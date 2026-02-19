import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withRlsBypass } from '@/lib/db/rls-context';
import { resolveRecipients } from './recipients';
import { renderTemplate } from './templates';
import { getEmailQueue } from './queue';

interface ProcessEventInput {
  tenantId: string;
  actorUserId: string;
  type: string;
  entityKind: string;
  entityId: string;
  payload: Record<string, unknown>;
  sourceEventId: string;
}

export interface ProcessEventResult {
  count: number;
  recipientIds: string[];
  emailDeliveryIds: string[];
}

/**
 * Process a single outbox event:
 * 1. Resolve recipients (with actor exclusion).
 * 2. Check notification preferences per channel (in_app / email).
 * 3. Create Notification rows (in-app inbox).
 * 4. Create NotificationDelivery rows for email channel.
 * 5. Return recipient IDs for SSE broadcasting.
 */
export async function processEvent(input: ProcessEventInput): Promise<ProcessEventResult> {
  const { tenantId, actorUserId, type, entityKind, entityId, payload, sourceEventId } = input;

  const recipientIds = await resolveRecipients(type, {
    tenantId,
    actorUserId,
    entityKind,
    entityId,
    payload,
  });

  if (recipientIds.length === 0) return { count: 0, recipientIds: [], emailDeliveryIds: [] };

  // Load all preferences for these recipients and this type in one query
  const prefs = await withRlsBypass(() =>
    prisma.notificationPreference.findMany({
      where: {
        tenantId,
        userId: { in: recipientIds },
        notificationType: { in: [type, '*'] },
      },
      select: { userId: true, notificationType: true, inAppEnabled: true, emailEnabled: true },
    })
  );

  // Build per-user preference maps — specific type overrides "*"
  const inAppDisabled = new Set<string>();
  const emailEnabled = new Set<string>();

  for (const uid of recipientIds) {
    const specific = prefs.find((p) => p.userId === uid && p.notificationType === type);
    const global = prefs.find((p) => p.userId === uid && p.notificationType === '*');
    const pref = specific ?? global;

    if (pref) {
      if (!pref.inAppEnabled) inAppDisabled.add(uid);
      if (pref.emailEnabled) emailEnabled.add(uid);
    }
    // Default: in-app enabled, email disabled (users must opt-in to email)
  }

  const inAppRecipients = recipientIds.filter((uid) => !inAppDisabled.has(uid));
  const emailRecipients = recipientIds.filter((uid) => emailEnabled.has(uid));

  // ─── In-app notifications ────────────────────────────────────────────────
  const { title: inAppTitle, body: inAppBody } = renderTemplate(type, 'in_app', payload);

  const notificationData = { entityKind, entityId, actorUserId, ...payload };

  let createdCount = 0;
  const createdNotificationIds: string[] = [];

  if (inAppRecipients.length > 0) {
    const rows = inAppRecipients.map((userId) => ({
      tenantId,
      userId,
      type,
      title: inAppTitle,
      body: inAppBody,
      data: notificationData,
      sourceEventId,
    }));

    await withRlsBypass(async () => {
      try {
        const result = await prisma.notification.createMany({
          data: rows,
          skipDuplicates: true,
        });
        createdCount = result.count;
      } catch (err: unknown) {
        // P2002: unique constraint fallback when skipDuplicates doesn't catch composite key
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          createdCount = 0;
          return;
        }
        throw err;
      }
    });

    // Fetch created notification ids for delivery linking
    if (createdCount > 0) {
      const created = await withRlsBypass(() =>
        prisma.notification.findMany({
          where: {
            tenantId,
            userId: { in: inAppRecipients },
            sourceEventId,
          },
          select: { id: true, userId: true },
        })
      );
      createdNotificationIds.push(...created.map((n) => n.id));
    }
  }

  // ─── Email deliveries ────────────────────────────────────────────────────
  const emailDeliveryIds: string[] = [];

  if (emailRecipients.length > 0 && createdNotificationIds.length > 0) {
    const { title: emailSubject } = renderTemplate(type, 'email', payload);

    // Map userId → notificationId for delivery link
    const notifByUser = await withRlsBypass(() =>
      prisma.notification.findMany({
        where: { tenantId, userId: { in: emailRecipients }, sourceEventId },
        select: { id: true, userId: true },
      })
    );
    const notifMap = new Map(notifByUser.map((n) => [n.userId, n.id]));

    const deliveryRows = emailRecipients
      .map((userId) => {
        const notificationId = notifMap.get(userId);
        if (!notificationId) return null;
        return {
          tenantId,
          notificationId,
          userId,
          channel: 'email',
          status: 'PENDING' as const,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (deliveryRows.length > 0) {
      await withRlsBypass(async () => {
        // Create deliveries — ignore if already exist (idempotency)
        for (const row of deliveryRows) {
          try {
            const delivery = await prisma.notificationDelivery.create({
              data: row,
              select: { id: true },
            });
            emailDeliveryIds.push(delivery.id);
          } catch (err: unknown) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
              continue;
            }
            throw err;
          }
        }
      });

      // Enqueue email delivery jobs
      if (emailDeliveryIds.length > 0) {
        const emailQueue = getEmailQueue();
        await Promise.all(
          emailDeliveryIds.map((deliveryId) =>
            emailQueue.add(
              'send-email',
              { deliveryId, tenantId, type, subject: emailSubject, payload },
              { jobId: `email:${deliveryId}`, attempts: 3 }
            )
          )
        );
      }
    }
  }

  return {
    count: createdCount,
    recipientIds: inAppRecipients,
    emailDeliveryIds,
  };
}

/**
 * List notifications for a user with cursor-based pagination.
 */
export async function listNotifications(
  tenantId: string,
  userId: string,
  opts: {
    cursor?: string;
    limit?: number;
    unreadOnly?: boolean;
    types?: string[];
  }
) {
  const { cursor, limit = 20, unreadOnly = false, types } = opts;

  const where: Prisma.NotificationWhereInput = {
    tenantId,
    userId,
    archivedAt: null,
    ...(unreadOnly && { readAt: null }),
    ...(types && types.length > 0 && { type: { in: types } }),
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return { items, nextCursor, hasMore };
}

/** Get unread notification count. */
export async function getUnreadCount(tenantId: string, userId: string): Promise<number> {
  return prisma.notification.count({
    where: { tenantId, userId, readAt: null, archivedAt: null },
  });
}

/** Mark a single notification as read. */
export async function markAsRead(tenantId: string, userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, tenantId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Mark all unread notifications as read for a user. */
export async function markAllAsRead(tenantId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { tenantId, userId, readAt: null, archivedAt: null },
    data: { readAt: new Date() },
  });
}

/** Archive a single notification. */
export async function archiveNotification(
  tenantId: string,
  userId: string,
  notificationId: string
) {
  return prisma.notification.updateMany({
    where: { id: notificationId, tenantId, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
}

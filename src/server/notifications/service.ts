import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withRlsBypass } from '@/lib/db/rls-context';
import { resolveRecipients } from './recipients';
import { renderTemplate } from './templates';

interface ProcessEventInput {
  tenantId: string;
  actorUserId: string;
  type: string;
  entityKind: string;
  entityId: string;
  payload: Record<string, unknown>;
  sourceEventId: string;
}

interface ProcessEventResult {
  count: number;
  recipientIds: string[];
}

/**
 * Process a single outbox event: resolve recipients, check preferences,
 * render templates, and create notification rows.
 */
export async function processEvent(input: ProcessEventInput): Promise<ProcessEventResult> {
  const {
    tenantId,
    actorUserId,
    type,
    entityKind,
    entityId,
    payload,
    sourceEventId,
  } = input;

  const recipientIds = await resolveRecipients(type, {
    tenantId,
    actorUserId,
    entityKind,
    entityId,
    payload,
  });

  if (recipientIds.length === 0) return { count: 0, recipientIds: [] };

  const disabledPrefs = await withRlsBypass(() =>
    prisma.notificationPreference.findMany({
      where: {
        tenantId,
        userId: { in: recipientIds },
        notificationType: { in: [type, '*'] },
        enabled: false,
      },
      select: { userId: true },
    })
  );
  const disabledUserIds = new Set(disabledPrefs.map((p) => p.userId));
  const activeRecipients = recipientIds.filter(
    (uid) => !disabledUserIds.has(uid)
  );

  if (activeRecipients.length === 0) return { count: 0, recipientIds: [] };

  const { title, body } = renderTemplate(type, payload);

  const notificationData = {
    entityKind,
    entityId,
    actorUserId,
    ...payload,
  };

  const rows = activeRecipients.map((userId) => ({
    tenantId,
    userId,
    type,
    title,
    body,
    data: notificationData,
    sourceEventId,
  }));

  let created = 0;

  await withRlsBypass(async () => {
    try {
      const result = await prisma.notification.createMany({
        data: rows,
        skipDuplicates: true,
      });
      created = result.count;
    } catch (err: unknown) {
      // P2002: unique constraint violation not caught by skipDuplicates (composite key)
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        created = 0;
        return;
      }
      throw err;
    }
  });

  return { count: created, recipientIds: activeRecipients };
}

/**
 * List notifications for a user with cursor-based pagination.
 */
export async function listNotifications(
  tenantId: string,
  userId: string,
  opts: { cursor?: string; limit?: number; unreadOnly?: boolean }
) {
  const { cursor, limit = 20, unreadOnly = false } = opts;

  const where = {
    tenantId,
    userId,
    archivedAt: null,
    ...(unreadOnly && { readAt: null }),
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return { items, nextCursor, hasMore };
}

/**
 * Get unread notification count.
 */
export async function getUnreadCount(
  tenantId: string,
  userId: string
): Promise<number> {
  return prisma.notification.count({
    where: { tenantId, userId, readAt: null, archivedAt: null },
  });
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  tenantId: string,
  userId: string,
  notificationId: string
) {
  return prisma.notification.updateMany({
    where: { id: notificationId, tenantId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllAsRead(tenantId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { tenantId, userId, readAt: null, archivedAt: null },
    data: { readAt: new Date() },
  });
}

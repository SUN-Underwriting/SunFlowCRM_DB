import type { PrismaClient } from '@prisma/client';
import { publishOutboxEvent } from './outbox';
import { enqueueOutboxJob } from './queue';
import { NotificationEventType, SYSTEM_ACTOR } from './types';

// PrismaClient structurally satisfies Pick<PrismaClient, 'outboxEvent'>.
type OutboxClient = Parameters<typeof publishOutboxEvent>[0];

/**
 * Activity Reminder Scheduler Job
 *
 * Runs every 5 minutes via BullMQ repeatable job.
 *
 * DUE_SOON  fires when now >= activity.remindAt  (default: dueAt − 1 hour)
 * OVERDUE   fires once when now > activity.dueAt and activity is not done
 *
 * Atomicity guarantee (fix #1):
 *   Each activity is claimed AND its outbox event is written in a SINGLE
 *   Prisma transaction. If the process crashes between two activities the
 *   already-processed ones remain committed; the rest will be picked up on
 *   the next scheduler tick (their notified-at flag is still null).
 *
 * Deduplication (fix #2):
 *   sourceEventId includes the remindAt/dueAt timestamp. After a reschedule
 *   the service resets dueSoonNotifiedAt and updates remindAt, so a fresh
 *   reminder fires and its sourceEventId is different — no unique-constraint
 *   conflict in OutboxEvent.
 *
 * Actor: SYSTEM_ACTOR — bypasses actor-exclusion so the assignee always
 *   receives the reminder even if they set the activity themselves.
 */
export async function runActivityReminderJob(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  await Promise.all([
    processDueSoon(prisma, now),
    processOverdue(prisma, now),
  ]);
}

// ---------------------------------------------------------------------------
// DUE SOON — fires when remindAt has been reached (remindAt = dueAt − 1h by default)
// ---------------------------------------------------------------------------
async function processDueSoon(prisma: PrismaClient, now: Date): Promise<void> {
  // First read the candidates (no lock yet)
  const candidates = await prisma.activity.findMany({
    where: {
      deleted: false,
      done: false,
      remindAt: { lte: now },
      dueSoonNotifiedAt: null,
    },
    select: {
      id: true,
      tenantId: true,
      ownerId: true,
      subject: true,
      type: true,
      dueAt: true,
      remindAt: true,
      dealId: true,
      leadId: true,
      deal: { select: { title: true } },
      lead: { select: { title: true } },
    },
  });

  if (candidates.length === 0) return;

  let notified = 0;

  for (const activity of candidates) {
    // Deterministic key: includes remindAt so it changes when the activity is
    // rescheduled (remindAt is reset to the new dueAt − 1h).
    const remindKey = (activity.remindAt ?? activity.dueAt)?.getTime() ?? 0;
    const sourceEventId = `crm.activity.due_soon:${activity.id}:${remindKey}`;

    // Claim + outbox write in a single transaction — crash-safe.
    const outboxId = await prisma.$transaction(async (tx) => {
      // Atomic claim: if another worker already claimed this, count === 0 → skip
      const claim = await tx.activity.updateMany({
        where: { id: activity.id, dueSoonNotifiedAt: null },
        data: { dueSoonNotifiedAt: now },
      });
      if (claim.count === 0) return null;

      return publishOutboxEvent(tx as OutboxClient, {
        tenantId: activity.tenantId,
        actorUserId: SYSTEM_ACTOR,
        type: NotificationEventType.ACTIVITY_DUE_SOON,
        entityKind: 'activity',
        entityId: activity.id,
        payload: {
          assigneeId: activity.ownerId,
          ownerId: activity.ownerId,
          activitySubject: activity.subject,
          activityType: activity.type,
          dueAt: formatDueAt(activity.dueAt),
          entityName: buildEntityName(activity.deal?.title, activity.lead?.title),
          dealId: activity.dealId,
          leadId: activity.leadId,
        },
        sourceEventId,
      });
    });

    if (outboxId) {
      enqueueOutboxJob(outboxId);
      notified++;
    }
  }

  if (notified > 0) {
    console.log(`[Reminder] DUE_SOON: notified for ${notified}/${candidates.length} activities`);
  }
}

// ---------------------------------------------------------------------------
// OVERDUE — fires once when dueAt has passed and the activity is still open
// ---------------------------------------------------------------------------
async function processOverdue(prisma: PrismaClient, now: Date): Promise<void> {
  const candidates = await prisma.activity.findMany({
    where: {
      deleted: false,
      done: false,
      dueAt: { lt: now },
      overdueNotifiedAt: null,
    },
    select: {
      id: true,
      tenantId: true,
      ownerId: true,
      subject: true,
      type: true,
      dueAt: true,
      dealId: true,
      leadId: true,
      deal: { select: { title: true } },
      lead: { select: { title: true } },
    },
  });

  if (candidates.length === 0) return;

  let notified = 0;

  for (const activity of candidates) {
    const daysOverdue = activity.dueAt
      ? Math.floor((now.getTime() - activity.dueAt.getTime()) / 86_400_000)
      : 0;

    // sourceEventId includes dueAt so rescheduled overdue events produce a new key
    const dueKey = activity.dueAt?.getTime() ?? 0;
    const sourceEventId = `crm.activity.overdue:${activity.id}:${dueKey}`;

    const outboxId = await prisma.$transaction(async (tx) => {
      const claim = await tx.activity.updateMany({
        where: { id: activity.id, overdueNotifiedAt: null },
        data: { overdueNotifiedAt: now },
      });
      if (claim.count === 0) return null;

      return publishOutboxEvent(tx as OutboxClient, {
        tenantId: activity.tenantId,
        actorUserId: SYSTEM_ACTOR,
        type: NotificationEventType.ACTIVITY_OVERDUE,
        entityKind: 'activity',
        entityId: activity.id,
        payload: {
          assigneeId: activity.ownerId,
          ownerId: activity.ownerId,
          activitySubject: activity.subject,
          activityType: activity.type,
          dueAt: formatDueAt(activity.dueAt),
          daysOverdue: daysOverdue > 0 ? daysOverdue : '<1',
          entityName: buildEntityName(activity.deal?.title, activity.lead?.title),
          dealId: activity.dealId,
          leadId: activity.leadId,
        },
        sourceEventId,
      });
    });

    if (outboxId) {
      enqueueOutboxJob(outboxId);
      notified++;
    }
  }

  if (notified > 0) {
    console.log(`[Reminder] OVERDUE: notified for ${notified}/${candidates.length} activities`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEntityName(dealTitle?: string | null, leadTitle?: string | null): string {
  if (dealTitle) return ` on "${dealTitle}"`;
  if (leadTitle) return ` on "${leadTitle}"`;
  return '';
}

function formatDueAt(dueAt: Date | null): string {
  if (!dueAt) return '';
  return dueAt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

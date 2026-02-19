import { prisma } from '@/lib/db/prisma';
import { NotificationEventType, SYSTEM_ACTOR } from './types';

interface RecipientContext {
  tenantId: string;
  actorUserId: string;
  entityKind: string;
  entityId: string;
  payload: Record<string, unknown>;
}

/**
 * Resolve recipient userIds for a given event type.
 *
 * Actor exclusion: the user who triggered the event does NOT receive
 * a notification about their own action — UNLESS the actor is SYSTEM_ACTOR
 * (background scheduler). Reminders must always reach the real recipient
 * even when they set the activity themselves.
 */
export async function resolveRecipients(
  type: string,
  ctx: RecipientContext
): Promise<string[]> {
  const raw = await resolveRaw(type, ctx);
  const unique = [...new Set(raw)];
  if (ctx.actorUserId === SYSTEM_ACTOR) return unique;
  return unique.filter((uid) => uid !== ctx.actorUserId);
}

async function resolveRaw(
  type: string,
  ctx: RecipientContext
): Promise<string[]> {
  const { tenantId, entityKind, entityId, payload } = ctx;

  switch (type) {
    case NotificationEventType.ACTIVITY_ASSIGNED:
    case NotificationEventType.ACTIVITY_DUE_SOON:
    case NotificationEventType.ACTIVITY_RESCHEDULED: {
      const assigneeId = (payload.assigneeId ?? payload.ownerId) as
        | string
        | undefined;
      return assigneeId ? [assigneeId] : [];
    }

    case NotificationEventType.ACTIVITY_OVERDUE: {
      const ids: string[] = [];
      const assignee = (payload.assigneeId ?? payload.ownerId) as
        | string
        | undefined;
      if (assignee) ids.push(assignee);
      const parentOwnerId = await getParentEntityOwner(
        tenantId,
        payload.dealId as string | undefined,
        payload.leadId as string | undefined
      );
      if (parentOwnerId) ids.push(parentOwnerId);
      return ids;
    }

    case NotificationEventType.DEAL_STAGE_CHANGED:
    case NotificationEventType.DEAL_ROTTEN: {
      const ownerIds = await getDealOwnerIds(tenantId, entityId);
      const watcherIds = await getWatcherIds(tenantId, 'deal', entityId);
      return [...ownerIds, ...watcherIds];
    }

    case NotificationEventType.DEAL_WON:
    case NotificationEventType.DEAL_LOST: {
      const ownerIds = await getDealOwnerIds(tenantId, entityId);
      const watcherIds = await getWatcherIds(tenantId, 'deal', entityId);
      return [...ownerIds, ...watcherIds];
    }

    case NotificationEventType.LEAD_ASSIGNED: {
      const assigneeId = payload.assigneeId as string | undefined;
      return assigneeId ? [assigneeId] : [];
    }

    case NotificationEventType.LEAD_CONVERTED: {
      const lead = await prisma.lead.findUnique({
        where: { id: entityId },
        select: { ownerId: true },
      });
      const watcherIds = await getWatcherIds(tenantId, 'lead', entityId);
      return lead ? [lead.ownerId, ...watcherIds] : watcherIds;
    }

    case NotificationEventType.COMMENT_CREATED:
    case NotificationEventType.MENTION_CREATED: {
      const mentionedIds = (payload.mentionedUserIds ?? []) as string[];
      if (type === NotificationEventType.MENTION_CREATED) {
        return mentionedIds;
      }
      const ownerIds = await getEntityOwnerIds(tenantId, entityKind, entityId);
      const watcherIds = await getWatcherIds(tenantId, entityKind, entityId);
      return [...ownerIds, ...watcherIds];
    }

    default:
      return [];
  }
}

async function getDealOwnerIds(
  tenantId: string,
  dealId: string
): Promise<string[]> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId, deleted: false },
    select: { ownerId: true },
  });
  return deal ? [deal.ownerId] : [];
}

async function getEntityOwnerIds(
  tenantId: string,
  entityKind: string,
  entityId: string
): Promise<string[]> {
  if (entityKind === 'deal') return getDealOwnerIds(tenantId, entityId);
  if (entityKind === 'lead') {
    const lead = await prisma.lead.findFirst({
      where: { id: entityId, tenantId, deleted: false },
      select: { ownerId: true },
    });
    return lead ? [lead.ownerId] : [];
  }
  return [];
}

async function getParentEntityOwner(
  tenantId: string,
  dealId?: string,
  leadId?: string
): Promise<string | null> {
  if (dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId, deleted: false },
      select: { ownerId: true },
    });
    return deal?.ownerId ?? null;
  }
  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deleted: false },
      select: { ownerId: true },
    });
    return lead?.ownerId ?? null;
  }
  return null;
}

async function getWatcherIds(
  tenantId: string,
  entityKind: string,
  entityId: string
): Promise<string[]> {
  const watchers = await prisma.entityWatcher.findMany({
    where: { tenantId, entityKind, entityId },
    select: { userId: true },
  });
  return watchers.map((w) => w.userId);
}

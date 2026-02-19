/**
 * Sentinel value used as actorUserId for system-triggered events
 * (schedulers, background jobs). Excluded from actor-exclusion filtering
 * so that the real recipient (e.g. activity owner) still gets the notification.
 */
export const SYSTEM_ACTOR = 'system' as const;

export const NotificationEventType = {
  ACTIVITY_ASSIGNED: 'crm.activity.assigned',
  ACTIVITY_DUE_SOON: 'crm.activity.due_soon',
  ACTIVITY_OVERDUE: 'crm.activity.overdue',
  ACTIVITY_RESCHEDULED: 'crm.activity.rescheduled',
  DEAL_STAGE_CHANGED: 'crm.deal.stage_changed',
  DEAL_WON: 'crm.deal.won',
  DEAL_LOST: 'crm.deal.lost',
  DEAL_ROTTEN: 'crm.deal.rotten',
  LEAD_ASSIGNED: 'crm.lead.assigned',
  LEAD_CONVERTED: 'crm.lead.converted',
  COMMENT_CREATED: 'crm.comment.created',
  MENTION_CREATED: 'crm.mention.created',
} as const;

export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType];

export interface OutboxEventInput {
  tenantId: string;
  /** Use SYSTEM_ACTOR for background/scheduler-triggered events. */
  actorUserId: string;
  type: NotificationEventType;
  entityKind: string;
  entityId: string;
  payload: Record<string, unknown>;
  sourceEventId?: string;
}

export interface NotificationPayload {
  actorName?: string;
  activitySubject?: string;
  dealTitle?: string;
  leadTitle?: string;
  stageName?: string;
  dueAt?: string;
  entityKind?: string;
  entityId?: string;
  [key: string]: unknown;
}

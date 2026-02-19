/**
 * Public notification event API — inspired by Novu's trigger() pattern.
 *
 * This is the single entry point for publishing notification events from
 * business logic (CRM services, background jobs, etc.).
 *
 * Callers MUST pass an active Prisma transaction client so the outbox write
 * is atomic with the CRM write that triggered the event. This prevents the
 * classic "event published but DB rolled back" split-brain scenario.
 *
 * @example
 *   await prisma.$transaction(async (tx) => {
 *     await tx.activity.update({ ... });
 *     await publishNotificationEvent(tx, {
 *       tenantId,
 *       actorUserId: userId,
 *       type: 'crm.activity.assigned',
 *       entity: { kind: 'activity', id: activityId },
 *       payload: { assigneeId, activitySubject: subject },
 *       sourceEventId: `crm.activity.assigned:${activityId}:${Date.now()}`,
 *     });
 *   });
 *   enqueueOutboxJob(outboxId); // after tx commit
 */

import { publishOutboxEvent } from './outbox';
import type { NotificationEventType, SYSTEM_ACTOR } from './types';
import type { PrismaClient } from '@prisma/client';

/** All supported notification event names (Novu-inspired event registry). */
export type NotificationEventName = NotificationEventType;

export interface PublishEventInput {
  tenantId: string;
  /**
   * User who triggered the event.
   * Use SYSTEM_ACTOR constant for scheduler/background-triggered events
   * to bypass actor-exclusion filtering.
   */
  actorUserId: string | typeof SYSTEM_ACTOR;
  type: NotificationEventName;
  /** CRM entity that the notification relates to (for deep-link navigation). */
  entity: {
    kind: 'activity' | 'deal' | 'lead' | 'comment';
    id: string;
  };
  /** Arbitrary payload used to render notification templates. */
  payload: Record<string, unknown>;
  /**
   * Stable, deterministic ID for this event occurrence.
   * Used for idempotency: duplicate sourceEventId for the same tenantId is ignored.
   * Format suggestion: `{eventType}:{entityId}:{context}` e.g.
   *   `crm.activity.assigned:act_123:reassign:1234567890`
   */
  sourceEventId: string;
}

/**
 * Publish a notification event to the outbox within an active transaction.
 *
 * This function MUST be called inside `prisma.$transaction()` to guarantee
 * the outbox write is atomic with the triggering business write.
 *
 * Returns the created OutboxEvent id. Use it with `enqueueOutboxJob(id)`
 * AFTER the transaction commits to trigger async processing.
 */
export async function publishNotificationEvent(
  tx: Pick<PrismaClient, 'outboxEvent'>,
  input: PublishEventInput
): Promise<string> {
  return publishOutboxEvent(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    type: input.type,
    entityKind: input.entity.kind,
    entityId: input.entity.id,
    payload: input.payload,
    sourceEventId: input.sourceEventId,
  });
}

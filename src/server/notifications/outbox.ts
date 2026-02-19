import type { PrismaClient } from '@prisma/client';
import { NotificationEventType, type OutboxEventInput } from './types';

/**
 * Minimal structural type for the Prisma transaction client.
 * Using a duck-type interface allows this function to accept both
 * the real transaction client and any compatible test double.
 */
type TxClient = Pick<PrismaClient, 'outboxEvent'>;

/**
 * Create a deterministic sourceEventId from action context.
 * Format: `{type}:{entityId}:{uniqueSuffix}`
 */
function makeSourceEventId(
  type: string,
  entityId: string,
  suffix?: string
): string {
  return suffix ? `${type}:${entityId}:${suffix}` : `${type}:${entityId}`;
}

/**
 * Write an outbox event INSIDE an existing Prisma transaction.
 * The caller must pass the transaction client (`tx`) to ensure atomicity
 * with the business write.
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   const activity = await tx.activity.update(...);
 *   await publishOutboxEvent(tx, { ... });
 * });
 */
export async function publishOutboxEvent(tx: TxClient, input: OutboxEventInput): Promise<string> {
  const sourceEventId =
    input.sourceEventId ??
    makeSourceEventId(input.type, input.entityId, Date.now().toString());

  const event = await tx.outboxEvent.create({
    data: {
      tenantId: input.tenantId,
      sourceEventId,
      type: input.type,
      actorUserId: input.actorUserId,
      entityKind: input.entityKind,
      entityId: input.entityId,
      payload: input.payload,
    },
    select: { id: true },
  });

  return event.id;
}

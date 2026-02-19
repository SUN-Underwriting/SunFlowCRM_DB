import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const parsed = new URL(REDIS_URL);

export const redisConnection = {
  host: parsed.hostname,
  port: Number(parsed.port) || 6379,
  ...(parsed.password && { password: parsed.password }),
};

export const QUEUE_NAME = 'notifications';

let _queue: Queue | null = null;

export function getNotificationsQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return _queue;
}

/**
 * Enqueue a job to process an outbox event.
 * Fire-and-forget: call this AFTER the DB transaction commits.
 */
export async function enqueueOutboxJob(outboxEventId: string) {
  try {
    const queue = getNotificationsQueue();
    await queue.add(
      'process-outbox',
      { outboxEventId },
      {
        deduplication: { id: outboxEventId },
      }
    );
  } catch (err) {
    console.error('[Notifications] Failed to enqueue outbox job:', err);
  }
}

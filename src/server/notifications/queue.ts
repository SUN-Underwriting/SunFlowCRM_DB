import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const parsed = new URL(REDIS_URL);

export const redisConnection = {
  host: parsed.hostname,
  port: Number(parsed.port) || 6379,
  ...(parsed.password && { password: parsed.password })
};

export const QUEUE_NAME = 'notifications';
export const EMAIL_QUEUE_NAME = 'email-delivery';
export const UW_EMAIL_QUEUE_NAME = 'underwriting-email';

let _queue: Queue | null = null;
let _emailQueue: Queue | null = null;
let _uwEmailQueue: Queue | null = null;

export function getNotificationsQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 }
      }
    });
  }
  return _queue;
}

export function getEmailQueue(): Queue {
  if (!_emailQueue) {
    _emailQueue = new Queue(EMAIL_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 2000 }
      }
    });
  }
  return _emailQueue;
}

export function getUnderwritingEmailQueue(): Queue {
  if (!_uwEmailQueue) {
    _uwEmailQueue = new Queue(UW_EMAIL_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 2000 }
      }
    });
  }
  return _uwEmailQueue;
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
        deduplication: { id: outboxEventId }
      }
    );
  } catch (err) {
    console.error('[Notifications] Failed to enqueue outbox job:', err);
  }
}

interface EnqueueUwSlipEmailInput {
  tenantId: string;
  submissionId?: string;
  to: string;
  subject: string;
  text: string;
  filename?: string;
  contentBase64?: string;
  dedupeKey: string;
}

function toBullMqJobId(value: string): string {
  // BullMQ custom job id cannot contain ":".
  return value.replace(/[:\s/\\]+/g, '_');
}

export async function enqueueUnderwritingSlipEmailJob(
  input: EnqueueUwSlipEmailInput
) {
  try {
    const queue = getUnderwritingEmailQueue();
    await queue.add('send-underwriting-slip', input, {
      jobId: toBullMqJobId(input.dedupeKey)
    });
  } catch (err) {
    console.error('[Notifications] Failed to enqueue underwriting email:', err);
  }
}

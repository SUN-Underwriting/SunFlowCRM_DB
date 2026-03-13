import 'dotenv/config';
import { Worker, Queue, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { processEvent } from '@/server/notifications/service';
import {
  redisConnection,
  QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  UW_EMAIL_QUEUE_NAME,
  USER_INVITE_EMAIL_QUEUE_NAME
} from '@/server/notifications/queue';
import { runActivityReminderJob } from '@/server/notifications/activity-reminder-job';
import { runUnderwritingRenewalJob } from '@/server/notifications/underwriting-renewal-job';
import { emailService } from '@/server/notifications/email-service';
import { renderTemplate } from '@/server/notifications/templates';

const REMINDER_QUEUE_NAME = 'activity-reminders';
const REMINDER_JOB_NAME = 'scan-due-activities';
/** Run reminder scan every 5 minutes */
const REMINDER_INTERVAL_MS = 5 * 60 * 1000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let isShuttingDown = false;
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface OutboxJobData {
  outboxEventId: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[Worker] Missing required environment variable: ${name}`);
  }
  return value;
}

const worker = new Worker<OutboxJobData>(
  QUEUE_NAME,
  async (job: Job<OutboxJobData>) => {
    const { outboxEventId } = job.data;

    // Atomic claim: only one worker can transition PENDING -> PROCESSING
    const claim = await prisma.outboxEvent.updateMany({
      where: { id: outboxEventId, status: 'PENDING' },
      data: { status: 'PROCESSING', lockedAt: new Date() }
    });

    if (claim.count === 0) {
      const current = await prisma.outboxEvent.findUnique({
        where: { id: outboxEventId },
        select: { status: true }
      });
      if (!current) {
        console.warn(
          `[Worker] Outbox event ${outboxEventId} not found, skipping`
        );
      }
      return;
    }

    const event = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId }
    });

    if (!event) {
      console.warn(
        `[Worker] Outbox event ${outboxEventId} disappeared after claim`
      );
      return;
    }

    if (event.status !== 'PROCESSING') {
      return;
    }

    await prisma.outboxEvent.update({
      where: { id: outboxEventId },
      data: { lockedAt: new Date() }
    });

    try {
      const result = await processEvent({
        tenantId: event.tenantId,
        actorUserId: event.actorUserId ?? '',
        type: event.type,
        entityKind: event.entityKind ?? '',
        entityId: event.entityId ?? '',
        payload: (event.payload ?? {}) as Record<string, unknown>,
        sourceEventId: event.sourceEventId
      });

      await prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: { status: 'PROCESSED', processedAt: new Date(), lockedAt: null }
      });

      // Push SSE events to connected clients via internal endpoint
      if (result.count > 0 && result.recipientIds.length > 0) {
        await pushSseEvent(event.tenantId, result.recipientIds, {
          type: 'notification.new',
          data: {
            eventType: event.type,
            entityKind: event.entityKind,
            entityId: event.entityId
          }
        });
      }

      console.log(
        `[Worker] Processed event ${outboxEventId} (${event.type}): ${result.count} notifications created`
      );
    } catch (err) {
      const attempt = (event.attempts ?? 0) + 1;
      const isFinal = attempt >= (event.maxAttempts ?? 5);

      await prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: {
          status: isFinal ? 'FAILED' : 'PENDING',
          attempts: attempt,
          lastError: err instanceof Error ? err.message : String(err),
          lockedAt: null
        }
      });

      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

// ---------------------------------------------------------------------------
// Activity Reminder Scheduler
// Uses a separate BullMQ queue with a repeatable job so the scan runs
// every 5 minutes independently of the outbox processor above.
// ---------------------------------------------------------------------------

const reminderQueue = new Queue(REMINDER_QUEUE_NAME, {
  connection: redisConnection
});

const reminderWorker = new Worker(
  REMINDER_QUEUE_NAME,
  async () => {
    await runActivityReminderJob(prisma);
    await runUnderwritingRenewalJob(prisma);
  },
  { connection: redisConnection, concurrency: 1 }
);

reminderWorker.on('completed', () => {
  console.log('[Reminder] Scan completed');
});

reminderWorker.on('failed', (_job, err) => {
  console.error('[Reminder] Scan failed:', err.message);
});

// ---------------------------------------------------------------------------
// Email Delivery Worker
// Processes email-delivery jobs created by the fanout in service.ts.
// ---------------------------------------------------------------------------

interface EmailJobData {
  deliveryId: string;
  tenantId: string;
  type: string;
  subject: string;
  payload: Record<string, unknown>;
}

interface UnderwritingSlipEmailJobData {
  tenantId: string;
  submissionId?: string;
  to: string;
  subject: string;
  text: string;
  filename?: string;
  contentBase64?: string;
  dedupeKey: string;
}

interface UserInviteEmailJobData {
  tenantId: string;
  userId: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  dedupeKey: string;
}

const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const { deliveryId, tenantId, type, payload } = job.data;

    // Atomic claim: PENDING → SENDING
    const claim = await prisma.notificationDelivery.updateMany({
      where: { id: deliveryId, status: 'PENDING', tenantId },
      data: { status: 'SENDING' }
    });

    if (claim.count === 0) {
      console.log(`[Email] Delivery ${deliveryId} already claimed, skipping`);
      return;
    }

    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } }
      }
    });

    if (!delivery) {
      console.warn(`[Email] Delivery ${deliveryId} not found after claim`);
      return;
    }

    const { title: subject, body: text } = renderTemplate(
      type,
      'email',
      payload
    );
    const toEmail = delivery.user.email;

    try {
      const result = await emailService.send({ to: toEmail, subject, text });

      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerMsgId: result.providerMsgId,
          attempts: { increment: 1 }
        }
      });

      console.log(`[Email] Sent delivery ${deliveryId} to ${toEmail}`);
    } catch (err) {
      const attempts = (delivery.attempts ?? 0) + 1;
      const maxAttempts = 3;

      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: attempts >= maxAttempts ? 'FAILED' : 'PENDING',
          attempts: { increment: 1 },
          lastError: err instanceof Error ? err.message : String(err)
        }
      });

      throw err;
    }
  },
  { connection: redisConnection, concurrency: 3 }
);

emailWorker.on('completed', (job) => {
  console.log(`[Email] Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Email] Job ${job?.id} failed:`, err.message);
});

const underwritingEmailWorker = new Worker<UnderwritingSlipEmailJobData>(
  UW_EMAIL_QUEUE_NAME,
  async (job: Job<UnderwritingSlipEmailJobData>) => {
    const { to, subject, text, filename, contentBase64 } = job.data;

    try {
      const attachments =
        contentBase64 && filename
          ? [
              {
                filename,
                contentType:
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                content: Buffer.from(contentBase64, 'base64')
              }
            ]
          : undefined;

      const result = await emailService.send({
        to,
        subject,
        text,
        attachments
      });

      console.log(
        `[UW Email] Sent slip to ${to} (job=${job.id}, providerMsgId=${result.providerMsgId ?? 'n/a'})`
      );
    } catch (err) {
      console.error(`[UW Email] Failed to send slip for job ${job.id}:`, err);
      throw err;
    }
  },
  { connection: redisConnection, concurrency: 2 }
);

underwritingEmailWorker.on('completed', (job) => {
  console.log(`[UW Email] Job ${job.id} completed`);
});

underwritingEmailWorker.on('failed', (job, err) => {
  console.error(`[UW Email] Job ${job?.id} failed:`, err.message);
});

const userInviteEmailWorker = new Worker<UserInviteEmailJobData>(
  USER_INVITE_EMAIL_QUEUE_NAME,
  async (job: Job<UserInviteEmailJobData>) => {
    const { to, subject, text, html } = job.data;

    try {
      const result = await emailService.send({
        to,
        subject,
        text,
        html
      });

      console.log(
        `[Invite Email] Sent invite to ${to} (job=${job.id}, providerMsgId=${result.providerMsgId ?? 'n/a'})`
      );
    } catch (err) {
      console.error(
        `[Invite Email] Failed to send invite for job ${job.id}:`,
        err
      );
      throw err;
    }
  },
  { connection: redisConnection, concurrency: 2 }
);

userInviteEmailWorker.on('completed', (job) => {
  console.log(`[Invite Email] Job ${job.id} completed`);
});

userInviteEmailWorker.on('failed', (job, err) => {
  console.error(`[Invite Email] Job ${job?.id} failed:`, err.message);
});

// Register the repeatable job using upsertJobScheduler (modern BullMQ API).
// Safe to call on every startup — upsert is idempotent, no duplicate schedules.
reminderQueue
  .upsertJobScheduler(
    REMINDER_JOB_NAME,
    { every: REMINDER_INTERVAL_MS },
    { name: REMINDER_JOB_NAME, data: {}, opts: {} }
  )
  .then(() => {
    console.log(
      `[Reminder] Job scheduler upserted (every ${REMINDER_INTERVAL_MS / 1000}s)`
    );
  })
  .catch((err) => {
    console.error('[Reminder] Failed to upsert job scheduler:', err);
  });

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const INTERNAL_SECRET = requireEnv('INTERNAL_WORKER_SECRET');

async function pushSseEvent(
  tenantId: string,
  userIds: string[],
  event: { type: string; data: Record<string, unknown> }
) {
  try {
    await fetch(`${FRONTEND_URL}/api/notifications/internal-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET
      },
      body: JSON.stringify({ tenantId, userIds, event })
    });
  } catch (err) {
    console.warn('[Worker] Failed to push SSE event:', err);
  }
}

console.log(
  `[Worker] Notifications worker started, listening on queue "${QUEUE_NAME}"`
);

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Worker] Received ${signal}, shutting down...`);

  // Force exit after 30s if jobs don't finish — prevents infinite hang
  const forceExit = setTimeout(() => {
    console.error('[Worker] Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30_000);

  try {
    await Promise.all([
      worker.close(),
      reminderWorker.close(),
      emailWorker.close(),
      underwritingEmailWorker.close(),
      userInviteEmailWorker.close(),
      reminderQueue.close()
    ]);
    await pool.end();
    clearTimeout(forceExit);
    console.log('[Worker] Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[Worker] Error during shutdown:', err);
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

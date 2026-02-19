import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { processEvent } from '@/server/notifications/service';
import { redisConnection, QUEUE_NAME } from '@/server/notifications/queue';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
      data: { status: 'PROCESSING', lockedAt: new Date() },
    });

    if (claim.count === 0) {
      const current = await prisma.outboxEvent.findUnique({
        where: { id: outboxEventId },
        select: { status: true },
      });
      if (!current) {
        console.warn(`[Worker] Outbox event ${outboxEventId} not found, skipping`);
      }
      return;
    }

    const event = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId },
    });

    if (!event) {
      console.warn(`[Worker] Outbox event ${outboxEventId} disappeared after claim`);
      return;
    }

    if (event.status !== 'PROCESSING') {
      return;
    }

    await prisma.outboxEvent.update({
      where: { id: outboxEventId },
      data: { lockedAt: new Date() },
    });

    try {
      const result = await processEvent({
        tenantId: event.tenantId,
        actorUserId: event.actorUserId ?? '',
        type: event.type,
        entityKind: event.entityKind ?? '',
        entityId: event.entityId ?? '',
        payload: (event.payload ?? {}) as Record<string, unknown>,
        sourceEventId: event.sourceEventId,
      });

      await prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: { status: 'PROCESSED', processedAt: new Date(), lockedAt: null },
      });

      // Push SSE events to connected clients via internal endpoint
      if (result.count > 0 && result.recipientIds.length > 0) {
        await pushSseEvent(event.tenantId, result.recipientIds, {
          type: 'notification.new',
          data: {
            eventType: event.type,
            entityKind: event.entityKind,
            entityId: event.entityId,
          },
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
          lockedAt: null,
        },
      });

      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
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
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ tenantId, userIds, event }),
    });
  } catch (err) {
    console.warn('[Worker] Failed to push SSE event:', err);
  }
}

console.log(`[Worker] Notifications worker started, listening on queue "${QUEUE_NAME}"`);

async function gracefulShutdown(signal: string) {
  console.log(`[Worker] Received ${signal}, shutting down...`);

  // Force exit after 30s if jobs don't finish — prevents infinite hang
  const forceExit = setTimeout(() => {
    console.error('[Worker] Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30_000);

  try {
    await worker.close();
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

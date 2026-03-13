#!/usr/bin/env tsx
/**
 * Check BullMQ queue status for all notification queues.
 *
 * Usage:
 *   npx tsx scripts/queue/check-queues.ts
 *   npx tsx scripts/queue/check-queues.ts --failed   # show failed job details
 *   npx tsx scripts/queue/check-queues.ts --clean     # remove all failed jobs
 */

import 'dotenv/config';
import { Queue, Worker } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const parsed = new URL(REDIS_URL);
const connection = {
  host: parsed.hostname,
  port: Number(parsed.port) || 6379,
  ...(parsed.password && { password: parsed.password })
};

const QUEUES = [
  'notifications',
  'email-delivery',
  'underwriting-email',
  'activity-reminders'
] as const;

const args = process.argv.slice(2);
const showFailed = args.includes('--failed');
const doClean = args.includes('--clean');
const retryPending = args.includes('--retry-pending');

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function col(text: string | number, color: string) {
  return `${color}${text}${c.reset}`;
}

function badge(n: number) {
  if (n === 0) return col(n, c.dim);
  if (n < 5) return col(n, c.yellow);
  return col(n, c.red);
}

async function main() {
  console.log(
    `\n${col('BullMQ Queue Status', c.bold + c.cyan)}  ${col(new Date().toLocaleString(), c.gray)}\n`
  );
  console.log(`${col('Redis:', c.dim)} ${REDIS_URL}\n`);

  const header = `${'Queue'.padEnd(22)} ${'Wait'.padStart(5)} ${'Active'.padStart(7)} ${'Delayed'.padStart(8)} ${'Done'.padStart(6)} ${'Failed'.padStart(7)}`;
  console.log(col(header, c.bold));
  console.log('─'.repeat(header.length));

  const queues: Queue[] = [];

  for (const name of QUEUES) {
    const q = new Queue(name, { connection });
    queues.push(q);

    const [waiting, active, delayed, completed, failed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getDelayedCount(),
      q.getCompletedCount(),
      q.getFailedCount()
    ]);

    const activeStr = active > 0 ? col(active, c.green) : col(active, c.dim);
    const line = [
      col(name.padEnd(22), c.bold),
      badge(waiting).padStart(5 + 9), // +9 for ANSI escape codes
      activeStr.padStart(7 + 9),
      badge(delayed).padStart(8 + 9),
      col(completed, c.dim).padStart(6 + 9),
      badge(failed).padStart(7 + 9)
    ].join(' ');

    console.log(line);

    if (showFailed && failed > 0) {
      const failedJobs = await q.getFailed(0, Math.min(failed - 1, 9));
      for (const job of failedJobs) {
        const reason = (job.failedReason ?? '').split('\n')[0].slice(0, 100);
        console.log(
          `  ${col('↳', c.red)} [${col(job.id ?? '?', c.yellow)}] ${col(job.name, c.bold)} — ${col(reason, c.dim)}`
        );
      }
      if (failed > 10) {
        console.log(`  ${col(`  … and ${failed - 10} more`, c.gray)}`);
      }
    }

    if (doClean && failed > 0) {
      await q.clean(0, failed, 'failed');
      console.log(
        `  ${col('✓ Cleaned', c.green)} ${failed} failed jobs from ${col(name, c.bold)}`
      );
    }
  }

  console.log('─'.repeat(header.length));

  // ─── Outbox status from DB ────────────────────────────────────────────────
  try {
    const { PrismaClient } = await import('@prisma/client');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { Pool } = await import('pg');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    const [pending, processing, failed, total] = await Promise.all([
      prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      prisma.outboxEvent.count({ where: { status: 'PROCESSING' } }),
      prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
      prisma.outboxEvent.count()
    ]);

    console.log(`\n${col('OutboxEvent table', c.bold)}`);
    console.log(`  Pending:    ${badge(pending)}`);
    console.log(`  Processing: ${badge(processing)}`);
    console.log(`  Failed:     ${badge(failed)}`);
    console.log(`  Total:      ${col(total, c.dim)}`);

    // --retry-pending: re-enqueue BullMQ jobs for orphaned PENDING outbox events
    if (retryPending && pending > 0) {
      const notifQueue = new Queue('notifications', { connection });
      const pendingEvents = await prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        select: { id: true, type: true },
        take: 100
      });
      let enqueued = 0;
      for (const ev of pendingEvents) {
        await notifQueue.add(
          'process-outbox',
          { outboxEventId: ev.id },
          { deduplication: { id: ev.id } }
        );
        enqueued++;
      }
      await notifQueue.close();
      console.log(
        `  ${col(`✓ Re-enqueued ${enqueued} pending outbox events`, c.green)}`
      );
    }

    const [delivPending, delivFailed, delivSent] = await Promise.all([
      prisma.notificationDelivery.count({ where: { status: 'PENDING' } }),
      prisma.notificationDelivery.count({ where: { status: 'FAILED' } }),
      prisma.notificationDelivery.count({ where: { status: 'SENT' } })
    ]);

    console.log(`\n${col('NotificationDelivery table', c.bold)}`);
    console.log(`  Pending:  ${badge(delivPending)}`);
    console.log(`  Failed:   ${badge(delivFailed)}`);
    console.log(`  Sent:     ${col(delivSent, c.green)}`);

    await prisma.$disconnect();
    await pool.end();
  } catch (err) {
    console.log(
      `\n${col('DB check skipped:', c.yellow)} ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ─── Upcoming reminder jobs ───────────────────────────────────────────────
  const reminderQueue = queues.find(
    (_, i) => QUEUES[i] === 'activity-reminders'
  );
  if (reminderQueue) {
    const delayed = await reminderQueue.getDelayed(0, 2);
    if (delayed.length > 0) {
      console.log(`\n${col('Next reminder scans', c.bold)}`);
      for (const job of delayed) {
        const runAt = job.opts.delay
          ? new Date(
              Date.now() +
                (job.opts.delay - (Date.now() - (job.timestamp ?? 0)))
            ).toLocaleTimeString()
          : 'soon';
        console.log(
          `  ${col('→', c.cyan)} ${job.name}  ${col('~' + runAt, c.gray)}`
        );
      }
    }
  }

  console.log();

  // Close all queues
  await Promise.all(queues.map((q) => q.close()));
  process.exit(0);
}

main().catch((err) => {
  console.error(col('Error:', c.red), err.message);
  process.exit(1);
});

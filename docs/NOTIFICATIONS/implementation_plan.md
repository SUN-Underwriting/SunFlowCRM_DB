# Notifications: implementation plan (CRM events)

## Goal

Implement reliable, multi-tenant notifications for CRM events (starting with Activities), with:

- **In-app notifications** stored in Postgres and shown in the UI.
- **Realtime updates** via SSE (Server-Sent Events) for a fast UX (fallback: polling).
- **Async processing** via a queue (BullMQ) to avoid slow API requests and enable retries.
- **Idempotency + deduplication** to prevent duplicates during retries.
- **Extensibility** for external channels later (email/push/Slack), digest, quiet hours, escalation.

This repo appears to be a monorepo:

- `api/`: NestJS backend (currently minimal bootstrap).
- Root app: Next.js + Prisma + Postgres schema (`prisma/schema.prisma`).

### Critical repo reality (affects v1 design)

Today, CRM write paths live in **Next.js Route Handlers** (e.g. `src/app/api/crm/...`). Therefore, v1 notifications must be implemented **where the writes happen** to keep this guarantee:

- business data + audit log + outbox event are written in the **same DB transaction**.

So this plan treats **Next.js as the v1 “owner”** of notifications (DB writes + outbox + SSE endpoint), and uses BullMQ workers as a separate Node process.

NestJS (`api/`) remains an optional **v2 consolidation** target (move CRM writes and notification processing to NestJS once ready).

## Constraints / non-goals (v1)

- **No external notification SaaS** (Courier/Knock/etc.).
- **No second primary database** (e.g., MongoDB). Postgres remains the source of truth.
- **No public sign-up** / auth changes in this phase.
- **v1 channels**: in-app only (+ realtime). Email/push are v2.

## Architecture (best practice)

### Event → Notification pipeline

1. A business action happens (e.g., activity assigned / due soon).
2. The action writes business data + **audit log** + **outbox event** in the *same DB transaction*.
3. A background worker reads outbox rows and enqueues jobs to the notifications queue.
4. Notifications processor:
   - resolves recipients (assignee/owner/watchers/roles),
   - applies preferences + quiet hours rules,
   - writes **`notifications`** rows (in-app),
   - (v2) schedules deliveries to external channels.
5. Realtime broadcaster emits SSE events to connected clients (per-tenant, per-user).

### Why Outbox

Outbox prevents “data committed but notification lost” and enables safe retries.

## Data model (Postgres via Prisma)

Add these tables/models (names can follow existing conventions):

- `outbox_events`
  - `id` (uuid/cuid), `tenantId`, `type`, `payload` (JSONB), `occurredAt`
  - `sourceEventId` (string, required) — stable event id for idempotency across retries
  - `status` (`PENDING`|`PROCESSING`|`PROCESSED`|`FAILED`)
  - `attempts`, `lockedAt`, `lastError`
  - unique: `(tenantId, sourceEventId)`
  - indexes: `(tenantId, status, occurredAt)`, `(type, status)`

- `notifications` (in-app)
  - `id`, `tenantId`, `userId`
  - `type` (e.g. `crm.activity.assigned`)
  - `title`, `body`
  - `data` (JSONB: entity refs, deep-link info)
  - `createdAt`, `readAt`, `archivedAt`
  - `severity` (optional)
  - `sourceEventId` (string, optional) — for event-based notifications
  - `dedupeKey` (string, optional) — for time-window notifications (due_soon, overdue)
  - unique: `(tenantId, userId, sourceEventId)` when `sourceEventId` is present
  - indexes: `(tenantId, userId, createdAt DESC)`, `(tenantId, userId, readAt)`

- `notification_preferences`
  - `tenantId`, `userId`, `notificationType`
  - `enabled` (bool)
  - v2: channel config, digest mode, quiet hours
  - unique: `(tenantId, userId, notificationType)`

Optional for v2:

- `notification_deliveries` (email/push/etc.) with status + provider message id + retries.

## Recipient resolution rules

Each event type must have a clear rule for who receives the notification.

| Event type | Recipients | Notes |
|---|---|---|
| `crm.activity.assigned` | assignee | |
| `crm.activity.due_soon` | assignee | |
| `crm.activity.overdue` | assignee + deal/lead owner | v2: escalate to manager |
| `crm.deal.stage_changed` | deal owner + watchers | |
| `crm.deal.won` / `crm.deal.lost` | deal owner + team manager + watchers | |
| `crm.deal.rotten` | deal owner + manager | |
| `crm.lead.assigned` | assignee | |
| `crm.lead.converted` | lead owner + watchers | |
| `crm.comment.created` | entity owner + watchers | |
| `crm.mention.created` | mentioned user(s) | |

**Critical rule: Actor exclusion.** The user who triggered the action MUST NOT receive a notification about it (e.g., if you assign an activity to yourself, no notification).

### Entity watchers (followers)

To support "watchers" a lightweight join table is needed:

- `entity_watchers`
  - `tenantId`, `entityKind` (deal/lead/org), `entityId`, `userId`
  - unique: `(tenantId, entityKind, entityId, userId)`

Users can follow/unfollow entities. All event resolvers check this table when the rule says "+ watchers".

## Notification templates

Notification text should not be hardcoded in processors. Use a simple template registry:

- Template per `(notificationType, channel, locale)`.
- v1: templates as TypeScript objects (map of type → `{ title: string, body: string }` with `{{variable}}` placeholders).
- v2: move to DB-backed templates with admin UI; add i18n (user locale from profile).

Example:

```typescript
// v1: simple template map
const templates: Record<string, { title: string; body: string }> = {
  'crm.activity.assigned': {
    title: 'New activity assigned',
    body: '{{actorName}} assigned you activity "{{activitySubject}}"',
  },
  'crm.activity.due_soon': {
    title: 'Activity due soon',
    body: 'Activity "{{activitySubject}}" is due at {{dueAt}}',
  },
};
```

## Event taxonomy (initial)

Start with a minimal set for Activities:

- `crm.activity.assigned`
- `crm.activity.due_soon`
- `crm.activity.overdue` (v1 optional; v2 escalation)

Then extend to Deals/Leads:

- `crm.deal.stage_changed`
- `crm.deal.rotten`
- `crm.lead.converted`
- `crm.comment.created`
- `crm.mention.created`

## Queue + realtime references (Context7)

This plan relies on:

- **BullMQ delayed jobs + retries/backoff + idempotency** (Context7: `taskforcesh/bullmq`)
  - delayed jobs for reminders (`delay`)
  - retries with backoff + jitter
  - job deduplication (`deduplication.id` / TTL)
  - idempotent job pattern
- **NestJS SSE** for realtime (Context7: NestJS docs `server-sent-events`)
  - `@Sse()` endpoint returns an `Observable<MessageEvent>`
- **NestJS queue integration** (Context7: `nestjs/bull`)
  - module registration, processors, queue event listeners

## Operational concerns

### Outbox polling & cleanup

- **Polling interval**: outbox processor polls every **2–5 seconds** (configurable via env).
- **Row locking**: use `SELECT ... FOR UPDATE SKIP LOCKED` (or Prisma equivalent) to allow parallel workers without double-processing.
- **Retention**: processed outbox rows older than 7 days → delete by cron job. Failed rows kept for 30 days for debugging.
- **Dead letter**: after `maxAttempts` (default 5), mark row as `FAILED`. Admin can inspect and retry manually or discard.

### Notification retention & cleanup

- Notifications older than **90 days** (configurable) → auto-archive or delete via scheduled job.
- Archived notifications remain queryable in a read-only view for audit.

### SSE connection management

- **Auth constraint**: native browser `EventSource` cannot send custom `Authorization` headers. v1 SHOULD rely on **cookie-based session** and be served **same-origin** as the app to ensure cookies are included.
- **Heartbeat**: send a `:keepalive` comment every **30 seconds** to prevent proxy/LB timeouts.
- **Max connections per user**: limit to **3** concurrent SSE connections (close oldest on overflow).
- **Cleanup**: when SSE connection drops, remove the user's Subject from the in-memory map.
- **Multi-instance (v2)**: use Redis pub/sub — each app instance subscribes to a per-tenant channel; when a notification is created, publish to Redis → all instances push to their local SSE connections.

### Security

- All queries MUST filter by `tenantId` (enforced at service layer, not just controller).
- SSE endpoint validates auth token on connect AND on every reconnect.
- Notification `data` JSONB must never contain sensitive fields (passwords, tokens, PII beyond what the recipient already has access to).

## Dependencies to install

```bash
# v1 (recommended): Next.js owner + BullMQ worker process (root app)
npm install bullmq

# (optional) if you want cron-style jobs in-app (cleanup, retention) instead of queue-only
# npm install node-cron

# v2 (optional): if/when moving queue processing into NestJS (api/)
cd api
npm install @nestjs/bullmq bullmq
npm install @nestjs/schedule
npm install @bull-board/nestjs @bull-board/api @bull-board/express
```

## File structure (target)

```
src/app/api/notifications/                 # Next.js route handlers (REST)
├── route.ts                               # GET list, POST actions (or split routes)
├── unread-count/route.ts                  # GET unread count
├── [id]/read/route.ts                     # POST mark single as read
└── read-all/route.ts                      # POST mark all as read

src/app/api/notifications/sse/route.ts     # SSE endpoint (same-origin, cookie auth)

src/server/notifications/                  # server-only logic (shared by routes + workers)
├── outbox.ts                              # publishEvent(), lock+fetch, mark processed/failed
├── recipients.ts                          # recipient resolver rules + watchers lookup
├── templates.ts                           # v1 template registry
├── service.ts                             # create notifications, apply preferences, dedupe
└── retention.ts                           # cleanup jobs

workers/notifications-worker.ts            # BullMQ Worker(s): outbox → fanout → reminders
```

## Implementation steps (small, reviewable chunks)

### Phase 0 — Repository alignment (0.5–1h)

- Confirm how tenant/user identity is derived in Next.js route handlers (cookie session) and how `tenantId` is obtained.
- Decide execution target:
  - **v1 (recommended)**: implement notifications in **Next.js** (same transaction with CRM writes).
  - v2: migrate CRM writes + notifications into **NestJS** (`api/`) later.

Deliverable: a short note in this file under “Decisions”.

### Phase 1 — Core module skeleton (0.5–1h)

Create Next.js routes + server-only services as per “File structure (target)”.

Add minimal auth enforcement (reuse existing session/tenant helpers) so every query is scoped by tenant and user.

### Phase 2 — DB schema + migrations (0.5–1h + review)

Update `prisma/schema.prisma` with models:

- `OutboxEvent`
- `Notification`
- `NotificationPreference`

Generate migration and apply to dev DB.

⚠️ Per project safety: schema migrations should be reviewed before merge.

### Phase 3 — Outbox write path (0.5–1h)

Implement a small outbox helper (in `src/server/notifications/outbox.ts`) with:

- `publishEvent({ tenantId, actorUserId, type, entity, payload, sourceEventId })`
- `sourceEventId` is required for idempotency (unique per tenant in `outbox_events`)

Integrate into one business action to prove the pipeline:

- When an Activity is assigned (`assigneeId` changes / is set) in `src/app/api/crm/activities/[id]/route.ts` → write `crm.activity.assigned`.

### Phase 4 — BullMQ integration + processors (1–2h)

Add BullMQ to the root app and implement a separate worker process (Node) that connects to Redis.

Queues:

- `notifications-outbox` (poll outbox, lock rows, enqueue downstream jobs)
- `notifications-fanout` (create notifications per recipient)

Best practices to implement immediately:

- retries with backoff + jitter
- idempotent processor logic (safe re-run)
- job deduplication (BullMQ `deduplication`), and DB `dedupeKey` uniqueness per user+event window

### Phase 5 — In-app REST API (0.5–1h)

Endpoints in Next.js (`src/app/api/notifications/...`):

- `GET /api/notifications?cursor&limit&unreadOnly`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`
- `GET/PUT /notification-preferences` (optional in v1; can default to “enabled”)

### Phase 6 — Realtime via SSE (0.5–1h)

Implement:

- `GET /api/notifications/sse` (auth required, cookie-based, same-origin)
  - emits `notification.new` and `notification.unread_count_changed`

Notes:

- For multi-instance scaling later: use Redis pub/sub (v2) to broadcast across instances.

### Phase 7 — Frontend integration (1–2h)

In Next.js app:

- Notification bell (badge with unread count).
- Dropdown list (latest notifications, mark as read).
- SSE subscription with reconnect; fallback polling if SSE fails.

### Phase 8 — Reminders for Activities (1–2h)

Two acceptable approaches:

- **A (preferred)**: enqueue a **delayed BullMQ job** at `remindAt` when Activity is created/updated.
- **B**: scheduled scanner (cron) queries upcoming activities and emits `due_soon` events.

Use dedupe window to prevent spamming.

### Phase 9 — Hardening + observability (0.5–1h)

- Queue event listeners / metrics counters (completed/failed).
- Admin-only debug endpoint to inspect last failed outbox events (optional).
- Audit logging for critical actions (notification preference changes, escalations later).

## Test plan

- **Unit**: recipient resolver + dedupe key logic.
- **Integration**: activity assignment → outbox row → queue job → notification row exists.
- **E2E (smoke)**: SSE at `/api/notifications/sse` delivers a `notification.new` to a connected client.

## v2 roadmap (after v1 is stable)

| Feature | Description | Effort |
|---|---|---|
| **Email channel** | `notification_deliveries` table + nodemailer/react-email + BullMQ delivery worker | 1–2 days |
| **Digest mode** | Batch non-urgent notifications into hourly/daily summary emails | 1 day |
| **Quiet hours / DND** | `quiet_from`/`quiet_to` + `timezone` in preferences; hold external deliveries | 0.5 day |
| **Escalation** | If notification requires action and user hasn't responded in N hours → re-notify or escalate to manager | 1 day |
| **Push notifications** | Web Push API (service worker) or mobile push via FCM/APNs | 1–2 days |
| **Slack/Teams channel** | Webhook-based delivery for team channels | 0.5 day |
| **Admin template editor** | Move templates to DB; UI for editing title/body per locale | 1–2 days |
| **Redis pub/sub for SSE** | Multi-instance realtime broadcast | 0.5 day |
| **Notification grouping** | Collapse multiple notifications about the same entity into one (e.g., "3 new comments on Deal X") | 1 day |
| **Notification center page** | Full-page view with filters, search, bulk actions | 1 day |

## Decisions (Phase 0 — confirmed)

- **v1 owner**: Next.js — yes. CRM writes live in `src/app/api/crm/...`, services in `src/lib/services/crm/`.
- **Redis availability**: yes (`docker-compose.yml` has `redis:7-alpine` on port 6379).
- **Auth for SSE**: cookie-based session via `withCurrentUser()` / `getCurrentUserOrNull()`, same-origin — yes.
- **Service pattern**: services extend `BaseService(tenantId, userId)`, use `prisma.$transaction()`. Outbox write goes INSIDE the transaction for atomicity.
- **Audit pattern**: `AuditService.log()` is fire-and-forget (outside tx). Outbox is different — it must be transactional.
- **Default reminder offset**: 1 hour before `dueAt` (configurable per user in v2 via preferences).


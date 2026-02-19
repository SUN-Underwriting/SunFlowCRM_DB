# Notifications Module

> **Inspired by [Novu](https://novu.co)** — event trigger API, template registry, inbox UX,
> and preferences model are modelled after Novu's design patterns.
> **No Novu package dependency** — entirely in-house implementation.

---

## Architecture Overview

```
CRM Write (prisma.$transaction)
    │
    ├─► publishNotificationEvent(tx, input)   ← atomic outbox insert
    │       └─► OutboxEvent [PENDING]
    │
    │   (after tx commit)
    ├─► enqueueOutboxJob(outboxEventId)        ← BullMQ: notifications queue
    │
    ▼
[BullMQ Worker: notifications]
    │
    ├─► claim OutboxEvent (PENDING → PROCESSING)
    ├─► processEvent()
    │     ├─► resolveRecipients()              ← per-event-type rules + EntityWatcher
    │     ├─► check NotificationPreference     ← per-user, per-channel opt-out
    │     ├─► renderTemplate(type, channel)    ← in_app + email templates
    │     ├─► createMany Notification          ← in-app inbox rows
    │     └─► createMany NotificationDelivery  ← email delivery rows
    │           └─► enqueue email-delivery queue
    ├─► mark OutboxEvent [PROCESSED]
    └─► POST /api/notifications/internal-push  ← SSE broadcast to connected clients
         └─► SSE broadcaster (in-memory v1, Redis pub/sub v2)

[BullMQ Worker: email-delivery]
    ├─► claim NotificationDelivery (PENDING → SENDING)
    ├─► emailService.send()                    ← ConsoleEmailService (v1 mock)
    └─► update NotificationDelivery [SENT | FAILED]

[BullMQ Worker: activity-reminders]  (repeatable, every 5 min)
    ├─► processDueSoon()   ← activities where remindAt ≤ now, dueSoonNotifiedAt IS NULL
    └─► processOverdue()   ← activities where dueAt ≤ now, overdueNotifiedAt IS NULL
          each: atomic claim + publishOutboxEvent in single $transaction
```

---

## Key Files

| File | Purpose |
|------|---------|
| `events.ts` | **Public API**: `publishNotificationEvent(tx, input)` — Novu-inspired trigger |
| `outbox.ts` | Low-level outbox insert — called by `events.ts` |
| `types.ts` | `NotificationEventType`, `OutboxEventInput`, `SYSTEM_ACTOR` |
| `templates.ts` | Template registry: `{eventType}:{channel}` → `{title, body}` |
| `recipients.ts` | Recipient resolution per event type + actor exclusion |
| `service.ts` | Fanout: recipients → Notification rows + NotificationDelivery rows |
| `email-service.ts` | `IEmailService` interface + mock implementation |
| `activity-reminder-job.ts` | Scheduler: due_soon + overdue activity scans |
| `sse-broadcaster.ts` | In-memory SSE broadcaster (v1) |
| `queue.ts` | BullMQ queue singletons + `enqueueOutboxJob()` |

---

## Event → Outbox → Fanout Flow

### 1. Triggering an event (in CRM service)

```typescript
// ✅ Correct: outbox write inside same transaction as CRM write
await prisma.$transaction(async (tx) => {
  await tx.activity.update({ ... });

  await publishNotificationEvent(tx, {
    tenantId,
    actorUserId: userId,
    type: 'crm.activity.assigned',
    entity: { kind: 'activity', id: activityId },
    payload: { assigneeId, activitySubject, dueAt },
    sourceEventId: `crm.activity.assigned:${activityId}:${Date.now()}`,
  });
});

enqueueOutboxJob(outboxId); // ← call AFTER transaction commits
```

### 2. Outbox worker claim

The worker atomically transitions `PENDING → PROCESSING` via `updateMany`:
```typescript
const claim = await prisma.outboxEvent.updateMany({
  where: { id: outboxEventId, status: 'PENDING' },
  data: { status: 'PROCESSING', lockedAt: new Date() },
});
if (claim.count === 0) return; // already claimed by another worker
```

### 3. Fanout (service.ts)

`processEvent()` does:
1. `resolveRecipients()` — determine who should be notified
2. Filter by `NotificationPreference` (per channel)
3. `createMany` Notification rows (in-app inbox)
4. `createMany` NotificationDelivery rows (email)
5. Enqueue `email-delivery` jobs

---

## Idempotency & Retry Model

| Layer | Mechanism |
|-------|-----------|
| OutboxEvent | `UNIQUE(tenantId, sourceEventId)` — duplicate publishes silently ignored |
| Notification | `UNIQUE(tenantId, userId, sourceEventId)` — `skipDuplicates: true` |
| BullMQ jobs | `deduplication: { id: outboxEventId }` on outbox jobs |
| Activity reminders | `sourceEventId` includes `remindAt.getTime()` — resets after reschedule |
| Email delivery | Atomic PENDING→SENDING claim prevents double-send |

**Retry safety**: All workers check `claim.count === 0` and skip if already processed. OutboxEvent transitions: `PENDING → PROCESSING → PROCESSED | FAILED`.

---

## Recipient Rules

| Event | Recipients | Actor exclusion |
|-------|-----------|-----------------|
| `crm.activity.assigned` | Assignee | Yes (actor excluded) |
| `crm.activity.due_soon` | Assignee | No (SYSTEM_ACTOR) |
| `crm.activity.overdue` | Assignee + deal/lead owner | No (SYSTEM_ACTOR) |
| `crm.activity.rescheduled` | Assignee (if changed by another user) | Yes |
| `crm.deal.stage_changed` | Deal owner + watchers | Yes |
| `crm.deal.won / lost / rotten` | Deal owner + watchers | Yes |
| `crm.lead.assigned` | Lead owner | Yes |
| `crm.lead.converted` | Lead owner + watchers | Yes |
| `crm.comment.created` | Entity owner + watchers | Yes |
| `crm.mention.created` | Mentioned users | Yes |

`SYSTEM_ACTOR = 'system'` — used by scheduler jobs to bypass actor exclusion.

---

## Notification Preferences

Default: **in-app ON, email OFF** (users must explicitly opt-in to email).

Preferences are stored per `(tenantId, userId, notificationType)`.
Special type `'*'` is the global fallback. Specific type overrides global.

**API**:
- `GET /api/notifications/preferences` — returns full list with defaults filled in
- `PUT /api/notifications/preferences` — upsert changed preferences

**UI**: `/settings/notifications`

---

## Templates

Templates are registered in `templates.ts` as a TypeScript `Map` keyed by `{eventType}:{channel}`.

```typescript
renderTemplate('crm.activity.assigned', 'in_app', { actorName: 'Alice', activitySubject: 'Call' })
// → { title: 'New activity assigned', body: 'Alice assigned you "Call" for ...' }

renderTemplate('crm.activity.assigned', 'email', { ... })
// → { title: 'New activity assigned: "Call"', body: '...' }
```

If no email template is registered, `renderTemplate` falls back to `in_app`.

---

## SSE (Real-time updates)

- `GET /api/notifications/sse` — SSE stream, scoped by `tenantId + userId`
- Events emitted: `notification.new`, `unread_count`
- Keep-alive: comment every 30s
- **v1**: In-memory broadcaster (`sse-broadcaster.ts`) — works for single-instance deployments
- **v2**: Replace `sseBroadcaster.emitToUsers()` with Redis Pub/Sub for multi-instance support

Cross-process push (worker → web): `POST /api/notifications/internal-push` protected by `INTERNAL_WORKER_SECRET`.

---

## UI

| Route | Component | Description |
|-------|-----------|-------------|
| Top navbar | `NotificationBell` | Bell icon + badge + dropdown inbox |
| `/dashboard/notifications` | `NotificationsPage` | Full feed with filters (unread/type), archive, date groups |
| `/settings/notifications` | `NotificationPreferencesPage` | Per-event toggles for in-app + email channels |

---

## Activity Reminder Scheduler

Runs every 5 minutes via BullMQ repeatable job (`upsertJobScheduler`):

1. **DUE_SOON**: finds activities where `remindAt ≤ now AND dueSoonNotifiedAt IS NULL AND done = false`
2. **OVERDUE**: finds activities where `dueAt ≤ now AND overdueNotifiedAt IS NULL AND done = false`

Each candidate is processed in a `$transaction`:
```typescript
const claim = await tx.activity.updateMany({
  where: { id, dueSoonNotifiedAt: null }, // atomic "first writer wins"
  data: { dueSoonNotifiedAt: now },
});
if (claim.count === 0) return null; // already claimed
await publishOutboxEvent(tx, { actorUserId: SYSTEM_ACTOR, ... });
```

---

## Adding a New Event Type

1. Add to `NotificationEventType` in `types.ts`
2. Add recipient rule in `recipients.ts` (`resolveRaw` switch)
3. Add in-app + email templates in `templates.ts`
4. Publish the event from the relevant CRM service using `publishNotificationEvent(tx, ...)`
5. Add the event to the preferences UI in `notification-preferences.tsx`

import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma, ActivityType, BusyFlag } from '@prisma/client';
import { AuditService } from '@/lib/services/audit-service';
import { publishOutboxEvent } from '@/server/notifications/outbox';
import { enqueueOutboxJob } from '@/server/notifications/queue';
import { NotificationEventType } from '@/server/notifications/types';

/** Default reminder offset: 1 hour before dueAt */
const DEFAULT_REMIND_OFFSET_MS = 60 * 60 * 1000;

function computeDefaultRemindAt(dueAt: Date): Date {
  return new Date(dueAt.getTime() - DEFAULT_REMIND_OFFSET_MS);
}

/**
 * Convert flat UpdateActivityInput to Prisma.ActivityUpdateInput (checked variant).
 *
 * Prisma 7 with $extends + PrismaPg validates the `data` argument inside
 * $transaction using the "checked" ActivityUpdateInput type, which does NOT
 * accept scalar FK fields (dealId, leadId, etc.). They must be expressed as
 * relation operations: `deal: { connect: { id } }` or `deal: { disconnect: true }`.
 *
 * This converter maps each optional FK field to the correct relational syntax so
 * the RLS extension's validateRelationTenantAccess also gets the connect/disconnect
 * information it expects.
 */
function toActivityUpdateInput(
  input: Omit<UpdateActivityInput, 'dealId' | 'leadId' | 'personId' | 'orgId' | 'ownerId'> & {
    dealId?: string | null;
    leadId?: string | null;
    personId?: string | null;
    orgId?: string | null;
    ownerId?: string;
    remindAt?: Date | null;
    dueSoonNotifiedAt?: Date | null;
    overdueNotifiedAt?: Date | null;
    completedAt?: Date | null;
  }
): Prisma.ActivityUpdateInput {
  const {
    dealId,
    leadId,
    personId,
    orgId,
    ownerId,
    ...rest
  } = input;

  const data: Prisma.ActivityUpdateInput = { ...rest };

  if (dealId !== undefined) {
    data.deal = dealId ? { connect: { id: dealId } } : { disconnect: true };
  }
  if (leadId !== undefined) {
    data.lead = leadId ? { connect: { id: leadId } } : { disconnect: true };
  }
  if (personId !== undefined) {
    data.person = personId ? { connect: { id: personId } } : { disconnect: true };
  }
  if (orgId !== undefined) {
    data.organization = orgId ? { connect: { id: orgId } } : { disconnect: true };
  }
  if (ownerId !== undefined) {
    data.owner = { connect: { id: ownerId } };
  }

  return data;
}

export interface CreateActivityInput {
  type: ActivityType;
  subject: string;
  dueAt?: Date;
  /** Custom reminder time. Defaults to dueAt − 1 hour when dueAt is set. */
  remindAt?: Date;
  hasTime?: boolean;
  durationMin?: number;
  busyFlag?: BusyFlag;
  dealId?: string;
  leadId?: string;
  personId?: string;
  orgId?: string;
  note?: string;
}

export interface UpdateActivityInput {
  type?: ActivityType;
  subject?: string;
  dueAt?: Date | null;
  /** Explicit reminder time. Pass null to clear; omit to auto-recalculate from new dueAt. */
  remindAt?: Date | null;
  hasTime?: boolean;
  durationMin?: number | null;
  busyFlag?: BusyFlag;
  done?: boolean;
  ownerId?: string;
  dealId?: string | null;
  leadId?: string | null;
  personId?: string | null;
  orgId?: string | null;
  note?: string;
}

export interface ActivityFilters {
  // Status tab
  status?: 'todo' | 'done' | 'all';
  // Filters
  type?: ActivityType;
  ownerId?: string;
  dealId?: string;
  leadId?: string;
  personId?: string;
  orgId?: string;
  // Date presets
  due?: 'overdue' | 'today' | 'week' | 'range';
  dueDateFrom?: Date;
  dueDateTo?: Date;
  // Search
  q?: string;
  // Pagination
  skip?: number;
  take?: number;
  // Sorting
  sortBy?: 'dueAt' | 'createdAt' | 'subject' | 'type';
  sortDesc?: boolean;
}

export interface BulkActivityInput {
  ids: string[];
  action: 'markDone' | 'markUndone' | 'changeOwner' | 'changeType' | 'shiftDueDate' | 'delete';
  ownerId?: string;
  type?: ActivityType;
  dueDateShiftDays?: number;
}

// ─── Recompute helpers ────────────────────────────────────────────────────────

/**
 * Recompute lastActivityDate / nextActivityDate for a single entity.
 * Accepts a Prisma transaction client to run atomically.
 *
 * lastActivityDate = max(completedAt) among done=true, deleted=false
 * nextActivityDate = min(dueAt)        among done=false, deleted=false, dueAt != null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

async function recomputeActivityDates(
  tx: TxClient,
  where: Prisma.ActivityWhereInput,
  updateFn: (data: { lastActivityDate: Date | null; nextActivityDate: Date | null }) => Promise<unknown>
) {
  const [lastResult, nextResult] = await Promise.all([
    tx.activity.findFirst({
      where: { ...where, done: true, deleted: false },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, dueAt: true }
    }),
    tx.activity.findFirst({
      where: { ...where, done: false, deleted: false, dueAt: { not: null } },
      orderBy: { dueAt: 'asc' },
      select: { dueAt: true }
    })
  ]);

  const lastActivityDate =
    lastResult?.completedAt ?? lastResult?.dueAt ?? null;
  const nextActivityDate = nextResult?.dueAt ?? null;

  await updateFn({ lastActivityDate, nextActivityDate });
}

async function recomputeDeal(tx: TxClient, tenantId: string, dealId: string) {
  await recomputeActivityDates(
    tx,
    { tenantId, dealId },
    ({ lastActivityDate, nextActivityDate }) =>
      tx.deal.update({ where: { id: dealId }, data: { lastActivityDate, nextActivityDate } })
  );
}

async function recomputeLead(tx: TxClient, tenantId: string, leadId: string) {
  await recomputeActivityDates(
    tx,
    { tenantId, leadId },
    ({ lastActivityDate, nextActivityDate }) =>
      tx.lead.update({ where: { id: leadId }, data: { lastActivityDate, nextActivityDate } })
  );
}

async function recomputePerson(tx: TxClient, tenantId: string, personId: string) {
  await recomputeActivityDates(
    tx,
    { tenantId, personId },
    ({ lastActivityDate, nextActivityDate }) =>
      tx.person.update({ where: { id: personId }, data: { lastActivityDate, nextActivityDate } })
  );
}

async function recomputeOrg(tx: TxClient, tenantId: string, orgId: string) {
  await recomputeActivityDates(
    tx,
    { tenantId, orgId },
    ({ lastActivityDate, nextActivityDate }) =>
      tx.organization.update({ where: { id: orgId }, data: { lastActivityDate, nextActivityDate } })
  );
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ActivityService extends BaseService {
  /**
   * List activities with server-side filtering, sorting, pagination
   */
  async list(filters: ActivityFilters = {}) {
    const {
      status,
      type,
      ownerId,
      dealId,
      leadId,
      personId,
      orgId,
      due,
      dueDateFrom,
      dueDateTo,
      q,
      skip = 0,
      take = 25,
      sortBy = 'dueAt',
      sortDesc = false
    } = filters;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    // done filter from tab
    let doneFilter: boolean | undefined;
    if (status === 'todo') doneFilter = false;
    else if (status === 'done') doneFilter = true;

    // due date filter
    let dueAtFilter: Prisma.DateTimeNullableFilter | undefined;
    if (due === 'overdue') {
      dueAtFilter = { lt: todayStart };
    } else if (due === 'today') {
      dueAtFilter = { gte: todayStart, lte: todayEnd };
    } else if (due === 'week') {
      dueAtFilter = { gte: todayStart, lte: weekEnd };
    } else if (due === 'range' && (dueDateFrom || dueDateTo)) {
      dueAtFilter = {
        ...(dueDateFrom ? { gte: dueDateFrom } : {}),
        ...(dueDateTo ? { lte: dueDateTo } : {})
      };
    }

    const where: Prisma.ActivityWhereInput = {
      ...this.getTenantFilter(),
      deleted: false,
      ...(doneFilter !== undefined && { done: doneFilter }),
      ...(type && { type }),
      ...(ownerId && { ownerId }),
      ...(dealId && { dealId }),
      ...(leadId && { leadId }),
      ...(personId && { personId }),
      ...(orgId && { orgId }),
      ...(dueAtFilter && { dueAt: dueAtFilter }),
      ...(q && {
        OR: [
          { subject: { contains: q, mode: 'insensitive' } },
          { note: { contains: q, mode: 'insensitive' } }
        ]
      })
    };

    // overdue implies todo (done=false) unless all tab
    if (due === 'overdue' && status !== 'done' && status !== 'all') {
      (where as Record<string, unknown>).done = false;
    }

    const orderBy = buildOrderBy(sortBy, sortDesc);

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
          deal: { select: { id: true, title: true, status: true, stage: { select: { name: true } } } },
          lead: { select: { id: true, title: true, status: true } },
          person: { select: { id: true, firstName: true, lastName: true, email: true } },
          organization: { select: { id: true, name: true } }
        }
      }),
      prisma.activity.count({ where })
    ]);

    return { activities, total };
  }

  /**
   * Get activity by ID
   */
  async getById(id: string) {
    const activity = await prisma.activity.findFirst({
      where: { id, deleted: false },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        deal: { select: { id: true, title: true, status: true, stage: { select: { name: true } } } },
        lead: { select: { id: true, title: true, status: true } },
        person: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { id: true, name: true } }
      }
    });

    this.ensureTenantAccess(activity);
    return activity;
  }

  /**
   * Create new activity — transactional with last/next recompute
   */
  async create(input: CreateActivityInput) {
    const { tenantId, userId } = this;

    // Validate linked entities belong to tenant
    await this.validateLinks(input);

    // Auto-compute remindAt = dueAt − 1h unless explicitly provided
    const remindAt = input.remindAt ?? (input.dueAt ? computeDefaultRemindAt(input.dueAt) : undefined);

    // Assignee: use provided ownerId (assign to another user) or fall back to creator
    const assigneeId = input.ownerId ?? userId;

    const activity = await prisma.$transaction(async (tx) => {
      const { ownerId: _ignored, ...inputWithoutOwnerId } = input;
      const created = await tx.activity.create({
        data: {
          ...inputWithoutOwnerId,
          remindAt,
          tenantId,
          ownerId: assigneeId,
        },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
          deal: { select: { id: true, title: true } },
          lead: { select: { id: true, title: true } },
          person: { select: { id: true, firstName: true, lastName: true } },
          organization: { select: { id: true, name: true } }
        }
      });

      await recomputeAllFromRefs(tx, tenantId, [{
        dealId: input.dealId,
        leadId: input.leadId,
        personId: input.personId,
        orgId: input.orgId
      }]);

      // ACTIVITY_ASSIGNED: actor exclusion handles the self-assignment case —
      // if the user creates an activity for themselves the recipient list will
      // be filtered to empty and no notification is sent.
      const outboxId = await publishOutboxEvent(tx, {
        tenantId,
        actorUserId: userId,
        type: NotificationEventType.ACTIVITY_ASSIGNED,
        entityKind: 'activity',
        entityId: created.id,
        payload: {
          assigneeId: assigneeId,
          ownerId: assigneeId,
          activitySubject: created.subject,
          activityType: created.type,
          dueAt: created.dueAt?.toISOString() ?? null,
          entityName: buildEntityName(created.deal?.title, created.lead?.title),
          dealId: created.dealId,
          leadId: created.leadId,
        },
      });

      return { created, outboxId };
    });

    enqueueOutboxJob(activity.outboxId);

    await AuditService.log({
      tenantId,
      userId,
      action: 'ACTIVITY_CREATED',
      module: 'ACTIVITIES',
      entityId: activity.created.id,
      entityType: 'Activity',
      details: { type: activity.created.type, subject: activity.created.subject }
    });

    return activity.created;
  }

  /**
   * Update activity — transactional with last/next recompute for old+new linked entities
   */
  async update(id: string, input: UpdateActivityInput) {
    const { tenantId, userId } = this;

    const existing = await prisma.activity.findUnique({ where: { id, deleted: false } });
    this.ensureTenantAccess(existing);

    await this.validateLinks(input);

    const dueAtChanged = 'dueAt' in input && String(input.dueAt) !== String(existing!.dueAt);
    const ownerChanged = !!input.ownerId && input.ownerId !== existing!.ownerId;

    // When dueAt is rescheduled: recalculate remindAt (unless caller overrides it explicitly)
    // and reset notification flags so fresh reminders fire for the new time.
    let remindAtUpdate: Date | null | undefined;
    if (dueAtChanged) {
      if ('remindAt' in input) {
        remindAtUpdate = input.remindAt ?? null;
      } else {
        remindAtUpdate = input.dueAt ? computeDefaultRemindAt(input.dueAt) : null;
      }
    } else if ('remindAt' in input) {
      remindAtUpdate = input.remindAt ?? null;
    }

    const activity = await prisma.$transaction(async (tx) => {
      // Build the checked ActivityUpdateInput: FK fields use relation connect/disconnect syntax.
      // Inside $transaction on an $extends client (Prisma 7 + PrismaPg), the query extension
      // validates data as ActivityUpdateInput (checked), so scalar FK fields must NOT be used.
      const updateData = toActivityUpdateInput({
        ...input,
        ...(remindAtUpdate !== undefined ? { remindAt: remindAtUpdate } : {}),
        ...(dueAtChanged ? { dueSoonNotifiedAt: null, overdueNotifiedAt: null } : {}),
        ...(input.done === true && !existing!.done ? { completedAt: new Date() } : {}),
        ...(input.done === false ? { completedAt: null } : {}),
      });

      const updated = await tx.activity.update({
        where: { id },
        data: updateData,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
          deal: { select: { id: true, title: true } },
          lead: { select: { id: true, title: true } },
          person: { select: { id: true, firstName: true, lastName: true } },
          organization: { select: { id: true, name: true } }
        }
      });

      // Recompute all entities touched (old + new links)
      await recomputeAllFromRefs(tx, tenantId, [
        { dealId: existing!.dealId, leadId: existing!.leadId, personId: existing!.personId, orgId: existing!.orgId },
        { dealId: updated.dealId, leadId: updated.leadId, personId: updated.personId, orgId: updated.orgId }
      ]);

      const outboxIds: string[] = [];
      const effectiveOwnerId = updated.ownerId;
      const entityName = buildEntityName(updated.deal?.title, updated.lead?.title);

      // ACTIVITY_ASSIGNED: new assignee notified (actor exclusion handles self-assignment)
      if (ownerChanged) {
        outboxIds.push(await publishOutboxEvent(tx, {
          tenantId,
          actorUserId: userId,
          type: NotificationEventType.ACTIVITY_ASSIGNED,
          entityKind: 'activity',
          entityId: id,
          payload: {
            assigneeId: input.ownerId,
            ownerId: input.ownerId,
            activitySubject: updated.subject,
            activityType: updated.type,
            dueAt: updated.dueAt?.toISOString() ?? null,
            entityName,
            dealId: updated.dealId,
            leadId: updated.leadId,
          },
          sourceEventId: `crm.activity.assigned:${id}:reassign:${Date.now()}`,
        }));
      }

      // ACTIVITY_RESCHEDULED: notify the assignee when SOMEONE ELSE changes their dueAt
      if (dueAtChanged && userId !== effectiveOwnerId) {
        outboxIds.push(await publishOutboxEvent(tx, {
          tenantId,
          actorUserId: userId,
          type: NotificationEventType.ACTIVITY_RESCHEDULED,
          entityKind: 'activity',
          entityId: id,
          payload: {
            assigneeId: effectiveOwnerId,
            ownerId: effectiveOwnerId,
            activitySubject: updated.subject,
            activityType: updated.type,
            dueAt: updated.dueAt?.toISOString() ?? null,
            entityName,
            dealId: updated.dealId,
            leadId: updated.leadId,
          },
          sourceEventId: `crm.activity.rescheduled:${id}:${Date.now()}`,
        }));
      }

      return { updated, outboxIds };
    });

    activity.outboxIds.forEach((oid) => enqueueOutboxJob(oid));

    await AuditService.log({
      tenantId,
      userId,
      action: 'ACTIVITY_UPDATED',
      module: 'ACTIVITIES',
      entityId: id,
      entityType: 'Activity',
      details: input as Record<string, unknown>
    });

    return activity.updated;
  }

  /**
   * Mark activity as done — transactional
   */
  async markAsDone(id: string) {
    const { tenantId, userId } = this;

    const existing = await prisma.activity.findUnique({ where: { id, deleted: false } });
    this.ensureTenantAccess(existing);

    const activity = await prisma.$transaction(async (tx) => {
      const updated = await tx.activity.update({
        where: { id },
        data: { done: true, completedAt: new Date() }
      });

      await recomputeAllFromRefs(tx, tenantId, [{
        dealId: existing!.dealId,
        leadId: existing!.leadId,
        personId: existing!.personId,
        orgId: existing!.orgId
      }]);

      return updated;
    });

    await AuditService.log({
      tenantId,
      userId,
      action: 'ACTIVITY_COMPLETED',
      module: 'ACTIVITIES',
      entityId: id,
      entityType: 'Activity',
      details: {}
    });

    return activity;
  }

  /**
   * Soft delete — transactional
   */
  async delete(id: string) {
    const { tenantId, userId } = this;

    const existing = await prisma.activity.findFirst({ where: { id, deleted: false } });
    this.ensureTenantAccess(existing);

    await prisma.$transaction(async (tx) => {
      await tx.activity.update({
        where: { id },
        data: { deleted: true, deletedAt: new Date() }
      });

      await recomputeAllFromRefs(tx, tenantId, [{
        dealId: existing!.dealId,
        leadId: existing!.leadId,
        personId: existing!.personId,
        orgId: existing!.orgId
      }]);
    });

    await AuditService.log({
      tenantId,
      userId,
      action: 'ACTIVITY_DELETED',
      module: 'ACTIVITIES',
      entityId: id,
      entityType: 'Activity',
      details: {}
    });

    return { success: true };
  }

  /**
   * Bulk operations — single transaction, recompute all affected entities
   */
  async bulk(input: BulkActivityInput) {
    const { tenantId, userId } = this;
    const { ids, action, ownerId, type, dueDateShiftDays } = input;

    // Load and validate ownership
    const existing = await prisma.activity.findMany({
      where: { id: { in: ids }, tenantId, deleted: false }
    });

    if (existing.length !== ids.length) {
      throw new Error('Some activities not found or access denied');
    }

    await prisma.$transaction(async (tx) => {
      if (action === 'markDone') {
        await tx.activity.updateMany({
          where: { id: { in: ids } },
          data: { done: true, completedAt: new Date() }
        });
      } else if (action === 'markUndone') {
        await tx.activity.updateMany({
          where: { id: { in: ids } },
          data: { done: false, completedAt: null }
        });
      } else if (action === 'changeOwner' && ownerId) {
        await tx.activity.updateMany({
          where: { id: { in: ids } },
          data: { ownerId }
        });
      } else if (action === 'changeType' && type) {
        await tx.activity.updateMany({
          where: { id: { in: ids } },
          data: { type }
        });
      } else if (action === 'shiftDueDate' && dueDateShiftDays !== undefined) {
        for (const activity of existing) {
          if (activity.dueAt) {
            const newDue = new Date(activity.dueAt);
            newDue.setDate(newDue.getDate() + dueDateShiftDays);
            await tx.activity.update({
              where: { id: activity.id },
              data: { dueAt: newDue }
            });
          }
        }
      } else if (action === 'delete') {
        await tx.activity.updateMany({
          where: { id: { in: ids } },
          data: { deleted: true, deletedAt: new Date() }
        });
      }

      // Recompute all unique entity refs touched by bulk action
      await recomputeAllFromRefs(
        tx,
        tenantId,
        existing.map(a => ({ dealId: a.dealId, leadId: a.leadId, personId: a.personId, orgId: a.orgId }))
      );
    });

    await AuditService.log({
      tenantId,
      userId,
      action: 'ACTIVITY_BULK_ACTION',
      module: 'ACTIVITIES',
      entityId: ids.join(','),
      entityType: 'Activity',
      details: { action, count: ids.length }
    });

    return { success: true, count: ids.length };
  }

  /** Validate linked entities exist and belong to this tenant */
  private async validateLinks(input: { dealId?: string | null; leadId?: string | null; personId?: string | null; orgId?: string | null }) {
    if (input.dealId) {
      const deal = await prisma.deal.findUnique({ where: { id: input.dealId, deleted: false } });
      this.ensureTenantAccess(deal);
    }
    if (input.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: input.leadId, deleted: false } });
      this.ensureTenantAccess(lead);
    }
    if (input.personId) {
      const person = await prisma.person.findUnique({ where: { id: input.personId, deleted: false } });
      this.ensureTenantAccess(person);
    }
    if (input.orgId) {
      const org = await prisma.organization.findUnique({ where: { id: input.orgId, deleted: false } });
      this.ensureTenantAccess(org);
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Build a human-readable entity context suffix for notification bodies */
function buildEntityName(dealTitle?: string | null, leadTitle?: string | null): string {
  if (dealTitle) return ` on "${dealTitle}"`;
  if (leadTitle) return ` on "${leadTitle}"`;
  return '';
}

function buildOrderBy(
  sortBy: ActivityFilters['sortBy'],
  sortDesc: boolean
): Prisma.ActivityOrderByWithRelationInput[] {
  const dir = sortDesc ? 'desc' : 'asc';
  switch (sortBy) {
    case 'createdAt': return [{ createdAt: dir }];
    case 'subject':   return [{ subject: dir }];
    case 'type':      return [{ type: dir }];
    case 'dueAt':
    default:
      return [
        { done: 'asc' },
        { dueAt: { sort: dir, nulls: 'last' } },
        { createdAt: 'desc' }
      ];
  }
}

type EntityRefs = {
  dealId?: string | null;
  leadId?: string | null;
  personId?: string | null;
  orgId?: string | null;
};

/**
 * Recompute last/next activity dates for all unique entity IDs extracted from a set of refs.
 * Handles the case where multiple activities reference different entity IDs (bulk actions).
 */
async function recomputeAllFromRefs(
  tx: TxClient,
  tenantId: string,
  refs: EntityRefs[]
) {
  const dealIds   = unique(refs.map(r => r.dealId));
  const leadIds   = unique(refs.map(r => r.leadId));
  const personIds = unique(refs.map(r => r.personId));
  const orgIds    = unique(refs.map(r => r.orgId));

  await Promise.all([
    ...dealIds.map(id => recomputeDeal(tx, tenantId, id)),
    ...leadIds.map(id => recomputeLead(tx, tenantId, id)),
    ...personIds.map(id => recomputePerson(tx, tenantId, id)),
    ...orgIds.map(id => recomputeOrg(tx, tenantId, id))
  ]);
}

function unique(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => !!id))];
}

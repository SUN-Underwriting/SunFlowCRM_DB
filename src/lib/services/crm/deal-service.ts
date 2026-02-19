import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma, DealStatus } from '@prisma/client';
import { ValidationError, BusinessRuleError } from '@/lib/errors/app-errors';
import { AuditService, AuditActions } from '../audit-service';
import { publishOutboxEvent } from '@/server/notifications/outbox';
import { enqueueOutboxJob } from '@/server/notifications/queue';
import { NotificationEventType } from '@/server/notifications/types';

export interface CreateDealInput {
  title: string;
  pipelineId: string;
  stageId: string;
  ownerId?: string; // If not provided, defaults to current userId
  personId?: string;
  orgId?: string;
  value?: number;
  currency?: string;
  expectedCloseDate?: Date;
  // V2 fields (PR-1)
  source?: string; // Business source: inbound_call, email, web_form, partner, etc.
  externalSourceId?: string; // ID in external system
  visibility?: 'OWNER' | 'TEAM' | 'COMPANY'; // Defaults to COMPANY
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  renewalType?: string; // one_time, renewal, new_business
  customData?: Record<string, any>;
}

export interface UpdateDealInput {
  title?: string;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  personId?: string;
  orgId?: string;
  value?: number;
  currency?: string;
  status?: DealStatus;
  expectedCloseDate?: Date;
  lostReason?: string;
  // V2 fields (PR-1)
  source?: string;
  externalSourceId?: string;
  visibility?: 'OWNER' | 'TEAM' | 'COMPANY';
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  probability?: number; // 0-100, manual override of stage probability
  renewalType?: string;
  customData?: Record<string, any>;
}

export interface DealFilters {
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  status?: DealStatus;
  search?: string;
  skip?: number;
  take?: number;
}

export class DealService extends BaseService {
  /**
   * List deals with filters
   */
  async list(filters: DealFilters = {}) {
    const {
      pipelineId,
      stageId,
      ownerId,
      status,
      search,
      skip = 0,
      take = 50
    } = filters;

    const where: Prisma.DealWhereInput = {
      ...this.getActiveFilter(),
      ...(pipelineId && { pipelineId }),
      ...(stageId && { stageId }),
      ...(ownerId && { ownerId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { person: { firstName: { contains: search, mode: 'insensitive' } } },
          { person: { lastName: { contains: search, mode: 'insensitive' } } },
          { organization: { name: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          pipeline: true,
          stage: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          person: true,
          organization: true
        }
      }),
      prisma.deal.count({ where })
    ]);

    return { deals, total };
  }

  /**
   * Get deals grouped by stage for pipeline board
   */
  async getByPipeline(pipelineId: string) {
    // Verify pipeline belongs to tenant
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId, deleted: false },
      include: {
        stages: {
          where: { deleted: false },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    this.ensureTenantAccess(pipeline); // Throws if null or wrong tenant

    // Get all deals for this pipeline
    const deals = await prisma.deal.findMany({
      where: {
        ...this.getActiveFilter(),
        pipelineId,
        status: DealStatus.OPEN
      },
      include: {
        stage: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        person: true,
        organization: true,
        _count: {
          select: { activities: true, notes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group deals by stage (pipeline is non-null after ensureTenantAccess)
    const dealsByStage = pipeline!.stages.map((stage) => ({
      stage,
      deals: deals.filter((deal) => deal.stageId === stage.id)
    }));

    return {
      pipeline,
      dealsByStage
    };
  }

  /**
   * Get deal by ID
   */
  async getById(id: string) {
    const deal = await prisma.deal.findUnique({
      where: {
        id,
        deleted: false // Context7: Soft delete filter on findUnique
      },
      include: {
        pipeline: true,
        stage: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        person: true,
        organization: true,
        activities: {
          where: { deleted: false },
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        emails: {
          where: { deleted: false },
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    this.ensureTenantAccess(deal);
    return deal;
  }

  /**
   * Create new deal
   */
  async create(input: CreateDealInput) {
    // Validate pipeline and stage
    const stage = await prisma.stage.findUnique({
      where: { id: input.stageId, deleted: false },
      include: { pipeline: true }
    });

    if (!stage || stage.pipelineId !== input.pipelineId) {
      throw new ValidationError(
        'Stage does not belong to the specified pipeline'
      );
    }
    this.ensureTenantAccess(stage);

    // Validate person/org if provided
    if (input.personId) {
      const person = await prisma.person.findUnique({
        where: { id: input.personId, deleted: false }
      });
      this.ensureTenantAccess(person);
    }

    if (input.orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: input.orgId, deleted: false }
      });
      this.ensureTenantAccess(org);
    }

    // Validate ownerId if provided
    const ownerId = input.ownerId || this.userId;
    if (input.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: input.ownerId }
      });
      this.ensureTenantAccess(owner);
    }

    const deal = await prisma.deal.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        ownerId,
        creatorId: this.userId,
        stageChangeTime: new Date(),
        value: input.value ?? 0,
        customData: input.customData || {}
      },
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        person: true,
        organization: true
      }
    });

    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.DEAL_CREATED,
      module: 'DEALS',
      entityId: deal.id,
      entityType: 'Deal',
      details: {
        title: deal.title,
        value: deal.value.toString(),
        currency: deal.currency,
        pipelineId: deal.pipelineId,
        stageId: deal.stageId
      }
    });

    return deal;
  }

  /**
   * Update deal
   */
  async update(id: string, input: UpdateDealInput) {
    const existing = await prisma.deal.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    // Validate stage if changing
    if (input.stageId) {
      const stage = await prisma.stage.findUnique({
        where: { id: input.stageId, deleted: false }
      });
      this.ensureTenantAccess(stage);

      // Ensure stage belongs to the deal's pipeline
      const pipelineId = input.pipelineId || existing!.pipelineId;
      if (stage!.pipelineId !== pipelineId) {
        throw new BusinessRuleError(
          'Stage does not belong to the deal pipeline'
        );
      }
    }

    // Context7: Validate personId if changing (prevent cross-tenant or deleted links)
    if (input.personId) {
      const person = await prisma.person.findUnique({
        where: { id: input.personId, deleted: false }
      });
      this.ensureTenantAccess(person);
    }

    // Context7: Validate orgId if changing
    if (input.orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: input.orgId, deleted: false }
      });
      this.ensureTenantAccess(org);
    }

    // Track changed fields for audit
    const updatedFields = Object.keys(input).filter(
      (key) => input[key as keyof UpdateDealInput] !== undefined
    );

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...input,
        // Update stageChangeTime if stage is changing
        ...(input.stageId && input.stageId !== existing!.stageId && {
          stageChangeTime: new Date()
        }),
        ...(input.customData && {
          customData: {
            ...((existing?.customData as object) || {}),
            ...input.customData
          }
        })
      },
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        person: true,
        organization: true
      }
    });

    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.DEAL_UPDATED,
      module: 'DEALS',
      entityId: id,
      entityType: 'Deal',
      details: { updatedFields }
    });

    return deal;
  }

  /**
   * Move deal to different stage (drag and drop)
   */
  async moveToStage(id: string, stageId: string) {
    const existing = await prisma.deal.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing); // Throws if null or wrong tenant

    const stage = await prisma.stage.findUnique({
      where: { id: stageId, deleted: false }
    });
    this.ensureTenantAccess(stage); // Throws if null or wrong tenant

    // Ensure the target stage belongs to the same pipeline as the deal
    if (stage!.pipelineId !== existing!.pipelineId) {
      throw new BusinessRuleError(
        'Cannot move deal to a stage in a different pipeline'
      );
    }

    // Check if stage indicates won/lost
    const now = new Date();
    const updateData: Prisma.DealUpdateInput = {
      stage: {
        connect: { id: stageId }
      },
      stageChangeTime: now,
      updatedAt: now
    };

    // Auto-update status based on stage probability (stage is non-null after ensureTenantAccess)
    const probability = Number(stage!.probability);
    if (probability >= 100) {
      updateData.status = DealStatus.WON;
      updateData.wonAt = new Date();
    } else if (probability <= 0 && stage!.name.toLowerCase().includes('lost')) {
      updateData.status = DealStatus.LOST;
      updateData.lostAt = new Date();
    }

    // timeout raised: this tx has up to 3 DB operations (deal update + 2 outbox inserts)
    const { deal, outboxIds } = await prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({
        where: { id },
        data: updateData,
        include: {
          pipeline: true,
          stage: true,
          owner: true,
          person: true,
          organization: true
        }
      });

      const ids: string[] = [];

      ids.push(await publishOutboxEvent(tx, {
        tenantId: this.tenantId,
        actorUserId: this.userId,
        type: NotificationEventType.DEAL_STAGE_CHANGED,
        entityKind: 'deal',
        entityId: id,
        payload: {
          dealTitle: existing!.title,
          stageName: stage!.name,
          fromStageId: existing!.stageId,
          toStageId: stageId,
          ownerId: existing!.ownerId,
        },
      }));

      if (updateData.status === DealStatus.WON) {
        ids.push(await publishOutboxEvent(tx, {
          tenantId: this.tenantId,
          actorUserId: this.userId,
          type: NotificationEventType.DEAL_WON,
          entityKind: 'deal',
          entityId: id,
          payload: {
            dealTitle: existing!.title,
            ownerId: existing!.ownerId,
          },
        }));
      } else if (updateData.status === DealStatus.LOST) {
        ids.push(await publishOutboxEvent(tx, {
          tenantId: this.tenantId,
          actorUserId: this.userId,
          type: NotificationEventType.DEAL_LOST,
          entityKind: 'deal',
          entityId: id,
          payload: {
            dealTitle: existing!.title,
            ownerId: existing!.ownerId,
          },
        }));
      }

      return { deal: updated, outboxIds: ids };
    }, { timeout: 10000, maxWait: 5000 });

    outboxIds.forEach((oid) => enqueueOutboxJob(oid));

    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.DEAL_MOVED,
      module: 'DEALS',
      entityId: id,
      entityType: 'Deal',
      details: {
        fromStageId: existing!.stageId,
        toStageId: stageId,
        fromStageName: existing!.stage?.name,
        toStageName: stage!.name,
        statusChange: updateData.status
          ? { from: existing!.status, to: updateData.status }
          : undefined
      }
    });

    return deal;
  }

  /**
   * Mark deal as won
   */
  async markAsWon(id: string) {
    const existing = await prisma.deal.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    const now = new Date();
    const { deal, outboxId } = await prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({
        where: { id },
        data: {
          status: DealStatus.WON,
          wonAt: now,
          ...((!existing!.firstWonTime && !existing!.wonAt) && { firstWonTime: now })
        }
      });

      const oid = await publishOutboxEvent(tx, {
        tenantId: this.tenantId,
        actorUserId: this.userId,
        type: NotificationEventType.DEAL_WON,
        entityKind: 'deal',
        entityId: id,
        payload: {
          dealTitle: existing!.title,
          ownerId: existing!.ownerId,
          value: existing!.value.toString(),
          currency: existing!.currency,
        },
      });

      return { deal: updated, outboxId: oid };
    });

    enqueueOutboxJob(outboxId);

    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.DEAL_WON,
      module: 'DEALS',
      entityId: id,
      entityType: 'Deal',
      details: {
        title: existing!.title,
        value: existing!.value.toString(),
        currency: existing!.currency
      }
    });

    return deal;
  }

  /**
   * Mark deal as lost
   */
  async markAsLost(id: string, reason?: string) {
    const existing = await prisma.deal.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    const { deal, outboxId } = await prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({
        where: { id },
        data: {
          status: DealStatus.LOST,
          lostAt: new Date(),
          lostReason: reason
        }
      });

      const oid = await publishOutboxEvent(tx, {
        tenantId: this.tenantId,
        actorUserId: this.userId,
        type: NotificationEventType.DEAL_LOST,
        entityKind: 'deal',
        entityId: id,
        payload: {
          dealTitle: existing!.title,
          ownerId: existing!.ownerId,
          value: existing!.value.toString(),
          currency: existing!.currency,
        },
      });

      return { deal: updated, outboxId: oid };
    });

    enqueueOutboxJob(outboxId);

    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.DEAL_LOST,
      module: 'DEALS',
      entityId: id,
      entityType: 'Deal',
      details: {
        title: existing!.title,
        value: existing!.value.toString(),
        currency: existing!.currency,
        reason
      }
    });

    return deal;
  }

  /**
   * Reopen a closed deal (WON or LOST back to OPEN)
   */
  async reopen(id: string) {
    const existing = await prisma.deal.findUnique({
      where: { id, deleted: false },
      include: { stage: true }
    });
    this.ensureTenantAccess(existing);

    if (!existing || existing.status === DealStatus.OPEN) {
      throw new BusinessRuleError('Deal is not in a closed state');
    }

    // Preserve firstWonTime if it was won before
    const updateData: Prisma.DealUpdateInput = {
      status: DealStatus.OPEN,
      wonAt: null,
      lostAt: null,
      lostReason: null,
      // If this was a won deal and firstWonTime is not set, set it now
      ...(existing.status === DealStatus.WON &&
        !existing.firstWonTime && { firstWonTime: existing.wonAt })
    };

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        person: true,
        organization: true
      }
    });

    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.DEAL_REOPENED,
      module: 'DEALS',
      entityId: id,
      entityType: 'Deal',
      details: {
        previousStatus: existing.status,
        title: existing.title
      }
    });

    return deal;
  }

  /**
   * Soft delete deal
   */
  async delete(id: string) {
    const existing = await prisma.deal.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    await prisma.deal.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.DEAL_DELETED,
      module: 'DEALS',
      entityId: id,
      entityType: 'Deal',
      details: {
        title: existing!.title
      }
    });

    return { success: true };
  }
}

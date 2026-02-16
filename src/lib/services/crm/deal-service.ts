import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma, DealStatus } from '@prisma/client';
import { ValidationError, BusinessRuleError } from '@/lib/errors/app-errors';

export interface CreateDealInput {
  title: string;
  pipelineId: string;
  stageId: string;
  personId?: string;
  orgId?: string;
  value?: number;
  currency?: string;
  expectedCloseDate?: Date;
  customData?: Record<string, any>;
}

export interface UpdateDealInput {
  title?: string;
  pipelineId?: string;
  stageId?: string;
  personId?: string;
  orgId?: string;
  value?: number;
  currency?: string;
  status?: DealStatus;
  expectedCloseDate?: Date;
  lostReason?: string;
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
        person: true,
        organization: true
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

    const deal = await prisma.deal.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        ownerId: this.userId,
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

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...input,
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
    const updateData: Prisma.DealUpdateInput = {
      stage: {
        connect: { id: stageId }
      },
      updatedAt: new Date()
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

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        status: DealStatus.WON,
        wonAt: new Date()
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

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        status: DealStatus.LOST,
        lostAt: new Date(),
        lostReason: reason
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

    return { success: true };
  }
}

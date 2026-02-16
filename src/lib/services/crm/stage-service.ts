import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { BusinessRuleError, ValidationError } from '@/lib/errors/app-errors';

export interface CreateStageInput {
  pipelineId: string;
  name: string;
  probability?: number;
  sortOrder?: number;
  isRotten?: boolean;
  rottenDays?: number;
}

export interface UpdateStageInput {
  name?: string;
  probability?: number;
  sortOrder?: number;
  isRotten?: boolean;
  rottenDays?: number;
}

export interface ReorderStagesInput {
  stageId: string;
  newSortOrder: number;
}

export class StageService extends BaseService {
  /**
   * List stages for a pipeline
   */
  async listByPipeline(pipelineId: string) {
    // Verify pipeline belongs to tenant (with soft-delete check)
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId, deleted: false }
    });
    this.ensureTenantAccess(pipeline);

    const stages = await prisma.stage.findMany({
      where: {
        pipelineId,
        deleted: false // Soft delete filter
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { deals: { where: { deleted: false } } }
        }
      }
    });

    return stages;
  }

  /**
   * Get stage by ID
   */
  async getById(id: string) {
    const stage = await prisma.stage.findFirst({
      where: {
        id,
        deleted: false // Soft delete filter
      },
      include: {
        pipeline: true,
        _count: {
          select: { deals: { where: { deleted: false } } }
        }
      }
    });

    this.ensureTenantAccess(stage);
    return stage;
  }

  /**
   * Create new stage
   * Context7: Wrap sort order calculation in transaction to prevent race conditions
   */
  async create(input: CreateStageInput) {
    // Verify pipeline belongs to tenant (with soft-delete check)
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: input.pipelineId, deleted: false }
    });
    this.ensureTenantAccess(pipeline);

    return await prisma.$transaction(async (tx) => {
      // Auto-assign sort order if not provided
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const maxStage = await tx.stage.findFirst({
          where: { pipelineId: input.pipelineId, deleted: false },
          orderBy: { sortOrder: 'desc' }
        });
        sortOrder = (maxStage?.sortOrder ?? -1) + 1;
      }

      const stage = await tx.stage.create({
        data: {
          ...input,
          tenantId: this.tenantId,
          sortOrder,
          probability: input.probability ?? 0
        }
      });

      return stage;
    });
  }

  /**
   * Update stage
   */
  async update(id: string, input: UpdateStageInput) {
    const existing = await prisma.stage.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    const stage = await prisma.stage.update({
      where: { id },
      data: input
    });

    return stage;
  }

  /**
   * Reorder stages (drag and drop)
   */
  async reorder(pipelineId: string, reorders: ReorderStagesInput[]) {
    // Verify pipeline belongs to tenant
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId, deleted: false }
    });
    this.ensureTenantAccess(pipeline);

    // Context7: Validate all stageIds belong to this pipeline before updating
    const stageIds = reorders.map((r) => r.stageId);
    const stages = await prisma.stage.findMany({
      where: {
        id: { in: stageIds },
        pipelineId,
        deleted: false
      },
      select: { id: true }
    });

    if (stages.length !== stageIds.length) {
      throw new ValidationError(
        'One or more stages do not belong to this pipeline'
      );
    }

    // Update sort orders in transaction
    await prisma.$transaction(
      reorders.map(({ stageId, newSortOrder }) =>
        prisma.stage.update({
          where: { id: stageId },
          data: { sortOrder: newSortOrder }
        })
      )
    );

    return { success: true };
  }

  /**
   * Soft delete stage (only if no active deals)
   * Best Practice: Preserve pipeline structure history
   */
  async delete(id: string) {
    const existing = await prisma.stage.findFirst({
      where: {
        id,
        deleted: false
      },
      include: { _count: { select: { deals: { where: { deleted: false } } } } }
    });

    this.ensureTenantAccess(existing);

    if (existing && existing._count.deals > 0) {
      throw new BusinessRuleError('Cannot delete stage with existing deals');
    }

    await prisma.stage.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    return { success: true };
  }
}

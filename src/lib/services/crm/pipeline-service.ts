import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { BusinessRuleError } from '@/lib/errors/app-errors';

export interface CreatePipelineInput {
  name: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface UpdatePipelineInput {
  name?: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export class PipelineService extends BaseService {
  /**
   * List all pipelines for tenant
   */
  async list() {
    const pipelines = await prisma.pipeline.findMany({
      where: {
        ...this.getTenantFilter(),
        deleted: false // Soft delete filter
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        stages: {
          where: { deleted: false },
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: { deals: { where: { deleted: false } } }
        }
      }
    });

    return pipelines;
  }

  /**
   * Get pipeline by ID with stages
   */
  async getById(id: string) {
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        deleted: false // Soft delete filter
      },
      include: {
        stages: {
          where: { deleted: false },
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: { deals: { where: { deleted: false } } }
        }
      }
    });

    this.ensureTenantAccess(pipeline);
    return pipeline;
  }

  /**
   * Get default pipeline
   */
  async getDefault() {
    let pipeline = await prisma.pipeline.findFirst({
      where: {
        ...this.getTenantFilter(),
        isDefault: true,
        deleted: false // Soft delete filter
      },
      include: {
        stages: {
          where: { deleted: false },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    // If no default, return first pipeline
    if (!pipeline) {
      pipeline = await prisma.pipeline.findFirst({
        where: {
          ...this.getTenantFilter(),
          deleted: false
        },
        orderBy: { createdAt: 'asc' },
        include: {
          stages: {
            where: { deleted: false },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    }

    return pipeline;
  }

  /**
   * Create new pipeline
   */
  async create(input: CreatePipelineInput) {
    // Context7: Wrap isDefault toggle in transaction to prevent data loss
    return await prisma.$transaction(async (tx) => {
      // If setting as default, unset other defaults (only for active pipelines)
      if (input.isDefault) {
        await tx.pipeline.updateMany({
          where: {
            ...this.getTenantFilter(),
            isDefault: true,
            deleted: false
          },
          data: { isDefault: false }
        });
      }

      const pipeline = await tx.pipeline.create({
        data: {
          ...input,
          tenantId: this.tenantId
        }
      });

      return pipeline;
    });
  }

  /**
   * Update pipeline
   */
  async update(id: string, input: UpdatePipelineInput) {
    const existing = await prisma.pipeline.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    // Context7: Wrap isDefault toggle in transaction
    const pipeline = await prisma.$transaction(async (tx) => {
      // If setting as default, unset other defaults (only for active pipelines)
      if (input.isDefault) {
        await tx.pipeline.updateMany({
          where: {
            ...this.getTenantFilter(),
            isDefault: true,
            deleted: false,
            NOT: { id }
          },
          data: { isDefault: false }
        });
      }

      return await tx.pipeline.update({
        where: { id },
        data: input
      });
    });

    return pipeline;
  }

  /**
   * Soft delete pipeline (only if no active deals)
   * Best Practice: Preserve pipeline configuration history
   */
  async delete(id: string) {
    const existing = await prisma.pipeline.findFirst({
      where: {
        id,
        deleted: false
      },
      include: { _count: { select: { deals: { where: { deleted: false } } } } }
    });

    this.ensureTenantAccess(existing);

    if (existing && existing._count.deals > 0) {
      throw new BusinessRuleError('Cannot delete pipeline with existing deals');
    }

    await prisma.pipeline.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    return { success: true };
  }
}

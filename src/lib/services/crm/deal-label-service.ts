import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { ValidationError } from '@/lib/errors/app-errors';

export interface CreateDealLabelInput {
  name: string;
  color?: string;
}

export interface UpdateDealLabelInput {
  name?: string;
  color?: string;
}

export class DealLabelService extends BaseService {
  /**
   * List all deal labels for the tenant
   */
  async list() {
    return prisma.dealLabel.findMany({
      where: this.getTenantFilter(),
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Create a new deal label
   */
  async create(input: CreateDealLabelInput) {
    const existing = await prisma.dealLabel.findFirst({
      where: {
        ...this.getTenantFilter(),
        name: input.name
      }
    });

    if (existing) {
      throw new ValidationError(`Label "${input.name}" already exists`);
    }

    return prisma.dealLabel.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        color: input.color || '#6B7280'
      }
    });
  }

  /**
   * Update a deal label
   */
  async update(id: string, input: UpdateDealLabelInput) {
    const existing = await prisma.dealLabel.findFirst({
      where: { id }
    });
    this.ensureTenantAccess(existing);

    if (existing!.isSystem) {
      throw new ValidationError('System labels cannot be modified');
    }

    return prisma.dealLabel.update({
      where: { id },
      data: input
    });
  }

  /**
   * Delete a deal label (cascades to links)
   */
  async delete(id: string) {
    const existing = await prisma.dealLabel.findFirst({
      where: { id }
    });
    this.ensureTenantAccess(existing);

    if (existing!.isSystem) {
      throw new ValidationError('System labels cannot be deleted');
    }

    await prisma.dealLabel.delete({ where: { id } });
    return { success: true };
  }
}

import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { ValidationError } from '@/lib/errors/app-errors';

export interface CreateLeadLabelInput {
  name: string;
  color?: string;
}

export interface UpdateLeadLabelInput {
  name?: string;
  color?: string;
}

export class LeadLabelService extends BaseService {
  /**
   * List all lead labels for the tenant
   */
  async list() {
    return prisma.leadLabel.findMany({
      where: this.getTenantFilter(),
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Create a new lead label
   */
  async create(input: CreateLeadLabelInput) {
    const existing = await prisma.leadLabel.findFirst({
      where: {
        ...this.getTenantFilter(),
        name: input.name
      }
    });

    if (existing) {
      throw new ValidationError(`Label "${input.name}" already exists`);
    }

    return prisma.leadLabel.create({
      data: {
        ...input,
        tenantId: this.tenantId
      }
    });
  }

  /**
   * Update a lead label
   */
  async update(id: string, input: UpdateLeadLabelInput) {
    const existing = await prisma.leadLabel.findFirst({
      where: { id }
    });
    this.ensureTenantAccess(existing);

    if (existing!.isSystem) {
      throw new ValidationError('System labels cannot be modified');
    }

    return prisma.leadLabel.update({
      where: { id },
      data: input
    });
  }

  /**
   * Delete a lead label (cascades to links)
   */
  async delete(id: string) {
    const existing = await prisma.leadLabel.findFirst({
      where: { id }
    });
    this.ensureTenantAccess(existing);

    if (existing!.isSystem) {
      throw new ValidationError('System labels cannot be deleted');
    }

    await prisma.leadLabel.delete({ where: { id } });
    return { success: true };
  }
}

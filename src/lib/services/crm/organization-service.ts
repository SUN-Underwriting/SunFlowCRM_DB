import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export interface CreateOrganizationInput {
  name: string;
  address?: string;
  industry?: string;
  size?: string;
  website?: string;
  phone?: string;
  customData?: Record<string, any>;
}

export interface UpdateOrganizationInput {
  name?: string;
  address?: string;
  industry?: string;
  size?: string;
  website?: string;
  phone?: string;
  customData?: Record<string, any>;
}

export interface OrganizationFilters {
  search?: string;
  industry?: string;
  size?: string;
  skip?: number;
  take?: number;
}

export class OrganizationService extends BaseService {
  /**
   * List organizations with filters and pagination
   */
  async list(filters: OrganizationFilters = {}) {
    const { search, industry, size, skip = 0, take = 50 } = filters;

    const where: Prisma.OrganizationWhereInput = {
      ...this.getActiveFilter(),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { website: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(industry && { industry }),
      ...(size && { size })
    };

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              deals: { where: { deleted: false } },
              persons: { where: { deleted: false } }
            }
          }
        }
      }),
      prisma.organization.count({ where })
    ]);

    return { organizations, total };
  }

  /**
   * Get organization by ID
   */
  async getById(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id, deleted: false },
      include: {
        persons: {
          where: { deleted: false },
          orderBy: { firstName: 'asc' }
        },
        deals: {
          where: { deleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            deals: { where: { deleted: false } },
            persons: { where: { deleted: false } },
            activities: { where: { deleted: false } },
            emails: { where: { deleted: false } }
          }
        }
      }
    });

    this.ensureTenantAccess(organization);
    return organization;
  }

  /**
   * Create new organization
   */
  async create(input: CreateOrganizationInput) {
    const organization = await prisma.organization.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        customData: input.customData || {}
      }
    });

    return organization;
  }

  /**
   * Update organization
   */
  async update(id: string, input: UpdateOrganizationInput) {
    const existing = await prisma.organization.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...input,
        ...(input.customData && {
          customData: {
            ...((existing?.customData as object) || {}),
            ...input.customData
          }
        })
      }
    });

    return organization;
  }

  /**
   * Soft delete organization
   */
  async delete(id: string) {
    const existing = await prisma.organization.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    await prisma.organization.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    return { success: true };
  }
}

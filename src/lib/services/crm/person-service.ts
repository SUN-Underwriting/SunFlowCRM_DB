import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export interface CreatePersonInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  orgId?: string;
  customData?: Record<string, any>;
}

export interface UpdatePersonInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  orgId?: string;
  customData?: Record<string, any>;
}

export interface PersonFilters {
  search?: string;
  orgId?: string;
  skip?: number;
  take?: number;
}

export class PersonService extends BaseService {
  /**
   * List persons with filters and pagination
   */
  async list(filters: PersonFilters = {}) {
    const { search, orgId, skip = 0, take = 50 } = filters;

    const where: Prisma.PersonWhereInput = {
      ...this.getActiveFilter(),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(orgId && { orgId })
    };

    const [persons, total] = await Promise.all([
      prisma.person.findMany({
        where,
        skip,
        take,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        include: {
          organization: true,
          _count: {
            select: {
              deals: { where: { deleted: false } },
              activities: { where: { deleted: false } },
              emails: { where: { deleted: false } }
            }
          }
        }
      }),
      prisma.person.count({ where })
    ]);

    return { persons, total };
  }

  /**
   * Get person by ID
   */
  async getById(id: string) {
    const person = await prisma.person.findUnique({
      where: { id, deleted: false },
      include: {
        organization: true,
        deals: {
          where: { deleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            pipeline: true,
            stage: true
          }
        },
        activities: {
          where: { deleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        emails: {
          where: { deleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    this.ensureTenantAccess(person);
    return person;
  }

  /**
   * Find person by email (for auto-linking)
   */
  async findByEmail(email: string) {
    const person = await prisma.person.findFirst({
      where: {
        tenantId: this.tenantId,
        email: {
          equals: email,
          mode: 'insensitive'
        },
        deleted: false
      }
    });

    return person;
  }

  /**
   * Create new person
   */
  async create(input: CreatePersonInput) {
    // Validate orgId belongs to tenant if provided (with soft-delete check)
    if (input.orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: input.orgId, deleted: false }
      });
      this.ensureTenantAccess(org);
    }

    const person = await prisma.person.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        customData: input.customData || {}
      },
      include: {
        organization: true
      }
    });

    return person;
  }

  /**
   * Update person
   */
  async update(id: string, input: UpdatePersonInput) {
    const existing = await prisma.person.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    // Validate orgId belongs to active tenant org
    if (input.orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: input.orgId, deleted: false }
      });
      this.ensureTenantAccess(org);
    }

    const person = await prisma.person.update({
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
        organization: true
      }
    });

    return person;
  }

  /**
   * Soft delete person
   */
  async delete(id: string) {
    const existing = await prisma.person.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    await prisma.person.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    return { success: true };
  }
}

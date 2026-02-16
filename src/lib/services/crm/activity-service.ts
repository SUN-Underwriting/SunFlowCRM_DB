import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma, ActivityType } from '@prisma/client';

export interface CreateActivityInput {
  type: ActivityType;
  subject: string;
  dueAt?: Date;
  dealId?: string;
  personId?: string;
  orgId?: string;
  note?: string;
}

export interface UpdateActivityInput {
  type?: ActivityType;
  subject?: string;
  dueAt?: Date;
  done?: boolean;
  dealId?: string;
  personId?: string;
  orgId?: string;
  note?: string;
}

export interface ActivityFilters {
  type?: ActivityType;
  done?: boolean;
  ownerId?: string;
  dealId?: string;
  personId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  skip?: number;
  take?: number;
}

export class ActivityService extends BaseService {
  /**
   * List activities with filters
   */
  async list(filters: ActivityFilters = {}) {
    const {
      type,
      done,
      ownerId,
      dealId,
      personId,
      dueBefore,
      dueAfter,
      skip = 0,
      take = 50
    } = filters;

    const where: Prisma.ActivityWhereInput = {
      ...this.getTenantFilter(),
      deleted: false, // Soft delete filter
      ...(type && { type }),
      ...(done !== undefined && { done }),
      ...(ownerId && { ownerId }),
      ...(dealId && { dealId }),
      ...(personId && { personId }),
      // Fix: Combine date range filters properly
      ...((dueBefore || dueAfter) && {
        dueAt: {
          ...(dueBefore && { lte: dueBefore }),
          ...(dueAfter && { gte: dueAfter })
        }
      })
    };

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take,
        orderBy: [{ done: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          deal: {
            select: {
              id: true,
              title: true
            }
          },
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          organization: {
            select: {
              id: true,
              name: true
            }
          }
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
      where: {
        id,
        deleted: false // Soft delete filter
      },
      include: {
        owner: true,
        deal: true,
        person: true,
        organization: true
      }
    });

    this.ensureTenantAccess(activity);
    return activity;
  }

  /**
   * Create new activity
   */
  async create(input: CreateActivityInput) {
    // Validate related entities if provided (with soft-delete check)
    if (input.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: input.dealId, deleted: false }
      });
      this.ensureTenantAccess(deal);
    }

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

    const activity = await prisma.activity.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        ownerId: this.userId
      },
      include: {
        owner: true,
        deal: true,
        person: true,
        organization: true
      }
    });

    return activity;
  }

  /**
   * Update activity
   */
  async update(id: string, input: UpdateActivityInput) {
    const existing = await prisma.activity.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    // Context7: Validate dealId if changing (prevent cross-tenant or deleted links)
    if (input.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: input.dealId, deleted: false }
      });
      this.ensureTenantAccess(deal);
    }

    // Context7: Validate personId if changing
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

    // If marking as done, set completedAt
    const updateData: Prisma.ActivityUpdateInput = {
      ...input
    };

    if (input.done === true && !existing?.done) {
      updateData.completedAt = new Date();
    } else if (input.done === false) {
      updateData.completedAt = null;
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: updateData,
      include: {
        owner: true,
        deal: true,
        person: true,
        organization: true
      }
    });

    return activity;
  }

  /**
   * Mark activity as done
   */
  async markAsDone(id: string) {
    const existing = await prisma.activity.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        done: true,
        completedAt: new Date()
      }
    });

    return activity;
  }

  /**
   * Soft delete activity (preserves audit trail)
   */
  async delete(id: string) {
    const existing = await prisma.activity.findFirst({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    await prisma.activity.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    return { success: true };
  }
}

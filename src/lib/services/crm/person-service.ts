import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { extractDomainFromEmail } from '@/lib/utils/domain';
import { AuditService, AuditActions } from '../audit-service';

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
    let finalOrgId = input.orgId;
    let autoLinked = false;
    let autoLinkedDomain: string | undefined;

    // Auto-link to organization by domain if orgId not provided
    if (!finalOrgId && input.email) {
      const domain = extractDomainFromEmail(input.email);
      if (domain) {
        const org = await prisma.organization.findFirst({
          where: {
            tenantId: this.tenantId,
            domain,
            deleted: false
          },
          select: { id: true, name: true }
        });

        if (org) {
          finalOrgId = org.id;
          autoLinked = true;
          autoLinkedDomain = domain;
        }
      }
    }

    // Validate orgId belongs to tenant if provided (with soft-delete check)
    if (finalOrgId) {
      const org = await prisma.organization.findUnique({
        where: { id: finalOrgId, deleted: false }
      });
      this.ensureTenantAccess(org);
    }

    const person = await prisma.person.create({
      data: {
        ...input,
        orgId: finalOrgId,
        tenantId: this.tenantId,
        customData: input.customData || {}
      },
      include: {
        organization: true
      }
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.PERSON_CREATED,
      module: 'CONTACTS',
      entityId: person.id,
      entityType: 'Person',
      details: {
        name: `${person.firstName} ${person.lastName}`,
        email: person.email,
        orgId: finalOrgId,
        ...(autoLinked && {
          autoLinked: true,
          autoLinkedDomain
        })
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

    let finalOrgId = input.orgId;
    let autoLinked = false;
    let autoLinkedDomain: string | undefined;

    // Auto-link to organization by domain if:
    // 1. orgId not explicitly set (undefined) AND existing person has no orgId
    // 2. email is being updated or exists
    if (input.orgId === undefined && !existing?.orgId) {
      const emailToCheck = input.email !== undefined ? input.email : existing?.email;
      if (emailToCheck) {
        const domain = extractDomainFromEmail(emailToCheck);
        if (domain) {
          const org = await prisma.organization.findFirst({
            where: {
              tenantId: this.tenantId,
              domain,
              deleted: false
            },
            select: { id: true, name: true }
          });

          if (org) {
            finalOrgId = org.id;
            autoLinked = true;
            autoLinkedDomain = domain;
          }
        }
      }
    }

    // Validate orgId belongs to active tenant org
    if (finalOrgId) {
      const org = await prisma.organization.findUnique({
        where: { id: finalOrgId, deleted: false }
      });
      this.ensureTenantAccess(org);
    }

    const person = await prisma.person.update({
      where: { id },
      data: {
        ...input,
        ...(finalOrgId !== undefined && { orgId: finalOrgId }),
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

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.PERSON_UPDATED,
      module: 'CONTACTS',
      entityId: person.id,
      entityType: 'Person',
      details: {
        updatedFields: Object.keys(input),
        ...(autoLinked && {
          autoLinked: true,
          autoLinkedDomain,
          orgId: finalOrgId
        })
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

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.PERSON_DELETED,
      module: 'CONTACTS',
      entityId: id,
      entityType: 'Person',
      details: {
        name: `${existing!.firstName} ${existing!.lastName}`,
        email: existing!.email,
        orgId: existing!.orgId
      }
    });

    return { success: true };
  }
}

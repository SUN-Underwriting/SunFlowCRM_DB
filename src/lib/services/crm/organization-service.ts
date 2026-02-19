import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { AuditService, AuditActions } from '../audit-service';
import { normalizeDomain } from '@/lib/utils/domain';

export interface CreateOrganizationInput {
  name: string;
  domain?: string;
  ownerId?: string;
  countryCode?: string;
  city?: string;
  address?: string;
  industry?: string;
  size?: string;
  website?: string;
  phone?: string;
  customData?: Record<string, any>;
}

export interface UpdateOrganizationInput {
  name?: string;
  domain?: string | null;
  ownerId?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string;
  industry?: string;
  size?: string;
  website?: string;
  phone?: string;
  customData?: Record<string, any>;
}

export interface OrganizationFilters {
  search?: string;
  domain?: string;
  ownerId?: string;
  countryCode?: string;
  city?: string;
  industry?: string;
  size?: string;
  skip?: number;
  take?: number;
  sortBy?: string;
  sortDesc?: boolean;
}

export class OrganizationService extends BaseService {
  /**
   * List organizations with filters and pagination
   */
  async list(filters: OrganizationFilters = {}) {
    const {
      search,
      domain,
      ownerId,
      countryCode,
      city,
      industry,
      size,
      skip = 0,
      take = 50,
      sortBy = 'name',
      sortDesc = false
    } = filters;

    const where: Prisma.OrganizationWhereInput = {
      ...this.getActiveFilter(),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { website: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { domain: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(domain && { domain }),
      ...(ownerId && { ownerId }),
      ...(countryCode && { countryCode }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(industry && { industry }),
      ...(size && { size })
    };

    // Map sortBy to valid Prisma orderBy
    const validSortFields = [
      'name',
      'domain',
      'countryCode',
      'city',
      'industry',
      'size',
      'website',
      'createdAt',
      'updatedAt'
    ];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'name';
    const orderBy: Prisma.OrganizationOrderByWithRelationInput = {
      [orderByField]: sortDesc ? 'desc' : 'asc'
    };

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy,
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
          take: 10,
          include: {
            stage: true,
            pipeline: true
          }
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
    // Normalize domain if provided
    const normalizedDomain = input.domain
      ? normalizeDomain(input.domain)
      : undefined;

    // Validate ownerId belongs to tenant if provided
    if (input.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: input.ownerId }
      });
      this.ensureTenantAccess(owner);
    }

    const organization = await prisma.organization.create({
      data: {
        ...input,
        domain: normalizedDomain,
        tenantId: this.tenantId,
        customData: input.customData || {}
      }
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.ORG_CREATED,
      module: 'ORGANIZATIONS',
      entityId: organization.id,
      entityType: 'Organization',
      details: {
        name: organization.name,
        industry: organization.industry,
        website: organization.website
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

    // Normalize domain if provided
    const normalizedDomain =
      input.domain !== undefined
        ? input.domain === null
          ? null
          : normalizeDomain(input.domain)
        : undefined;

    // Validate ownerId belongs to tenant if provided
    if (input.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: input.ownerId }
      });
      this.ensureTenantAccess(owner);
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...input,
        ...(normalizedDomain !== undefined && { domain: normalizedDomain }),
        ...(input.customData && {
          customData: {
            ...((existing?.customData as object) || {}),
            ...input.customData
          }
        })
      }
    });

    // Audit: track what fields were updated
    const updatedFields = Object.keys(input);
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    // Track key field changes for audit trail
    if (input.name !== undefined && existing) {
      changes.name = { before: existing.name, after: input.name };
    }
    if (input.domain !== undefined && existing) {
      changes.domain = { before: existing.domain, after: normalizedDomain };
    }
    if (input.ownerId !== undefined && existing) {
      changes.ownerId = { before: existing.ownerId, after: input.ownerId };
    }
    if (input.website !== undefined && existing) {
      changes.website = { before: existing.website, after: input.website };
    }
    if (input.phone !== undefined && existing) {
      changes.phone = { before: existing.phone, after: input.phone };
    }
    if (input.industry !== undefined && existing) {
      changes.industry = { before: existing.industry, after: input.industry };
    }

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.ORG_UPDATED,
      module: 'ORGANIZATIONS',
      entityId: id,
      entityType: 'Organization',
      details: {
        updatedFields,
        changes: Object.keys(changes).length > 0 ? changes : undefined
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

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.ORG_DELETED,
      module: 'ORGANIZATIONS',
      entityId: id,
      entityType: 'Organization',
      details: {
        name: existing!.name,
        industry: existing!.industry,
        website: existing!.website
      }
    });

    return { success: true };
  }

  /**
   * Batch attach persons to organization by domain
   * Finds all persons without orgId whose email domain matches organization domain
   */
  async attachPersonsByDomain(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id, deleted: false },
      select: { id: true, domain: true, name: true }
    });

    this.ensureTenantAccess(organization);

    if (!organization?.domain) {
      return { attachedCount: 0, message: 'Organization has no domain set' };
    }

    // Find persons without orgId whose email ends with @domain
    const emailPattern = `%@${organization.domain}`;

    const personsToLink = await prisma.person.findMany({
      where: {
        tenantId: this.tenantId,
        orgId: null,
        email: {
          endsWith: organization.domain,
          mode: 'insensitive'
        },
        deleted: false
      },
      select: { id: true, email: true, firstName: true, lastName: true }
    });

    if (personsToLink.length === 0) {
      return { attachedCount: 0, message: 'No matching persons found' };
    }

    // Batch update persons
    const result = await prisma.person.updateMany({
      where: {
        id: { in: personsToLink.map((p) => p.id) },
        tenantId: this.tenantId
      },
      data: {
        orgId: organization.id
      }
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.ORG_UPDATED,
      module: 'ORGANIZATIONS',
      entityId: id,
      entityType: 'Organization',
      details: {
        bulkAction: 'ATTACH_PERSONS_BY_DOMAIN',
        domain: organization.domain,
        attachedCount: result.count,
        personIds: personsToLink.map((p) => p.id)
      }
    });

    return {
      attachedCount: result.count,
      message: `Successfully linked ${result.count} person(s) to ${organization.name}`
    };
  }
}

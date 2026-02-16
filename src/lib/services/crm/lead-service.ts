import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma, LeadStatus } from '@prisma/client';
import { ValidationError, BusinessRuleError } from '@/lib/errors/app-errors';

export interface CreateLeadInput {
  title: string;
  source?: string;
  personId?: string;
  orgId?: string;
}

export interface UpdateLeadInput {
  title?: string;
  source?: string;
  status?: LeadStatus;
  personId?: string;
  orgId?: string;
}

export interface ConvertLeadToDealInput {
  pipelineId: string;
  stageId: string;
  dealTitle?: string;
  dealValue?: number;
  currency?: string;
  expectedCloseDate?: Date;
  createPerson?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
  };
  createOrganization?: {
    name: string;
    industry?: string;
    website?: string;
  };
}

export interface LeadFilters {
  status?: LeadStatus;
  source?: string;
  ownerId?: string;
  search?: string;
  skip?: number;
  take?: number;
}

export class LeadService extends BaseService {
  /**
   * List leads with filters
   */
  async list(filters: LeadFilters = {}) {
    const { status, source, ownerId, search, skip = 0, take = 50 } = filters;

    const where: Prisma.LeadWhereInput = {
      ...this.getTenantFilter(),
      deleted: false, // Soft delete filter
      ...(status && { status }),
      ...(source && { source }),
      ...(ownerId && { ownerId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { person: { firstName: { contains: search, mode: 'insensitive' } } },
          { person: { lastName: { contains: search, mode: 'insensitive' } } },
          { person: { email: { contains: search, mode: 'insensitive' } } },
          { organization: { name: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
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
          convertedToDeal: {
            select: {
              id: true,
              title: true,
              value: true,
              status: true
            }
          }
        }
      }),
      prisma.lead.count({ where })
    ]);

    return { leads, total };
  }

  /**
   * Get lead by ID
   */
  async getById(id: string) {
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        deleted: false // Soft delete filter
      },
      include: {
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
        convertedToDeal: {
          include: {
            pipeline: true,
            stage: true
          }
        }
      }
    });

    this.ensureTenantAccess(lead);
    return lead;
  }

  /**
   * Create new lead
   */
  async create(input: CreateLeadInput) {
    // Validate person/org if provided (with soft-delete check)
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

    const lead = await prisma.lead.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        ownerId: this.userId
      },
      include: {
        owner: true,
        person: true,
        organization: true
      }
    });

    return lead;
  }

  /**
   * Update lead
   */
  async update(id: string, input: UpdateLeadInput) {
    const existing = await prisma.lead.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

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

    const lead = await prisma.lead.update({
      where: { id },
      data: input,
      include: {
        owner: true,
        person: true,
        organization: true
      }
    });

    return lead;
  }

  /**
   * Convert lead to deal
   */
  async convertToDeal(id: string, input: ConvertLeadToDealInput) {
    const lead = await prisma.lead.findUnique({
      where: { id, deleted: false },
      include: {
        person: true,
        organization: true
      }
    });

    this.ensureTenantAccess(lead); // Throws if null or wrong tenant

    if (lead!.status === LeadStatus.CONVERTED) {
      throw new BusinessRuleError('Lead has already been converted to a deal');
    }

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

    // lead is non-null after ensureTenantAccess
    const validLead = lead!;

    // Context7: Move person/org creation INSIDE transaction to prevent orphaned records
    const result = await prisma.$transaction(async (tx) => {
      // Create person if needed
      let personId = validLead.personId;
      if (!personId && input.createPerson) {
        const newPerson = await tx.person.create({
          data: {
            ...input.createPerson,
            tenantId: this.tenantId
          }
        });
        personId = newPerson.id;
      }

      // Create organization if needed
      let orgId = validLead.orgId;
      if (!orgId && input.createOrganization) {
        const newOrg = await tx.organization.create({
          data: {
            ...input.createOrganization,
            tenantId: this.tenantId
          }
        });
        orgId = newOrg.id;
      }
      const deal = await tx.deal.create({
        data: {
          title: input.dealTitle || validLead.title,
          tenantId: this.tenantId,
          pipelineId: input.pipelineId,
          stageId: input.stageId,
          ownerId: validLead.ownerId,
          personId,
          orgId,
          value: input.dealValue ?? 0,
          currency: input.currency ?? 'USD',
          expectedCloseDate: input.expectedCloseDate
        },
        include: {
          pipeline: true,
          stage: true,
          owner: true,
          person: true,
          organization: true
        }
      });

      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status: LeadStatus.CONVERTED,
          convertedDealId: deal.id
        },
        include: {
          owner: true,
          person: true,
          organization: true,
          convertedToDeal: true
        }
      });

      return { deal, lead: updatedLead };
    });

    return result;
  }

  /**
   * Soft delete lead (sets deleted=true, preserves audit trail)
   * Best Practice (Context7): Use soft deletes for audit compliance
   */
  async delete(id: string) {
    const existing = await prisma.lead.findFirst({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    await prisma.lead.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    return { success: true };
  }
}

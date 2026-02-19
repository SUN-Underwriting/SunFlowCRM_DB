import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma, LeadStatus } from '@prisma/client';
import { ValidationError, BusinessRuleError } from '@/lib/errors/app-errors';
import { AuditService, AuditActions } from '../audit-service';
import { publishOutboxEvent } from '@/server/notifications/outbox';
import { enqueueOutboxJob } from '@/server/notifications/queue';
import { NotificationEventType } from '@/server/notifications/types';

export interface CreateLeadInput {
  title: string;
  description?: string;
  source?: string;
  origin?: string;
  inboxChannel?: string;
  externalSourceId?: string;
  valueAmount?: number;
  valueCurrency?: string;
  expectedCloseDate?: Date;
  personId?: string;
  orgId?: string;
  labelIds?: string[];
  customData?: Record<string, unknown>;
}

export interface UpdateLeadInput {
  title?: string;
  description?: string | null;
  source?: string | null;
  origin?: string | null;
  inboxChannel?: string | null;
  externalSourceId?: string | null;
  status?: LeadStatus;
  valueAmount?: number | null;
  valueCurrency?: string | null;
  expectedCloseDate?: Date | null;
  personId?: string | null;
  orgId?: string | null;
  ownerId?: string;
  labelIds?: string[];
  customData?: Record<string, unknown>;
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
  wasSeen?: boolean;
  skip?: number;
  take?: number;
}

const LEAD_INCLUDE = {
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  creator: {
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
  },
  labelLinks: {
    include: {
      label: true
    }
  }
} as const;

export class LeadService extends BaseService {
  /**
   * List leads with filters
   */
  async list(filters: LeadFilters = {}) {
    const { status, source, ownerId, search, wasSeen, skip = 0, take = 50 } = filters;

    const where: Prisma.LeadWhereInput = {
      ...this.getTenantFilter(),
      deleted: false,
      ...(status && { status }),
      ...(source && { source }),
      ...(ownerId && { ownerId }),
      ...(wasSeen !== undefined && { wasSeen }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
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
        include: LEAD_INCLUDE
      }),
      prisma.lead.count({ where })
    ]);

    return { leads, total };
  }

  /**
   * Get lead by ID with full relations
   */
  async getById(id: string) {
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        deleted: false
      },
      include: LEAD_INCLUDE
    });

    this.ensureTenantAccess(lead);
    return lead;
  }

  /**
   * Create new lead
   */
  async create(input: CreateLeadInput) {
    if (!input.personId && !input.orgId) {
      throw new ValidationError(
        'Lead must be linked to at least a person or an organization'
      );
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

    const { labelIds, ...data } = input;

    const lead = await prisma.lead.create({
      data: {
        ...data,
        valueAmount: data.valueAmount != null ? data.valueAmount : undefined,
        tenantId: this.tenantId,
        ownerId: this.userId,
        creatorId: this.userId,
        customData: data.customData ?? {},
        ...(labelIds && labelIds.length > 0
          ? {
              labelLinks: {
                create: labelIds.map((labelId) => ({ labelId }))
              }
            }
          : {})
      },
      include: LEAD_INCLUDE
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.LEAD_CREATED,
      module: 'LEADS',
      entityId: lead.id,
      entityType: 'Lead',
      details: { title: lead.title, source: lead.source }
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

    // Enforce person/org constraint when clearing relations
    const finalPersonId =
      input.personId !== undefined ? input.personId : existing!.personId;
    const finalOrgId =
      input.orgId !== undefined ? input.orgId : existing!.orgId;

    if (!finalPersonId && !finalOrgId) {
      throw new ValidationError(
        'Lead must be linked to at least a person or an organization'
      );
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

    if (input.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: input.ownerId }
      });
      this.ensureTenantAccess(owner);
    }

    const { labelIds, ...data } = input;

    const { lead, outboxId } = await prisma.$transaction(async (tx) => {
      if (labelIds !== undefined) {
        await tx.leadLabelLink.deleteMany({ where: { leadId: id } });
        if (labelIds.length > 0) {
          await tx.leadLabelLink.createMany({
            data: labelIds.map((labelId) => ({ leadId: id, labelId }))
          });
        }
      }

      const updated = await tx.lead.update({
        where: { id },
        data: {
          ...data,
          valueAmount:
            data.valueAmount === null
              ? null
              : data.valueAmount !== undefined
                ? data.valueAmount
                : undefined
        },
        include: LEAD_INCLUDE
      });

      let oid: string | null = null;
      if (input.ownerId && input.ownerId !== existing!.ownerId) {
        oid = await publishOutboxEvent(tx, {
          tenantId: this.tenantId,
          actorUserId: this.userId,
          type: NotificationEventType.LEAD_ASSIGNED,
          entityKind: 'lead',
          entityId: id,
          payload: {
            assigneeId: input.ownerId,
            leadTitle: updated.title,
            source: updated.source,
          },
          sourceEventId: `crm.lead.assigned:${id}:reassign:${Date.now()}`,
        });
      }

      return { lead: updated, outboxId: oid };
    });

    if (outboxId) enqueueOutboxJob(outboxId);

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.LEAD_UPDATED,
      module: 'LEADS',
      entityId: lead.id,
      entityType: 'Lead',
      details: { updatedFields: Object.keys(input) }
    });

    return lead;
  }

  /**
   * Archive lead (move to ARCHIVED status)
   */
  async archive(id: string) {
    const existing = await prisma.lead.findFirst({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    if (existing!.status === LeadStatus.CONVERTED) {
      throw new BusinessRuleError('Cannot archive a converted lead');
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { status: LeadStatus.ARCHIVED },
      include: LEAD_INCLUDE
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.LEAD_ARCHIVED,
      module: 'LEADS',
      entityId: lead.id,
      entityType: 'Lead',
      details: { previousStatus: existing!.status }
    });

    return lead;
  }

  /**
   * Restore lead from ARCHIVED to OPEN
   */
  async restore(id: string) {
    const existing = await prisma.lead.findFirst({
      where: { id, deleted: false, status: LeadStatus.ARCHIVED }
    });
    this.ensureTenantAccess(existing);

    const lead = await prisma.lead.update({
      where: { id },
      data: { status: LeadStatus.OPEN },
      include: LEAD_INCLUDE
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.LEAD_RESTORED,
      module: 'LEADS',
      entityId: lead.id,
      entityType: 'Lead'
    });

    return lead;
  }

  /**
   * Mark lead as seen by the current user
   */
  async markSeen(id: string) {
    const existing = await prisma.lead.findFirst({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    if (existing!.wasSeen) {
      return existing;
    }

    return prisma.lead.update({
      where: { id },
      data: { wasSeen: true },
      include: LEAD_INCLUDE
    });
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

    this.ensureTenantAccess(lead);

    if (lead!.status === LeadStatus.CONVERTED) {
      throw new BusinessRuleError('Lead has already been converted to a deal');
    }

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

    const validLead = lead!;

    const result = await prisma.$transaction(async (tx) => {
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
          value: input.dealValue ?? validLead.valueAmount ?? 0,
          currency: input.currency ?? validLead.valueCurrency ?? 'USD',
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
        include: LEAD_INCLUDE
      });

      const outboxId = await publishOutboxEvent(tx, {
        tenantId: this.tenantId,
        actorUserId: this.userId,
        type: NotificationEventType.LEAD_CONVERTED,
        entityKind: 'lead',
        entityId: id,
        payload: {
          leadTitle: validLead.title,
          ownerId: validLead.ownerId,
          dealId: deal.id,
          dealTitle: deal.title,
        },
      });

      return { deal, lead: updatedLead, outboxId };
    });

    enqueueOutboxJob(result.outboxId);

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.LEAD_CONVERTED,
      module: 'LEADS',
      entityId: id,
      entityType: 'Lead',
      details: { dealId: result.deal.id, dealTitle: result.deal.title }
    });

    return { deal: result.deal, lead: result.lead };
  }

  /**
   * Soft delete lead
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

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.LEAD_DELETED,
      module: 'LEADS',
      entityId: id,
      entityType: 'Lead',
      details: { title: existing!.title }
    });

    return { success: true };
  }
}

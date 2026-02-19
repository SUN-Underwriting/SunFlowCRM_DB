import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { AuditService, AuditActions } from '../audit-service';

export interface CreateNoteInput {
  body: string;
  pinned?: boolean;
  leadId?: string;
  dealId?: string;
  personId?: string;
  orgId?: string;
}

export interface UpdateNoteInput {
  body?: string;
  pinned?: boolean;
}

export interface NoteFilters {
  leadId?: string;
  dealId?: string;
  personId?: string;
  orgId?: string;
  pinned?: boolean;
  skip?: number;
  take?: number;
}

const NOTE_INCLUDE = {
  author: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  }
} as const;

export class NoteService extends BaseService {
  /**
   * List notes with filters
   */
  async list(filters: NoteFilters = {}) {
    const { leadId, dealId, personId, orgId, pinned, skip = 0, take = 50 } = filters;

    const where: Prisma.NoteWhereInput = {
      ...this.getTenantFilter(),
      deleted: false,
      ...(leadId && { leadId }),
      ...(dealId && { dealId }),
      ...(personId && { personId }),
      ...(orgId && { orgId }),
      ...(pinned !== undefined && { pinned })
    };

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        skip,
        take,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        include: NOTE_INCLUDE
      }),
      prisma.note.count({ where })
    ]);

    return { notes, total };
  }

  /**
   * Get note by ID
   */
  async getById(id: string) {
    const note = await prisma.note.findFirst({
      where: { id, deleted: false },
      include: NOTE_INCLUDE
    });

    this.ensureTenantAccess(note);
    return note;
  }

  /**
   * Create note
   */
  async create(input: CreateNoteInput) {
    const note = await prisma.note.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        authorId: this.userId
      },
      include: NOTE_INCLUDE
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.NOTE_CREATED,
      module: 'NOTES',
      entityId: note.id,
      entityType: 'Note',
      details: {
        leadId: input.leadId,
        dealId: input.dealId,
        personId: input.personId
      }
    });

    return note;
  }

  /**
   * Update note
   */
  async update(id: string, input: UpdateNoteInput) {
    const existing = await prisma.note.findFirst({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    const note = await prisma.note.update({
      where: { id },
      data: input,
      include: NOTE_INCLUDE
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.NOTE_UPDATED,
      module: 'NOTES',
      entityId: note.id,
      entityType: 'Note'
    });

    return note;
  }

  /**
   * Soft delete note
   */
  async delete(id: string) {
    const existing = await prisma.note.findFirst({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    await prisma.note.update({
      where: { id },
      data: { deleted: true, deletedAt: new Date() }
    });

    AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.NOTE_DELETED,
      module: 'NOTES',
      entityId: id,
      entityType: 'Note'
    });

    return { success: true };
  }
}

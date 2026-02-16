import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { Prisma, EmailDirection } from '@prisma/client';
import { PersonService } from './person-service';

export interface CreateEmailInput {
  direction: EmailDirection;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  bodyPreview?: string;
  hasHtmlBody?: boolean;
  hasTextBody?: boolean;
  dealId?: string;
  personId?: string;
  orgId?: string;
}

export interface EmailFilters {
  direction?: EmailDirection;
  dealId?: string;
  personId?: string;
  threadId?: string;
  search?: string;
  skip?: number;
  take?: number;
}

export class EmailService extends BaseService {
  /**
   * List emails with filters
   */
  async list(filters: EmailFilters = {}) {
    const {
      direction,
      dealId,
      personId,
      threadId,
      search,
      skip = 0,
      take = 50
    } = filters;

    const where: Prisma.EmailWhereInput = {
      ...this.getTenantFilter(),
      deleted: false, // Soft delete filter
      ...(direction && { direction }),
      ...(dealId && { dealId }),
      ...(personId && { personId }),
      ...(threadId && { threadId }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { from: { contains: search, mode: 'insensitive' } },
          { to: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
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
      prisma.email.count({ where })
    ]);

    return { emails, total };
  }

  /**
   * Get email by ID
   */
  async getById(id: string) {
    const email = await prisma.email.findFirst({
      where: {
        id,
        deleted: false // Soft delete filter
      },
      include: {
        user: true,
        account: true,
        deal: true,
        person: true,
        organization: true,
        trackingEvents: {
          orderBy: { occurredAt: 'desc' }
        }
      }
    });

    this.ensureTenantAccess(email);
    return email;
  }

  /**
   * Create new email (mock sending)
   * TODO: Implement real SMTP sending
   * TODO: Implement IMAP sync for incoming emails
   * TODO: Implement Smart BCC
   * TODO: Implement OAuth integration for Gmail/Outlook
   */
  async create(input: CreateEmailInput) {
    // Context7: Validate tenant access for explicitly provided entity IDs
    if (input.personId) {
      const person = await prisma.person.findUnique({
        where: { id: input.personId, deleted: false }
      });
      this.ensureTenantAccess(person);
    }
    if (input.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: input.dealId, deleted: false }
      });
      this.ensureTenantAccess(deal);
    }
    if (input.orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: input.orgId, deleted: false }
      });
      this.ensureTenantAccess(org);
    }

    // Auto-link to Person by email address
    let personId = input.personId;
    let dealId = input.dealId;
    let orgId = input.orgId;
    let isLinkedAutomatically = false;

    if (!personId) {
      const personService = new PersonService(this.tenantId, this.userId);

      // Extract email from 'to' field (for outgoing) or 'from' field (for incoming)
      const emailToMatch =
        input.direction === EmailDirection.OUTGOING
          ? this.extractEmail(input.to)
          : this.extractEmail(input.from);

      if (emailToMatch) {
        const person = await personService.findByEmail(emailToMatch);

        if (person) {
          personId = person.id;
          orgId = person.orgId || orgId;
          isLinkedAutomatically = true;

          // Find open deals for this person
          if (!dealId) {
            const openDeal = await prisma.deal.findFirst({
              where: {
                tenantId: this.tenantId,
                personId: person.id,
                status: 'OPEN',
                deleted: false
              },
              orderBy: { createdAt: 'desc' }
            });

            if (openDeal) {
              dealId = openDeal.id;
            }
          }
        }
      }
    }

    // Generate unique messageId
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@crm.local>`;

    // Calculate threadId (simplified - in real implementation, use messageId/inReplyTo/references)
    const threadId = this.calculateThreadId(input.subject);

    const email = await prisma.email.create({
      data: {
        ...input,
        tenantId: this.tenantId,
        userId: this.userId,
        messageId,
        threadId,
        personId,
        dealId,
        orgId,
        isLinkedAutomatically,
        sentAt:
          input.direction === EmailDirection.OUTGOING ? new Date() : undefined,
        receivedAt:
          input.direction === EmailDirection.INCOMING ? new Date() : undefined
      },
      include: {
        user: true,
        deal: true,
        person: true,
        organization: true
      }
    });

    // TODO: Here would be the SMTP sending logic for outgoing emails
    // TODO: For now, we just create the record

    return email;
  }

  /**
   * Extract email address from string (e.g., "John Doe <john@example.com>")
   */
  private extractEmail(emailString: string): string | null {
    const match =
      emailString.match(/<(.+?)>/) || emailString.match(/([^\s]+@[^\s]+)/);
    return match ? match[1] : null;
  }

  /**
   * Calculate thread ID based on subject (simplified)
   * TODO: Implement proper threading using messageId, inReplyTo, references
   */
  private calculateThreadId(subject: string): string {
    // Remove "Re:", "Fwd:", etc. and normalize
    const normalized = subject
      .replace(/^(Re|Fwd|Fw):\s*/gi, '')
      .trim()
      .toLowerCase();

    // Generate hash-like ID from normalized subject
    return `thread-${normalized.replace(/\s+/g, '-').substring(0, 50)}`;
  }

  /**
   * Soft delete email (preserves audit trail)
   * Best Practice: Emails should never be permanently deleted for compliance
   */
  async delete(id: string) {
    const existing = await prisma.email.findFirst({
      where: { id, deleted: false }
    });

    this.ensureTenantAccess(existing);

    await prisma.email.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    return { success: true };
  }
}

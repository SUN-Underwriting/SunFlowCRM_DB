import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';

export type TimelineItemType = 'activity' | 'note' | 'email';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface TimelineFilters {
  leadId: string;
  types?: TimelineItemType[];
  skip?: number;
  take?: number;
}

export interface OrganizationTimelineFilters {
  orgId: string;
  types?: TimelineItemType[];
  skip?: number;
  take?: number;
}

export class TimelineService extends BaseService {
  /**
   * Get unified timeline for a lead (activities, notes, emails)
   * Sorted by timestamp descending
   */
  async getLeadTimeline(filters: TimelineFilters) {
    const { leadId, types, skip = 0, take = 50 } = filters;

    const includeActivities = !types || types.includes('activity');
    const includeNotes = !types || types.includes('note');
    const includeEmails = !types || types.includes('email');

    const tenantFilter = this.getTenantFilter();

    const [activities, notes, emails] = await Promise.all([
      includeActivities
        ? prisma.activity.findMany({
            where: {
              ...tenantFilter,
              leadId,
              deleted: false
            },
            include: {
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        : [],
      includeNotes
        ? prisma.note.findMany({
            where: {
              ...tenantFilter,
              leadId,
              deleted: false
            },
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        : [],
      includeEmails
        ? prisma.email.findMany({
            where: {
              ...tenantFilter,
              leadId,
              deleted: false
            },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        : []
    ]);

    const items: TimelineItem[] = [
      ...activities.map((a) => ({
        id: a.id,
        type: 'activity' as const,
        timestamp: a.completedAt || a.createdAt,
        data: a as unknown as Record<string, unknown>
      })),
      ...notes.map((n) => ({
        id: n.id,
        type: 'note' as const,
        timestamp: n.createdAt,
        data: n as unknown as Record<string, unknown>
      })),
      ...emails.map((e) => ({
        id: e.id,
        type: 'email' as const,
        timestamp: e.sentAt || e.receivedAt || e.createdAt,
        data: e as unknown as Record<string, unknown>
      }))
    ];

    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const total = items.length;
    const paginated = items.slice(skip, skip + take);

    return { items: paginated, total };
  }

  /**
   * Get unified timeline for an organization (activities, notes, emails)
   * Sorted by timestamp descending
   */
  async getOrganizationTimeline(filters: OrganizationTimelineFilters) {
    const { orgId, types, skip = 0, take = 50 } = filters;

    const includeActivities = !types || types.includes('activity');
    const includeNotes = !types || types.includes('note');
    const includeEmails = !types || types.includes('email');

    const tenantFilter = this.getTenantFilter();

    const [activities, notes, emails] = await Promise.all([
      includeActivities
        ? prisma.activity.findMany({
            where: {
              ...tenantFilter,
              orgId,
              deleted: false
            },
            include: {
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        : [],
      includeNotes
        ? prisma.note.findMany({
            where: {
              ...tenantFilter,
              orgId,
              deleted: false
            },
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        : [],
      includeEmails
        ? prisma.email.findMany({
            where: {
              ...tenantFilter,
              orgId,
              deleted: false
            },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        : []
    ]);

    const items: TimelineItem[] = [
      ...activities.map((a) => ({
        id: a.id,
        type: 'activity' as const,
        timestamp: a.completedAt || a.createdAt,
        data: a as unknown as Record<string, unknown>
      })),
      ...notes.map((n) => ({
        id: n.id,
        type: 'note' as const,
        timestamp: n.createdAt,
        data: n as unknown as Record<string, unknown>
      })),
      ...emails.map((e) => ({
        id: e.id,
        type: 'email' as const,
        timestamp: e.sentAt || e.receivedAt || e.createdAt,
        data: e as unknown as Record<string, unknown>
      }))
    ];

    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const total = items.length;
    const paginated = items.slice(skip, skip + take);

    return { items: paginated, total };
  }
}

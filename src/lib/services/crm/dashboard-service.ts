import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { DealStatus, LeadStatus } from '@prisma/client';

export interface DashboardKPIs {
  totalDeals: number;
  totalValue: number;
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  newLeads: number;
  conversionRate: number;
  avgDealValue: number;
}

export interface DealsByStage {
  stages: Array<{
    stageId: string;
    stageName: string;
    count: number;
    totalValue: number;
    sortOrder: number;
  }>;
}

export interface RecentActivity {
  id: string;
  type: string;
  subject: string;
  createdAt: Date;
  owner: {
    firstName: string | null;
    lastName: string | null;
  };
}

/**
 * Dashboard Service - Aggregation and analytics for dashboard widgets
 * Best Practice: Encapsulate dashboard queries in service layer
 */
export class DashboardService extends BaseService {
  /**
   * Get KPIs for dashboard
   */
  async getKPIs(): Promise<DashboardKPIs> {
    // Get all deals
    const deals = await prisma.deal.findMany({
      where: {
        tenantId: this.tenantId,
        deleted: false
      },
      select: {
        status: true,
        value: true
      }
    });

    // Calculate metrics
    const totalDeals = deals.length;
    const wonDeals = deals.filter((d) => d.status === DealStatus.WON).length;
    const lostDeals = deals.filter((d) => d.status === DealStatus.LOST).length;
    const openDeals = deals.filter((d) => d.status === DealStatus.OPEN).length;

    const totalValue = deals.reduce(
      (sum, deal) => sum + (Number(deal.value) || 0),
      0
    );
    const avgDealValue = totalDeals > 0 ? totalValue / totalDeals : 0;

    // Get new leads (this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newLeads = await prisma.lead.count({
      where: {
        tenantId: this.tenantId,
        deleted: false,
        createdAt: {
          gte: startOfMonth
        },
        status: {
          in: [LeadStatus.NEW, LeadStatus.IN_PROGRESS]
        }
      }
    });

    // Conversion rate (won deals / total non-open deals)
    const closedDeals = wonDeals + lostDeals;
    const conversionRate = closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;

    return {
      totalDeals,
      totalValue,
      wonDeals,
      lostDeals,
      openDeals,
      newLeads,
      conversionRate,
      avgDealValue
    };
  }

  /**
   * Get deals grouped by stage
   */
  async getDealsByStage(): Promise<DealsByStage> {
    interface DealWithStage {
      stageId: string;
      value: { toNumber(): number } | number | null;
      stage: {
        id: string;
        name: string;
        sortOrder: number;
      } | null;
    }

    // Get all open deals with their stages
    const deals: DealWithStage[] = await prisma.deal.findMany({
      where: {
        tenantId: this.tenantId,
        deleted: false,
        status: 'OPEN'
      },
      select: {
        stageId: true,
        value: true,
        stage: {
          select: {
            id: true,
            name: true,
            sortOrder: true
          }
        }
      }
    });

    // Group by stage
    const stageMap = new Map<
      string,
      {
        stageId: string;
        stageName: string;
        count: number;
        totalValue: number;
        sortOrder: number;
      }
    >();

    deals.forEach((deal) => {
      if (!deal.stage) return;

      const existing = stageMap.get(deal.stageId);
      if (existing) {
        existing.count++;
        existing.totalValue += Number(deal.value) || 0;
      } else {
        stageMap.set(deal.stageId, {
          stageId: deal.stageId,
          stageName: deal.stage.name,
          count: 1,
          totalValue: Number(deal.value) || 0,
          sortOrder: deal.stage.sortOrder
        });
      }
    });

    // Convert to array and sort by stage order
    const stages = Array.from(stageMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    return { stages };
  }

  /**
   * Get recent activities for dashboard widget
   */
  async getRecentActivities(
    limit: number = 5
  ): Promise<{ activities: RecentActivity[] }> {
    const activities = await prisma.activity.findMany({
      where: {
        tenantId: this.tenantId,
        deleted: false
      },
      select: {
        id: true,
        type: true,
        subject: true,
        createdAt: true,
        owner: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    return { activities };
  }
}

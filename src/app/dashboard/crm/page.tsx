'use client';

import {
  IconTrendingUp,
  IconCurrencyDollar,
  IconChecks,
  IconX,
  IconFolders,
  IconUsers,
  IconTarget,
  IconChartBar
} from '@tabler/icons-react';
import { KPICard } from '@/features/crm/dashboard/components/kpi-card';
import { DealsByStageChart } from '@/features/crm/dashboard/components/deals-by-stage-chart';
import { RecentActivitiesWidget } from '@/features/crm/dashboard/components/recent-activities-widget';
import {
  useDashboardKPIs,
  useDealsByStage,
  useRecentActivities
} from '@/features/crm/dashboard/hooks/use-dashboard';
import { formatCurrency } from '@/lib/format-currency';

/**
 * CRM Dashboard Page
 * Best Practice (Context7): Dashboard with KPIs, charts, and real-time widgets
 */
export default function CRMDashboardPage() {
  const { data: kpis, isLoading: loadingKPIs } = useDashboardKPIs();
  const { data: dealsByStage, isLoading: loadingStages } = useDealsByStage();
  const { data: recentActivities, isLoading: loadingActivities } =
    useRecentActivities(5);

  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>CRM Dashboard</h2>
          <p className='text-muted-foreground'>
            Overview of your sales pipeline and activities
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <KPICard
          title='Total Deals'
          value={kpis?.totalDeals || 0}
          subtitle={`${kpis?.openDeals || 0} open deals`}
          icon={IconFolders}
          isLoading={loadingKPIs}
        />
        <KPICard
          title='Total Value'
          value={formatCurrency(kpis?.totalValue)}
          subtitle={
            kpis?.avgDealValue
              ? `Avg: ${formatCurrency(kpis.avgDealValue)}`
              : undefined
          }
          icon={IconCurrencyDollar}
          isLoading={loadingKPIs}
        />
        <KPICard
          title='Won Deals'
          value={kpis?.wonDeals || 0}
          subtitle={
            kpis?.conversionRate
              ? `${kpis.conversionRate.toFixed(1)}% conversion`
              : undefined
          }
          icon={IconChecks}
          isLoading={loadingKPIs}
        />
        <KPICard
          title='New Leads'
          value={kpis?.newLeads || 0}
          subtitle='This month'
          icon={IconUsers}
          isLoading={loadingKPIs}
        />
      </div>

      {/* Secondary Metrics */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <KPICard
          title='Lost Deals'
          value={kpis?.lostDeals || 0}
          subtitle='Needs follow-up'
          icon={IconX}
          isLoading={loadingKPIs}
        />
        <KPICard
          title='Open Deals'
          value={kpis?.openDeals || 0}
          subtitle='In pipeline'
          icon={IconTarget}
          isLoading={loadingKPIs}
        />
        <KPICard
          title='Avg Deal Value'
          value={formatCurrency(kpis?.avgDealValue)}
          subtitle='Across all deals'
          icon={IconTrendingUp}
          isLoading={loadingKPIs}
        />
        <KPICard
          title='Conversion Rate'
          value={
            kpis?.conversionRate ? `${kpis.conversionRate.toFixed(1)}%` : '0%'
          }
          subtitle='Lead to deal'
          icon={IconChartBar}
          isLoading={loadingKPIs}
        />
      </div>

      {/* Charts and Widgets */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-7'>
        <div className='col-span-4'>
          <DealsByStageChart
            data={dealsByStage || []}
            isLoading={loadingStages}
          />
        </div>
        <div className='col-span-3'>
          <RecentActivitiesWidget
            activities={recentActivities || []}
            isLoading={loadingActivities}
          />
        </div>
      </div>

      {/* Info Message */}
      <div className='rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950'>
        <div className='flex items-start gap-3'>
          <IconTarget className='mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400' />
          <div>
            <h3 className='font-semibold text-blue-900 dark:text-blue-100'>
              Dashboard Overview
            </h3>
            <p className='mt-1 text-sm text-blue-800 dark:text-blue-200'>
              This dashboard provides real-time metrics from your CRM. Data
              refreshes automatically to keep you updated on your sales
              pipeline, deals, and activities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import {
  IconShip,
  IconCalculator,
  IconClipboardList,
  IconReportMoney,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconTrendingUp
} from '@tabler/icons-react';
import Link from 'next/link';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue'
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    blue: 'text-blue-500 bg-blue-500/10',
    green: 'text-green-500 bg-green-500/10',
    yellow: 'text-yellow-500 bg-yellow-500/10',
    red: 'text-red-500 bg-red-500/10'
  };
  return (
    <div className='bg-card rounded-xl border p-6'>
      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>{title}</p>
        <div className={`rounded-lg p-2 ${colors[color]}`}>
          <Icon className='h-4 w-4' />
        </div>
      </div>
      <p className='mt-2 text-3xl font-bold'>{value}</p>
      <p className='text-muted-foreground mt-1 text-xs'>{subtitle}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  primary = false
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-4 rounded-xl border p-5 transition-all hover:shadow-md ${
        primary
          ? 'border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10'
          : 'bg-card hover:bg-accent'
      }`}
    >
      <div
        className={`rounded-lg p-2.5 ${primary ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-muted-foreground group-hover:text-foreground'}`}
      >
        <Icon className='h-5 w-5' />
      </div>
      <div>
        <p
          className={`font-semibold ${primary ? 'text-blue-400' : 'text-foreground'}`}
        >
          {title}
        </p>
        <p className='text-muted-foreground mt-0.5 text-sm'>{description}</p>
      </div>
    </Link>
  );
}

export default function UnderwritingPage() {
  const [metrics, setMetrics] = useState({
    submissionsMTD: 0,
    boundCount: 0,
    pendingReview: 0,
    declined: 0,
    gwp: 0
  });

  useEffect(() => {
    fetch('/api/underwriting/metrics')
      .then((r) => r.json())
      .then((json) => {
        const data = json?.data;
        if (data?.submissionsMTD !== undefined) setMetrics(data);
      })
      .catch(() => {
        /* keep zeros on error */
      });
  }, []);

  const gwpFormatted =
    metrics.gwp >= 1000
      ? `$${(metrics.gwp / 1000).toFixed(0)}K`
      : `$${metrics.gwp.toFixed(0)}`;

  return (
    <div className='flex-1 space-y-6 p-4 pt-6 md:p-8'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='rounded-xl bg-blue-500/10 p-2.5'>
            <IconShip className='h-6 w-6 text-blue-500' />
          </div>
          <div>
            <h2 className='text-3xl font-bold tracking-tight'>Underwriting</h2>
            <p className='text-muted-foreground'>
              Sun Re Marine — Marine Yacht
            </p>
          </div>
        </div>
        <Link
          href='/dashboard/underwriting/new'
          className='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
        >
          <IconCalculator className='h-4 w-4' />
          New Quote
        </Link>
      </div>

      {/* KPI Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title='Submissions MTD'
          value={metrics.submissionsMTD}
          subtitle={
            metrics.submissionsMTD === 0
              ? 'Start quoting to see metrics'
              : 'This calendar month'
          }
          icon={IconClipboardList}
          color='blue'
        />
        <StatCard
          title='Bound Policies'
          value={metrics.boundCount}
          subtitle={`Gross Written Premium: ${gwpFormatted}`}
          icon={IconCheck}
          color='green'
        />
        <StatCard
          title='Pending Review'
          value={metrics.pendingReview}
          subtitle='Awaiting UW decision'
          icon={IconClock}
          color='yellow'
        />
        <StatCard
          title='Referred / Declined'
          value={metrics.declined}
          subtitle='Outside appetite'
          icon={IconAlertTriangle}
          color='red'
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className='text-muted-foreground mb-3 text-sm font-medium tracking-wider uppercase'>
          Quick Actions
        </h3>
        <div className='grid gap-3 md:grid-cols-3'>
          <QuickAction
            href='/dashboard/underwriting/new'
            icon={IconCalculator}
            title='Calculate New Quote'
            description='Instant premium for yacht under $6M hull value'
            primary
          />
          <QuickAction
            href='/dashboard/underwriting/submissions'
            icon={IconClipboardList}
            title='View Submissions'
            description='All submissions and their current status'
          />
          <QuickAction
            href='/dashboard/underwriting/quotes'
            icon={IconReportMoney}
            title='Issued Quotes'
            description='Indication, firm, and bound quotes'
          />
        </div>
      </div>

      {/* Facility Info */}
      <div className='rounded-xl border border-blue-500/20 bg-blue-500/5 p-5'>
        <div className='flex items-start gap-3'>
          <IconShip className='mt-0.5 h-5 w-5 shrink-0 text-blue-400' />
          <div className='space-y-1'>
            <p className='font-semibold text-blue-300'>
              Sun Re Marine — Active
            </p>
            <div className='grid gap-x-8 gap-y-1 text-sm text-blue-200/70 sm:grid-cols-3'>
              <span>
                Hull limit:{' '}
                <strong className='text-blue-200'>$6,000,000</strong>
              </span>
              <span>
                P&I limit (ROW):{' '}
                <strong className='text-blue-200'>$3,000,000</strong>
              </span>
              <span>
                Min premium: <strong className='text-blue-200'>$250</strong>
              </span>
              <span>
                Territories:{' '}
                <strong className='text-blue-200'>US/CA/MX/Carib + ROW</strong>
              </span>
              <span>
                Use types:{' '}
                <strong className='text-blue-200'>
                  Private, Charter, Bareboat
                </strong>
              </span>
              <span>
                Rate tables:{' '}
                <strong className='text-blue-200'>Appendix 6 (2021)</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GPW Target */}
      <div className='bg-card rounded-xl border p-5'>
        <div className='mb-3 flex items-center gap-2'>
          <IconTrendingUp className='text-muted-foreground h-4 w-4' />
          <h3 className='font-semibold'>GPW Target — Year 1</h3>
        </div>
        <div className='grid gap-4 sm:grid-cols-3'>
          {[
            { label: 'Conservative', value: '$3M', policies: '~250 policies' },
            { label: 'Base', value: '$5M', policies: '~420 policies' },
            { label: 'Optimistic', value: '$7M', policies: '~580 policies' }
          ].map((scenario) => (
            <div key={scenario.label} className='bg-muted/50 rounded-lg p-4'>
              <p className='text-muted-foreground text-xs'>{scenario.label}</p>
              <p className='mt-1 text-2xl font-bold'>{scenario.value}</p>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {scenario.policies}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

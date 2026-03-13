'use client';

import { useQuery } from '@tanstack/react-query';
import {
  IconReportMoney,
  IconPlus,
  IconShip,
  IconSearch,
  IconX
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type QuoteStatus =
  | 'INDICATION'
  | 'FIRM'
  | 'BOUND'
  | 'DECLINED'
  | 'EXPIRED'
  | 'SUPERSEDED';

interface Quote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  totalPremium: number;
  hullPremium: number;
  liabilityPremium: number;
  createdAt: string;
  submission: {
    id: string;
    reference: string;
    vesselName: string | null;
    hullValue: number | null;
    territory: string;
    status: string;
  };
}

const STATUS_STYLES: Record<QuoteStatus, string> = {
  INDICATION: 'bg-blue-500/20 text-blue-400',
  FIRM: 'bg-green-500/20 text-green-400',
  BOUND: 'bg-emerald-500/20 text-emerald-400',
  DECLINED: 'bg-red-500/20 text-red-400',
  EXPIRED: 'bg-gray-500/20 text-gray-500',
  SUPERSEDED: 'bg-gray-500/20 text-gray-400'
};

const ALL_STATUSES: QuoteStatus[] = [
  'INDICATION',
  'FIRM',
  'BOUND',
  'DECLINED',
  'EXPIRED',
  'SUPERSEDED'
];

function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.INDICATION}`}
    >
      {status}
    </span>
  );
}

async function fetchQuotes(): Promise<Quote[]> {
  const res = await fetch('/api/underwriting/quotes');
  if (!res.ok) throw new Error('Failed to fetch quotes');
  const json = await res.json();
  return json?.data?.quotes ?? [];
}

export default function QuotesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const {
    data: quotes = [],
    isLoading,
    isError
  } = useQuery({
    queryKey: ['underwriting', 'quotes'],
    queryFn: fetchQuotes,
    staleTime: 30 * 1000
  });

  const filtered = quotes.filter((q) => {
    const haystack = [
      q.quoteNumber,
      q.submission.reference,
      q.submission.vesselName ?? ''
    ]
      .join(' ')
      .toLowerCase();
    const matchSearch = !search || haystack.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className='flex-1 space-y-6 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Quotes</h2>
          <p className='text-muted-foreground'>
            Indication, firm and bound quotes
          </p>
        </div>
        <Link
          href='/dashboard/underwriting/new'
          className='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
        >
          <IconPlus className='h-4 w-4' />
          New Quote
        </Link>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap items-center gap-3'>
        <div className='relative max-w-xs min-w-[220px] flex-1'>
          <IconSearch className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <input
            type='text'
            placeholder='Search quote, submission, vessel…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='bg-card border-border w-full rounded-lg border py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500'
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className='absolute top-1/2 right-2 -translate-y-1/2'
            >
              <IconX className='text-muted-foreground h-4 w-4' />
            </button>
          )}
        </div>
        <div className='flex flex-wrap gap-1.5'>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            All
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === s ? STATUS_STYLES[s] + ' ring-1 ring-current' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
        {(search || statusFilter !== 'ALL') && (
          <span className='text-muted-foreground text-xs'>
            {filtered.length} of {quotes.length}
          </span>
        )}
      </div>

      <div className='bg-card overflow-hidden rounded-xl border'>
        {isLoading && (
          <div className='flex items-center justify-center py-24'>
            <p className='text-muted-foreground text-sm'>Loading...</p>
          </div>
        )}

        {isError && (
          <div className='flex items-center justify-center py-24'>
            <p className='text-sm text-red-400'>Failed to load quotes.</p>
          </div>
        )}

        {!isLoading && !isError && quotes.length === 0 && (
          <div className='flex flex-col items-center justify-center gap-3 py-24 text-center'>
            <div className='bg-muted rounded-xl p-4'>
              <IconReportMoney className='text-muted-foreground h-8 w-8' />
            </div>
            <p className='text-lg font-semibold'>No quotes yet</p>
            <p className='text-muted-foreground max-w-sm text-sm'>
              Quotes will appear here after you save your first premium
              calculation.
            </p>
            <Link
              href='/dashboard/underwriting/new'
              className='mt-2 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
            >
              <IconPlus className='h-4 w-4' />
              Calculate First Quote
            </Link>
          </div>
        )}

        {!isLoading &&
          !isError &&
          quotes.length > 0 &&
          filtered.length === 0 && (
            <div className='flex flex-col items-center justify-center gap-2 py-16 text-center'>
              <p className='text-muted-foreground text-sm'>
                No quotes match your filters.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                }}
                className='text-xs text-blue-400 hover:underline'
              >
                Clear filters
              </button>
            </div>
          )}

        {!isLoading && !isError && filtered.length > 0 && (
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-muted-foreground border-b text-left text-xs tracking-wide uppercase'>
                <th className='px-4 py-3 font-medium'>Quote #</th>
                <th className='px-4 py-3 font-medium'>Submission</th>
                <th className='px-4 py-3 font-medium'>Vessel</th>
                <th className='px-4 py-3 font-medium'>Hull Value</th>
                <th className='px-4 py-3 font-medium'>Status</th>
                <th className='px-4 py-3 font-medium'>Total Premium</th>
                <th className='px-4 py-3 font-medium'>Hull</th>
                <th className='px-4 py-3 font-medium'>P&I</th>
                <th className='px-4 py-3 font-medium'>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  onClick={() =>
                    router.push(
                      `/dashboard/underwriting/submissions/${q.submission.id}`
                    )
                  }
                  className='hover:bg-muted/50 cursor-pointer border-b transition-colors last:border-0'
                >
                  <td className='px-4 py-3 font-mono text-xs font-medium'>
                    {q.quoteNumber}
                  </td>
                  <td className='px-4 py-3 font-mono text-xs'>
                    {q.submission.reference}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-2'>
                      <IconShip className='text-muted-foreground h-4 w-4 shrink-0' />
                      <span>{q.submission.vesselName ?? '—'}</span>
                    </div>
                  </td>
                  <td className='px-4 py-3'>
                    {q.submission.hullValue
                      ? `$${Number(q.submission.hullValue).toLocaleString()}`
                      : '—'}
                  </td>
                  <td className='px-4 py-3'>
                    <StatusBadge status={q.status} />
                  </td>
                  <td className='px-4 py-3 font-semibold text-blue-400'>
                    $
                    {Number(q.totalPremium).toLocaleString('en-US', {
                      minimumFractionDigits: 2
                    })}
                  </td>
                  <td className='px-4 py-3 text-xs'>
                    $
                    {Number(q.hullPremium).toLocaleString('en-US', {
                      minimumFractionDigits: 2
                    })}
                  </td>
                  <td className='px-4 py-3 text-xs'>
                    $
                    {Number(q.liabilityPremium).toLocaleString('en-US', {
                      minimumFractionDigits: 2
                    })}
                  </td>
                  <td className='text-muted-foreground px-4 py-3 text-xs'>
                    {new Date(q.createdAt).toLocaleDateString('en-US', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

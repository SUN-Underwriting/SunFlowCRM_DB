'use client';

import { useQuery } from '@tanstack/react-query';
import { IconReportMoney, IconPlus, IconShip } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const {
    data: quotes = [],
    isLoading,
    isError
  } = useQuery({
    queryKey: ['underwriting', 'quotes'],
    queryFn: fetchQuotes,
    staleTime: 30 * 1000
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

        {!isLoading && !isError && quotes.length > 0 && (
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
              {quotes.map((q) => (
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

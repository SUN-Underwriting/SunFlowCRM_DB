'use client';

import { useQuery } from '@tanstack/react-query';
import { IconClipboardList, IconPlus, IconShip } from '@tabler/icons-react';
import Link from 'next/link';

type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEW'
  | 'QUOTED'
  | 'BOUND'
  | 'DECLINED'
  | 'EXPIRED';

interface Quote {
  id: string;
  totalPremium: number;
}

interface Submission {
  id: string;
  reference: string;
  status: SubmissionStatus;
  vesselName: string | null;
  hullValue: number | null;
  territory: string;
  createdAt: string;
  quotes: Quote[];
}

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  SUBMITTED: 'bg-blue-500/20 text-blue-400',
  REVIEW: 'bg-yellow-500/20 text-yellow-400',
  QUOTED: 'bg-green-500/20 text-green-400',
  BOUND: 'bg-emerald-500/20 text-emerald-400',
  DECLINED: 'bg-red-500/20 text-red-400',
  EXPIRED: 'bg-gray-500/20 text-gray-500'
};

function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}
    >
      {status}
    </span>
  );
}

async function fetchSubmissions(): Promise<Submission[]> {
  const res = await fetch('/api/underwriting/submissions');
  if (!res.ok) throw new Error('Failed to fetch submissions');
  const json = await res.json();
  return json?.data?.submissions ?? [];
}

export default function SubmissionsPage() {
  const {
    data: submissions = [],
    isLoading,
    isError
  } = useQuery({
    queryKey: ['underwriting', 'submissions'],
    queryFn: fetchSubmissions,
    staleTime: 30 * 1000
  });

  return (
    <div className='flex-1 space-y-6 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Submissions</h2>
          <p className='text-muted-foreground'>All underwriting submissions</p>
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
            <p className='text-sm text-red-400'>Failed to load submissions.</p>
          </div>
        )}

        {!isLoading && !isError && submissions.length === 0 && (
          <div className='flex flex-col items-center justify-center gap-3 py-24 text-center'>
            <div className='bg-muted rounded-xl p-4'>
              <IconClipboardList className='text-muted-foreground h-8 w-8' />
            </div>
            <p className='text-lg font-semibold'>No submissions yet</p>
            <p className='text-muted-foreground max-w-sm text-sm'>
              Calculate your first yacht insurance quote to get started.
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

        {!isLoading && !isError && submissions.length > 0 && (
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-muted-foreground border-b text-left text-xs tracking-wide uppercase'>
                <th className='px-4 py-3 font-medium'>Reference</th>
                <th className='px-4 py-3 font-medium'>Vessel</th>
                <th className='px-4 py-3 font-medium'>Hull Value</th>
                <th className='px-4 py-3 font-medium'>Territory</th>
                <th className='px-4 py-3 font-medium'>Status</th>
                <th className='px-4 py-3 font-medium'>Total Premium</th>
                <th className='px-4 py-3 font-medium'>Created</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const premium = s.quotes[0]?.totalPremium;
                return (
                  <tr
                    key={s.id}
                    className='hover:bg-muted/50 border-b transition-colors last:border-0'
                  >
                    <td className='px-4 py-3 font-mono text-xs font-medium'>
                      {s.reference}
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-2'>
                        <IconShip className='text-muted-foreground h-4 w-4 shrink-0' />
                        <span>{s.vesselName ?? '—'}</span>
                      </div>
                    </td>
                    <td className='px-4 py-3'>
                      {s.hullValue
                        ? `$${Number(s.hullValue).toLocaleString()}`
                        : '—'}
                    </td>
                    <td className='px-4 py-3 text-xs uppercase'>
                      {s.territory}
                    </td>
                    <td className='px-4 py-3'>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className='px-4 py-3 font-medium'>
                      {premium != null
                        ? `$${Number(premium).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className='text-muted-foreground px-4 py-3 text-xs'>
                      {new Date(s.createdAt).toLocaleDateString('en-US', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

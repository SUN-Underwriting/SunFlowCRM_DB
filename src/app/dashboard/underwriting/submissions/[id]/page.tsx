'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AIAnalysisPanel } from '@/components/underwriting/AIAnalysisPanel';
import { toast } from 'sonner';
import {
  IconArrowLeft,
  IconShip,
  IconFileText,
  IconCurrencyDollar,
  IconUser,
  IconCalendar,
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconClock,
  IconChevronRight,
  IconAnchor,
  IconShield,
  IconMessage,
  IconActivity,
  IconChartBar,
  IconDownload,
  IconSend,
  IconCheck
} from '@tabler/icons-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  totalPremium: number;
  hullPremium: number;
  liabilityPremium: number;
  baseRatePct: number;
  adjustedRatePct: number;
  netAdjustmentPct: number;
  discountsApplied: Array<{ code: string; label: string; pct: number }>;
  loadingsApplied: Array<{ code: string; label: string; pct: number }>;
  hullDeductible: number;
  hullDeductiblePct: number;
  liabilityDed: number;
  optionalPremiums: Record<string, number>;
  rateTableSource: string;
  uwFlags: string[];
  autoDecline?: string | null;
  createdAt: string;
  validUntil?: string;
}

interface Submission {
  id: string;
  reference: string;
  status: string;
  vesselName?: string;
  vesselType?: string;
  yearBuilt?: number;
  lengthFeet?: number;
  hullValue?: number;
  currency: string;
  territory: string;
  useType?: string;
  navigationArea?: string;
  maxSpeedKnots?: number;
  liabilityLimit?: number;
  hullDeductiblePct?: number;
  faultClaimsCY?: number;
  faultClaimsPY?: number;
  faultClaims2Y?: number;
  faultClaims3Y?: number;
  noFaultClaims?: number;
  layUpMonths?: number;
  hasAutoFireExt?: boolean;
  professionalCrew?: boolean;
  hasYachtingQual?: boolean;
  dieselOnly?: boolean;
  includeWindstorm?: boolean;
  englishLaw?: boolean;
  insuredName?: string;
  brokerName?: string;
  brokerCompany?: string;
  brokerEmail?: string;
  navAreaModifier?: string;
  uwNotes?: string;
  uwDecision?: string;
  aiAnalysis?: Record<string, unknown> | null;
  aiAnalyzedAt?: string | null;
  createdAt: string;
  quotes: Quote[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number | undefined | null, decimals = 0) {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val);
}

function fmtPct(val: number | undefined | null) {
  if (val == null || isNaN(val)) return '—';
  return `${Number(val).toFixed(3)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  DRAFT: { label: 'Draft', color: 'text-zinc-400', bg: 'bg-zinc-800' },
  SUBMITTED: {
    label: 'Submitted',
    color: 'text-blue-400',
    bg: 'bg-blue-900/40'
  },
  REVIEW: {
    label: 'Under Review',
    color: 'text-amber-400',
    bg: 'bg-amber-900/40'
  },
  QUOTED: { label: 'Quoted', color: 'text-sky-400', bg: 'bg-sky-900/40' },
  BOUND: { label: 'Bound', color: 'text-emerald-400', bg: 'bg-emerald-900/40' },
  DECLINED: { label: 'Declined', color: 'text-red-400', bg: 'bg-red-900/40' },
  EXPIRED: { label: 'Expired', color: 'text-zinc-500', bg: 'bg-zinc-800' }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className='overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900'>
      <div className='flex items-center gap-2 border-b border-zinc-800 px-5 py-3'>
        <Icon className='h-4 w-4 text-zinc-400' />
        <span className='text-xs font-semibold tracking-widest text-zinc-400 uppercase'>
          {title}
        </span>
      </div>
      <div className='p-5'>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-0.5'>
      <span className='text-xs text-zinc-500'>{label}</span>
      <span className='text-sm font-medium text-zinc-100'>{value ?? '—'}</span>
    </div>
  );
}

function Grid({
  cols = 3,
  children
}: {
  cols?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className='grid gap-4'
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

function Badge({
  status,
  uwDecision
}: {
  status: string;
  uwDecision?: string;
}) {
  // Show "Referred" pill if uwDecision is REFER, regardless of status
  if (uwDecision === 'REFER') {
    return (
      <span className='inline-flex items-center rounded-full bg-orange-900/40 px-2.5 py-0.5 text-xs font-semibold text-orange-400'>
        Referred
      </span>
    );
  }
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

function AdjustmentRow({
  item,
  type
}: {
  item: { code: string; label: string; pct: number };
  type: 'discount' | 'loading';
}) {
  const isDiscount = type === 'discount';
  const pctDisplay = `${isDiscount ? '-' : '+'}${Math.abs(Number(item.pct)).toFixed(1)}%`;
  return (
    <div className='flex items-center justify-between border-b border-zinc-800 py-1.5 last:border-0'>
      <div>
        <span className='mr-2 font-mono text-xs text-zinc-500'>
          {item.code}
        </span>
        <span className='text-sm text-zinc-300'>{item.label}</span>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${isDiscount ? 'text-emerald-400' : 'text-amber-400'}`}
      >
        {pctDisplay}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [sub, setSub] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [uwNotes, setUwNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPolicy, setDownloadingPolicy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueValidFrom, setIssueValidFrom] = useState('');
  const [issueValidUntil, setIssueValidUntil] = useState('');

  const id = params?.id as string;

  useEffect(() => {
    if (!id) return;
    fetch(`/api/underwriting/submissions/${id}`)
      .then((r) => r.json())
      .then((json) => {
        const data = json?.data?.submission;
        setSub(data ?? null);
        setUwNotes(data?.uwNotes ?? '');
      })
      .catch(() => toast.error('Failed to load submission'))
      .finally(() => setLoading(false));
  }, [id]);

  const quote = sub?.quotes?.[0]; // latest quote

  async function updateStatus(newStatus: string) {
    setActionLoading(newStatus);
    try {
      const res = await fetch(`/api/underwriting/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSub(json?.data?.submission ?? null);
      const label = STATUS_CONFIG[newStatus]?.label ?? newStatus;
      toast.success(`Status updated to ${label}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  }

  async function referSubmission() {
    setActionLoading('REFER');
    try {
      const res = await fetch(`/api/underwriting/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uwDecision: 'REFER' })
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSub(json?.data?.submission ?? null);
      toast.success('Submission referred');
    } catch {
      toast.error('Failed to refer submission');
    } finally {
      setActionLoading(null);
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      const res = await fetch(`/api/underwriting/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uwNotes })
      });
      if (!res.ok) throw new Error();
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  }

  async function downloadSlip() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/underwriting/submissions/${id}/slip`);
      if (!res.ok) throw new Error('Failed to generate slip');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QuoteSlip_${sub!.reference}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Quote slip downloaded');
    } catch {
      toast.error('Failed to download slip');
    } finally {
      setDownloading(false);
    }
  }

  function openIssueForm() {
    const from = new Date();
    const until = new Date();
    until.setDate(until.getDate() + 30);
    setIssueValidFrom(from.toISOString().split('T')[0]);
    setIssueValidUntil(until.toISOString().split('T')[0]);
    setIssueOpen(true);
  }

  async function issueQuote() {
    setActionLoading('QUOTED');
    try {
      const res = await fetch(`/api/underwriting/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'QUOTED',
          quoteValidFrom: issueValidFrom,
          quoteValidUntil: issueValidUntil
        })
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSub(json?.data?.submission ?? null);
      setIssueOpen(false);
      toast.success('Quote issued — ready to bind');
    } catch {
      toast.error('Failed to issue quote');
    } finally {
      setActionLoading(null);
    }
  }

  function sendToBroker() {
    if (!sub || !quote) return;
    const email = sub.brokerEmail ?? '';
    const validUntilStr = quote.validUntil
      ? fmtDate(quote.validUntil)
      : '30 days from issue';
    const subject = `Insurance Quote — ${sub.reference} — ${sub.vesselName ?? 'Vessel'}`;
    const body = [
      `Dear ${sub.brokerName ?? 'Broker'},`,
      '',
      `Please find below the marine yacht insurance quotation for ${sub.vesselName ?? 'your vessel'}.`,
      '',
      `Quote Reference:  ${sub.reference}`,
      `Total Premium:    ${fmt(Number(quote.totalPremium))} per annum`,
      `Hull Value:       ${fmt(Number(sub.hullValue))}`,
      `Liability Limit:  ${fmt(Number(sub.liabilityLimit))}`,
      `Territory:        ${sub.territory}`,
      `Valid Until:      ${validUntilStr}`,
      '',
      'This quotation is subject to full terms and conditions set out in the Quote Slip.',
      'Please confirm acceptance in writing to bind coverage.',
      '',
      'Kind regards,',
      'Sun Re Marine Underwriting'
    ].join('\n');
    window.open(
      `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank'
    );
  }

  async function downloadPolicy() {
    setDownloadingPolicy(true);
    try {
      const res = await fetch(`/api/underwriting/submissions/${id}/policy`);
      if (!res.ok) throw new Error('Failed to generate policy');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Policy_POL-${sub!.reference.replace('SUN-', '')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Policy certificate downloaded');
    } catch {
      toast.error('Failed to download policy');
    } finally {
      setDownloadingPolicy(false);
    }
  }

  if (loading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500' />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className='flex h-96 flex-col items-center justify-center gap-4'>
        <IconCircleX className='h-12 w-12 text-zinc-600' />
        <p className='text-zinc-400'>Submission not found</p>
        <button
          onClick={() => router.back()}
          className='text-sm text-blue-400 hover:underline'
        >
          Go back
        </button>
      </div>
    );
  }

  const totalClaims =
    (sub.faultClaimsCY ?? 0) +
    (sub.faultClaimsPY ?? 0) +
    (sub.faultClaims2Y ?? 0) +
    (sub.faultClaims3Y ?? 0);
  const canReview = sub.status === 'SUBMITTED';
  const canRefer =
    ['SUBMITTED', 'REVIEW'].includes(sub.status) && sub.uwDecision !== 'REFER';
  const canDecline = !['BOUND', 'DECLINED', 'EXPIRED'].includes(sub.status);
  const canIssueQuote = !!quote && ['SUBMITTED', 'REVIEW'].includes(sub.status);
  const uwFlags: string[] = (quote?.uwFlags as string[]) ?? [];
  const autoDecline = quote?.autoDecline ?? null;
  const hasBlocker = uwFlags.some((f) => f.includes('CANNOT BIND'));
  const canBind = sub.status === 'QUOTED' && !autoDecline && !hasBlocker;
  const isTerminal = ['BOUND', 'DECLINED', 'EXPIRED'].includes(sub.status);

  return (
    <div className='mx-auto max-w-6xl space-y-6 px-6 py-8'>
      {/* ── Header ── */}
      <div className='space-y-3'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => router.back()}
              className='rounded-lg bg-zinc-800 p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100'
            >
              <IconArrowLeft className='h-4 w-4' />
            </button>
            <div>
              <div className='flex items-center gap-3'>
                <h1 className='font-mono text-2xl font-bold text-zinc-100'>
                  {sub.reference}
                </h1>
                <Badge status={sub.status} uwDecision={sub.uwDecision} />
              </div>
              <p className='mt-0.5 text-sm text-zinc-500'>
                {sub.vesselName ?? 'Unnamed vessel'} · Created{' '}
                {fmtDate(sub.createdAt)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className='flex items-center gap-2'>
            {quote && (
              <button
                onClick={downloadSlip}
                disabled={downloading}
                className='flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50'
              >
                <IconDownload className='h-4 w-4' />
                {downloading ? 'Generating…' : 'Quote Slip'}
              </button>
            )}
            {quote && sub.status === 'QUOTED' && (
              <button
                onClick={sendToBroker}
                className='flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700'
              >
                <IconSend className='h-4 w-4' />
                Send to Broker
              </button>
            )}
            {canReview && (
              <button
                onClick={() => updateStatus('REVIEW')}
                disabled={actionLoading === 'REVIEW'}
                className='flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50'
              >
                <IconActivity className='h-4 w-4' />
                Start Review
              </button>
            )}
            {canIssueQuote && !issueOpen && (
              <button
                onClick={openIssueForm}
                className='flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500'
              >
                <IconCheck className='h-4 w-4' />
                Issue Quote
              </button>
            )}
            {canRefer && (
              <button
                onClick={referSubmission}
                disabled={actionLoading === 'REFER'}
                className='flex items-center gap-1.5 rounded-lg bg-amber-900/50 px-3 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-900/70 disabled:opacity-50'
              >
                <IconAlertTriangle className='h-4 w-4' />
                Refer
              </button>
            )}
            {canDecline && (
              <button
                onClick={() => updateStatus('DECLINED')}
                disabled={actionLoading === 'DECLINED'}
                className='flex items-center gap-1.5 rounded-lg bg-red-900/40 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50'
              >
                <IconCircleX className='h-4 w-4' />
                Decline
              </button>
            )}
            {canBind && (
              <button
                onClick={() => updateStatus('BOUND')}
                disabled={actionLoading === 'BOUND'}
                className='flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50'
              >
                <IconCircleCheck className='h-4 w-4' />
                Bind Policy
              </button>
            )}
            {sub.status === 'QUOTED' && (autoDecline || hasBlocker) && (
              <span
                title={autoDecline ?? 'UW flags prevent binding'}
                className='flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-500'
              >
                <IconCircleX className='h-4 w-4' />
                Bind Blocked
              </span>
            )}
            {sub.status === 'BOUND' && (
              <>
                <button
                  onClick={downloadPolicy}
                  disabled={downloadingPolicy}
                  className='flex items-center gap-1.5 rounded-lg bg-emerald-900/40 px-3 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-900/60 disabled:opacity-50'
                >
                  <IconDownload className='h-4 w-4' />
                  {downloadingPolicy ? 'Generating…' : 'Policy'}
                </button>
                <span className='flex items-center gap-1.5 rounded-lg bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-400'>
                  <IconCircleCheck className='h-4 w-4' />
                  Bound
                </span>
              </>
            )}
            {sub.status === 'DECLINED' && (
              <span className='flex items-center gap-1.5 rounded-lg bg-red-900/40 px-4 py-2 text-sm font-semibold text-red-400'>
                <IconCircleX className='h-4 w-4' />
                Declined
              </span>
            )}
          </div>
        </div>

        {/* ── Issue Quote inline form ── */}
        {issueOpen && (
          <div className='rounded-lg border border-blue-500/40 bg-blue-950/30 p-4'>
            <p className='mb-3 text-sm font-medium text-blue-300'>
              Set quote validity period — quote will be issued as FIRM
            </p>
            <div className='flex flex-wrap items-end gap-4'>
              <div>
                <label className='mb-1 block text-xs text-zinc-500'>
                  Valid From
                </label>
                <input
                  type='date'
                  value={issueValidFrom}
                  onChange={(e) => setIssueValidFrom(e.target.value)}
                  className='rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none'
                />
              </div>
              <div>
                <label className='mb-1 block text-xs text-zinc-500'>
                  Valid Until
                </label>
                <input
                  type='date'
                  value={issueValidUntil}
                  onChange={(e) => setIssueValidUntil(e.target.value)}
                  className='rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none'
                />
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={issueQuote}
                  disabled={actionLoading === 'QUOTED'}
                  className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50'
                >
                  {actionLoading === 'QUOTED' ? 'Issuing…' : 'Confirm Issue'}
                </button>
                <button
                  onClick={() => setIssueOpen(false)}
                  className='rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700'
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Premium Summary bar ── */}
      {quote && (
        <div className='rounded-xl border border-zinc-700 bg-gradient-to-r from-zinc-900 to-zinc-800 p-5'>
          <div className='grid grid-cols-4 gap-6'>
            <div>
              <p className='mb-1 text-xs tracking-wider text-zinc-500 uppercase'>
                Total Premium
              </p>
              <p className='text-3xl font-bold text-emerald-400 tabular-nums'>
                {fmt(Number(quote.totalPremium))}
              </p>
              <p className='mt-1 text-xs text-zinc-500'>{quote.quoteNumber}</p>
            </div>
            <div className='border-l border-zinc-700 pl-6'>
              <p className='mb-1 text-xs tracking-wider text-zinc-500 uppercase'>
                Hull Premium
              </p>
              <p className='text-xl font-semibold text-zinc-100 tabular-nums'>
                {fmt(Number(quote.hullPremium))}
              </p>
              <p className='mt-1 text-xs text-zinc-500'>
                Rate: {fmtPct(Number(quote.adjustedRatePct))}
              </p>
            </div>
            <div className='border-l border-zinc-700 pl-6'>
              <p className='mb-1 text-xs tracking-wider text-zinc-500 uppercase'>
                P&amp;I Premium
              </p>
              <p className='text-xl font-semibold text-zinc-100 tabular-nums'>
                {fmt(Number(quote.liabilityPremium))}
              </p>
              <p className='mt-1 text-xs text-zinc-500'>
                Limit: {fmt(Number(sub.liabilityLimit))}
              </p>
            </div>
            <div className='border-l border-zinc-700 pl-6'>
              <p className='mb-1 text-xs tracking-wider text-zinc-500 uppercase'>
                Net Adjustment
              </p>
              <p
                className={`text-xl font-semibold tabular-nums ${Number(quote.netAdjustmentPct) < 0 ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                {Number(quote.netAdjustmentPct) < 0 ? '' : '+'}
                {Number(quote.netAdjustmentPct).toFixed(1)}%
              </p>
              <p className='mt-1 text-xs text-zinc-500'>
                Base: {fmtPct(Number(quote.baseRatePct))}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className='grid grid-cols-3 gap-5'>
        {/* ── Left column (2/3) ── */}
        <div className='col-span-2 space-y-5'>
          {/* Vessel */}
          <Section title='Vessel Details' icon={IconShip}>
            <Grid cols={3}>
              <Field label='Vessel Name' value={sub.vesselName} />
              <Field label='Type' value={sub.vesselType?.replace(/_/g, ' ')} />
              <Field label='Year Built' value={sub.yearBuilt} />
              <Field
                label='Length'
                value={sub.lengthFeet ? `${sub.lengthFeet} ft` : undefined}
              />
              <Field
                label='Max Speed'
                value={
                  sub.maxSpeedKnots ? `${sub.maxSpeedKnots} kn` : undefined
                }
              />
              <Field label='Territory' value={sub.territory} />
              <Field label='Use Type' value={sub.useType?.replace(/_/g, ' ')} />
              <Field label='Navigation Area' value={sub.navigationArea} />
              <Field label='Hull Value' value={fmt(Number(sub.hullValue))} />
            </Grid>
            <div className='mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4'>
              {[
                { flag: sub.hasAutoFireExt, label: '🔥 Auto Fire Ext.' },
                { flag: sub.professionalCrew, label: '👨‍✈️ Professional Crew' },
                {
                  flag: sub.hasYachtingQual,
                  label: '🎓 Yachting Qualification'
                },
                { flag: sub.dieselOnly, label: '⛽ Diesel Only' },
                { flag: sub.includeWindstorm, label: '🌪️ Windstorm Included' },
                { flag: sub.englishLaw, label: '⚖️ English Law' }
              ]
                .filter((f) => f.flag)
                .map((f) => (
                  <span
                    key={f.label}
                    className='rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300'
                  >
                    {f.label}
                  </span>
                ))}
            </div>
          </Section>

          {/* Coverage */}
          <Section title='Coverage' icon={IconShield}>
            <Grid cols={3}>
              <Field label='Hull Value' value={fmt(Number(sub.hullValue))} />
              <Field
                label='Liability Limit'
                value={fmt(Number(sub.liabilityLimit))}
              />
              <Field
                label='Hull Deductible'
                value={
                  sub.hullDeductiblePct
                    ? `${(Number(sub.hullDeductiblePct) * 100).toFixed(0)}%`
                    : undefined
                }
              />
              {quote && (
                <>
                  <Field
                    label='Hull Ded. Amount'
                    value={fmt(Number(quote.hullDeductible))}
                  />
                  <Field
                    label='Liability Ded.'
                    value={fmt(Number(quote.liabilityDed))}
                  />
                </>
              )}
            </Grid>
          </Section>

          {/* UW Flags */}
          {quote && (autoDecline || uwFlags.length > 0) && (
            <div className='space-y-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4'>
              <p className='text-xs font-semibold tracking-wider text-amber-400 uppercase'>
                Underwriting Flags
              </p>
              {autoDecline && (
                <div className='flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2'>
                  <IconCircleX className='mt-0.5 h-4 w-4 shrink-0 text-red-400' />
                  <span className='text-sm text-red-300'>
                    AUTO-DECLINE: {autoDecline}
                  </span>
                </div>
              )}
              {uwFlags.map((flag, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                    flag.includes('CANNOT BIND')
                      ? 'border border-red-500/40 bg-red-950/30'
                      : 'border border-amber-500/30 bg-amber-950/20'
                  }`}
                >
                  <IconAlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      flag.includes('CANNOT BIND')
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      flag.includes('CANNOT BIND')
                        ? 'text-red-300'
                        : 'text-amber-300'
                    }`}
                  >
                    {flag}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Rating Breakdown */}
          {quote && (
            <Section title='Rating Breakdown' icon={IconChartBar}>
              <div className='space-y-4'>
                {/* Rate flow */}
                <div className='flex items-center gap-3 text-sm'>
                  <div className='flex flex-col items-center'>
                    <span className='text-xs text-zinc-500'>Base Rate</span>
                    <span className='text-lg font-semibold text-zinc-100 tabular-nums'>
                      {fmtPct(Number(quote.baseRatePct))}
                    </span>
                  </div>
                  <IconChevronRight className='h-4 w-4 text-zinc-600' />
                  <div className='flex flex-col items-center'>
                    <span className='text-xs text-zinc-500'>Net Adj.</span>
                    <span
                      className={`text-lg font-semibold tabular-nums ${Number(quote.netAdjustmentPct) <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}
                    >
                      {Number(quote.netAdjustmentPct) < 0 ? '' : '+'}
                      {Number(quote.netAdjustmentPct).toFixed(1)}%
                    </span>
                  </div>
                  <IconChevronRight className='h-4 w-4 text-zinc-600' />
                  <div className='flex flex-col items-center'>
                    <span className='text-xs text-zinc-500'>Adjusted Rate</span>
                    <span className='text-lg font-semibold text-blue-400 tabular-nums'>
                      {fmtPct(Number(quote.adjustedRatePct))}
                    </span>
                  </div>
                  <IconChevronRight className='h-4 w-4 text-zinc-600' />
                  <div className='flex flex-col items-center'>
                    <span className='text-xs text-zinc-500'>Hull Premium</span>
                    <span className='text-lg font-semibold text-emerald-400 tabular-nums'>
                      {fmt(Number(quote.hullPremium))}
                    </span>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-4 pt-2'>
                  {/* Discounts */}
                  <div>
                    <p className='mb-2 text-xs font-semibold tracking-wider text-emerald-500 uppercase'>
                      Discounts ({quote.discountsApplied?.length ?? 0})
                    </p>
                    {(quote.discountsApplied?.length ?? 0) === 0 ? (
                      <p className='text-xs text-zinc-600'>None applied</p>
                    ) : (
                      quote.discountsApplied.map((d) => (
                        <AdjustmentRow key={d.code} item={d} type='discount' />
                      ))
                    )}
                  </div>
                  {/* Loadings */}
                  <div>
                    <p className='mb-2 text-xs font-semibold tracking-wider text-amber-500 uppercase'>
                      Loadings ({quote.loadingsApplied?.length ?? 0})
                    </p>
                    {(quote.loadingsApplied?.length ?? 0) === 0 ? (
                      <p className='text-xs text-zinc-600'>None applied</p>
                    ) : (
                      quote.loadingsApplied.map((l) => (
                        <AdjustmentRow key={l.code} item={l} type='loading' />
                      ))
                    )}
                  </div>
                </div>

                {/* Optional premiums */}
                {quote.optionalPremiums &&
                  Object.keys(quote.optionalPremiums).length > 0 && (
                    <div className='border-t border-zinc-800 pt-3'>
                      <p className='mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase'>
                        Optional Covers
                      </p>
                      <div className='grid grid-cols-3 gap-3'>
                        {Object.entries(quote.optionalPremiums).map(
                          ([key, val]) => (
                            <div
                              key={key}
                              className='rounded-lg bg-zinc-800 p-2.5'
                            >
                              <p className='text-xs text-zinc-500 capitalize'>
                                {key.replace(/([A-Z])/g, ' $1')}
                              </p>
                              <p className='text-sm font-semibold text-zinc-100'>
                                {fmt(Number(val))}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                <p className='pt-1 text-xs text-zinc-600'>
                  Rate table: {quote.rateTableSource}
                </p>
              </div>
            </Section>
          )}

          {/* Loss History */}
          <Section title='Loss History (3 Years)' icon={IconActivity}>
            <div className='grid grid-cols-5 gap-3'>
              {[
                { label: 'Fault CY', value: sub.faultClaimsCY },
                { label: 'Fault PY', value: sub.faultClaimsPY },
                { label: 'Fault -2Y', value: sub.faultClaims2Y },
                { label: 'Fault -3Y', value: sub.faultClaims3Y },
                { label: 'No-Fault', value: sub.noFaultClaims }
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-lg p-3 text-center ${(item.value ?? 0) > 0 ? 'border border-red-900/50 bg-red-900/30' : 'bg-zinc-800'}`}
                >
                  <p className='text-xs text-zinc-500'>{item.label}</p>
                  <p
                    className={`mt-1 text-2xl font-bold ${(item.value ?? 0) > 0 ? 'text-red-400' : 'text-zinc-300'}`}
                  >
                    {item.value ?? 0}
                  </p>
                </div>
              ))}
            </div>
            {totalClaims > 0 && (
              <p className='mt-3 flex items-center gap-1 text-xs text-amber-400'>
                <IconAlertTriangle className='h-3 w-3' />
                {totalClaims} fault claim{totalClaims > 1 ? 's' : ''} in rolling
                3-year window
              </p>
            )}
            {sub.layUpMonths ? (
              <p className='mt-2 flex items-center gap-1 text-xs text-zinc-400'>
                <IconAnchor className='h-3 w-3' /> Lay-up: {sub.layUpMonths}{' '}
                months
              </p>
            ) : null}
          </Section>
        </div>

        {/* ── Right column (1/3) ── */}
        <div className='space-y-5'>
          {/* Broker & Insured */}
          <Section title='Parties' icon={IconUser}>
            <div className='space-y-4'>
              <div>
                <p className='mb-1 text-xs text-zinc-500'>Insured</p>
                <p className='text-sm font-medium text-zinc-100'>
                  {sub.insuredName ?? '—'}
                </p>
              </div>
              <div>
                <p className='mb-1 text-xs text-zinc-500'>Broker</p>
                <p className='text-sm font-medium text-zinc-100'>
                  {sub.brokerName ?? '—'}
                </p>
                {sub.brokerEmail && (
                  <a
                    href={`mailto:${sub.brokerEmail}`}
                    className='text-xs text-blue-400 hover:underline'
                  >
                    {sub.brokerEmail}
                  </a>
                )}
              </div>
            </div>
          </Section>

          {/* Timeline */}
          <Section title='Timeline' icon={IconCalendar}>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='text-xs text-zinc-500'>Submitted</span>
                <span className='text-xs text-zinc-300'>
                  {fmtDate(sub.createdAt)}
                </span>
              </div>
              {quote?.validUntil && (
                <div className='flex items-center justify-between'>
                  <span className='text-xs text-zinc-500'>Valid Until</span>
                  <span className='text-xs text-zinc-300'>
                    {fmtDate(quote.validUntil)}
                  </span>
                </div>
              )}
              <div className='flex items-center justify-between'>
                <span className='text-xs text-zinc-500'>Quote Version</span>
                <span className='text-xs text-zinc-300'>
                  v{sub.quotes?.length ?? 1}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-xs text-zinc-500'>Status</span>
                <Badge status={sub.status} uwDecision={sub.uwDecision} />
              </div>
            </div>
          </Section>

          {/* UW Notes */}
          <Section title='Underwriter Notes' icon={IconMessage}>
            <textarea
              value={uwNotes}
              onChange={(e) => setUwNotes(e.target.value)}
              placeholder='Add underwriting notes, referral reasons, conditions...'
              rows={6}
              className='w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none'
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className='mt-2 w-full rounded-lg bg-zinc-700 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600 disabled:opacity-50'
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </Section>

          {/* AI Analysis */}
          <AIAnalysisPanel
            submissionId={sub.id}
            initialAnalysis={sub.aiAnalysis ? (sub.aiAnalysis as any) : null}
            initialAnalyzedAt={sub.aiAnalyzedAt ?? null}
          />

          {/* Quote history */}
          {sub.quotes.length > 1 && (
            <Section title='Quote History' icon={IconFileText}>
              <div className='space-y-2'>
                {sub.quotes.map((q, i) => (
                  <div
                    key={q.id}
                    className={`flex items-center justify-between py-2 ${i < sub.quotes.length - 1 ? 'border-b border-zinc-800' : ''}`}
                  >
                    <div>
                      <p className='font-mono text-xs text-zinc-300'>
                        {q.quoteNumber}
                      </p>
                      <p className='text-xs text-zinc-500'>
                        {fmtDate(q.createdAt)}
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='text-sm font-semibold text-zinc-100'>
                        {fmt(Number(q.totalPremium))}
                      </p>
                      <span className='text-xs text-zinc-500'>{q.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

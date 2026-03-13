'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconShip,
  IconCalculator,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconAlertTriangle,
  IconDeviceFloppy,
  IconBan
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { calculateYachtPremium } from '@/features/underwriting/rating/engine';
import type { RiskInput } from '@/features/underwriting/rating/types';

const STEPS = ['Vessel', 'Coverage', 'History', 'Quote'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className='flex items-center gap-2'>
      {STEPS.map((step, i) => (
        <div key={step} className='flex items-center gap-2'>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              i < current
                ? 'bg-green-600 text-white'
                : i === current
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < current ? <IconCheck className='h-4 w-4' /> : i + 1}
          </div>
          <span
            className={`hidden text-sm sm:block ${i === current ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
          >
            {step}
          </span>
          {i < STEPS.length - 1 && (
            <IconChevronRight className='text-muted-foreground h-4 w-4' />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className='space-y-1.5'>
      <label className='text-foreground text-sm font-medium'>{label}</label>
      {children}
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className='bg-background w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
    />
  );
}

function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className='bg-background w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
    >
      {children}
    </select>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  loading
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  loading?: boolean;
}) {
  return (
    <div className='bg-card flex items-center justify-between rounded-lg border px-4 py-3'>
      <span className={`text-sm ${loading ? 'text-red-300' : ''}`}>
        {label}
      </span>
      <button
        type='button'
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? (loading ? 'bg-red-600' : 'bg-blue-600') : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  );
}

export default function NewQuotePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ReturnType<
    typeof calculateYachtPremium
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const [vesselName, setVesselName] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerEmail, setBrokerEmail] = useState('');

  const [form, setForm] = useState<Partial<RiskInput>>({
    territory: 'ROW',
    vesselType: 'MOTOR',
    useType: 'PRIVATE',
    hullDeductiblePct: 0.02,
    englishLaw: true,
    includeWindstorm: false,
    includeLightningStrike: false,
    hasAutoFireExt: false,
    professionalCrew: false,
    hasYachtingQual: false,
    hasExperience3Years: false,
    dieselOnly: false,
    inlandWatersOnly: false,
    singleHanded: false,
    isKevlarMetal: false,
    racingRally: false,
    faultClaimsCY: 0,
    faultClaimsPY: 0,
    faultClaims2Y: 0,
    faultClaims3Y: 0,
    noFaultClaims: 0,
    layUpMonths: 0,
    liabilityLimit: 1_000_000,
    medicalExpensesLimit: 10_000,
    uninsuredBoatersLimit: 25_000,
    crewLiabilityLimit: 0
  });

  function set(key: keyof RiskInput, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      const payload = {
        hullValue: Number(form.hullValue) || 0,
        vesselType: form.vesselType || 'MOTOR',
        yearBuilt: Number(form.yearBuilt) || 2010,
        lengthFeet: Number(form.lengthFeet) || 40,
        territory: form.territory || 'ROW',
        useType: form.useType || 'PRIVATE',
        navAreaModifier: form.navAreaModifier ?? null,
        liabilityLimit: Number(form.liabilityLimit) || 1_000_000,
        hullDeductiblePct: Number(form.hullDeductiblePct) || 0.02,
        englishLaw: form.englishLaw ?? true,
        includeWindstorm: form.includeWindstorm ?? false,
        includeLightningStrike: form.includeLightningStrike ?? false,
        hasAutoFireExt: form.hasAutoFireExt ?? false,
        professionalCrew: form.professionalCrew ?? false,
        hasYachtingQual: form.hasYachtingQual ?? false,
        hasExperience3Years: form.hasExperience3Years ?? false,
        dieselOnly: form.dieselOnly ?? false,
        inlandWatersOnly: form.inlandWatersOnly ?? false,
        singleHanded: form.singleHanded ?? false,
        isKevlarMetal: form.isKevlarMetal ?? false,
        racingRally: form.racingRally ?? false,
        surveyDate: form.surveyDate,
        surveyType: form.surveyType,
        faultClaimsCY: Number(form.faultClaimsCY) || 0,
        faultClaimsPY: Number(form.faultClaimsPY) || 0,
        faultClaims2Y: Number(form.faultClaims2Y) || 0,
        faultClaims3Y: Number(form.faultClaims3Y) || 0,
        noFaultClaims: Number(form.noFaultClaims) || 0,
        layUpMonths: Number(form.layUpMonths) || 0,
        transits: [],
        maxSpeedKnots: form.maxSpeedKnots
          ? Number(form.maxSpeedKnots)
          : undefined,
        tenderValue: form.tenderValue ? Number(form.tenderValue) : undefined,
        personalProperty: form.personalProperty
          ? Number(form.personalProperty)
          : undefined,
        includeTowing: form.includeTowing ?? false,
        includeTrailer: form.includeTrailer ?? false,
        trailerValue: form.trailerValue ? Number(form.trailerValue) : undefined,
        medicalExpensesLimit: Number(form.medicalExpensesLimit) || 10_000,
        uninsuredBoatersLimit: Number(form.uninsuredBoatersLimit) || 25_000,
        crewLiabilityLimit: Number(form.crewLiabilityLimit) || 0,
        vesselName,
        brokerName,
        brokerEmail
      };
      try {
        res = await fetch('/api/underwriting/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Quote saved! Redirecting to submissions...');
      router.push('/dashboard/underwriting/submissions');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Request timed out — check the server logs');
      } else {
        toast.error(
          err instanceof Error ? err.message : 'Failed to save quote'
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function calculate() {
    const input: RiskInput = {
      hullValue: Number(form.hullValue) || 0,
      vesselType: form.vesselType || 'MOTOR',
      yearBuilt: Number(form.yearBuilt) || 2010,
      lengthFeet: Number(form.lengthFeet) || 40,
      territory: form.territory || 'ROW',
      useType: form.useType || 'PRIVATE',
      navAreaModifier: form.navAreaModifier || null,
      liabilityLimit: Number(form.liabilityLimit) || 1_000_000,
      hullDeductiblePct: Number(form.hullDeductiblePct) || 0.02,
      englishLaw: form.englishLaw ?? true,
      includeWindstorm: form.includeWindstorm ?? false,
      includeLightningStrike: form.includeLightningStrike ?? false,
      hasAutoFireExt: form.hasAutoFireExt ?? false,
      professionalCrew: form.professionalCrew ?? false,
      hasYachtingQual: form.hasYachtingQual ?? false,
      hasExperience3Years: form.hasExperience3Years ?? false,
      dieselOnly: form.dieselOnly ?? false,
      inlandWatersOnly: form.inlandWatersOnly ?? false,
      singleHanded: form.singleHanded ?? false,
      isKevlarMetal: form.isKevlarMetal ?? false,
      racingRally: form.racingRally ?? false,
      surveyDate: form.surveyDate,
      surveyType: form.surveyType,
      faultClaimsCY: Number(form.faultClaimsCY) || 0,
      faultClaimsPY: Number(form.faultClaimsPY) || 0,
      faultClaims2Y: Number(form.faultClaims2Y) || 0,
      faultClaims3Y: Number(form.faultClaims3Y) || 0,
      noFaultClaims: Number(form.noFaultClaims) || 0,
      layUpMonths: Number(form.layUpMonths) || 0,
      transits: [],
      maxSpeedKnots: form.maxSpeedKnots
        ? Number(form.maxSpeedKnots)
        : undefined,
      medicalExpensesLimit: Number(form.medicalExpensesLimit) ?? 10_000,
      uninsuredBoatersLimit: Number(form.uninsuredBoatersLimit) ?? 25_000,
      crewLiabilityLimit: Number(form.crewLiabilityLimit) ?? 0
    };
    setResult(calculateYachtPremium(input));
    setStep(3);
  }

  const vesselAge = form.yearBuilt
    ? new Date().getFullYear() - Number(form.yearBuilt)
    : 0;
  const needsSurvey = vesselAge > 15;

  return (
    <div className='flex-1 space-y-6 p-4 pt-6 md:p-8'>
      <div className='mx-auto max-w-2xl space-y-6'>
        {/* Header */}
        <div className='flex items-center gap-3'>
          <div className='rounded-xl bg-blue-500/10 p-2.5'>
            <IconCalculator className='h-6 w-6 text-blue-500' />
          </div>
          <div>
            <h2 className='text-2xl font-bold'>New Quote</h2>
            <p className='text-muted-foreground text-sm'>Sun Re Marine</p>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step 0: Vessel */}
        {step === 0 && (
          <div className='bg-card space-y-4 rounded-xl border p-6'>
            <div className='mb-2 flex items-center gap-2'>
              <IconShip className='h-5 w-5 text-blue-400' />
              <h3 className='font-semibold'>Vessel Details</h3>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field label='Vessel Name'>
                <Input
                  placeholder='e.g. Lady Veronica'
                  value={vesselName}
                  onChange={(e) => setVesselName(e.target.value)}
                />
              </Field>
              <Field label='Year Built'>
                <Input
                  type='number'
                  placeholder='2015'
                  value={form.yearBuilt || ''}
                  onChange={(e) => set('yearBuilt', e.target.value)}
                />
              </Field>
              <Field label='Hull Value (USD)' hint='Maximum $6,000,000'>
                <Input
                  type='number'
                  placeholder='500000'
                  value={form.hullValue || ''}
                  onChange={(e) => set('hullValue', e.target.value)}
                />
              </Field>
              <Field label='Length (feet)'>
                <Input
                  type='number'
                  placeholder='45'
                  value={form.lengthFeet || ''}
                  onChange={(e) => set('lengthFeet', e.target.value)}
                />
              </Field>
              <Field label='Vessel Type'>
                <Select
                  value={form.vesselType}
                  onChange={(e) => set('vesselType', e.target.value)}
                >
                  <option value='MOTOR'>Motor</option>
                  <option value='SAILING'>Sailing</option>
                  <option value='CATAMARAN'>Catamaran</option>
                  <option value='TRIMARAN'>Trimaran</option>
                  <option value='POWER'>Power</option>
                </Select>
              </Field>
              <Field label='Territory'>
                <Select
                  value={form.territory}
                  onChange={(e) => set('territory', e.target.value)}
                >
                  <option value='ROW'>Rest of World (EUR/GBP)</option>
                  <option value='US_CA_MX_CARIB'>
                    US / Canada / Mexico / Caribbean
                  </option>
                </Select>
              </Field>
              <Field label='Navigation Area'>
                <Select
                  value={form.navAreaModifier || ''}
                  onChange={(e) =>
                    set('navAreaModifier', e.target.value || null)
                  }
                >
                  <option value=''>Worldwide (no modifier)</option>
                  <option value='MED_EU'>
                    Mediterranean / European Waters
                  </option>
                  <option value='AUS_NZ'>
                    Australia / New Zealand (DECLINED)
                  </option>
                  <option value='WEST_COAST_US_MX'>
                    West Coast US / Mexico
                  </option>
                  <option value='CABO_SAN_LUCAS_SEASONAL'>
                    Cabo San Lucas Seasonal
                  </option>
                  <option value='CHESAPEAKE_SEASONAL'>
                    Chesapeake Bay Seasonal
                  </option>
                  <option value='CUBA_COL_HAITI_VEN'>
                    Cuba / Colombia / Haiti / Venezuela (+10%)
                  </option>
                </Select>
              </Field>
              <Field label='Use Type'>
                <Select
                  value={form.useType}
                  onChange={(e) => set('useType', e.target.value)}
                >
                  <option value='PRIVATE'>Private</option>
                  <option value='CHARTER'>Charter</option>
                  <option value='BAREBOAT'>Bareboat Charter</option>
                </Select>
              </Field>
              {(form.vesselType === 'MOTOR' || form.vesselType === 'POWER') && (
                <Field label='Max Speed (knots)' hint='Loading applies >36kt'>
                  <Input
                    type='number'
                    placeholder='20'
                    value={form.maxSpeedKnots || ''}
                    onChange={(e) => set('maxSpeedKnots', e.target.value)}
                  />
                </Field>
              )}
              <Field label='Broker Name'>
                <Input
                  placeholder='John Smith'
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                />
              </Field>
              <Field label='Broker Email'>
                <Input
                  type='email'
                  placeholder='broker@example.com'
                  value={brokerEmail}
                  onChange={(e) => setBrokerEmail(e.target.value)}
                />
              </Field>
            </div>

            {/* Survey — shown when vessel >15 years */}
            {needsSurvey && (
              <div className='space-y-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4'>
                <div className='flex items-center gap-2'>
                  <IconAlertTriangle className='h-4 w-4 text-yellow-400' />
                  <p className='text-sm font-semibold text-yellow-300'>
                    Survey Required — Vessel Over 15 Years
                  </p>
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <Field label='Survey Date' hint='Max 5 years old'>
                    <Input
                      type='date'
                      value={form.surveyDate || ''}
                      onChange={(e) => set('surveyDate', e.target.value)}
                    />
                  </Field>
                  <Field label='Survey Type'>
                    <Select
                      value={form.surveyType || ''}
                      onChange={(e) =>
                        set('surveyType', e.target.value || undefined)
                      }
                    >
                      <option value=''>Select type...</option>
                      <option value='IN_WATER'>In-Water Survey</option>
                      <option value='OUT_OF_WATER'>Out-of-Water Survey</option>
                      <option value='PRE_PURCHASE'>Pre-Purchase Survey</option>
                    </Select>
                  </Field>
                </div>
                {vesselAge > 25 && (
                  <p className='text-xs text-yellow-200/70'>
                    Vessel over 25 years — out-of-water survey mandatory
                    (Appendix 7)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Coverage */}
        {step === 1 && (
          <div className='bg-card space-y-4 rounded-xl border p-6'>
            <h3 className='font-semibold'>Coverage & Deductibles</h3>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field label='P&I Liability Limit (USD)'>
                <Select
                  value={form.liabilityLimit}
                  onChange={(e) =>
                    set('liabilityLimit', Number(e.target.value))
                  }
                >
                  <option value={300_000}>$300,000</option>
                  <option value={500_000}>$500,000</option>
                  <option value={1_000_000}>$1,000,000</option>
                  {form.territory === 'ROW' && (
                    <option value={2_000_000}>$2,000,000</option>
                  )}
                  {form.territory === 'ROW' && (
                    <option value={3_000_000}>$3,000,000</option>
                  )}
                </Select>
              </Field>
              <Field label='Hull Deductible'>
                <Select
                  value={form.hullDeductiblePct}
                  onChange={(e) =>
                    set('hullDeductiblePct', Number(e.target.value))
                  }
                >
                  <option value={0.01}>1% of hull value</option>
                  <option value={0.02}>2% of hull value (standard)</option>
                  <option value={0.03}>3% of hull value (-5%)</option>
                  <option value={0.04}>4% of hull value (-10%)</option>
                  <option value={0.05}>5% of hull value (-15%)</option>
                </Select>
              </Field>
              <Field label='Tender Value (USD)'>
                <Input
                  type='number'
                  placeholder='0'
                  value={form.tenderValue || ''}
                  onChange={(e) => set('tenderValue', e.target.value)}
                />
              </Field>
              <Field label='Personal Property (USD)'>
                <Input
                  type='number'
                  placeholder='0'
                  value={form.personalProperty || ''}
                  onChange={(e) => set('personalProperty', e.target.value)}
                />
              </Field>
              <Field label='Lay-up Months' hint='Max 6 months, -5% per month'>
                <Select
                  value={form.layUpMonths}
                  onChange={(e) => set('layUpMonths', Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((m) => (
                    <option key={m} value={m}>
                      {m} month{m !== 1 ? 's' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label='Medical Expenses'
                hint='Up to $10K included in hull rate'
              >
                <Select
                  value={form.medicalExpensesLimit}
                  onChange={(e) =>
                    set('medicalExpensesLimit', Number(e.target.value))
                  }
                >
                  <option value={10_000}>Up to $10,000 (included)</option>
                  <option value={25_000}>Up to $25,000 (+$25)</option>
                  <option value={50_000}>Up to $50,000 (+$50)</option>
                  <option value={100_000}>Up to $100,000 (+$75)</option>
                </Select>
              </Field>
              <Field
                label='Uninsured Boaters'
                hint='Up to $25K included in hull rate'
              >
                <Select
                  value={form.uninsuredBoatersLimit}
                  onChange={(e) =>
                    set('uninsuredBoatersLimit', Number(e.target.value))
                  }
                >
                  <option value={25_000}>Up to $25,000 (included)</option>
                  <option value={100_000}>Up to $100,000 (+$50)</option>
                </Select>
              </Field>
              <Field label='Crew Liability'>
                <Select
                  value={form.crewLiabilityLimit}
                  onChange={(e) =>
                    set('crewLiabilityLimit', Number(e.target.value))
                  }
                >
                  <option value={0}>Not included</option>
                  <option value={300_000}>$300,000</option>
                  <option value={500_000}>$500,000</option>
                  <option value={1_000_000}>$1,000,000</option>
                  <option value={2_000_000}>$2,000,000</option>
                  <option value={3_000_000}>$3,000,000</option>
                </Select>
              </Field>
            </div>
            <div className='space-y-2 pt-2'>
              <p className='text-muted-foreground text-sm font-medium'>
                Discounts & Features
              </p>
              <Toggle
                label='English Law & Jurisdiction (-10%)'
                checked={!!form.englishLaw}
                onChange={(v) => set('englishLaw', v)}
              />
              <Toggle
                label='Automatic Fire Extinguisher (-5%)'
                checked={!!form.hasAutoFireExt}
                onChange={(v) => set('hasAutoFireExt', v)}
              />
              <Toggle
                label='Professional Crew (-10%)'
                checked={!!form.professionalCrew}
                onChange={(v) => set('professionalCrew', v)}
              />
              <Toggle
                label='Recognised Yachting Qualification (-10%)'
                checked={!!form.hasYachtingQual}
                onChange={(v) => set('hasYachtingQual', v)}
              />
              <Toggle
                label='3 Years Boating Experience (-10%)'
                checked={!!form.hasExperience3Years}
                onChange={(v) => set('hasExperience3Years', v)}
              />
              {form.vesselType === 'MOTOR' && (
                <Toggle
                  label='Diesel Engine Only (-10%)'
                  checked={!!form.dieselOnly}
                  onChange={(v) => set('dieselOnly', v)}
                />
              )}
              <Toggle
                label='Inland Waters Only (-5%)'
                checked={!!form.inlandWatersOnly}
                onChange={(v) => set('inlandWatersOnly', v)}
              />
              <Toggle
                label='Include Windstorm (named storm box)'
                checked={!!form.includeWindstorm}
                onChange={(v) => set('includeWindstorm', v)}
              />
            </div>
            <div className='space-y-2 pt-2'>
              <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                Loadings
              </p>
              <Toggle
                label='Single-Handed Operation (+10%)'
                checked={!!form.singleHanded}
                onChange={(v) => set('singleHanded', v)}
                loading
              />
              <Toggle
                label='Kevlar / Metal Hull Construction (+10%)'
                checked={!!form.isKevlarMetal}
                onChange={(v) => set('isKevlarMetal', v)}
                loading
              />
              <Toggle
                label='Racing / Rally Use (+20%)'
                checked={!!form.racingRally}
                onChange={(v) => set('racingRally', v)}
                loading
              />
              <Toggle
                label='Include Lightning Strike Cover (+10%)'
                checked={!!form.includeLightningStrike}
                onChange={(v) => set('includeLightningStrike', v)}
                loading
              />
            </div>
          </div>
        )}

        {/* Step 2: Loss History */}
        {step === 2 && (
          <div className='bg-card space-y-4 rounded-xl border p-6'>
            <h3 className='font-semibold'>Loss History (Rolling 3 Years)</h3>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field
                label='Fault Claims — Current Year'
                hint='+30% loading if >0'
              >
                <Select
                  value={form.faultClaimsCY}
                  onChange={(e) => set('faultClaimsCY', Number(e.target.value))}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label='Fault Claims — Prior Year'
                hint='+30% loading if >0'
              >
                <Select
                  value={form.faultClaimsPY}
                  onChange={(e) => set('faultClaimsPY', Number(e.target.value))}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label='Fault Claims — 2 Years Prior'
                hint='+20% loading if >0'
              >
                <Select
                  value={form.faultClaims2Y}
                  onChange={(e) => set('faultClaims2Y', Number(e.target.value))}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label='Fault Claims — 3 Years Prior'
                hint='+10% loading if >0'
              >
                <Select
                  value={form.faultClaims3Y}
                  onChange={(e) => set('faultClaims3Y', Number(e.target.value))}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label='Non-Fault Claims (any period)'>
                <Select
                  value={form.noFaultClaims}
                  onChange={(e) => set('noFaultClaims', Number(e.target.value))}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && result && (
          <div className='space-y-4'>
            {/* AUTO-DECLINE */}
            {result.autoDecline && (
              <div className='space-y-2 rounded-xl border border-red-500/40 bg-red-500/10 p-5'>
                <div className='flex items-center gap-2'>
                  <IconBan className='h-5 w-5 text-red-400' />
                  <p className='text-base font-semibold text-red-300'>
                    Risk Declined
                  </p>
                </div>
                <p className='pl-7 text-sm text-red-200/80'>
                  {result.autoDecline}
                </p>
              </div>
            )}

            {/* UW Flags */}
            {result.uwFlags.length > 0 && (
              <div className='space-y-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4'>
                <div className='flex items-center gap-2'>
                  <IconAlertTriangle className='h-4 w-4 text-yellow-400' />
                  <p className='text-sm font-semibold text-yellow-300'>
                    UW Flags
                  </p>
                </div>
                {result.uwFlags.map((flag, i) => (
                  <p key={i} className='pl-6 text-sm text-yellow-200/80'>
                    • {flag}
                  </p>
                ))}
              </div>
            )}

            {/* Premium Summary — hidden on auto-decline */}
            {!result.autoDecline && (
              <>
                <div className='rounded-xl border border-blue-500/30 bg-blue-500/5 p-6'>
                  <p className='text-muted-foreground mb-1 text-sm'>
                    Total Annual Premium
                  </p>
                  <p className='text-5xl font-bold text-blue-400'>
                    $
                    {result.totalPremium.toLocaleString('en-US', {
                      minimumFractionDigits: 2
                    })}
                  </p>
                  {result.minimumPremiumApplied && (
                    <p className='mt-1 text-xs text-yellow-400'>
                      Minimum premium applied ($350)
                    </p>
                  )}
                </div>

                {/* Breakdown */}
                <div className='bg-card space-y-3 rounded-xl border p-5'>
                  <p className='font-semibold'>Premium Breakdown</p>
                  <div className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Hull & Machinery
                      </span>
                      <span className='font-medium'>
                        ${result.hullPremium.toLocaleString()}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        P&I Liability
                      </span>
                      <span className='font-medium'>
                        ${result.liabilityPremium.toLocaleString()}
                      </span>
                    </div>
                    {result.optionalPremiums.tender > 0 && (
                      <div className='flex justify-between'>
                        <span className='text-muted-foreground'>Tender</span>
                        <span className='font-medium'>
                          ${result.optionalPremiums.tender.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className='flex justify-between border-t pt-2 font-semibold'>
                      <span>Total</span>
                      <span>${result.totalPremium.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Rating details */}
                <div className='bg-card space-y-3 rounded-xl border p-5'>
                  <p className='font-semibold'>Rating Details</p>
                  <div className='grid grid-cols-3 gap-3 text-sm'>
                    <div className='bg-muted/50 rounded-lg p-3'>
                      <p className='text-muted-foreground text-xs'>Base Rate</p>
                      <p className='mt-1 font-semibold'>
                        {result.ratingBreakdown.baseRatePct.toFixed(3)}%
                      </p>
                    </div>
                    <div className='bg-muted/50 rounded-lg p-3'>
                      <p className='text-muted-foreground text-xs'>
                        Net Adjustment
                      </p>
                      <p
                        className={`mt-1 font-semibold ${result.ratingBreakdown.netAdjustmentPct < 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {result.ratingBreakdown.netAdjustmentPct > 0 ? '+' : ''}
                        {result.ratingBreakdown.netAdjustmentPct.toFixed(1)}%
                      </p>
                    </div>
                    <div className='bg-muted/50 rounded-lg p-3'>
                      <p className='text-muted-foreground text-xs'>
                        Adjusted Rate
                      </p>
                      <p className='mt-1 font-semibold'>
                        {result.ratingBreakdown.adjustedRatePct.toFixed(3)}%
                      </p>
                    </div>
                  </div>

                  {result.ratingBreakdown.discounts.length > 0 && (
                    <div>
                      <p className='mb-1 text-xs font-medium text-green-400'>
                        Discounts Applied
                      </p>
                      {result.ratingBreakdown.discounts.map((d) => (
                        <div
                          key={d.code}
                          className='flex justify-between py-0.5 text-xs'
                        >
                          <span className='text-muted-foreground'>
                            {d.label}
                          </span>
                          <span className='text-green-400'>{d.pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.ratingBreakdown.loadings.length > 0 && (
                    <div>
                      <p className='mb-1 text-xs font-medium text-red-400'>
                        Loadings Applied
                      </p>
                      {result.ratingBreakdown.loadings.map((l) => (
                        <div
                          key={l.code}
                          className='flex justify-between py-0.5 text-xs'
                        >
                          <span className='text-muted-foreground'>
                            {l.label}
                          </span>
                          <span className='text-red-400'>+{l.pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className='text-muted-foreground border-t pt-2 text-xs'>
                    Deductibles: Hull {result.deductibles.hullPct}% (min $
                    {result.deductibles.hull.toLocaleString()}) · P&I $
                    {result.deductibles.liability.toLocaleString()}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className='flex justify-between'>
          {step > 0 && step < 3 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className='hover:bg-accent flex items-center gap-2 rounded-lg border px-4 py-2 text-sm'
            >
              <IconChevronLeft className='h-4 w-4' /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 2 && (
            <button
              onClick={() => setStep((s) => s + 1)}
              className='flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700'
            >
              Next <IconChevronRight className='h-4 w-4' />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={calculate}
              className='flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700'
            >
              <IconCalculator className='h-4 w-4' /> Calculate Premium
            </button>
          )}

          {step === 3 && (
            <div className='flex gap-3'>
              <button
                onClick={() => {
                  setStep(0);
                  setResult(null);
                }}
                className='hover:bg-accent flex items-center gap-2 rounded-lg border px-4 py-2 text-sm'
              >
                New Quote
              </button>
              {!result?.autoDecline && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className='flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60'
                >
                  <IconDeviceFloppy className='h-4 w-4' />
                  {saving ? 'Saving...' : 'Save & Issue Quote'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

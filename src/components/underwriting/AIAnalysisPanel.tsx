'use client';

// src/components/underwriting/AIAnalysisPanel.tsx

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskFlag {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

interface AIAnalysisResult {
  recommendedAction: 'APPROVE' | 'REFER' | 'DECLINE';
  suggestedRateAdjustmentPct: number;
  confidenceScore: number;
  riskFlags: RiskFlag[];
  reasoning: string;
  keyPositives: string[];
  keyNegatives: string[];
  generatedAt: string;
  modelVersion: string;
}

interface AIAnalysisPanelProps {
  submissionId: string;
  initialAnalysis?: AIAnalysisResult | null;
  initialAnalyzedAt?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function actionColor(action: AIAnalysisResult['recommendedAction']) {
  switch (action) {
    case 'APPROVE':
      return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    case 'REFER':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'DECLINE':
      return 'bg-red-50 border-red-200 text-red-800';
  }
}

function actionBadgeVariant(action: AIAnalysisResult['recommendedAction']) {
  switch (action) {
    case 'APPROVE':
      return 'default' as const;
    case 'REFER':
      return 'secondary' as const;
    case 'DECLINE':
      return 'destructive' as const;
  }
}

function severityColor(severity: RiskFlag['severity']) {
  switch (severity) {
    case 'HIGH':
      return 'text-red-600 font-semibold';
    case 'MEDIUM':
      return 'text-amber-600 font-medium';
    case 'LOW':
      return 'text-slate-500';
  }
}

function severityDot(severity: RiskFlag['severity']) {
  switch (severity) {
    case 'HIGH':
      return 'bg-red-500';
    case 'MEDIUM':
      return 'bg-amber-400';
    case 'LOW':
      return 'bg-slate-300';
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIAnalysisPanel({
  submissionId,
  initialAnalysis = null,
  initialAnalyzedAt = null
}: AIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(
    initialAnalysis
  );
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(
    initialAnalyzedAt
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount, fetch cached analysis if not passed from server
  const fetchCached = useCallback(async () => {
    if (analysis) return;
    try {
      const res = await fetch(
        `/api/underwriting/submissions/${submissionId}/ai-analysis`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAnalysis(data.analysis as AIAnalysisResult);
          setAnalyzedAt(data.analyzedAt ?? null);
        }
      }
    } catch {
      // silence — cached fetch failure is non-critical
    }
  }, [submissionId, analysis]);

  useEffect(() => {
    fetchCached();
  }, [fetchCached]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/underwriting/submissions/${submissionId}/ai-analysis`,
        { method: 'POST' }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const result = (await res.json()) as AIAnalysisResult;
      setAnalysis(result);
      setAnalyzedAt(result.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='border-slate-200'>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base font-semibold'>
              {/* Simple sparkle icon via unicode — no lucide dependency needed */}
              <span className='text-violet-500'>✦</span>
              AI Underwriting Analysis
            </CardTitle>
            <CardDescription className='mt-0.5 text-xs'>
              Powered by Claude · Sun Re Marine
            </CardDescription>
          </div>

          <Button
            size='sm'
            variant={analysis ? 'outline' : 'default'}
            onClick={runAnalysis}
            disabled={loading}
            className='text-xs'
          >
            {loading ? (
              <span className='flex items-center gap-1.5'>
                <span className='inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
                Analysing…
              </span>
            ) : analysis ? (
              'Re-analyse'
            ) : (
              'Get AI Analysis'
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className='space-y-4 pt-0'>
        {/* Error */}
        {error && (
          <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
            {error}
          </div>
        )}

        {/* Empty state */}
        {!analysis && !loading && !error && (
          <div className='py-6 text-center text-sm text-slate-400'>
            Click "Get AI Analysis" to receive an instant underwriting
            recommendation based on Sun Re Marine facility guidelines.
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !analysis && (
          <div className='animate-pulse space-y-3'>
            <div className='h-4 w-1/3 rounded bg-slate-100' />
            <div className='h-3 w-full rounded bg-slate-100' />
            <div className='h-3 w-4/5 rounded bg-slate-100' />
          </div>
        )}

        {/* Result */}
        {analysis && (
          <div className='space-y-4'>
            {/* Header row: action badge + rate adjustment + confidence */}
            <div
              className={`flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 ${actionColor(analysis.recommendedAction)}`}
            >
              <div className='flex items-center gap-2'>
                <span className='text-xs font-medium tracking-wide uppercase opacity-70'>
                  Recommendation
                </span>
                <Badge variant={actionBadgeVariant(analysis.recommendedAction)}>
                  {analysis.recommendedAction}
                </Badge>
              </div>

              <Separator orientation='vertical' className='h-5 opacity-30' />

              <div>
                <span className='text-xs opacity-70'>Rate adjustment </span>
                <span className='font-semibold tabular-nums'>
                  {analysis.suggestedRateAdjustmentPct > 0 ? '+' : ''}
                  {analysis.suggestedRateAdjustmentPct}%
                </span>
              </div>

              <Separator orientation='vertical' className='h-5 opacity-30' />

              <div>
                <span className='text-xs opacity-70'>Confidence </span>
                <span className='font-semibold tabular-nums'>
                  {analysis.confidenceScore}/100
                </span>
              </div>
            </div>

            {/* Reasoning */}
            <div>
              <p className='mb-1 text-xs font-medium text-slate-500'>
                Reasoning
              </p>
              <p className='text-sm leading-relaxed text-slate-700'>
                {analysis.reasoning}
              </p>
            </div>

            {/* Positives + Negatives */}
            {(analysis.keyPositives.length > 0 ||
              analysis.keyNegatives.length > 0) && (
              <div className='grid grid-cols-2 gap-3'>
                {analysis.keyPositives.length > 0 && (
                  <div>
                    <p className='mb-1.5 text-xs font-medium text-emerald-600'>
                      ✓ Positives
                    </p>
                    <ul className='space-y-1'>
                      {analysis.keyPositives.map((p, i) => (
                        <li key={i} className='text-xs text-slate-600'>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.keyNegatives.length > 0 && (
                  <div>
                    <p className='mb-1.5 text-xs font-medium text-red-600'>
                      ✗ Concerns
                    </p>
                    <ul className='space-y-1'>
                      {analysis.keyNegatives.map((n, i) => (
                        <li key={i} className='text-xs text-slate-600'>
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Risk flags */}
            {analysis.riskFlags.length > 0 && (
              <div>
                <p className='mb-2 text-xs font-medium text-slate-500'>
                  Risk Flags
                </p>
                <div className='space-y-1.5'>
                  {analysis.riskFlags.map((flag, i) => (
                    <div key={i} className='flex items-start gap-2'>
                      <span
                        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${severityDot(flag.severity)}`}
                      />
                      <div>
                        <span
                          className={`mr-1 text-xs ${severityColor(flag.severity)}`}
                        >
                          [{flag.code}]
                        </span>
                        <span className='text-xs text-slate-600'>
                          {flag.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            {analyzedAt && (
              <p className='pt-1 text-[11px] text-slate-400'>
                Analysed {formatDate(analyzedAt)} · {analysis.modelVersion}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

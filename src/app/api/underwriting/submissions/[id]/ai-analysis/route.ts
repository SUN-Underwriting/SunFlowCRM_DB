// src/app/api/underwriting/submissions/[id]/ai-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIAnalysisResult {
  recommendedAction: 'APPROVE' | 'REFER' | 'DECLINE';
  suggestedRateAdjustmentPct: number; // e.g. +10 or -5 (percent points on top of base)
  confidenceScore: number; // 0–100
  riskFlags: Array<{
    code: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  }>;
  reasoning: string; // narrative for the underwriter
  keyPositives: string[];
  keyNegatives: string[];
  generatedAt: string;
  modelVersion: string;
}

// ─── Helper: build prompt from Submission ────────────────────────────────────

function buildPrompt(sub: Record<string, unknown>): string {
  const age = sub.yearBuilt
    ? new Date().getFullYear() - (sub.yearBuilt as number)
    : null;

  const claimsTotal =
    ((sub.faultClaimsCY as number) || 0) +
    ((sub.faultClaimsPY as number) || 0) +
    ((sub.faultClaims2Y as number) || 0) +
    ((sub.faultClaims3Y as number) || 0);

  return `You are a senior marine yacht underwriter working under Lloyd's facility SUN-MYC-001 (coverholder: London Marine Insurance Services Ltd).
Facility limits: max hull value USD 6,000,000. Auto-decline for Australian risks. Minimum premium USD 350.

Analyse the following submission and respond ONLY with a JSON object matching this exact structure:
{
  "recommendedAction": "APPROVE" | "REFER" | "DECLINE",
  "suggestedRateAdjustmentPct": number,
  "confidenceScore": number,
  "riskFlags": [{ "code": string, "severity": "LOW"|"MEDIUM"|"HIGH", "description": string }],
  "reasoning": string,
  "keyPositives": string[],
  "keyNegatives": string[]
}

Rules:
- DECLINE if navigation area includes Australia or New Zealand
- DECLINE if hullValue > 6000000
- REFER if hullValue > 2500000 (above automatic limit, needs discretionary approval)
- REFER if vessel age > 15 years (survey required)
- REFER if fault claims in last 3 years >= 2
- suggestedRateAdjustmentPct: net % adjustment to apply on top of base rate (negative = discount, positive = loading)
- confidenceScore: 0-100 based on data completeness and risk clarity
- reasoning: 2-4 sentences for the underwriter explaining your decision
- keyPositives: up to 4 risk-positive factors
- keyNegatives: up to 4 risk-negative factors

SUBMISSION DATA:
Reference: ${sub.reference}
Vessel: ${sub.vesselName || 'N/A'} | Type: ${sub.vesselType || 'N/A'} | Year: ${sub.yearBuilt || 'N/A'} (age: ${age !== null ? age + ' years' : 'N/A'})
Length: ${sub.lengthFeet || 'N/A'} ft | Hull Value: ${sub.currency} ${sub.hullValue || 'N/A'}
Territory: ${sub.territory} | Use: ${sub.useType}
Navigation Area: ${sub.navigationArea || 'N/A'} | Nav Area Modifier: ${sub.navAreaModifier || 'none'}

Hull Characteristics:
- Auto fire extinguisher: ${sub.hasAutoFireExt}
- Professional crew: ${sub.professionalCrew}
- Has yachting qualification: ${sub.hasYachtingQual}
- Diesel only: ${sub.dieselOnly}
- Inland waters only: ${sub.inlandWatersOnly}
- Max speed: ${sub.maxSpeedKnots || 'N/A'} knots

Coverage:
- Liability limit: ${sub.liabilityLimit || 'none'}
- Hull deductible: ${((sub.hullDeductiblePct as number) * 100).toFixed(1)}%
- Include windstorm: ${sub.includeWindstorm}
- Tender value: ${sub.tenderValue || 'none'}
- Personal property: ${sub.personalProperty || 'none'}
- Electronics: ${sub.electronicsValue || 'none'}

Loss History (fault claims):
- Current year: ${sub.faultClaimsCY}
- Prior year: ${sub.faultClaimsPY}
- 2 years ago: ${sub.faultClaims2Y}
- 3 years ago: ${sub.faultClaims3Y}
- Total fault claims (3yr): ${claimsTotal}
- Non-fault claims: ${sub.noFaultClaims}

Lay-up months: ${sub.layUpMonths}
Transits: ${JSON.stringify(sub.transits)}

Broker: ${sub.brokerCompany || 'N/A'} | ${sub.brokerEmail || 'N/A'}
Insured: ${sub.insuredName || 'N/A'}

UW Notes: ${sub.uwNotes || 'none'}`;
}

// ─── POST /api/underwriting/submissions/[id]/ai-analysis ─────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 }
    );
  }

  // 1. Load submission
  const submission = await prisma.submission.findUnique({
    where: { id }
  });

  if (!submission) {
    return NextResponse.json(
      { error: 'Submission not found' },
      { status: 404 }
    );
  }

  // 2. Call Claude API
  let analysisResult: AIAnalysisResult;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: buildPrompt(
              submission as unknown as Record<string, unknown>
            )
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return NextResponse.json(
        { error: 'AI service unavailable', details: err },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    // Strip markdown fences if present
    const clean = rawText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(clean);

    analysisResult = {
      ...parsed,
      generatedAt: new Date().toISOString(),
      modelVersion: 'claude-sonnet-4-20250514'
    };
  } catch (err) {
    console.error('AI analysis failed:', err);
    return NextResponse.json(
      { error: 'Failed to parse AI response' },
      { status: 500 }
    );
  }

  // 3. Persist to DB
  await prisma.submission.update({
    where: { id },
    data: {
      aiAnalysis: analysisResult as object,
      aiModelVersion: analysisResult.modelVersion,
      aiAnalyzedAt: new Date()
    }
  });

  return NextResponse.json(analysisResult);
}

// ─── GET /api/underwriting/submissions/[id]/ai-analysis ──────────────────────
// Returns cached analysis if it exists

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: {
      aiAnalysis: true,
      aiAnalyzedAt: true,
      aiModelVersion: true
    }
  });

  if (!submission) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!submission.aiAnalysis) {
    return NextResponse.json({ analysis: null });
  }

  return NextResponse.json({
    analysis: submission.aiAnalysis,
    analyzedAt: submission.aiAnalyzedAt,
    modelVersion: submission.aiModelVersion
  });
}

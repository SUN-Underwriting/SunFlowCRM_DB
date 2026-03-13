import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { calculateYachtPremium } from '@/features/underwriting/rating/engine';
import type { RiskInput } from '@/features/underwriting/rating/types';

function genRef(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const body = (await request.json()) as RiskInput & {
        vesselName?: string;
        brokerName?: string;
        brokerEmail?: string;
      };

      const { vesselName, brokerName, brokerEmail, ...rawInput } = body;

      // Coerce numeric fields that may arrive as strings from form inputs
      const riskInput: RiskInput = {
        ...rawInput,
        hullValue: Number(rawInput.hullValue) || 0,
        yearBuilt: Number(rawInput.yearBuilt) || 2010,
        lengthFeet: Number(rawInput.lengthFeet) || 40,
        liabilityLimit: Number(rawInput.liabilityLimit) || 1_000_000,
        hullDeductiblePct: Number(rawInput.hullDeductiblePct) || 0.02,
        maxSpeedKnots: rawInput.maxSpeedKnots
          ? Number(rawInput.maxSpeedKnots)
          : undefined,
        tenderValue: rawInput.tenderValue
          ? Number(rawInput.tenderValue)
          : undefined,
        personalProperty: rawInput.personalProperty
          ? Number(rawInput.personalProperty)
          : undefined,
        electronicsValue: rawInput.electronicsValue
          ? Number(rawInput.electronicsValue)
          : undefined,
        trailerValue: rawInput.trailerValue
          ? Number(rawInput.trailerValue)
          : undefined,
        navAreaModifier: rawInput.navAreaModifier ?? null,
        medicalExpensesLimit: rawInput.medicalExpensesLimit
          ? Number(rawInput.medicalExpensesLimit)
          : 10_000,
        uninsuredBoatersLimit: rawInput.uninsuredBoatersLimit
          ? Number(rawInput.uninsuredBoatersLimit)
          : 25_000,
        crewLiabilityLimit: rawInput.crewLiabilityLimit
          ? Number(rawInput.crewLiabilityLimit)
          : 0,
        faultClaimsCY: Number(rawInput.faultClaimsCY) || 0,
        faultClaimsPY: Number(rawInput.faultClaimsPY) || 0,
        faultClaims2Y: Number(rawInput.faultClaims2Y) || 0,
        faultClaims3Y: Number(rawInput.faultClaims3Y) || 0,
        noFaultClaims: Number(rawInput.noFaultClaims) || 0,
        layUpMonths: Number(rawInput.layUpMonths) || 0
      } as RiskInput;

      const result = calculateYachtPremium(riskInput);

      const reference = genRef('SUN');
      const quoteNumber = genRef('SUN-Q');

      console.log('[UW calculate] creating submission...');
      const submission = await prisma.submission.create({
        data: {
          tenant: { connect: { id: user.tenantId } },
          reference,
          status: 'SUBMITTED',
          createdBy: user.id,
          vesselName: vesselName ?? null,
          brokerName: brokerName ?? null,
          brokerEmail: brokerEmail ?? null,
          vesselType: riskInput.vesselType ?? 'MOTOR',
          yearBuilt: riskInput.yearBuilt ?? null,
          lengthFeet: riskInput.lengthFeet ?? null,
          hullValue: riskInput.hullValue ?? null,
          territory: riskInput.territory ?? 'ROW',
          useType: riskInput.useType ?? 'PRIVATE',
          navAreaModifier: riskInput.navAreaModifier ?? null,
          maxSpeedKnots: riskInput.maxSpeedKnots ?? null,
          liabilityLimit: riskInput.liabilityLimit ?? null,
          tenderValue: riskInput.tenderValue ?? null,
          personalProperty: riskInput.personalProperty ?? null,
          electronicsValue: riskInput.electronicsValue ?? null,
          includeTowing: riskInput.includeTowing ?? false,
          includeTrailer: riskInput.includeTrailer ?? false,
          trailerValue: riskInput.trailerValue ?? null,
          includeWindstorm: riskInput.includeWindstorm ?? false,
          hullDeductiblePct: riskInput.hullDeductiblePct ?? 0.02,
          medicalExpensesLimit: riskInput.medicalExpensesLimit ?? 10_000,
          uninsuredBoatersLimit: riskInput.uninsuredBoatersLimit ?? 25_000,
          crewLiabilityLimit: riskInput.crewLiabilityLimit ?? 0,
          hasAutoFireExt: riskInput.hasAutoFireExt ?? false,
          professionalCrew: riskInput.professionalCrew ?? false,
          hasYachtingQual: riskInput.hasYachtingQual ?? false,
          dieselOnly: riskInput.dieselOnly ?? false,
          englishLaw: riskInput.englishLaw ?? true,
          inlandWatersOnly: riskInput.inlandWatersOnly ?? false,
          faultClaimsCY: riskInput.faultClaimsCY ?? 0,
          faultClaimsPY: riskInput.faultClaimsPY ?? 0,
          faultClaims2Y: riskInput.faultClaims2Y ?? 0,
          faultClaims3Y: riskInput.faultClaims3Y ?? 0,
          noFaultClaims: riskInput.noFaultClaims ?? 0,
          layUpMonths: riskInput.layUpMonths ?? 0,
          transits: riskInput.transits ? (riskInput.transits as object[]) : []
        }
      });

      const quote = await prisma.quote.create({
        data: {
          tenant: { connect: { id: user.tenantId } },
          submission: { connect: { id: submission.id } },
          quoteNumber,
          status: 'INDICATION',
          hullPremium: result.hullPremium,
          liabilityPremium: result.liabilityPremium,
          optionalPremiums: result.optionalPremiums as object,
          totalPremium: result.totalPremium,
          baseRatePct: result.ratingBreakdown.baseRatePct,
          adjustedRatePct: result.ratingBreakdown.adjustedRatePct,
          netAdjustmentPct: result.ratingBreakdown.netAdjustmentPct,
          discountsApplied: result.ratingBreakdown.discounts as object[],
          loadingsApplied: result.ratingBreakdown.loadings as object[],
          rateTableSource: result.ratingBreakdown.rateTableSource,
          hullDeductible: result.deductibles.hull,
          hullDeductiblePct: result.deductibles.hullPct / 100,
          liabilityDed: result.deductibles.liability,
          uwFlags: result.uwFlags as string[],
          autoDecline: result.autoDecline ?? null
        }
      });

      return apiResponse({ submission, quote, result }, 201);
    });
  } catch (error) {
    console.error('[UW calculate] ERROR:', error);
    return handleApiError(error);
  }
}

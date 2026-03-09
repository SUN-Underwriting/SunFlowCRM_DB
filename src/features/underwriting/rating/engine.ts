/**
 * engine.ts — Yacht Insurance Rating Engine
 * Facility: LM21M0136, Appendix 6 + Appendix 7
 *
 * Changelog (facility audit fixes):
 * - MIN_PREMIUM: 250 → 350 (Appendix 7)
 * - AUS_NZ: discount removed → auto-DECLINE (Appendix 7)
 * - CUBA/COLOMBIA/HAITI/VENEZUELA nav area → +10% loading (Appendix 6)
 * - Added: hasExperience3Years (-10%), singleHanded (+10%),
 *          isKevlarMetal (+10%), racingRally (+20%),
 *          includeLightningStrike (+10%)
 * - Survey blocker: vessels >15y without surveyDate → cannot bind
 * - autoDecline field on RatingResult for hard stops
 */

import type {
  RiskInput,
  RatingResult,
  AppliedFactor,
  OptionalPremiums
} from './types';

// ============================================================
// CONSTANTS
// ============================================================

const CURRENT_YEAR = new Date().getFullYear();
const MIN_PREMIUM = 350; // USD — Appendix 7 (was 250, corrected)
const MAX_NET_DISCOUNT = -0.6; // -60% cap — Appendix 6

// Hull rate bands — US/CA/MX/Caribbean
const HULL_RATES_US: [number, number, number][] = [
  [0, 50_000, 0.0175],
  [50_001, 100_000, 0.015],
  [100_001, 250_000, 0.0125],
  [250_001, 500_000, 0.01125],
  [500_001, 750_000, 0.00975],
  [750_001, 1_000_000, 0.00825],
  [1_000_001, 1_500_000, 0.00635],
  [1_500_001, 2_000_000, 0.0061],
  [2_000_001, 2_500_000, 0.00595],
  [2_500_001, 3_500_000, 0.0058],
  [3_500_001, 5_000_000, 0.00565],
  [5_000_001, 6_000_000, 0.0055]
];

// Hull rate bands — Rest of World
const HULL_RATES_ROW: [number, number, number][] = [
  [0, 50_000, 0.015],
  [50_001, 100_000, 0.0075],
  [100_001, 250_000, 0.00625],
  [250_001, 500_000, 0.00575],
  [500_001, 750_000, 0.00425],
  [750_001, 1_000_000, 0.0041],
  [1_000_001, 1_500_000, 0.00315],
  [1_500_001, 2_000_000, 0.00305],
  [2_000_001, 2_500_000, 0.00295],
  [2_500_001, 3_500_000, 0.00285],
  [3_500_001, 5_000_000, 0.00275],
  [5_000_001, 6_000_000, 0.00265]
];

// P&I annual premiums — Private use
// [liabilityLimit, maxLengthFt] → premium
const PI_PRIVATE: Record<number, Record<number, number>> = {
  300_000: { 35: 165, 40: 195, 45: 225, 50: 255, 60: 285, 999: 320 },
  500_000: { 35: 190, 40: 225, 45: 265, 50: 300, 60: 335, 999: 375 },
  1_000_000: { 35: 235, 40: 285, 45: 330, 50: 380, 60: 425, 999: 475 },
  2_000_000: { 35: 280, 40: 340, 45: 395, 50: 455, 60: 510, 999: 570 }, // ROW only
  3_000_000: { 35: 335, 40: 405, 45: 475, 50: 545, 60: 610, 999: 680 } // ROW only
};

// P&I annual premiums — Charter use
const PI_CHARTER: Record<number, Record<number, number>> = {
  300_000: { 35: 215, 40: 260, 45: 305, 50: 340, 60: 385, 999: 515 },
  500_000: { 35: 255, 40: 305, 45: 365, 50: 405, 60: 455, 999: 580 },
  1_000_000: { 35: 320, 40: 385, 45: 445, 50: 515, 60: 575, 999: 660 }
};

// Ocean transit additional rates (% of hull value)
const TRANSIT_RATES: Record<string, Record<string, number>> = {
  TRANS_PACIFIC: { ONE_WAY: 0.0025, ROUND_TRIP: 0.0038 },
  TRANS_ATLANTIC: { ONE_WAY: 0.002, ROUND_TRIP: 0.003 },
  INDIAN_OCEAN: { ONE_WAY: 0.002, ROUND_TRIP: 0.003 },
  HAWAII: { ONE_WAY: 0.001, ROUND_TRIP: 0.0015 },
  BERMUDA: { ONE_WAY: 0.001, ROUND_TRIP: 0.0015 },
  PANAMA: { ONE_WAY: 0.0007, ROUND_TRIP: 0.0011 }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getHullRate(
  hullValue: number,
  territory: 'US_CA_MX_CARIB' | 'ROW'
): number {
  const bands = territory === 'US_CA_MX_CARIB' ? HULL_RATES_US : HULL_RATES_ROW;
  for (const [min, max, rate] of bands) {
    if (hullValue >= min && hullValue <= max) return rate;
  }
  // Return top band rate for values above maximum
  return bands[bands.length - 1][2];
}

function getPiPremium(
  liabilityLimit: number,
  lengthFeet: number,
  useType: 'PRIVATE' | 'CHARTER' | 'BAREBOAT',
  territory: 'US_CA_MX_CARIB' | 'ROW'
): number {
  const isCharter = useType === 'CHARTER' || useType === 'BAREBOAT';
  const table = isCharter ? PI_CHARTER : PI_PRIVATE;

  // Enforce US P&I cap of $1M (per LM21M0136)
  const effectiveLimit =
    territory === 'US_CA_MX_CARIB'
      ? Math.min(liabilityLimit, 1_000_000)
      : liabilityLimit;

  // Find closest limit bracket (below or equal)
  const availableLimits = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);

  let closestLimit = availableLimits[0];
  for (const limit of availableLimits) {
    if (limit <= effectiveLimit) closestLimit = limit;
  }

  const lengthTable = table[closestLimit];
  const brackets = Object.keys(lengthTable)
    .map(Number)
    .sort((a, b) => a - b);

  for (const bracket of brackets) {
    if (lengthFeet <= bracket) return lengthTable[bracket];
  }
  return lengthTable[999];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getSurveyAge(surveyDate: string | undefined): number | null {
  if (!surveyDate) return null;
  const survey = new Date(surveyDate);
  if (isNaN(survey.getTime())) return null;
  return (Date.now() - survey.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

// ============================================================
// MAIN RATING FUNCTION
// ============================================================

export function calculateYachtPremium(input: RiskInput): RatingResult {
  const {
    hullValue,
    vesselType,
    yearBuilt,
    lengthFeet,
    territory,
    useType,
    navAreaModifier,
    maxSpeedKnots,
    liabilityLimit = 1_000_000,
    tenderValue,
    personalProperty,
    electronicsValue,
    includeTowing = false,
    includeTrailer = false,
    trailerValue,
    includeWindstorm = false,
    includeLightningStrike = false,
    hullDeductiblePct = 0.02,
    hasAutoFireExt = false,
    professionalCrew = false,
    hasYachtingQual = false,
    hasExperience3Years = false,
    dieselOnly = false,
    englishLaw = true,
    inlandWatersOnly = false,
    singleHanded = false,
    isKevlarMetal = false,
    racingRally = false,
    surveyDate,
    faultClaimsCY = 0,
    faultClaimsPY = 0,
    faultClaims2Y = 0,
    faultClaims3Y = 0,
    noFaultClaims = 0,
    transits = [],
    layUpMonths = 0
  } = input;

  const vesselAge = CURRENT_YEAR - yearBuilt;
  const uwFlags: string[] = [];
  const discounts: AppliedFactor[] = [];
  const loadings: AppliedFactor[] = [];
  let autoDecline: string | undefined;

  // ── AUTO-DECLINE CHECKS ──────────────────────────────────────────────────

  // Australia/NZ — declined per Appendix 7
  if (navAreaModifier === 'AUS_NZ') {
    autoDecline =
      'Australian risks are declined — requires personal lines wording (Appendix 7)';
  }

  // ── UW FLAGS (warnings, not auto-declines) ───────────────────────────────

  if (hullValue > 2_500_000) {
    uwFlags.push(
      `Hull value $${hullValue.toLocaleString()} exceeds facility automatic limit ($2,500,000) — Sun UW discretionary acceptance, refer to capacity provider`
    );
  }
  if (vesselAge > 25)
    uwFlags.push('Vessel >25 years — out-of-water survey mandatory');
  else if (vesselAge > 15)
    uwFlags.push(
      'Vessel >15 years — survey required (in-water or out-of-water, max 5 years old)'
    );

  if (vesselAge > 15) {
    const surveyAgeYears = getSurveyAge(surveyDate);
    if (!surveyDate) {
      uwFlags.push(
        '⚠️ CANNOT BIND: Survey date not provided — required for vessels over 15 years (Appendix 7)'
      );
    } else if (surveyAgeYears !== null && surveyAgeYears > 5) {
      uwFlags.push(
        `⚠️ CANNOT BIND: Survey is ${surveyAgeYears.toFixed(1)} years old — maximum 5 years accepted (Appendix 7)`
      );
    }
  }

  if (vesselType === 'TRIMARAN') {
    uwFlags.push(
      'Trimaran — up-to-date survey and high deductible required (Appendix 7)'
    );
  }

  if (maxSpeedKnots && maxSpeedKnots > 65) {
    uwFlags.push('Speed >65 knots — outside automatic capacity, refer to UW');
  }

  if (faultClaimsCY + faultClaimsPY > 1) {
    uwFlags.push(
      'Multiple fault claims current/prior year — senior UW review required'
    );
  }

  if (navAreaModifier === 'CUBA_COL_HAITI_VEN') {
    uwFlags.push(
      'Navigation in Cuba/Colombia/Haiti/Venezuela — +10% loading applied'
    );
  }

  if (racingRally) {
    uwFlags.push(
      'Racing/Rally use — +20% loading applied, confirm race wording'
    );
  }

  if (transits.length > 0 && vesselType === 'SAILING' && vesselAge > 10) {
    uwFlags.push(
      'Sailing vessel >10 years with ocean transit — rigging inspection report required prior to voyage (Appendix 7)'
    );
  }

  // ── BASE HULL RATE ────────────────────────────────────────
  const baseRate = getHullRate(hullValue, territory);

  // ── VESSEL AGE LOADINGS ───────────────────────────────────
  if (vesselAge > 25) {
    loadings.push({
      code: 'VESSEL_OVER_25Y',
      label: `Vessel ${vesselAge} Years Old (>25y)`,
      pct: 35
    });
  } else if (vesselAge > 20) {
    loadings.push({
      code: 'VESSEL_OVER_20Y',
      label: `Vessel ${vesselAge} Years Old (>20y)`,
      pct: 25
    });
  } else if (vesselAge > 15) {
    loadings.push({
      code: 'VESSEL_OVER_15Y',
      label: `Vessel ${vesselAge} Years Old (>15y)`,
      pct: 15
    });
  } else if (vesselAge > 10) {
    loadings.push({
      code: 'VESSEL_OVER_10Y',
      label: `Vessel ${vesselAge} Years Old (>10y)`,
      pct: 10
    });
  }

  // ── VESSEL TYPE ───────────────────────────────────────────
  if (vesselType === 'SAILING') {
    discounts.push({
      code: 'SAILING_VESSEL_HULL',
      label: 'Sailing Vessel',
      pct: -10
    });
  } else if (vesselType === 'CATAMARAN') {
    loadings.push({ code: 'CATAMARAN', label: 'Catamaran', pct: 10 });
  } else if (vesselType === 'TRIMARAN') {
    loadings.push({
      code: 'TRIMARAN_FERRO',
      label: 'Trimaran / Ferro-cement',
      pct: 35
    });
  }

  // ── USE TYPE ──────────────────────────────────────────────
  if (useType === 'CHARTER' || useType === 'BAREBOAT') {
    loadings.push({
      code: 'CHARTER_VESSEL',
      label: 'Charter / Bareboat Use',
      pct: 20
    });
  }

  // ── NAVIGATION AREA ───────────────────────────────────────
  if (navAreaModifier === 'MED_EU') {
    discounts.push({
      code: 'MED_EU',
      label: 'Mediterranean / European Waters',
      pct: -30
    });
  } else if (navAreaModifier === 'WEST_COAST_US_MX') {
    discounts.push({
      code: 'WEST_COAST_US_MX',
      label: 'West Coast US / Mexico',
      pct: -30
    });
  } else if (navAreaModifier === 'CABO_SAN_LUCAS_SEASONAL') {
    discounts.push({
      code: 'CABO_SAN_LUCAS_SEASONAL',
      label: 'Cabo San Lucas Seasonal',
      pct: -40
    });
  } else if (navAreaModifier === 'CHESAPEAKE_SEASONAL') {
    discounts.push({
      code: 'CHESAPEAKE_SEASONAL',
      label: 'Chesapeake Bay Seasonal',
      pct: -25
    });
  } else if (navAreaModifier === 'CUBA_COL_HAITI_VEN') {
    // +10% loading — Appendix 6
    loadings.push({
      code: 'CUBA_COL_HAITI_VEN',
      label: 'Cuba / Colombia / Haiti / Venezuela',
      pct: 10
    });
  }
  // AUS_NZ: no discount — auto-decline handled above

  // ── VESSEL FEATURES ───────────────────────────────────────
  if (hasAutoFireExt) {
    discounts.push({
      code: 'AUTO_FIRE_EXT',
      label: 'Automatic Fire Extinguisher',
      pct: -5
    });
  }
  if (professionalCrew) {
    discounts.push({
      code: 'PROFESSIONAL_CREW',
      label: 'Professional Crew',
      pct: -10
    });
  }
  if (hasYachtingQual) {
    discounts.push({
      code: 'YACHTING_QUALIFICATION',
      label: 'Yachting Qualification',
      pct: -10
    });
  }
  if (hasExperience3Years) {
    // Appendix 6 — "3 YEARS EXPERIENCE 10%"
    discounts.push({
      code: 'EXPERIENCE_3Y',
      label: '3 Years Boating Experience',
      pct: -10
    });
  }
  if (dieselOnly && vesselType === 'MOTOR') {
    discounts.push({
      code: 'DIESEL_ONLY',
      label: 'Diesel Engine Only',
      pct: -10
    });
  }
  if (inlandWatersOnly) {
    discounts.push({
      code: 'INLAND_WATERS_HULL',
      label: 'Inland Waters Only',
      pct: -5
    });
  }
  if (englishLaw) {
    discounts.push({
      code: 'ENGLISH_LAW_HULL',
      label: 'English Law & Jurisdiction',
      pct: -10
    });
  }
  if (!includeWindstorm) {
    discounts.push({
      code: 'EXCL_WINDSTORM_BOX',
      label: 'Windstorm Box Excluded',
      pct: -10
    });
  }

  // ── VESSEL FEATURES — LOADINGS ────────────────────────────────
  if (singleHanded) {
    // Appendix 6 — "SINGLE HANDED 10%"
    loadings.push({
      code: 'SINGLE_HANDED',
      label: 'Single-Handed Operation',
      pct: 10
    });
  }
  if (isKevlarMetal) {
    // Appendix 6 — "KEVLER / METALHULL 10%"
    loadings.push({
      code: 'KEVLAR_METAL',
      label: 'Kevlar / Metal Hull Construction',
      pct: 10
    });
  }
  if (racingRally) {
    // Appendix 6 — "RACING / RALLY 20%"
    loadings.push({
      code: 'RACING_RALLY',
      label: 'Racing / Rally Use',
      pct: 20
    });
  }
  if (includeLightningStrike) {
    // Appendix 6 — "INCLUDE LIGHTNING STRIKE 10%"
    loadings.push({
      code: 'LIGHTNING_STRIKE',
      label: 'Lightning Strike Cover Included',
      pct: 10
    });
  }

  // ── DEDUCTIBLE DISCOUNTS / LOADINGS ──────────────────────
  if (hullDeductiblePct >= 0.05) {
    discounts.push({
      code: 'HULL_DED_5PCT',
      label: 'Hull Deductible 5%',
      pct: -15
    });
  } else if (hullDeductiblePct >= 0.04) {
    discounts.push({
      code: 'HULL_DED_4PCT',
      label: 'Hull Deductible 4%',
      pct: -10
    });
  } else if (hullDeductiblePct >= 0.03) {
    discounts.push({
      code: 'HULL_DED_3PCT',
      label: 'Hull Deductible 3%',
      pct: -5
    });
  }
  if (hullDeductiblePct <= 0.01 && hullValue > 1_000_000) {
    loadings.push({
      code: 'HULL_DED_1PCT_OVER_1M',
      label: 'Low Deductible on High Value',
      pct: 5
    });
  }

  // ── SPEED LOADINGS ────────────────────────────────────────
  if (maxSpeedKnots) {
    if (maxSpeedKnots > 50 && maxSpeedKnots <= 65) {
      loadings.push({
        code: 'MOTOR_50_65KT',
        label: `High Speed Motor (${maxSpeedKnots}kt)`,
        pct: 40
      });
    } else if (maxSpeedKnots > 36) {
      loadings.push({
        code: 'MOTOR_36_50KT',
        label: `Fast Motor Vessel (${maxSpeedKnots}kt)`,
        pct: 25
      });
    }
  }

  // ── CLAIMS HISTORY ────────────────────────────────────────
  const hasFaultCY = faultClaimsCY > 0;
  const hasFaultPY = faultClaimsPY > 0;
  const hasFault2Y = faultClaims2Y > 0;
  const hasFault3Y = faultClaims3Y > 0;
  const hasNonFault = noFaultClaims > 0;

  if (hasFaultCY || hasFaultPY) {
    if (hasNonFault) {
      loadings.push({
        code: 'FAULT_CLAIM_CY_PY_NF',
        label: 'Fault + Non-Fault Claim (CY/PY)',
        pct: 15
      });
    } else {
      loadings.push({
        code: 'FAULT_CLAIM_CY_PY',
        label: 'Fault Claim Current/Prior Year',
        pct: 30
      });
    }
  } else if (hasFault2Y) {
    if (hasNonFault) {
      loadings.push({
        code: 'FAULT_CLAIM_PRIOR_2Y_NF',
        label: 'Fault + Non-Fault Claim (2Y Prior)',
        pct: 5
      });
    } else {
      loadings.push({
        code: 'FAULT_CLAIM_PRIOR_2Y',
        label: 'Fault Claim 2 Years Prior',
        pct: 20
      });
    }
  } else if (hasFault3Y) {
    loadings.push({
      code: 'FAULT_CLAIM_PRIOR_3Y',
      label: 'Fault Claim 3 Years Prior',
      pct: 10
    });
  }

  // ── LAY-UP DISCOUNT ───────────────────────────────────────
  if (layUpMonths > 0) {
    const months = Math.min(layUpMonths, 6);
    const layUpPct = -(months * 5);
    discounts.push({
      code: 'LAY_UP',
      label: `Lay-up ${months} Month(s)`,
      pct: layUpPct
    });
  }

  // ── NET ADJUSTMENT (capped at -60%) ───────────────────────
  const totalDiscountPct = discounts.reduce((sum, d) => sum + d.pct / 100, 0);
  const totalLoadingPct = loadings.reduce((sum, l) => sum + l.pct / 100, 0);
  const rawNetAdj = totalDiscountPct + totalLoadingPct;
  const netAdj = Math.max(rawNetAdj, MAX_NET_DISCOUNT);

  // ── ADJUSTED HULL RATE & PREMIUM ─────────────────────────
  const adjustedRate = baseRate * (1 + netAdj);
  const hullPremiumRaw = hullValue * adjustedRate;

  // ── OCEAN TRANSIT ADDITIONAL ─────────────────────────────
  let transitPremium = 0;
  for (const transit of transits) {
    const rate = TRANSIT_RATES[transit.route]?.[transit.direction] ?? 0;
    transitPremium += hullValue * rate;
  }

  // ── HULL DEDUCTIBLE ───────────────────────────────────────
  const hullDed = Math.max(round2(hullValue * hullDeductiblePct), 500);

  // ── P&I PREMIUM ───────────────────────────────────────────
  const liabilityPremiumRaw = getPiPremium(
    liabilityLimit,
    lengthFeet,
    useType,
    territory
  );
  const liabilityDed = useType === 'PRIVATE' ? 350 : 1_500;

  // Apply P&I adjustments
  let piAdj = 0;
  if (inlandWatersOnly) piAdj += -0.05;
  if (vesselType === 'SAILING') piAdj += -0.2;
  if (englishLaw) piAdj += -0.2;
  const liabilityPremium = round2(liabilityPremiumRaw * (1 + piAdj));

  // ── OPTIONAL PREMIUMS ─────────────────────────────────────
  const isUS = territory === 'US_CA_MX_CARIB';
  const tenderPremium = tenderValue
    ? round2(tenderValue * (isUS ? 0.0225 : 0.02))
    : 0;
  const personalPropPremium = personalProperty
    ? round2(personalProperty * (isUS ? 0.033 : 0.03))
    : 0;
  const electronicsPremium = electronicsValue
    ? round2(electronicsValue * 0.1)
    : 0;
  const towingPremium = includeTowing ? 25 : 0;
  const trailerPremium =
    includeTrailer && trailerValue ? round2(trailerValue * 0.035) : 0;

  const optionalPremiums: OptionalPremiums = {
    tender: tenderPremium,
    personalProperty: personalPropPremium,
    electronics: electronicsPremium,
    towing: towingPremium,
    trailer: trailerPremium,
    transits: round2(transitPremium)
  };

  // ── TOTAL PREMIUM ─────────────────────────────────────────
  const hullPremium = round2(hullPremiumRaw);
  const optionalTotal = Object.values(optionalPremiums).reduce(
    (a, b) => a + b,
    0
  );
  const rawTotal = hullPremium + liabilityPremium + optionalTotal;
  const totalPremium = round2(Math.max(rawTotal, MIN_PREMIUM));
  const minimumPremiumApplied = rawTotal < MIN_PREMIUM;

  return {
    hullPremium,
    liabilityPremium,
    optionalPremiums,
    totalPremium,
    ratingBreakdown: {
      baseRatePct: round2(baseRate * 100),
      adjustedRatePct: round2(adjustedRate * 100),
      netAdjustmentPct: round2(netAdj * 100),
      discounts,
      loadings,
      rateTableSource: 'LM21M0136_Appendix6_v2021'
    },
    deductibles: {
      hull: hullDed,
      hullPct: hullDeductiblePct * 100,
      liability: liabilityDed
    },
    minimumPremiumApplied,
    vesselAge,
    uwFlags,
    autoDecline
  };
}

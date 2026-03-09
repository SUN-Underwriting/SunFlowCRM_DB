/**
 * types.ts — Rating Engine Type Definitions
 * Facility: LM21M0136 Appendix 6 + Appendix 7
 * Updated: added missing factors from facility audit
 */

export type Territory = 'US_CA_MX_CARIB' | 'ROW';
export type VesselType =
  | 'SAILING'
  | 'MOTOR'
  | 'CATAMARAN'
  | 'TRIMARAN'
  | 'POWER'
  | 'OTHER';
export type UseType = 'PRIVATE' | 'CHARTER' | 'BAREBOAT';
export type NavModifier =
  | 'MED_EU'
  | 'AUS_NZ' // AUTO-DECLINE per Appendix 7
  | 'WEST_COAST_US_MX'
  | 'CABO_SAN_LUCAS_SEASONAL'
  | 'CHESAPEAKE_SEASONAL'
  | 'CUBA_COL_HAITI_VEN' // +10% loading
  | null;

export type TransitRoute =
  | 'TRANS_PACIFIC'
  | 'TRANS_ATLANTIC'
  | 'INDIAN_OCEAN'
  | 'HAWAII'
  | 'BERMUDA'
  | 'PANAMA';

export type TransitDirection = 'ONE_WAY' | 'ROUND_TRIP';

export interface Transit {
  route: TransitRoute;
  direction: TransitDirection;
}

export interface RiskInput {
  hullValue: number;
  vesselType: VesselType;
  yearBuilt: number;
  lengthFeet: number;
  territory: Territory;
  useType: UseType;
  navAreaModifier?: NavModifier;
  maxSpeedKnots?: number;
  liabilityLimit?: number;
  tenderValue?: number;
  personalProperty?: number;
  electronicsValue?: number;
  includeTowing?: boolean;
  includeTrailer?: boolean;
  trailerValue?: number;
  includeWindstorm?: boolean; // false = exclude windstorm box (-10%)
  includeLightningStrike?: boolean; // true = +10% loading
  hullDeductiblePct?: number;

  // ── Vessel features / discounts ─────────────────────────────────────
  hasAutoFireExt?: boolean; // -5%
  professionalCrew?: boolean; // -10%
  hasYachtingQual?: boolean; // -10%
  hasExperience3Years?: boolean; // -10% (NEW — 3 Years Experience)
  dieselOnly?: boolean; // -10% motor only
  englishLaw?: boolean; // -10% hull, -20% P&I
  inlandWatersOnly?: boolean; // -5% hull, -5% P&I

  // ── Vessel loadings ──────────────────────────────────────────
  singleHanded?: boolean; // +10% (NEW)
  isKevlarMetal?: boolean; // +10% Kevlar/Metal hull (NEW)
  racingRally?: boolean; // +20% (NEW)

  // ── Survey (Appendix 7) ──────────────────────────────────────
  surveyDate?: string; // ISO date — required for vessels >15y
  surveyType?: 'IN_WATER' | 'OUT_OF_WATER' | 'PRE_PURCHASE';

  // ── Claims history ───────────────────────────────────────────
  faultClaimsCY?: number;
  faultClaimsPY?: number;
  faultClaims2Y?: number;
  faultClaims3Y?: number;
  noFaultClaims?: number;

  // ── Other ────────────────────────────────────────────────
  transits?: Transit[];
  layUpMonths?: number;
}

export interface AppliedFactor {
  code: string;
  label: string;
  pct: number;
}

export interface OptionalPremiums {
  tender: number;
  personalProperty: number;
  electronics: number;
  towing: number;
  trailer: number;
  transits: number;
}

export interface RatingBreakdown {
  baseRatePct: number;
  adjustedRatePct: number;
  netAdjustmentPct: number;
  discounts: AppliedFactor[];
  loadings: AppliedFactor[];
  rateTableSource: string;
}

export interface Deductibles {
  hull: number;
  hullPct: number;
  liability: number;
}

export interface RatingResult {
  hullPremium: number;
  liabilityPremium: number;
  optionalPremiums: OptionalPremiums;
  totalPremium: number;
  ratingBreakdown: RatingBreakdown;
  deductibles: Deductibles;
  minimumPremiumApplied: boolean;
  vesselAge: number;
  uwFlags: string[];
  autoDecline?: string; // if set — submission must be declined, reason here
}

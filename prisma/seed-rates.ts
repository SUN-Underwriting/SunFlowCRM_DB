/**
 * seed-rates.ts
 * Loads all rating tables from Facility Agreement SUN-MYC-001 Appendix 6
 * into the database.
 *
 * Run: npx tsx prisma/seed-rates.ts
 */

import { PrismaClient, FactorCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EFFECTIVE_DATE = new Date('2021-01-01');

// ============================================================
// HULL RATE BANDS — US / Canada / Mexico / Caribbean (USD)
// ============================================================
const HULL_RATES_US = [
  { minValue: 0, maxValue: 50_000, ratePct: 0.0175 },
  { minValue: 50_001, maxValue: 100_000, ratePct: 0.015 },
  { minValue: 100_001, maxValue: 250_000, ratePct: 0.0125 },
  { minValue: 250_001, maxValue: 500_000, ratePct: 0.01125 },
  { minValue: 500_001, maxValue: 750_000, ratePct: 0.00975 },
  { minValue: 750_001, maxValue: 1_000_000, ratePct: 0.00825 },
  { minValue: 1_000_001, maxValue: 1_500_000, ratePct: 0.00635 },
  { minValue: 1_500_001, maxValue: 2_000_000, ratePct: 0.0061 },
  { minValue: 2_000_001, maxValue: 2_500_000, ratePct: 0.00595 },
  { minValue: 2_500_001, maxValue: 3_500_000, ratePct: 0.0058 },
  { minValue: 3_500_001, maxValue: 5_000_000, ratePct: 0.00565 },
  { minValue: 5_000_001, maxValue: 6_000_000, ratePct: 0.0055 }
];

// ============================================================
// HULL RATE BANDS — Rest of World (EUR / GBP)
// ============================================================
const HULL_RATES_ROW = [
  { minValue: 0, maxValue: 50_000, ratePct: 0.015 },
  { minValue: 50_001, maxValue: 100_000, ratePct: 0.0075 },
  { minValue: 100_001, maxValue: 250_000, ratePct: 0.00625 },
  { minValue: 250_001, maxValue: 500_000, ratePct: 0.00575 },
  { minValue: 500_001, maxValue: 750_000, ratePct: 0.00425 },
  { minValue: 750_001, maxValue: 1_000_000, ratePct: 0.0041 },
  { minValue: 1_000_001, maxValue: 1_500_000, ratePct: 0.00315 },
  { minValue: 1_500_001, maxValue: 2_000_000, ratePct: 0.00305 },
  { minValue: 2_000_001, maxValue: 2_500_000, ratePct: 0.00295 },
  { minValue: 2_500_001, maxValue: 3_500_000, ratePct: 0.00285 },
  { minValue: 3_500_001, maxValue: 5_000_000, ratePct: 0.00275 },
  { minValue: 5_000_001, maxValue: 6_000_000, ratePct: 0.00265 }
];

// ============================================================
// P&I RATES — PRIVATE USE
// Rows: liability limit | Cols: max vessel length (ft)
// ============================================================
const PI_PRIVATE_US = [
  // liabilityLimit, maxLengthFt, annualPremium
  { liabilityLimit: 300_000, maxLengthFt: 35, annualPremium: 165 },
  { liabilityLimit: 300_000, maxLengthFt: 40, annualPremium: 195 },
  { liabilityLimit: 300_000, maxLengthFt: 45, annualPremium: 225 },
  { liabilityLimit: 300_000, maxLengthFt: 50, annualPremium: 255 },
  { liabilityLimit: 300_000, maxLengthFt: 60, annualPremium: 285 },
  { liabilityLimit: 300_000, maxLengthFt: 999, annualPremium: 320 },

  { liabilityLimit: 500_000, maxLengthFt: 35, annualPremium: 190 },
  { liabilityLimit: 500_000, maxLengthFt: 40, annualPremium: 225 },
  { liabilityLimit: 500_000, maxLengthFt: 45, annualPremium: 265 },
  { liabilityLimit: 500_000, maxLengthFt: 50, annualPremium: 300 },
  { liabilityLimit: 500_000, maxLengthFt: 60, annualPremium: 335 },
  { liabilityLimit: 500_000, maxLengthFt: 999, annualPremium: 375 },

  { liabilityLimit: 1_000_000, maxLengthFt: 35, annualPremium: 235 },
  { liabilityLimit: 1_000_000, maxLengthFt: 40, annualPremium: 285 },
  { liabilityLimit: 1_000_000, maxLengthFt: 45, annualPremium: 330 },
  { liabilityLimit: 1_000_000, maxLengthFt: 50, annualPremium: 380 },
  { liabilityLimit: 1_000_000, maxLengthFt: 60, annualPremium: 425 },
  { liabilityLimit: 1_000_000, maxLengthFt: 999, annualPremium: 475 }
];

// ROW P&I is same table as US for private (per SUN-MYC-001)
const PI_PRIVATE_ROW = PI_PRIVATE_US;

const PI_CHARTER_US = [
  { liabilityLimit: 300_000, maxLengthFt: 35, annualPremium: 215 },
  { liabilityLimit: 300_000, maxLengthFt: 40, annualPremium: 260 },
  { liabilityLimit: 300_000, maxLengthFt: 45, annualPremium: 305 },
  { liabilityLimit: 300_000, maxLengthFt: 50, annualPremium: 340 },
  { liabilityLimit: 300_000, maxLengthFt: 60, annualPremium: 385 },
  { liabilityLimit: 300_000, maxLengthFt: 999, annualPremium: 515 },

  { liabilityLimit: 500_000, maxLengthFt: 35, annualPremium: 255 },
  { liabilityLimit: 500_000, maxLengthFt: 40, annualPremium: 305 },
  { liabilityLimit: 500_000, maxLengthFt: 45, annualPremium: 365 },
  { liabilityLimit: 500_000, maxLengthFt: 50, annualPremium: 405 },
  { liabilityLimit: 500_000, maxLengthFt: 60, annualPremium: 455 },
  { liabilityLimit: 500_000, maxLengthFt: 999, annualPremium: 580 },

  { liabilityLimit: 1_000_000, maxLengthFt: 35, annualPremium: 320 },
  { liabilityLimit: 1_000_000, maxLengthFt: 40, annualPremium: 385 },
  { liabilityLimit: 1_000_000, maxLengthFt: 45, annualPremium: 445 },
  { liabilityLimit: 1_000_000, maxLengthFt: 50, annualPremium: 515 },
  { liabilityLimit: 1_000_000, maxLengthFt: 60, annualPremium: 575 },
  { liabilityLimit: 1_000_000, maxLengthFt: 999, annualPremium: 660 }
];

// ROW allows up to $3M P&I (vs $1M cap for US per SUN-MYC-001)
const PI_PRIVATE_ROW_EXTENDED = [
  ...PI_PRIVATE_ROW,
  { liabilityLimit: 2_000_000, maxLengthFt: 35, annualPremium: 280 },
  { liabilityLimit: 2_000_000, maxLengthFt: 40, annualPremium: 340 },
  { liabilityLimit: 2_000_000, maxLengthFt: 45, annualPremium: 395 },
  { liabilityLimit: 2_000_000, maxLengthFt: 50, annualPremium: 455 },
  { liabilityLimit: 2_000_000, maxLengthFt: 60, annualPremium: 510 },
  { liabilityLimit: 2_000_000, maxLengthFt: 999, annualPremium: 570 },

  { liabilityLimit: 3_000_000, maxLengthFt: 35, annualPremium: 335 },
  { liabilityLimit: 3_000_000, maxLengthFt: 40, annualPremium: 405 },
  { liabilityLimit: 3_000_000, maxLengthFt: 45, annualPremium: 475 },
  { liabilityLimit: 3_000_000, maxLengthFt: 50, annualPremium: 545 },
  { liabilityLimit: 3_000_000, maxLengthFt: 60, annualPremium: 610 },
  { liabilityLimit: 3_000_000, maxLengthFt: 999, annualPremium: 680 }
];

// ============================================================
// RATING FACTORS — Discounts & Loadings (SUN-MYC-001 Appendix 6)
// ============================================================
const RATING_FACTORS: {
  code: string;
  category: FactorCategory;
  label: string;
  description: string;
  valuePct: number;
}[] = [
  // ── HULL DISCOUNTS ──────────────────────────────────────
  {
    code: 'EXPERIENCE_3Y',
    category: 'DISCOUNT',
    label: '3+ Years Experience',
    description: 'Owner/operator with 3+ years experience on same vessel type',
    valuePct: -0.1
  },
  {
    code: 'AUTO_FIRE_EXT',
    category: 'DISCOUNT',
    label: 'Automatic Fire Extinguisher',
    description: 'Vessel fitted with automatic fire extinguisher system',
    valuePct: -0.05
  },
  {
    code: 'PROFESSIONAL_CREW',
    category: 'DISCOUNT',
    label: 'Professional Crew',
    description: 'Licensed professional captain/crew on board',
    valuePct: -0.1
  },
  {
    code: 'AUS_NZ',
    category: 'DISCOUNT',
    label: 'Australia / New Zealand Navigation',
    description:
      'Vessel navigates exclusively in Australian or New Zealand waters',
    valuePct: -0.3
  },
  {
    code: 'DIESEL_ONLY',
    category: 'DISCOUNT',
    label: 'Diesel Engine Only',
    description: 'Motor vessel with diesel engine only (no petrol/gasoline)',
    valuePct: -0.1
  },
  {
    code: 'INLAND_WATERS_HULL',
    category: 'DISCOUNT',
    label: 'Inland Waters Only (Hull)',
    description: 'Vessel navigates inland waters only — no open sea',
    valuePct: -0.05
  },
  {
    code: 'SAILING_VESSEL_HULL',
    category: 'DISCOUNT',
    label: 'Sailing Vessel (Hull)',
    description: 'Primary propulsion by sail (includes sailing catamarans)',
    valuePct: -0.1
  },
  {
    code: 'MED_EU',
    category: 'DISCOUNT',
    label: 'Mediterranean / European Waters',
    description:
      'Navigation restricted to Mediterranean Sea or European coastal waters',
    valuePct: -0.3
  },
  {
    code: 'YACHTING_QUALIFICATION',
    category: 'DISCOUNT',
    label: 'Recognised Yachting Qualification',
    description:
      'Owner/operator holds recognised yachting qualification (RYA, ISAF, etc.)',
    valuePct: -0.1
  },
  {
    code: 'ENGLISH_LAW_HULL',
    category: 'DISCOUNT',
    label: 'English Law & Jurisdiction (Hull)',
    description: 'Policy subject to English law and jurisdiction',
    valuePct: -0.1
  },
  {
    code: 'EXCL_WINDSTORM_BOX',
    category: 'DISCOUNT',
    label: 'Exclude Windstorm in Named Storm Box',
    description:
      'Windstorm excluded during named storm / hurricane season in defined box',
    valuePct: -0.1
  },
  {
    code: 'WEST_COAST_US_MX',
    category: 'DISCOUNT',
    label: 'West Coast US / Mexico Navigation',
    description: 'Navigation restricted to Pacific coast of US and Mexico',
    valuePct: -0.3
  },
  {
    code: 'CABO_SAN_LUCAS_SEASONAL',
    category: 'DISCOUNT',
    label: 'Cabo San Lucas Seasonal Discount',
    description:
      'Vessel in Cabo San Lucas area — seasonal windstorm exclusion applied',
    valuePct: -0.4
  },
  {
    code: 'CHESAPEAKE_SEASONAL',
    category: 'DISCOUNT',
    label: 'Chesapeake Bay Seasonal',
    description: 'Navigation restricted to Chesapeake Bay with seasonal lay-up',
    valuePct: -0.25
  },
  {
    code: 'HULL_DED_3PCT',
    category: 'DISCOUNT',
    label: 'Hull Deductible 3%',
    description: 'Hull deductible increased to minimum 3% of insured value',
    valuePct: -0.05
  },
  {
    code: 'HULL_DED_4PCT',
    category: 'DISCOUNT',
    label: 'Hull Deductible 4%',
    description: 'Hull deductible increased to minimum 4% of insured value',
    valuePct: -0.1
  },
  {
    code: 'HULL_DED_5PCT',
    category: 'DISCOUNT',
    label: 'Hull Deductible 5%',
    description: 'Hull deductible increased to minimum 5% of insured value',
    valuePct: -0.15
  },
  // ── P&I DISCOUNTS ───────────────────────────────────────
  {
    code: 'INLAND_WATERS_PI',
    category: 'DISCOUNT',
    label: 'Inland Waters Only (P&I)',
    description: 'P&I discount for inland waters navigation only',
    valuePct: -0.05
  },
  {
    code: 'SAILING_VESSEL_PI',
    category: 'DISCOUNT',
    label: 'Sailing Vessel (P&I)',
    description: 'P&I discount for sailing vessels (primary sail propulsion)',
    valuePct: -0.2
  },
  {
    code: 'ENGLISH_LAW_PI',
    category: 'DISCOUNT',
    label: 'English Law & Jurisdiction (P&I)',
    description: 'P&I discount for English law and jurisdiction wording',
    valuePct: -0.2
  },
  {
    code: 'LAY_UP_PER_MONTH',
    category: 'DISCOUNT',
    label: 'Lay-up (per month, max 6)',
    description:
      'Monthly lay-up discount applied per full month of lay-up (max 6 months = -30%)',
    valuePct: -0.05
  },
  // ── HULL LOADINGS ───────────────────────────────────────
  {
    code: 'VESSEL_OVER_10Y',
    category: 'LOADING',
    label: 'Vessel Age 11–15 Years',
    description: 'Age loading for vessels 11 to 15 years old',
    valuePct: 0.1
  },
  {
    code: 'VESSEL_OVER_15Y',
    category: 'LOADING',
    label: 'Vessel Age 16–20 Years',
    description:
      'Age loading for vessels 16 to 20 years old (survey may be required)',
    valuePct: 0.15
  },
  {
    code: 'VESSEL_OVER_20Y',
    category: 'LOADING',
    label: 'Vessel Age 21–25 Years',
    description:
      'Age loading for vessels 21 to 25 years old (out-of-water survey required)',
    valuePct: 0.25
  },
  {
    code: 'VESSEL_OVER_25Y',
    category: 'LOADING',
    label: 'Vessel Age 26+ Years',
    description:
      'Age loading for vessels over 25 years old (out-of-water survey mandatory)',
    valuePct: 0.35
  },
  {
    code: 'RACING_RALLY',
    category: 'LOADING',
    label: 'Racing / Rally Participation',
    description: 'Vessel participates in racing events or ocean rallies',
    valuePct: 0.2
  },
  {
    code: 'CUBA_COL_HAITI_VEN',
    category: 'LOADING',
    label: 'Cuba / Colombia / Haiti / Venezuela Navigation',
    description:
      'Vessel navigates in or through Cuba, Colombia, Haiti or Venezuela',
    valuePct: 0.1
  },
  {
    code: 'CATAMARAN',
    category: 'LOADING',
    label: 'Catamaran',
    description: 'Multi-hull catamaran vessel type loading',
    valuePct: 0.1
  },
  {
    code: 'TRIMARAN_FERRO',
    category: 'LOADING',
    label: 'Trimaran / Ferro-Cement',
    description: 'Trimaran or ferro-cement construction vessel type loading',
    valuePct: 0.35
  },
  {
    code: 'CHARTER_VESSEL',
    category: 'LOADING',
    label: 'Charter / Bareboat Charter Use',
    description: 'Vessel used for commercial charter or bareboat charter',
    valuePct: 0.2
  },
  {
    code: 'SINGLE_HANDED',
    category: 'LOADING',
    label: 'Single-Handed Sailing',
    description: 'Vessel regularly sailed single-handed (no other crew)',
    valuePct: 0.1
  },
  {
    code: 'KEVLAR_METALHULL',
    category: 'LOADING',
    label: 'Kevlar / Metal Hull Construction',
    description:
      'Vessel hull constructed of kevlar or metal (non-standard materials)',
    valuePct: 0.1
  },
  {
    code: 'FAULT_CLAIM_CY_PY',
    category: 'LOADING',
    label: 'Fault Claim — Current or Prior Year',
    description: 'One or more at-fault claims in current or prior policy year',
    valuePct: 0.3
  },
  {
    code: 'FAULT_CLAIM_CY_PY_NF',
    category: 'LOADING',
    label: 'Fault Claim + Non-Fault — Current or Prior Year',
    description: 'At-fault claim plus non-fault claim in current or prior year',
    valuePct: 0.15
  },
  {
    code: 'FAULT_CLAIM_PRIOR_2Y',
    category: 'LOADING',
    label: 'Fault Claim — 2 Years Prior',
    description: 'At-fault claim(s) two years prior to current policy year',
    valuePct: 0.2
  },
  {
    code: 'FAULT_CLAIM_PRIOR_2Y_NF',
    category: 'LOADING',
    label: 'Fault Claim + Non-Fault — 2 Years Prior',
    description: 'At-fault plus non-fault claim two years prior',
    valuePct: 0.05
  },
  {
    code: 'FAULT_CLAIM_PRIOR_3Y',
    category: 'LOADING',
    label: 'Fault Claim — 3 Years Prior',
    description: 'At-fault claim(s) three years prior to current policy year',
    valuePct: 0.1
  },
  {
    code: 'MOTOR_36_50KT',
    category: 'LOADING',
    label: 'Motor Vessel 36–50 Knots',
    description: 'High-speed motor vessel capable of 36 to 50 knots',
    valuePct: 0.25
  },
  {
    code: 'MOTOR_50_65KT',
    category: 'LOADING',
    label: 'Motor Vessel 50–65 Knots',
    description:
      'Very high-speed motor vessel capable of 50 to 65 knots (refer UW if >65kt)',
    valuePct: 0.4
  },
  {
    code: 'HULL_DED_1PCT_OVER_1M',
    category: 'LOADING',
    label: 'Hull Deductible 1% on Value >$1M',
    description:
      'Loading for 1% deductible on hull values exceeding $1,000,000',
    valuePct: 0.05
  },
  {
    code: 'LIGHTNING_STRIKE',
    category: 'LOADING',
    label: 'Lightning Strike History',
    description: 'Previous lightning strike claim on this vessel',
    valuePct: 0.1
  },
  // ── OCEAN TRANSIT ADDITIONAL RATES (% of hull value) ────
  {
    code: 'TRANS_PACIFIC_OW',
    category: 'TRANSIT',
    label: 'Trans-Pacific One-Way',
    description: 'Additional premium for one-way trans-Pacific passage',
    valuePct: 0.0025
  },
  {
    code: 'TRANS_PACIFIC_RT',
    category: 'TRANSIT',
    label: 'Trans-Pacific Round-Trip',
    description: 'Additional premium for round-trip trans-Pacific passage',
    valuePct: 0.0038
  },
  {
    code: 'TRANS_ATLANTIC_OW',
    category: 'TRANSIT',
    label: 'Trans-Atlantic One-Way',
    description: 'Additional premium for one-way trans-Atlantic passage',
    valuePct: 0.002
  },
  {
    code: 'TRANS_ATLANTIC_RT',
    category: 'TRANSIT',
    label: 'Trans-Atlantic Round-Trip',
    description: 'Additional premium for round-trip trans-Atlantic passage',
    valuePct: 0.003
  },
  {
    code: 'INDIAN_OCEAN_OW',
    category: 'TRANSIT',
    label: 'Indian Ocean One-Way',
    description: 'Additional premium for one-way Indian Ocean passage',
    valuePct: 0.002
  },
  {
    code: 'INDIAN_OCEAN_RT',
    category: 'TRANSIT',
    label: 'Indian Ocean Round-Trip',
    description: 'Additional premium for round-trip Indian Ocean passage',
    valuePct: 0.003
  },
  {
    code: 'HAWAII_OW',
    category: 'TRANSIT',
    label: 'Hawaii One-Way',
    description: 'Additional premium for one-way passage to/from Hawaii',
    valuePct: 0.001
  },
  {
    code: 'HAWAII_RT',
    category: 'TRANSIT',
    label: 'Hawaii Round-Trip',
    description: 'Additional premium for round-trip passage to/from Hawaii',
    valuePct: 0.0015
  },
  {
    code: 'BERMUDA_OW',
    category: 'TRANSIT',
    label: 'Bermuda One-Way',
    description: 'Additional premium for one-way passage to/from Bermuda',
    valuePct: 0.001
  },
  {
    code: 'BERMUDA_RT',
    category: 'TRANSIT',
    label: 'Bermuda Round-Trip',
    description: 'Additional premium for round-trip passage to/from Bermuda',
    valuePct: 0.0015
  },
  {
    code: 'PANAMA_OW',
    category: 'TRANSIT',
    label: 'Panama Canal One-Way',
    description: 'Additional premium for one-way Panama Canal transit',
    valuePct: 0.0007
  },
  {
    code: 'PANAMA_RT',
    category: 'TRANSIT',
    label: 'Panama Canal Round-Trip',
    description: 'Additional premium for round-trip Panama Canal transit',
    valuePct: 0.0011
  }
];

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
async function main() {
  console.log('🚢 Seeding SUN-MYC-001 rate tables...\n');

  // --- Hull Rate Bands US ---
  console.log('📊 Hull rates US/CA/MX/Caribbean...');
  await prisma.hullRateBand.deleteMany({
    where: { territory: 'US_CA_MX_CARIB' }
  });
  for (const band of HULL_RATES_US) {
    await prisma.hullRateBand.create({
      data: {
        territory: 'US_CA_MX_CARIB',
        minValue: band.minValue,
        maxValue: band.maxValue ?? null,
        ratePct: band.ratePct,
        effectiveDate: EFFECTIVE_DATE,
        isActive: true
      }
    });
  }
  console.log(`   ✅ ${HULL_RATES_US.length} bands loaded`);

  // --- Hull Rate Bands ROW ---
  console.log('📊 Hull rates Rest of World...');
  await prisma.hullRateBand.deleteMany({ where: { territory: 'ROW' } });
  for (const band of HULL_RATES_ROW) {
    await prisma.hullRateBand.create({
      data: {
        territory: 'ROW',
        minValue: band.minValue,
        maxValue: band.maxValue ?? null,
        ratePct: band.ratePct,
        effectiveDate: EFFECTIVE_DATE,
        isActive: true
      }
    });
  }
  console.log(`   ✅ ${HULL_RATES_ROW.length} bands loaded`);

  // --- P&I Rates Private US ---
  console.log('📊 P&I rates — Private / US...');
  await prisma.piRateBand.deleteMany({
    where: { territory: 'US_CA_MX_CARIB', useType: 'PRIVATE' }
  });
  for (const band of PI_PRIVATE_US) {
    await prisma.piRateBand.create({
      data: {
        territory: 'US_CA_MX_CARIB',
        useType: 'PRIVATE',
        liabilityLimit: band.liabilityLimit,
        maxLengthFt: band.maxLengthFt,
        annualPremium: band.annualPremium,
        effectiveDate: EFFECTIVE_DATE,
        isActive: true
      }
    });
  }
  console.log(`   ✅ ${PI_PRIVATE_US.length} bands loaded`);

  // --- P&I Rates Private ROW (extended with $2M/$3M) ---
  console.log('📊 P&I rates — Private / ROW (incl. $2M/$3M)...');
  await prisma.piRateBand.deleteMany({
    where: { territory: 'ROW', useType: 'PRIVATE' }
  });
  for (const band of PI_PRIVATE_ROW_EXTENDED) {
    await prisma.piRateBand.create({
      data: {
        territory: 'ROW',
        useType: 'PRIVATE',
        liabilityLimit: band.liabilityLimit,
        maxLengthFt: band.maxLengthFt,
        annualPremium: band.annualPremium,
        effectiveDate: EFFECTIVE_DATE,
        isActive: true
      }
    });
  }
  console.log(`   ✅ ${PI_PRIVATE_ROW_EXTENDED.length} bands loaded`);

  // --- P&I Rates Charter US ---
  console.log('📊 P&I rates — Charter / US...');
  await prisma.piRateBand.deleteMany({
    where: { territory: 'US_CA_MX_CARIB', useType: 'CHARTER' }
  });
  for (const band of PI_CHARTER_US) {
    await prisma.piRateBand.create({
      data: {
        territory: 'US_CA_MX_CARIB',
        useType: 'CHARTER',
        liabilityLimit: band.liabilityLimit,
        maxLengthFt: band.maxLengthFt,
        annualPremium: band.annualPremium,
        effectiveDate: EFFECTIVE_DATE,
        isActive: true
      }
    });
  }
  console.log(`   ✅ ${PI_CHARTER_US.length} bands loaded`);

  // --- Rating Factors ---
  console.log('⚙️  Rating factors (discounts & loadings)...');
  for (const factor of RATING_FACTORS) {
    await prisma.ratingFactor.upsert({
      where: { code: factor.code },
      update: {
        label: factor.label,
        description: factor.description,
        valuePct: factor.valuePct,
        isActive: true
      },
      create: {
        code: factor.code,
        category: factor.category,
        label: factor.label,
        description: factor.description,
        valuePct: factor.valuePct,
        isActive: true
      }
    });
  }
  console.log(`   ✅ ${RATING_FACTORS.length} factors loaded`);

  // --- Summary ---
  const hullCount = await prisma.hullRateBand.count();
  const piCount = await prisma.piRateBand.count();
  const factorCount = await prisma.ratingFactor.count();

  console.log('\n✅ Seed complete!');
  console.log(`   Hull rate bands : ${hullCount}`);
  console.log(`   P&I rate bands  : ${piCount}`);
  console.log(`   Rating factors  : ${factorCount}`);
  console.log(
    '\n📋 Source: Facility Agreement SUN-MYC-001, Appendix 6 (effective 2021-01-01)'
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

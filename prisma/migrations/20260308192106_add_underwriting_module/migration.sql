-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEW', 'QUOTED', 'BOUND', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('INDICATION', 'FIRM', 'BOUND', 'DECLINED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "UWDecision" AS ENUM ('APPROVE', 'DECLINE', 'REFER', 'MORE_INFO');

-- CreateEnum
CREATE TYPE "VesselType" AS ENUM ('SAILING', 'MOTOR', 'CATAMARAN', 'TRIMARAN', 'POWER', 'OTHER');

-- CreateEnum
CREATE TYPE "Territory" AS ENUM ('US_CA_MX_CARIB', 'ROW');

-- CreateEnum
CREATE TYPE "UseType" AS ENUM ('PRIVATE', 'CHARTER', 'BAREBOAT');

-- CreateEnum
CREATE TYPE "FactorCategory" AS ENUM ('DISCOUNT', 'LOADING', 'TRANSIT');

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "orgId" TEXT,
    "personId" TEXT,
    "dealId" TEXT,
    "vesselName" TEXT,
    "vesselType" "VesselType",
    "yearBuilt" INTEGER,
    "lengthFeet" DECIMAL(6,1),
    "hullValue" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "territory" "Territory" NOT NULL DEFAULT 'ROW',
    "useType" "UseType" NOT NULL DEFAULT 'PRIVATE',
    "navigationArea" TEXT,
    "navAreaModifier" TEXT,
    "maxSpeedKnots" INTEGER,
    "hasAutoFireExt" BOOLEAN NOT NULL DEFAULT false,
    "professionalCrew" BOOLEAN NOT NULL DEFAULT false,
    "hasYachtingQual" BOOLEAN NOT NULL DEFAULT false,
    "dieselOnly" BOOLEAN NOT NULL DEFAULT false,
    "englishLaw" BOOLEAN NOT NULL DEFAULT true,
    "inlandWatersOnly" BOOLEAN NOT NULL DEFAULT false,
    "liabilityLimit" DECIMAL(14,2),
    "tenderValue" DECIMAL(12,2),
    "personalProperty" DECIMAL(12,2),
    "electronicsValue" DECIMAL(12,2),
    "includeTowing" BOOLEAN NOT NULL DEFAULT false,
    "includeTrailer" BOOLEAN NOT NULL DEFAULT false,
    "trailerValue" DECIMAL(10,2),
    "includeWindstorm" BOOLEAN NOT NULL DEFAULT false,
    "hullDeductiblePct" DECIMAL(4,3) NOT NULL DEFAULT 0.02,
    "faultClaimsCY" INTEGER NOT NULL DEFAULT 0,
    "faultClaimsPY" INTEGER NOT NULL DEFAULT 0,
    "faultClaims2Y" INTEGER NOT NULL DEFAULT 0,
    "faultClaims3Y" INTEGER NOT NULL DEFAULT 0,
    "noFaultClaims" INTEGER NOT NULL DEFAULT 0,
    "transits" JSONB NOT NULL DEFAULT '[]',
    "layUpMonths" INTEGER NOT NULL DEFAULT 0,
    "insuredName" TEXT,
    "brokerName" TEXT,
    "brokerCompany" TEXT,
    "brokerEmail" TEXT,
    "aiAnalysis" JSONB,
    "aiModelVersion" TEXT,
    "aiAnalyzedAt" TIMESTAMP(3),
    "uwNotes" TEXT,
    "uwDecision" "UWDecision",
    "underwriterId" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'INDICATION',
    "hullPremium" DECIMAL(12,2) NOT NULL,
    "liabilityPremium" DECIMAL(12,2) NOT NULL,
    "optionalPremiums" JSONB NOT NULL DEFAULT '{}',
    "totalPremium" DECIMAL(12,2) NOT NULL,
    "baseRatePct" DECIMAL(6,4) NOT NULL,
    "adjustedRatePct" DECIMAL(6,4) NOT NULL,
    "netAdjustmentPct" DECIMAL(6,2) NOT NULL,
    "discountsApplied" JSONB NOT NULL DEFAULT '[]',
    "loadingsApplied" JSONB NOT NULL DEFAULT '[]',
    "rateTableSource" TEXT NOT NULL DEFAULT 'LM21M0136_Appendix6_v2021',
    "hullDeductible" DECIMAL(10,2) NOT NULL,
    "hullDeductiblePct" DECIMAL(4,3) NOT NULL,
    "liabilityDed" DECIMAL(10,2) NOT NULL,
    "uwNotes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "validFrom" DATE,
    "validUntil" DATE,
    "documentPath" TEXT,
    "documentGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hull_rate_bands" (
    "id" TEXT NOT NULL,
    "territory" "Territory" NOT NULL,
    "minValue" DECIMAL(14,2) NOT NULL,
    "maxValue" DECIMAL(14,2),
    "ratePct" DECIMAL(6,4) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hull_rate_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pi_rate_bands" (
    "id" TEXT NOT NULL,
    "territory" "Territory" NOT NULL,
    "useType" "UseType" NOT NULL,
    "liabilityLimit" DECIMAL(14,2) NOT NULL,
    "maxLengthFt" INTEGER NOT NULL,
    "annualPremium" DECIMAL(10,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pi_rate_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_factors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "FactorCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "valuePct" DECIMAL(6,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submissions_reference_key" ON "submissions"("reference");

-- CreateIndex
CREATE INDEX "submissions_tenantId_idx" ON "submissions"("tenantId");

-- CreateIndex
CREATE INDEX "submissions_tenantId_status_idx" ON "submissions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "submissions_tenantId_deleted_idx" ON "submissions"("tenantId", "deleted");

-- CreateIndex
CREATE INDEX "submissions_tenantId_createdAt_idx" ON "submissions"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "submissions_orgId_idx" ON "submissions"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quoteNumber_key" ON "quotes"("quoteNumber");

-- CreateIndex
CREATE INDEX "quotes_tenantId_idx" ON "quotes"("tenantId");

-- CreateIndex
CREATE INDEX "quotes_submissionId_idx" ON "quotes"("submissionId");

-- CreateIndex
CREATE INDEX "quotes_tenantId_status_idx" ON "quotes"("tenantId", "status");

-- CreateIndex
CREATE INDEX "quotes_tenantId_createdAt_idx" ON "quotes"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "hull_rate_bands_territory_isActive_idx" ON "hull_rate_bands"("territory", "isActive");

-- CreateIndex
CREATE INDEX "pi_rate_bands_territory_useType_isActive_idx" ON "pi_rate_bands"("territory", "useType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "rating_factors_code_key" ON "rating_factors"("code");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_underwriterId_fkey" FOREIGN KEY ("underwriterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

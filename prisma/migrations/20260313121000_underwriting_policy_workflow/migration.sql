-- Add submission lifecycle status for issued policy
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'POLICY_ISSUED';

-- Extend submissions for policy issuance + renewal linkage
ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "policyNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "boundAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "policyIssuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "policyDocumentPath" TEXT,
  ADD COLUMN IF NOT EXISTS "policyDocumentGeneratedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceSubmissionId" TEXT;

-- Policy number sequence per tenant/year
CREATE TABLE IF NOT EXISTS "policy_sequences" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "policy_sequences_pkey" PRIMARY KEY ("id")
);

-- Renewal reminders idempotency tracker
CREATE TABLE IF NOT EXISTS "renewal_notifications" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "daysBefore" INTEGER NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "renewal_notifications_pkey" PRIMARY KEY ("id")
);

-- Endorsements
CREATE TYPE "EndorsementType" AS ENUM (
  'VESSEL_CHANGE',
  'NAVIGATION_EXT',
  'LAYUP_CHANGE',
  'ADDITIONAL_INSURED'
);

CREATE TYPE "EndorsementStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'APPLIED',
  'DECLINED'
);

CREATE TABLE IF NOT EXISTS "policy_endorsements" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "endorsementNo" TEXT NOT NULL,
  "type" "EndorsementType" NOT NULL,
  "status" "EndorsementStatus" NOT NULL DEFAULT 'PENDING',
  "effectiveDate" DATE NOT NULL,
  "changes" JSONB NOT NULL DEFAULT '{}',
  "premiumDelta" DECIMAL(12,2),
  "notes" TEXT,
  "documentPath" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "policy_endorsements_pkey" PRIMARY KEY ("id")
);

-- Indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS "submissions_policyNumber_key" ON "submissions"("policyNumber");
CREATE INDEX IF NOT EXISTS "submissions_tenantId_policyNumber_idx" ON "submissions"("tenantId", "policyNumber");
CREATE INDEX IF NOT EXISTS "submissions_sourceSubmissionId_idx" ON "submissions"("sourceSubmissionId");

CREATE UNIQUE INDEX IF NOT EXISTS "policy_seq_tenant_year_unique" ON "policy_sequences"("tenantId", "year");
CREATE INDEX IF NOT EXISTS "policy_sequences_tenantId_year_idx" ON "policy_sequences"("tenantId", "year");

CREATE UNIQUE INDEX IF NOT EXISTS "renewal_submission_days_unique" ON "renewal_notifications"("submissionId", "daysBefore");
CREATE INDEX IF NOT EXISTS "renewal_notifications_tenantId_daysBefore_idx" ON "renewal_notifications"("tenantId", "daysBefore");

CREATE UNIQUE INDEX IF NOT EXISTS "policy_endorsements_endorsementNo_key" ON "policy_endorsements"("endorsementNo");
CREATE INDEX IF NOT EXISTS "policy_endorsements_tenantId_submissionId_status_idx" ON "policy_endorsements"("tenantId", "submissionId", "status");
CREATE INDEX IF NOT EXISTS "policy_endorsements_submissionId_createdAt_idx" ON "policy_endorsements"("submissionId", "createdAt" DESC);

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_sourceSubmissionId_fkey"
  FOREIGN KEY ("sourceSubmissionId") REFERENCES "submissions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "policy_sequences"
  ADD CONSTRAINT "policy_sequences_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "renewal_notifications"
  ADD CONSTRAINT "renewal_notifications_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "renewal_notifications"
  ADD CONSTRAINT "renewal_notifications_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "policy_endorsements"
  ADD CONSTRAINT "policy_endorsements_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "policy_endorsements"
  ADD CONSTRAINT "policy_endorsements_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

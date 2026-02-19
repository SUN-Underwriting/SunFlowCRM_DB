-- CreateEnum
CREATE TYPE "DealVisibility" AS ENUM ('OWNER', 'TEAM', 'COMPANY');

-- CreateEnum
CREATE TYPE "DealPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "externalSourceId" TEXT,
ADD COLUMN     "firstWonTime" TIMESTAMP(3),
ADD COLUMN     "priority" "DealPriority",
ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "renewalType" TEXT,
ADD COLUMN     "rottenFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rottenTime" TIMESTAMP(3),
ADD COLUMN     "source" TEXT,
ADD COLUMN     "stageChangeTime" TIMESTAMP(3),
ADD COLUMN     "visibility" "DealVisibility" NOT NULL DEFAULT 'COMPANY';

-- AlterTable
ALTER TABLE "emails" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Backfill stageChangeTime for existing deals (use createdAt as fallback)
UPDATE "deals" SET "stageChangeTime" = "createdAt" WHERE "stageChangeTime" IS NULL;

-- Backfill creatorId for existing deals (use ownerId as best-effort fallback)
UPDATE "deals" SET "creatorId" = "ownerId" WHERE "creatorId" IS NULL;

-- CreateIndex
CREATE INDEX "deals_creatorId_idx" ON "deals"("creatorId");

-- CreateIndex
CREATE INDEX "deals_tenantId_visibility_idx" ON "deals"("tenantId", "visibility");

-- CreateIndex
CREATE INDEX "deals_tenantId_priority_idx" ON "deals"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "deals_tenantId_source_idx" ON "deals"("tenantId", "source");

-- CreateIndex
CREATE INDEX "deals_tenantId_stageChangeTime_idx" ON "deals"("tenantId", "stageChangeTime");

-- CreateIndex
CREATE INDEX "deals_tenantId_rottenFlag_idx" ON "deals"("tenantId", "rottenFlag");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

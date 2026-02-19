-- CreateEnum
CREATE TYPE "BusyFlag" AS ENUM ('FREE', 'BUSY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'DEADLINE';
ALTER TYPE "ActivityType" ADD VALUE 'LUNCH';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "busyFlag" "BusyFlag" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "calendarProvider" TEXT,
ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "externalEventId" TEXT,
ADD COLUMN     "hasTime" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "lastActivityDate" TIMESTAMP(3),
ADD COLUMN     "nextActivityDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "lastActivityDate" TIMESTAMP(3),
ADD COLUMN     "nextActivityDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "lastActivityDate" TIMESTAMP(3),
ADD COLUMN     "nextActivityDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "persons" ADD COLUMN     "lastActivityDate" TIMESTAMP(3),
ADD COLUMN     "nextActivityDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "activities_tenantId_ownerId_done_dueAt_idx" ON "activities"("tenantId", "ownerId", "done", "dueAt");

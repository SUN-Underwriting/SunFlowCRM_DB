-- DropIndex
DROP INDEX "activities_tenantId_done_deleted_dueAt_dueSoonNotifiedAt_idx";

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "remindAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "activities_tenantId_done_deleted_remindAt_dueSoonNotifiedAt_idx" ON "activities"("tenantId", "done", "deleted", "remindAt", "dueSoonNotifiedAt");

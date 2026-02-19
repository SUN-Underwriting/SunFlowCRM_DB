-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "dueSoonNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "activities_tenantId_done_deleted_dueAt_dueSoonNotifiedAt_idx" ON "activities"("tenantId", "done", "deleted", "dueAt", "dueSoonNotifiedAt");

-- CreateIndex
CREATE INDEX "activities_tenantId_done_deleted_dueAt_overdueNotifiedAt_idx" ON "activities"("tenantId", "done", "deleted", "dueAt", "overdueNotifiedAt");

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "domain" TEXT,
ADD COLUMN "ownerId" TEXT,
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "city" TEXT;

-- CreateIndex
CREATE INDEX "organizations_tenantId_domain_idx" ON "organizations"("tenantId", "domain");

-- CreateIndex
CREATE INDEX "organizations_tenantId_ownerId_idx" ON "organizations"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "organizations_tenantId_countryCode_idx" ON "organizations"("tenantId", "countryCode");

-- CreateIndex
CREATE INDEX "organizations_tenantId_city_idx" ON "organizations"("tenantId", "city");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

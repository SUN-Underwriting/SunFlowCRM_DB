-- CreateTable
CREATE TABLE "deal_labels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#6B7280',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_label_links" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_label_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_permitted_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionType" TEXT NOT NULL DEFAULT 'read',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_permitted_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_labels_tenantId_idx" ON "deal_labels"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_labels_tenantId_name_key" ON "deal_labels"("tenantId", "name");

-- CreateIndex
CREATE INDEX "deal_label_links_dealId_idx" ON "deal_label_links"("dealId");

-- CreateIndex
CREATE INDEX "deal_label_links_labelId_idx" ON "deal_label_links"("labelId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_label_links_dealId_labelId_key" ON "deal_label_links"("dealId", "labelId");

-- CreateIndex
CREATE INDEX "deal_permitted_users_tenantId_idx" ON "deal_permitted_users"("tenantId");

-- CreateIndex
CREATE INDEX "deal_permitted_users_dealId_idx" ON "deal_permitted_users"("dealId");

-- CreateIndex
CREATE INDEX "deal_permitted_users_userId_idx" ON "deal_permitted_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_permitted_users_dealId_userId_key" ON "deal_permitted_users"("dealId", "userId");

-- AddForeignKey
ALTER TABLE "deal_labels" ADD CONSTRAINT "deal_labels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_label_links" ADD CONSTRAINT "deal_label_links_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_label_links" ADD CONSTRAINT "deal_label_links_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "deal_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_permitted_users" ADD CONSTRAINT "deal_permitted_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_permitted_users" ADD CONSTRAINT "deal_permitted_users_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_permitted_users" ADD CONSTRAINT "deal_permitted_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

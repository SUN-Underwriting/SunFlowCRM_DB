-- CreateEnum
CREATE TYPE "LeadVisibility" AS ENUM ('OWNER', 'TEAM', 'COMPANY');

-- AlterEnum
ALTER TYPE "FieldEntityType" ADD VALUE 'LEAD';

-- AlterEnum: LeadStatus (replace NEW/IN_PROGRESS with OPEN/LOST)
BEGIN;
CREATE TYPE "LeadStatus_new" AS ENUM ('OPEN', 'LOST', 'ARCHIVED', 'CONVERTED');
ALTER TABLE "public"."leads" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
DROP TYPE "public"."LeadStatus_old";
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterTable: activities (add leadId, soft-delete fields)
ALTER TABLE "activities" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "leadId" TEXT;

-- AlterTable: deals (add deletedAt)
ALTER TABLE "deals" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable: emails (add leadId, soft-delete, updatedAt)
ALTER TABLE "emails" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: field_definitions (add soft-delete)
ALTER TABLE "field_definitions" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable: leads (expand domain fields)
ALTER TABLE "leads" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "customData" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "expectedCloseDate" DATE,
ADD COLUMN     "externalSourceId" TEXT,
ADD COLUMN     "inboxChannel" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "valueAmount" DECIMAL(18,2),
ADD COLUMN     "valueCurrency" VARCHAR(3),
ADD COLUMN     "visibility" "LeadVisibility" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "wasSeen" BOOLEAN,
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- AlterTable: organizations (add deletedAt)
ALTER TABLE "organizations" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable: persons (add deletedAt)
ALTER TABLE "persons" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable: pipelines (add soft-delete)
ALTER TABLE "pipelines" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable: stages (add soft-delete)
ALTER TABLE "stages" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lead_labels
CREATE TABLE "lead_labels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lead_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lead_label_links
CREATE TABLE "lead_label_links" (
    "leadId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    CONSTRAINT "lead_label_links_pkey" PRIMARY KEY ("leadId","labelId")
);

-- CreateTable: lead_permitted_users
CREATE TABLE "lead_permitted_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionType" TEXT NOT NULL DEFAULT 'read',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_permitted_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notes
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "dealId" TEXT,
    "personId" TEXT,
    "orgId" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: audit_logs
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");
CREATE INDEX "audit_logs_tenantId_module_idx" ON "audit_logs"("tenantId", "module");
CREATE INDEX "audit_logs_tenantId_action_idx" ON "audit_logs"("tenantId", "action");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_entityId_entityType_idx" ON "audit_logs"("entityId", "entityType");

-- CreateIndex: lead_labels
CREATE INDEX "lead_labels_tenantId_idx" ON "lead_labels"("tenantId");
CREATE UNIQUE INDEX "lead_labels_tenantId_name_key" ON "lead_labels"("tenantId", "name");

-- CreateIndex: lead_permitted_users
CREATE INDEX "lead_permitted_users_tenantId_idx" ON "lead_permitted_users"("tenantId");
CREATE INDEX "lead_permitted_users_userId_idx" ON "lead_permitted_users"("userId");
CREATE UNIQUE INDEX "lead_permitted_users_leadId_userId_key" ON "lead_permitted_users"("leadId", "userId");

-- CreateIndex: notes
CREATE INDEX "notes_tenantId_idx" ON "notes"("tenantId");
CREATE INDEX "notes_tenantId_deleted_idx" ON "notes"("tenantId", "deleted");
CREATE INDEX "notes_leadId_idx" ON "notes"("leadId");
CREATE INDEX "notes_dealId_idx" ON "notes"("dealId");
CREATE INDEX "notes_personId_idx" ON "notes"("personId");
CREATE INDEX "notes_authorId_idx" ON "notes"("authorId");

-- CreateIndex: activities (new indexes)
CREATE INDEX "activities_tenantId_deleted_idx" ON "activities"("tenantId", "deleted");
CREATE INDEX "activities_leadId_idx" ON "activities"("leadId");

-- CreateIndex: deals (new indexes)
CREATE INDEX "deals_tenantId_deleted_idx" ON "deals"("tenantId", "deleted");

-- CreateIndex: emails (new indexes)
CREATE INDEX "emails_tenantId_deleted_idx" ON "emails"("tenantId", "deleted");
CREATE INDEX "emails_leadId_idx" ON "emails"("leadId");

-- CreateIndex: field_definitions (new indexes)
CREATE INDEX "field_definitions_tenantId_deleted_idx" ON "field_definitions"("tenantId", "deleted");

-- CreateIndex: leads (new indexes)
CREATE INDEX "leads_tenantId_deleted_idx" ON "leads"("tenantId", "deleted");
CREATE INDEX "leads_tenantId_wasSeen_idx" ON "leads"("tenantId", "wasSeen");
CREATE INDEX "leads_creatorId_idx" ON "leads"("creatorId");

-- CreateIndex: pipelines (new indexes)
CREATE INDEX "pipelines_tenantId_deleted_idx" ON "pipelines"("tenantId", "deleted");

-- CreateIndex: stages (new indexes)
CREATE INDEX "stages_tenantId_deleted_idx" ON "stages"("tenantId", "deleted");

-- AddForeignKey: leads -> users (creator)
ALTER TABLE "leads" ADD CONSTRAINT "leads_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: lead_labels -> tenants
ALTER TABLE "lead_labels" ADD CONSTRAINT "lead_labels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: lead_label_links -> leads, lead_labels
ALTER TABLE "lead_label_links" ADD CONSTRAINT "lead_label_links_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_label_links" ADD CONSTRAINT "lead_label_links_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "lead_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: lead_permitted_users -> leads, users
ALTER TABLE "lead_permitted_users" ADD CONSTRAINT "lead_permitted_users_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_permitted_users" ADD CONSTRAINT "lead_permitted_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: notes -> tenants, users, leads, deals, persons, organizations
ALTER TABLE "notes" ADD CONSTRAINT "notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: activities -> leads
ALTER TABLE "activities" ADD CONSTRAINT "activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: emails -> leads
ALTER TABLE "emails" ADD CONSTRAINT "emails_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

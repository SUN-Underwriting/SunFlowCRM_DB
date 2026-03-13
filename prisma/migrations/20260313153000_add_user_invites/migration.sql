CREATE TABLE IF NOT EXISTS "user_invites" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_invites_tokenHash_key" ON "user_invites"("tokenHash");
CREATE INDEX IF NOT EXISTS "user_invites_tenantId_email_createdAt_idx" ON "user_invites"("tenantId", "email", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "user_invites_userId_createdAt_idx" ON "user_invites"("userId", "createdAt" DESC);

ALTER TABLE "user_invites"
  ADD CONSTRAINT "user_invites_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_invites"
  ADD CONSTRAINT "user_invites_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_invites"
  ADD CONSTRAINT "user_invites_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add Stack Auth user ID field and make SuperTokens user ID nullable
-- This migration enables multi-provider support for auth (SuperTokens + Stack Auth)

-- Make supertokensUserId nullable (for Stack Auth users)
ALTER TABLE "users" ALTER COLUMN "supertokensUserId" DROP NOT NULL;

-- Add stackAuthUserId field
ALTER TABLE "users" ADD COLUMN "stackAuthUserId" TEXT;

-- Create unique index for stackAuthUserId
CREATE UNIQUE INDEX "users_stackAuthUserId_key" ON "users"("stackAuthUserId");

-- Create index for faster lookups
CREATE INDEX "users_stackAuthUserId_idx" ON "users"("stackAuthUserId");

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "autoDecline" TEXT,
ADD COLUMN     "uwFlags" JSONB NOT NULL DEFAULT '[]';

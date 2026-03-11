-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "rateTableSource" SET DEFAULT 'SUN-MYC-001_Appendix6_v2021';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "crewLiabilityLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "medicalExpensesLimit" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "uninsuredBoatersLimit" INTEGER NOT NULL DEFAULT 25000;

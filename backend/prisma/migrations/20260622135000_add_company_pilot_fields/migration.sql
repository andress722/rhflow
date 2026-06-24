-- CreateEnum
CREATE TYPE "PilotStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'PROPOSAL_SENT', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "pilotStatus" "PilotStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "pilotStartedAt" TIMESTAMP(3),
ADD COLUMN "pilotEndsAt" TIMESTAMP(3),
ADD COLUMN "proposalSentAt" TIMESTAMP(3),
ADD COLUMN "convertedAt" TIMESTAMP(3),
ADD COLUMN "pilotLostReason" TEXT,
ADD COLUMN "commercialNotes" TEXT;

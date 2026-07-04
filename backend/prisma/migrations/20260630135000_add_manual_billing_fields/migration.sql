-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAYMENT_PENDING', 'OVERDUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterTable
ALTER TABLE "CompanySubscription" 
ADD COLUMN "billingStatus" "BillingStatus" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN "contractedAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN "contractSentAt" TIMESTAMP(3),
ADD COLUMN "contractSignedAt" TIMESTAMP(3),
ADD COLUMN "subscriptionStartedAt" TIMESTAMP(3),
ADD COLUMN "nextBillingAt" TIMESTAMP(3),
ADD COLUMN "canceledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "financeNotes" TEXT;

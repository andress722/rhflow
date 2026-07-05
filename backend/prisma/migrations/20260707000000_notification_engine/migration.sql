-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "QuietHoursBehavior" AS ENUM ('DEFER', 'ALLOW_HIGH_PRIORITY', 'IGNORE');

-- CreateEnum
CREATE TYPE "ChannelFallbackMode" AS ENUM ('PARALLEL', 'SEQUENTIAL');

-- CreateEnum
CREATE TYPE "NotificationRecipientType" AS ENUM ('EMPLOYEE', 'DIRECT_MANAGER', 'HR', 'ADMIN', 'SPECIFIC_USER', 'ROLE', 'REQUESTER', 'EVENT_ACTOR');

-- CreateEnum
CREATE TYPE "NotificationWorkflowStatus" AS ENUM ('PENDING', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED', 'EXHAUSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED', 'SUPPRESSED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationChannel" ADD VALUE 'WEB_PUSH';
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';
ALTER TYPE "NotificationChannel" ADD VALUE 'EMAIL';

-- CreateTable
CREATE TABLE "NotificationPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgmentTimeoutMinutes" INTEGER,
    "maxEscalationLevel" INTEGER NOT NULL DEFAULT 1,
    "quietHoursBehavior" "QuietHoursBehavior" NOT NULL DEFAULT 'DEFER',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPolicyStep" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "recipientType" "NotificationRecipientType" NOT NULL,
    "recipientReference" TEXT,
    "channels" JSONB NOT NULL,
    "fallbackMode" "ChannelFallbackMode" NOT NULL DEFAULT 'PARALLEL',
    "stopOnAcknowledgment" BOOLEAN NOT NULL DEFAULT true,
    "stopOnResolution" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPolicyStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationWorkflowInstance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "policyId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL,
    "status" "NotificationWorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextActionAt" TIMESTAMP(3),
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionReason" TEXT,
    "deduplicationKey" TEXT NOT NULL,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationWorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "policyStepId" TEXT,
    "recipientUserId" TEXT,
    "recipientEmployeeId" TEXT,
    "channel" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReasonCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationQuietHours" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "daysOfWeek" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationQuietHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationMessageTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "subjectTemplate" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationPolicy_companyId_eventType_isActive_idx" ON "NotificationPolicy"("companyId", "eventType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPolicyStep_policyId_stepOrder_key" ON "NotificationPolicyStep"("policyId", "stepOrder");

-- CreateIndex
CREATE INDEX "NotificationWorkflowInstance_status_nextActionAt_idx" ON "NotificationWorkflowInstance"("status", "nextActionAt");

-- CreateIndex
CREATE INDEX "NotificationWorkflowInstance_companyId_status_nextActionAt_idx" ON "NotificationWorkflowInstance"("companyId", "status", "nextActionAt");

-- CreateIndex
CREATE INDEX "NotificationWorkflowInstance_companyId_eventType_createdAt_idx" ON "NotificationWorkflowInstance"("companyId", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationWorkflowInstance_companyId_deduplicationKey_key" ON "NotificationWorkflowInstance"("companyId", "deduplicationKey");

-- CreateIndex
CREATE INDEX "NotificationDeliveryAttempt_workflowInstanceId_status_idx" ON "NotificationDeliveryAttempt"("workflowInstanceId", "status");

-- CreateIndex
CREATE INDEX "NotificationDeliveryAttempt_companyId_channel_status_idx" ON "NotificationDeliveryAttempt"("companyId", "channel", "status");

-- CreateIndex
CREATE INDEX "NotificationDeliveryAttempt_scheduledAt_idx" ON "NotificationDeliveryAttempt"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_companyId_idempotencyKey_key" ON "NotificationDeliveryAttempt"("companyId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationQuietHours_companyId_key" ON "NotificationQuietHours"("companyId");

-- CreateIndex
CREATE INDEX "NotificationMessageTemplate_companyId_eventType_channel_idx" ON "NotificationMessageTemplate"("companyId", "eventType", "channel");

-- AddForeignKey
ALTER TABLE "NotificationPolicy" ADD CONSTRAINT "NotificationPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPolicyStep" ADD CONSTRAINT "NotificationPolicyStep_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "NotificationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationWorkflowInstance" ADD CONSTRAINT "NotificationWorkflowInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationWorkflowInstance" ADD CONSTRAINT "NotificationWorkflowInstance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "NotificationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "NotificationWorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationQuietHours" ADD CONSTRAINT "NotificationQuietHours_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationMessageTemplate" ADD CONSTRAINT "NotificationMessageTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Partial unique indexes for NotificationMessageTemplate (companyId nullable
-- means a plain composite unique would treat every NULL as distinct in
-- Postgres, silently allowing duplicate "global" templates; these two
-- partial indexes make each side unique on its own terms).
CREATE UNIQUE INDEX "NotificationMessageTemplate_global_unique"
  ON "NotificationMessageTemplate" ("eventType", "channel", "version")
  WHERE "companyId" IS NULL;

CREATE UNIQUE INDEX "NotificationMessageTemplate_tenant_unique"
  ON "NotificationMessageTemplate" ("companyId", "eventType", "channel", "version")
  WHERE "companyId" IS NOT NULL;

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('NOTE', 'STATUS_CHANGED', 'CONTACTED', 'DEMO_SCHEDULED', 'FOLLOW_UP_SCHEDULED', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "PilotLead" ADD COLUMN "assignedToUserId" TEXT,
ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN "lastContactedAt" TIMESTAMP(3),
ADD COLUMN "demoScheduledAt" TIMESTAMP(3),
ADD COLUMN "lostReason" TEXT,
ADD COLUMN "wonAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotLead_assignedToUserId_idx" ON "PilotLead"("assignedToUserId");
CREATE INDEX "PilotLead_nextFollowUpAt_idx" ON "PilotLead"("nextFollowUpAt");
CREATE INDEX "PilotLead_demoScheduledAt_idx" ON "PilotLead"("demoScheduledAt");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX "LeadActivity_createdByUserId_idx" ON "LeadActivity"("createdByUserId");
CREATE INDEX "LeadActivity_type_idx" ON "LeadActivity"("type");
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "PilotLead" ADD CONSTRAINT "PilotLead_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PilotLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

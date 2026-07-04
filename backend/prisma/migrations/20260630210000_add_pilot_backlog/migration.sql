-- CreateEnum
CREATE TYPE "PilotBacklogType" AS ENUM ('BUGFIX', 'IMPROVEMENT', 'CONFIGURATION', 'TRAINING', 'DOCUMENTATION', 'FEATURE_REQUEST');

-- CreateEnum
CREATE TYPE "PilotBacklogPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PilotBacklogStatus" AS ENUM ('TRIAGED', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- CreateTable
CREATE TABLE "PilotBacklogItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "feedbackId" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "type" "PilotBacklogType" NOT NULL,
    "priority" "PilotBacklogPriority" NOT NULL,
    "status" "PilotBacklogStatus" NOT NULL DEFAULT 'TRIAGED',
    "impact" VARCHAR(3000),
    "rootCause" VARCHAR(3000),
    "plannedAction" VARCHAR(3000),
    "releaseNote" VARCHAR(3000),
    "targetReleaseDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotBacklogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotBacklogItem_companyId_idx" ON "PilotBacklogItem"("companyId");

-- CreateIndex
CREATE INDEX "PilotBacklogItem_status_idx" ON "PilotBacklogItem"("status");

-- CreateIndex
CREATE INDEX "PilotBacklogItem_priority_idx" ON "PilotBacklogItem"("priority");

-- AddForeignKey
ALTER TABLE "PilotBacklogItem" ADD CONSTRAINT "PilotBacklogItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotBacklogItem" ADD CONSTRAINT "PilotBacklogItem_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "PilotFeedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotBacklogItem" ADD CONSTRAINT "PilotBacklogItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

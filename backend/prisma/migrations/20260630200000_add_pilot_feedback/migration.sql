-- CreateEnum
CREATE TYPE "PilotFeedbackSource" AS ENUM ('WHATSAPP', 'CALL', 'EMAIL', 'MEETING', 'INTERNAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PilotFeedbackCategory" AS ENUM ('BUG', 'QUESTION', 'USABILITY', 'TRAINING', 'FEATURE_REQUEST', 'INCIDENT', 'COMMERCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PilotFeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PilotFeedbackStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "PilotFeedback" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "reportedByRole" TEXT,
    "source" "PilotFeedbackSource" NOT NULL,
    "category" "PilotFeedbackCategory" NOT NULL,
    "severity" "PilotFeedbackSeverity" NOT NULL,
    "status" "PilotFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "impact" VARCHAR(2000),
    "actionTaken" VARCHAR(2000),
    "relatedRequestId" TEXT,
    "relatedUrl" TEXT,
    "assignedToUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotFeedback_companyId_idx" ON "PilotFeedback"("companyId");

-- CreateIndex
CREATE INDEX "PilotFeedback_status_idx" ON "PilotFeedback"("status");

-- CreateIndex
CREATE INDEX "PilotFeedback_severity_idx" ON "PilotFeedback"("severity");

-- CreateIndex
CREATE INDEX "PilotFeedback_category_idx" ON "PilotFeedback"("category");

-- AddForeignKey
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

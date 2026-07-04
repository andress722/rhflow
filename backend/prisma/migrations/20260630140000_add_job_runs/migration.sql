-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED', 'RUNNING');

-- CreateEnum
CREATE TYPE "JobTriggerType" AS ENUM ('INTERNAL', 'MANUAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "triggeredBy" "JobTriggerType" NOT NULL,
    "requestId" TEXT,
    "summary" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_jobKey_idx" ON "JobRun"("jobKey");

-- CreateIndex
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");

-- CreateIndex
CREATE INDEX "JobRun_startedAt_idx" ON "JobRun"("startedAt");

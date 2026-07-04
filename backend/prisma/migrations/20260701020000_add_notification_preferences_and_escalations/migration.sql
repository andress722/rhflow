-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP');

-- CreateEnum
CREATE TYPE "EscalationScope" AS ENUM ('PLATFORM', 'COMPANY');

-- CreateEnum
CREATE TYPE "DigestStatus" AS ENUM ('GENERATED', 'SENT', 'SKIPPED');

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "role" TEXT,
    "type" TEXT,
    "severity" "NotificationSeverity",
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" VARCHAR(5),
    "quietHoursEnd" VARCHAR(5),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEscalationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "scope" "EscalationScope" NOT NULL DEFAULT 'COMPANY',
    "type" TEXT,
    "severity" "NotificationSeverity",
    "condition" JSONB,
    "escalateAfterMinutes" INTEGER NOT NULL,
    "targetRole" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationEscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDigest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "role" TEXT,
    "digestDate" TIMESTAMP(3) NOT NULL,
    "status" "DigestStatus" NOT NULL DEFAULT 'GENERATED',
    "summary" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationPreference_companyId_idx" ON "NotificationPreference"("companyId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_role_idx" ON "NotificationPreference"("role");

-- CreateIndex
CREATE INDEX "NotificationEscalationRule_companyId_idx" ON "NotificationEscalationRule"("companyId");

-- CreateIndex
CREATE INDEX "NotificationEscalationRule_scope_idx" ON "NotificationEscalationRule"("scope");

-- CreateIndex
CREATE INDEX "NotificationDigest_companyId_idx" ON "NotificationDigest"("companyId");

-- CreateIndex
CREATE INDEX "NotificationDigest_userId_idx" ON "NotificationDigest"("userId");

-- CreateIndex
CREATE INDEX "NotificationDigest_role_idx" ON "NotificationDigest"("role");

-- CreateIndex
CREATE INDEX "NotificationDigest_digestDate_idx" ON "NotificationDigest"("digestDate");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEscalationRule" ADD CONSTRAINT "NotificationEscalationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDigest" ADD CONSTRAINT "NotificationDigest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

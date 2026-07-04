-- Migration: 20260701010000_add_in_app_notifications
-- Sprint 38: In-App Notifications, Central de Alertas e Caixa de Tarefas Operacionais

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED', 'RESOLVED');

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id"          TEXT NOT NULL,
    "companyId"   TEXT,
    "userId"      TEXT,
    "role"        TEXT,
    "type"        TEXT NOT NULL,
    "severity"    "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "status"      "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title"       VARCHAR(200) NOT NULL,
    "message"     VARCHAR(1000) NOT NULL,
    "actionUrl"   TEXT,
    "entityType"  TEXT,
    "entityId"    TEXT,
    "dedupeKey"   TEXT,
    "metadata"    JSONB,
    "readAt"      TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "resolvedAt"  TIMESTAMP(3),
    "expiresAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotification_dedupeKey_key" ON "InAppNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "InAppNotification_companyId_status_createdAt_idx" ON "InAppNotification"("companyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "InAppNotification_userId_status_idx" ON "InAppNotification"("userId", "status");

-- CreateIndex
CREATE INDEX "InAppNotification_role_companyId_idx" ON "InAppNotification"("role", "companyId");

-- CreateIndex
CREATE INDEX "InAppNotification_severity_status_idx" ON "InAppNotification"("severity", "status");

-- CreateIndex
CREATE INDEX "InAppNotification_expiresAt_idx" ON "InAppNotification"("expiresAt");

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

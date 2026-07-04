-- CreateIndex
CREATE INDEX "AuditLog_companyId_action_createdAt_idx" ON "AuditLog"("companyId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "CompanySubscription_billingStatus_nextBillingAt_idx" ON "CompanySubscription"("billingStatus", "nextBillingAt");

-- CreateIndex
CREATE INDEX "JobRun_jobKey_startedAt_idx" ON "JobRun"("jobKey", "startedAt");

-- CreateIndex
CREATE INDEX "MedicalCertificate_companyId_status_createdAt_idx" ON "MedicalCertificate"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Occurrence_companyId_status_createdAt_idx" ON "Occurrence"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Occurrence_companyId_type_createdAt_idx" ON "Occurrence"("companyId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "PilotLead_status_createdAt_idx" ON "PilotLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RemoteCheckin_companyId_checkinDate_idx" ON "RemoteCheckin"("companyId", "checkinDate");

-- CreateIndex
CREATE INDEX "RemoteCheckin_companyId_status_checkinDate_idx" ON "RemoteCheckin"("companyId", "status", "checkinDate");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_companyId_status_createdAt_idx" ON "WhatsAppMessageLog"("companyId", "status", "createdAt");

ALTER TABLE "NotificationWorkflowInstance"
  ADD COLUMN IF NOT EXISTS "payload" JSONB;

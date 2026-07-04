-- Migration: Add expiresAt and revokedAt to ApiKey for lifecycle tracking
ALTER TABLE "ApiKey" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "ApiKey" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- Migration: Add deliveryLogsEnabled to WebhookSubscription for replay audit
ALTER TABLE "WebhookSubscription" ADD COLUMN "deliveryLogsEnabled" BOOLEAN NOT NULL DEFAULT true;

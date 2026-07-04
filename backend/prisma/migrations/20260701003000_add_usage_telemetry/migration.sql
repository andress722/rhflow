-- CreateTable
CREATE TABLE "UsageTelemetry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "eventName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageTelemetry_companyId_idx" ON "UsageTelemetry"("companyId");

-- CreateIndex
CREATE INDEX "UsageTelemetry_userId_idx" ON "UsageTelemetry"("userId");

-- CreateIndex
CREATE INDEX "UsageTelemetry_eventName_idx" ON "UsageTelemetry"("eventName");

-- CreateIndex
CREATE INDEX "UsageTelemetry_createdAt_idx" ON "UsageTelemetry"("createdAt");

-- CreateIndex
CREATE INDEX "UsageTelemetry_eventName_createdAt_idx" ON "UsageTelemetry"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "UsageTelemetry_companyId_createdAt_idx" ON "UsageTelemetry"("companyId", "createdAt");

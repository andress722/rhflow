-- AlterTable RemoteCheckin
ALTER TABLE "RemoteCheckin" ADD COLUMN "clientCapturedAt" TIMESTAMP(3);
ALTER TABLE "RemoteCheckin" ADD COLUMN "timezone" TEXT;
ALTER TABLE "RemoteCheckin" ADD COLUMN "deviceIdHash" TEXT;
ALTER TABLE "RemoteCheckin" ADD COLUMN "offlineEventId" TEXT;
ALTER TABLE "RemoteCheckin" ADD COLUMN "offlineSequence" INTEGER;
ALTER TABLE "RemoteCheckin" ADD COLUMN "previousEventHash" TEXT;
ALTER TABLE "RemoteCheckin" ADD COLUMN "payloadHash" TEXT;
ALTER TABLE "RemoteCheckin" ADD COLUMN "integrityVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RemoteCheckin" ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "RemoteCheckin" ADD COLUMN "clockDriftSeconds" INTEGER;
ALTER TABLE "RemoteCheckin" ADD COLUMN "offlineEvidenceStatus" TEXT;
ALTER TABLE "RemoteCheckin" ADD COLUMN "accuracyMeters" DOUBLE PRECISION;
ALTER TABLE "RemoteCheckin" ADD COLUMN "geofenceDistanceMeters" DOUBLE PRECISION;
ALTER TABLE "RemoteCheckin" ADD COLUMN "configuredRadiusMeters" DOUBLE PRECISION;
ALTER TABLE "RemoteCheckin" ADD COLUMN "geofenceResult" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RemoteCheckin_offlineEventId_key" ON "RemoteCheckin"("offlineEventId");

-- AlterTable TimesheetSignature
ALTER TABLE "TimesheetSignature" ADD COLUMN "documentHash" TEXT;
ALTER TABLE "TimesheetSignature" ADD COLUMN "documentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TimesheetSignature" ADD COLUMN "signedPayloadHash" TEXT;
ALTER TABLE "TimesheetSignature" ADD COLUMN "consentTextVersion" TEXT;

-- CreateTable BiometricProcessingConfiguration
CREATE TABLE "BiometricProcessingConfiguration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "purpose" TEXT,
    "legalBasisDeclared" TEXT,
    "legalBasisNotes" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "alternativeMethodAvailable" BOOLEAN NOT NULL DEFAULT true,
    "livenessRequired" BOOLEAN NOT NULL DEFAULT false,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "policyVersion" TEXT NOT NULL DEFAULT '1.0',
    "activatedAt" TIMESTAMP(3),
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricProcessingConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiometricProcessingConfiguration_companyId_key" ON "BiometricProcessingConfiguration"("companyId");

-- AddForeignKey
ALTER TABLE "BiometricProcessingConfiguration" ADD CONSTRAINT "BiometricProcessingConfiguration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

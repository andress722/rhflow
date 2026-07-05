-- Sprint 53: Enterprise Import & Customer Onboarding
-- Adds ImportJob, ImportMappingTemplate, ImportValidationIssue models
-- and registrationNumber field to Employee

-- Enums
CREATE TYPE "ImportJobStatus" AS ENUM (
  'UPLOADED', 'PARSING', 'MAPPING', 'VALIDATING', 'READY',
  'QUEUED', 'IMPORTING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'
);

CREATE TYPE "ImportMode" AS ENUM (
  'CREATE_ONLY', 'UPDATE_EXISTING', 'UPSERT'
);

CREATE TYPE "ImportFileType" AS ENUM ('CSV', 'XLSX');

CREATE TYPE "IssueSeverity" AS ENUM ('ERROR', 'WARNING');

-- Add registrationNumber to Employee
ALTER TABLE "Employee" ADD COLUMN "registrationNumber" TEXT;

-- ImportJob
CREATE TABLE "ImportJob" (
  "id"                TEXT NOT NULL,
  "companyId"         TEXT NOT NULL,
  "createdByUserId"   TEXT NOT NULL,
  "originalFileName"  TEXT NOT NULL,
  "fileType"          "ImportFileType" NOT NULL,
  "selectedWorksheet" TEXT,
  "status"            "ImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
  "mode"              "ImportMode" NOT NULL DEFAULT 'CREATE_ONLY',
  "mappings"          JSONB,
  "parsedData"        JSONB,
  "totalRows"         INTEGER NOT NULL DEFAULT 0,
  "processedRows"     INTEGER NOT NULL DEFAULT 0,
  "validRows"         INTEGER NOT NULL DEFAULT 0,
  "invalidRows"       INTEGER NOT NULL DEFAULT 0,
  "createdRows"       INTEGER NOT NULL DEFAULT 0,
  "updatedRows"       INTEGER NOT NULL DEFAULT 0,
  "skippedRows"       INTEGER NOT NULL DEFAULT 0,
  "failedRows"        INTEGER NOT NULL DEFAULT 0,
  "mappingTemplateId" TEXT,
  "correlationId"     TEXT,
  "startedAt"         TIMESTAMP(3),
  "completedAt"       TIMESTAMP(3),
  "cancelledAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ImportJob_correlationId_key" ON "ImportJob"("correlationId");
CREATE INDEX "ImportJob_companyId_status_createdAt_idx" ON "ImportJob"("companyId", "status", "createdAt");

-- ImportMappingTemplate
CREATE TABLE "ImportMappingTemplate" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "sourceType"      TEXT NOT NULL DEFAULT 'CSV',
  "mappings"        JSONB NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportMappingTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImportMappingTemplate" ADD CONSTRAINT "ImportMappingTemplate_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ImportMappingTemplate" ADD CONSTRAINT "ImportMappingTemplate_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ImportMappingTemplate_companyId_name_key" ON "ImportMappingTemplate"("companyId", "name");
CREATE INDEX "ImportMappingTemplate_companyId_idx" ON "ImportMappingTemplate"("companyId");

-- ImportValidationIssue
CREATE TABLE "ImportValidationIssue" (
  "id"          TEXT NOT NULL,
  "importJobId" TEXT NOT NULL,
  "rowNumber"   INTEGER NOT NULL,
  "field"       TEXT,
  "code"        TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "severity"    "IssueSeverity" NOT NULL DEFAULT 'ERROR',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportValidationIssue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImportValidationIssue" ADD CONSTRAINT "ImportValidationIssue_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ImportValidationIssue_importJobId_severity_idx" ON "ImportValidationIssue"("importJobId", "severity");

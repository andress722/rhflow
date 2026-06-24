-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "PilotLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "employeeCount" INTEGER,
    "mainPain" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "notes" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotLead_status_idx" ON "PilotLead"("status");

-- CreateIndex
CREATE INDEX "PilotLead_createdAt_idx" ON "PilotLead"("createdAt");

-- CreateIndex
CREATE INDEX "PilotLead_email_idx" ON "PilotLead"("email");

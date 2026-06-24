-- CreateTable
CREATE TABLE "OperationalErrorLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "requestId" TEXT,
    "route" TEXT,
    "method" TEXT,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statusCode" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalErrorLog_companyId_createdAt_idx" ON "OperationalErrorLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalErrorLog_requestId_idx" ON "OperationalErrorLog"("requestId");

-- CreateIndex
CREATE INDEX "OperationalErrorLog_errorCode_createdAt_idx" ON "OperationalErrorLog"("errorCode", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalErrorLog_statusCode_createdAt_idx" ON "OperationalErrorLog"("statusCode", "createdAt");

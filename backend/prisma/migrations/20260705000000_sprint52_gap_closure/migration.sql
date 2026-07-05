-- AlterTable
ALTER TABLE "AbsenceRecord" ADD COLUMN "leaveRequestId" TEXT;

-- AlterTable
ALTER TABLE "HourBankTransaction" ADD COLUMN "actorId" TEXT,
ADD COLUMN "previousBalance" INTEGER,
ADD COLUMN "resultingBalance" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRecord_leaveRequestId_key" ON "AbsenceRecord"("leaveRequestId");

-- AddForeignKey
ALTER TABLE "AbsenceRecord" ADD CONSTRAINT "AbsenceRecord_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourBankTransaction" ADD CONSTRAINT "HourBankTransaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

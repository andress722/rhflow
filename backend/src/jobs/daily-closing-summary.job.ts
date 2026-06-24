import { prisma } from '../lib/prisma';
import { JobExecutionResult } from './remote-checkin-batch.job';

export async function runDailyClosingSummaryJob(options: { companyId?: string } = {}): Promise<JobExecutionResult> {
  const companies = options.companyId 
    ? [{ id: options.companyId }] 
    : await prisma.company.findMany({ select: { id: true } });

  let processedCount = 0;
  let errorCount = 0;
  const details: any[] = [];

  for (const company of companies) {
    try {
      // 1. Calculate counts
      const [
        pendingCheckins,
        notRespondedCheckins,
        openOccurrences,
        pendingCertificates,
        activeAbsences,
      ] = await Promise.all([
        prisma.remoteCheckin.count({
          where: { companyId: company.id, status: 'PENDING' },
        }),
        prisma.remoteCheckin.count({
          where: { companyId: company.id, status: 'NOT_RESPONDED' },
        }),
        prisma.occurrence.count({
          where: {
            companyId: company.id,
            status: { in: ['OPEN', 'WAITING_EMPLOYEE', 'WAITING_MANAGER', 'WAITING_HR'] },
          },
        }),
        prisma.medicalCertificate.count({
          where: {
            companyId: company.id,
            status: { in: ['RECEIVED', 'UNDER_REVIEW'] },
          },
        }),
        prisma.absenceRecord.count({
          where: { companyId: company.id, status: 'ACTIVE' },
        }),
      ]);

      // 2. Create AuditLog entry
      await prisma.auditLog.create({
        data: {
          companyId: company.id,
          action: 'DAILY_CLOSING_SUMMARY',
          metadata: {
            pendingCheckins,
            notRespondedCheckins,
            openOccurrences,
            pendingCertificates,
            activeAbsences,
            computedAt: new Date().toISOString(),
          },
        },
      });

      processedCount++;
      details.push({
        companyId: company.id,
        summary: {
          pendingCheckins,
          notRespondedCheckins,
          openOccurrences,
          pendingCertificates,
          activeAbsences,
        },
      });
    } catch (err: any) {
      errorCount++;
      details.push({
        companyId: company.id,
        error: err.message || String(err),
      });
    }
  }

  return {
    processedCount,
    errorCount,
    details,
  };
}

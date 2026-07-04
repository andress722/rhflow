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

      // 2.1 Trigger Notifications for Company ADMIN/HR
      const dateStr = new Date().toISOString().split('T')[0];
      const { NotificationCenterService } = require('../services/notification-center.service');
      const { NotificationSeverity } = require('@prisma/client');

      // MANY_OPEN_OCCURRENCES
      if (openOccurrences > 5) {
        await NotificationCenterService.createOrUpdateByDedupeKey({
          companyId: company.id,
          role: 'HR',
          type: 'MANY_OPEN_OCCURRENCES',
          severity: NotificationSeverity.WARNING,
          title: 'Muitas ocorrências em aberto',
          message: `Sua empresa possui ${openOccurrences} ocorrências em aberto pendentes de resolução.`,
          actionUrl: `/app/occurrences`,
          dedupeKey: `company:${company.id}:many-open-occurrences:${dateStr}`,
          metadata: { openOccurrences },
        }).catch(() => {});
      }

      // MANY_CHECKINS_NOT_RESPONDED
      if (notRespondedCheckins > 3) {
        await NotificationCenterService.createOrUpdateByDedupeKey({
          companyId: company.id,
          role: 'HR',
          type: 'MANY_CHECKINS_NOT_RESPONDED',
          severity: NotificationSeverity.WARNING,
          title: 'Muitos check-ins não respondidos',
          message: `Sua empresa possui ${notRespondedCheckins} check-ins sem resposta hoje.`,
          actionUrl: `/app/presence`,
          dedupeKey: `company:${company.id}:many-not-responded:${dateStr}`,
          metadata: { notRespondedCheckins },
        }).catch(() => {});
      }

      // CLOSING_PENDENCIES
      if (openOccurrences > 0) {
        await NotificationCenterService.createOrUpdateByDedupeKey({
          companyId: company.id,
          role: 'HR',
          type: 'CLOSING_PENDENCIES',
          severity: NotificationSeverity.INFO,
          title: 'Relatório diário com pendências',
          message: `O fechamento diário foi gerado e há ${openOccurrences} ocorrências pendentes.`,
          actionUrl: `/app/reports`,
          dedupeKey: `company:${company.id}:closing-pendencies:${dateStr}`,
          metadata: { openOccurrences, pendingCertificates },
        }).catch(() => {});
      }

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

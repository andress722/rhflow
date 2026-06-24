import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { JobExecutionResult } from './remote-checkin-batch.job';

export async function runCleanupOldLogsJob(): Promise<JobExecutionResult> {
  const whatsappRetentionDays = env.WHATSAPP_LOG_RETENTION_DAYS;
  const auditRetentionDays = env.AUDIT_LOG_RETENTION_DAYS;

  // double check minimum retention constraints to be safe
  const finalWhatsappDays = Math.max(whatsappRetentionDays, 30);
  const finalAuditDays = Math.max(auditRetentionDays, 180);

  const whatsappCutoff = new Date();
  whatsappCutoff.setDate(whatsappCutoff.getDate() - finalWhatsappDays);

  const auditCutoff = new Date();
  auditCutoff.setDate(auditCutoff.getDate() - finalAuditDays);

  try {
    const deletedWhatsappLogs = await prisma.whatsAppMessageLog.deleteMany({
      where: {
        createdAt: {
          lt: whatsappCutoff,
        },
      },
    });

    const deletedAuditLogs = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: auditCutoff,
        },
      },
    });

    const totalCount = deletedWhatsappLogs.count + deletedAuditLogs.count;

    return {
      processedCount: totalCount,
      errorCount: 0,
      details: {
        deletedWhatsappLogs: deletedWhatsappLogs.count,
        deletedAuditLogs: deletedAuditLogs.count,
        whatsappRetentionDays: finalWhatsappDays,
        auditRetentionDays: finalAuditDays,
      },
    };
  } catch (error: any) {
    return {
      processedCount: 0,
      errorCount: 1,
      details: {
        error: error.message || String(error),
      },
    };
  }
}

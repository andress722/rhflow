import { prisma } from '../lib/prisma';
import { NotificationCenterService } from './notification-center.service';
import { NotificationSeverity } from '@prisma/client';

export interface JobRegistryEntry {
  key: string;
  label: string;
  description: string;
  expectedFrequency: string;
  recommendedSchedule: string;
  isCritical: boolean;
  maxExpectedDelayMinutes: number;
}

export const JOBS_REGISTRY: Record<string, JobRegistryEntry> = {
  REMOTE_CHECKIN_BATCH: {
    key: 'REMOTE_CHECKIN_BATCH',
    label: 'Lote de Check-ins',
    description: 'Dispara lotes de check-ins programados para os colaboradores.',
    expectedFrequency: 'A cada 10 minutos',
    recommendedSchedule: '*/10 * * * *',
    isCritical: true,
    maxExpectedDelayMinutes: 20,
  },
  MARK_NOT_RESPONDED: {
    key: 'MARK_NOT_RESPONDED',
    label: 'Marcar Não Respondidos',
    description: 'Expira e encerra check-ins que não receberam resposta.',
    expectedFrequency: 'A cada 30 minutos',
    recommendedSchedule: '*/30 * * * *',
    isCritical: false,
    maxExpectedDelayMinutes: 60,
  },
  DAILY_CLOSING_SUMMARY: {
    key: 'DAILY_CLOSING_SUMMARY',
    label: 'Fechamento Diário',
    description: 'Consolida e envia resumos operacionais diários de ponto.',
    expectedFrequency: 'Diariamente',
    recommendedSchedule: '0 22 * * *',
    isCritical: true,
    maxExpectedDelayMinutes: 1440,
  },
  CLEANUP_OLD_LOGS: {
    key: 'CLEANUP_OLD_LOGS',
    label: 'Limpeza de Logs',
    description: 'Remove logs de auditoria e erros operacionais antigos.',
    expectedFrequency: 'Semanalmente',
    recommendedSchedule: '0 3 * * 0',
    isCritical: false,
    maxExpectedDelayMinutes: 11520,
  },
  COMMERCIAL_ALERTS: {
    key: 'COMMERCIAL_ALERTS',
    label: 'Alertas Comerciais',
    description: 'Varre e alerta sobre leads e follow-ups em atraso no CRM.',
    expectedFrequency: 'Diariamente',
    recommendedSchedule: '0 8 * * *',
    isCritical: false,
    maxExpectedDelayMinutes: 1500,
  },
  RETENTION_ALERTS: {
    key: 'RETENTION_ALERTS',
    label: 'Alertas de Retenção',
    description: 'Varre e alerta sobre riscos de churn e contas vencidas.',
    expectedFrequency: 'Diariamente',
    recommendedSchedule: '0 9 * * *',
    isCritical: true,
    maxExpectedDelayMinutes: 1500,
  },
  INTERNAL_PING: {
    key: 'INTERNAL_PING',
    label: 'Ping de Monitoramento',
    description: 'Validação interna periódica de atividade do agendador.',
    expectedFrequency: 'A cada 5 minutos',
    recommendedSchedule: '*/5 * * * *',
    isCritical: false,
    maxExpectedDelayMinutes: 10,
  },
  NOTIFICATION_DIGEST: {
    key: 'NOTIFICATION_DIGEST',
    label: 'Resumo Diário de Notificações',
    description: 'Gera e consolida os resumos operacionais diários de notificações dos usuários.',
    expectedFrequency: 'Diariamente',
    recommendedSchedule: '0 23 * * *',
    isCritical: false,
    maxExpectedDelayMinutes: 1440,
  },
  NOTIFICATION_ESCALATIONS: {
    key: 'NOTIFICATION_ESCALATIONS',
    label: 'Escalação de Notificações',
    description: 'Varre e aplica regras de escalação para notificações pendentes.',
    expectedFrequency: 'A cada 10 minutos',
    recommendedSchedule: '*/10 * * * *',
    isCritical: false,
    maxExpectedDelayMinutes: 20,
  },
};

export class JobRegistryService {
  /**
   * Helper to sanitize and avoid saving secrets
   */
  private static sanitizeText(text?: string | null): string | null {
    if (!text) return null;
    let clean = text;
    // Mask sensitive keys/secrets
    const secrets = ['secret', 'jwt', 'password', 'token', 'key', 'auth', 'postgres', 'redis'];
    for (const secret of secrets) {
      const regex = new RegExp(`(${secret}[^\\s,;]*)`, 'gi');
      clean = clean.replace(regex, '***REDACTED***');
    }
    return clean;
  }

  /**
   * Get all registered jobs and their current status
   */
  static async getJobsStatus(): Promise<any[]> {
    const jobs = Object.values(JOBS_REGISTRY);
    const statuses = [];

    if (!(prisma as any).jobRun) {
      return jobs.map(job => ({
        jobKey: job.key,
        label: job.label,
        description: job.description,
        expectedFrequency: job.expectedFrequency,
        recommendedSchedule: job.recommendedSchedule,
        isCritical: job.isCritical,
        lastRunAt: null,
        lastStatus: null,
        lastDurationMs: null,
        nextExpectedRunAt: null,
        isOverdue: job.isCritical,
        lastErrorCode: null,
      }));
    }

    for (const job of jobs) {
      const lastRun = await prisma.jobRun.findFirst({
        where: { jobKey: job.key },
        orderBy: { startedAt: 'desc' },
      });
      
      const lastRunAt = lastRun ? lastRun.startedAt : null;
      const lastStatus = lastRun ? lastRun.status : null;
      const lastDurationMs = lastRun ? lastRun.durationMs : null;
      const lastErrorCode = lastRun ? lastRun.errorCode : null;

      // Check if job is overdue
      let isOverdue = false;
      if (lastRunAt) {
        const delay = Date.now() - lastRunAt.getTime();
        isOverdue = delay > job.maxExpectedDelayMinutes * 60 * 1000;
      } else {
        isOverdue = job.isCritical;
      }

      const nextExpectedRunAt = lastRunAt
        ? new Date(lastRunAt.getTime() + job.maxExpectedDelayMinutes * 60 * 1000)
        : null;

      statuses.push({
        jobKey: job.key,
        label: job.label,
        description: job.description,
        expectedFrequency: job.expectedFrequency,
        recommendedSchedule: job.recommendedSchedule,
        isCritical: job.isCritical,
        lastRunAt,
        lastStatus,
        lastDurationMs,
        nextExpectedRunAt,
        isOverdue,
        lastErrorCode,
      });
    }

    return statuses;
  }

  /**
   * Get complete details of a specific job
   */
  static async getJobDetails(jobKey: string): Promise<any> {
    const job = JOBS_REGISTRY[jobKey];
    if (!job) throw new Error('JOB_NOT_FOUND');

    if (!(prisma as any).jobRun) {
      return {
        registry: job,
        lastRuns: [],
        successRate7d: 100,
        failures7d: 0,
        avgDurationMs7d: 0,
        isOverdue: job.isCritical,
      };
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const totalRuns = await prisma.jobRun.count({
      where: { jobKey, startedAt: { gte: sevenDaysAgo }, NOT: { status: 'RUNNING' } },
    });

    const successRuns = await prisma.jobRun.count({
      where: { jobKey, status: { in: ['SUCCESS', 'SKIPPED'] }, startedAt: { gte: sevenDaysAgo } },
    });

    const failures7d = await prisma.jobRun.count({
      where: { jobKey, status: 'FAILED', startedAt: { gte: sevenDaysAgo } },
    });

    const successRate7d = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 100;

    // Average duration
    const runsWithDuration = await prisma.jobRun.findMany({
      where: {
        jobKey,
        startedAt: { gte: sevenDaysAgo },
        durationMs: { not: null },
      },
      select: { durationMs: true },
    });

    const totalDuration = runsWithDuration.reduce((acc, r) => acc + (r.durationMs || 0), 0);
    const avgDurationMs7d = runsWithDuration.length > 0 ? Math.round(totalDuration / runsWithDuration.length) : 0;

    const lastRuns = await prisma.jobRun.findMany({
      where: { jobKey },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const currentStatus = await this.getJobsStatus();
    const statusInfo = currentStatus.find(s => s.jobKey === jobKey);

    return {
      registry: job,
      lastRuns,
      successRate7d,
      failures7d,
      avgDurationMs7d,
      isOverdue: statusInfo?.isOverdue ?? false,
    };
  }

  /**
   * Start recording a new job execution
   */
  static async startRun(jobKey: string, triggeredBy: 'INTERNAL' | 'MANUAL' | 'SYSTEM', requestId?: string): Promise<string | null> {
    try {
      if (!(prisma as any).jobRun) return null;
      const run = await prisma.jobRun.create({
        data: {
          jobKey,
          status: 'RUNNING',
          startedAt: new Date(),
          triggeredBy,
          requestId: requestId || null,
        },
      });
      return run.id;
    } catch (err) {
      console.error('Failed to log JobRun start:', err);
      return null;
    }
  }

  /**
   * Complete recording a job execution
   */
  static async completeRun(
    id: string | null,
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
    durationMs: number,
    summary?: any,
    error?: { code?: string; message?: string }
  ): Promise<void> {
    if (!id) return;
    try {
      if (!(prisma as any).jobRun) return;
      // Sanitize summary data
      let sanitizedSummary: any = null;
      if (summary) {
        sanitizedSummary = JSON.parse(JSON.stringify(summary));
        if (sanitizedSummary.secret || sanitizedSummary.token) {
          sanitizedSummary.secret = '***REDACTED***';
          sanitizedSummary.token = '***REDACTED***';
        }
      }

      await prisma.jobRun.update({
        where: { id },
        data: {
          status,
          finishedAt: new Date(),
          durationMs,
          summary: sanitizedSummary || undefined,
          errorCode: error?.code || null,
          errorMessage: this.sanitizeText(error?.message) || null,
        },
      });

      // Notify SUPER_ADMIN if a critical job failed
      if (status === 'FAILED') {
        const jobRun = await prisma.jobRun.findUnique({ where: { id }, select: { jobKey: true } });
        if (jobRun) {
          const registry = JOBS_REGISTRY[jobRun.jobKey];
          const dateStr = new Date().toISOString().split('T')[0];
          if (registry?.isCritical) {
            NotificationCenterService.createOrUpdateByDedupeKey({
              companyId: null,
              role: null,
              type: 'CRITICAL_JOB_FAILED',
              severity: NotificationSeverity.CRITICAL,
              title: `Job crítico falhou: ${registry.label}`,
              message: `O job "${registry.label}" falhou. Verifique os logs operacionais.`,
              actionUrl: `/app/admin/jobs`,
              entityType: 'JobRun',
              entityId: id,
              dedupeKey: `job:${jobRun.jobKey}:failed:${dateStr}`,
              metadata: { jobKey: jobRun.jobKey, errorCode: error?.code },
            }).catch(() => {/* silent */});
          } else {
            // Even non-critical failures count for MANY_OPERATIONAL_ERRORS tracking
            // Count failed jobs in last 24h and alert if > 10
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentFailures = await prisma.jobRun.count({
              where: { status: 'FAILED', finishedAt: { gte: oneDayAgo } },
            });
            if (recentFailures > 10) {
              NotificationCenterService.createOrUpdateByDedupeKey({
                companyId: null,
                role: null,
                type: 'MANY_OPERATIONAL_ERRORS',
                severity: NotificationSeverity.WARNING,
                title: 'Muitos erros operacionais recentes',
                message: `${recentFailures} jobs falharam nas últimas 24 horas. Verifique o painel de jobs.`,
                actionUrl: `/app/admin/jobs`,
                entityType: 'JobRun',
                entityId: null,
                dedupeKey: `platform:many-op-errors:${dateStr}`,
                metadata: { count: recentFailures },
              }).catch(() => {/* silent */});
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to update JobRun completion:', err);
    }
  }
}

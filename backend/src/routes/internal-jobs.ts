import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { env } from '../config/env';
import { JobLock } from '../lib/job-lock';
import { runRemoteCheckinBatchJob } from '../jobs/remote-checkin-batch.job';
import { runMarkNotRespondedJob } from '../jobs/mark-not-responded.job';
import { runDailyClosingSummaryJob } from '../jobs/daily-closing-summary.job';
import { runCleanupOldLogsJob } from '../jobs/cleanup-old-logs.job';
import { prisma } from '../lib/prisma';
import { getSaoPauloDayRange } from '../lib/date-helpers';
import { CommercialNotificationService } from '../services/commercial-notification.service';
import { RetentionService } from '../services/retention.service';
import { JobRegistryService } from '../services/job-registry.service';
import { NotificationCenterService } from '../services/notification-center.service';
import { NotificationSeverity } from '@prisma/client';
import { NotificationEscalationService } from '../modules/notification-engine/notification-escalation.service';

const bodyCompanySchema = z.object({
  companyId: z.string().uuid().optional(),
});

const bodyMarkNotRespondedSchema = z.object({
  companyId: z.string().uuid().optional(),
  date: z.string().optional(),
  graceMinutes: z.number().int().optional(),
});

export default async function internalJobsRoutes(fastify: FastifyInstance) {
  // Pre-handler hook to authenticate internal job calls
  fastify.addHook('preHandler', async (request, reply) => {
    const clientSecret = request.headers['x-internal-job-secret'];
    const expectedSecret = env.INTERNAL_JOB_SECRET;

    if (!clientSecret || clientSecret !== expectedSecret) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Chave secreta interna inválida ou ausente.',
        },
      });
    }
  });

  // POST /api/internal/jobs/remote-checkin-batch
  fastify.post('/internal/jobs/remote-checkin-batch', async (request, reply) => {
    const bodyResult = bodyCompanySchema.safeParse(request.body || {});
    const companyId = bodyResult.success ? bodyResult.data.companyId : undefined;

    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();

    const lockAcquired = await JobLock.acquire('REMOTE_CHECKIN_BATCH', 300000);
    if (!lockAcquired) {
      return reply.status(409).send({
        success: false,
        error: { code: 'JOB_LOCKED', message: 'Este job já está rodando em outra instância.' }
      });
    }

    const jobRunId = await JobRegistryService.startRun('REMOTE_CHECKIN_BATCH', 'INTERNAL', requestId);

    try {
      const result = await runRemoteCheckinBatchJob({ companyId });
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const status = (result.processedCount === 0 && result.errorCount === 0) ? 'SKIPPED' : 'SUCCESS';
      await JobRegistryService.completeRun(jobRunId, status, durationMs, result);

      const logObject = {
        jobName: 'remote-checkin-batch',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status,
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        source: 'INTERNAL_JOB',
      };
      fastify.log.info(logObject, `Job remote-checkin-batch finished successfully`);

      return reply.status(200).send({
        success: true,
        data: logObject,
        details: result.details,
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });

      const logObject = {
        jobName: 'remote-checkin-batch',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'FAILED',
        processedCount: 0,
        errorCount: 1,
        source: 'INTERNAL_JOB',
      };
      fastify.log.error({ ...logObject, error: err.message || String(err) }, `Job remote-checkin-batch failed`);

      return reply.status(500).send({
        success: false,
        error: {
          code: 'JOB_ERROR',
          message: err.message || 'Erro durante a execução do job.',
        },
      });
    } finally {
      await JobLock.release('REMOTE_CHECKIN_BATCH');
    }
  });

  // POST /api/internal/jobs/mark-not-responded
  fastify.post('/internal/jobs/mark-not-responded', async (request, reply) => {
    const bodyResult = bodyMarkNotRespondedSchema.safeParse(request.body || {});
    const { companyId, date, graceMinutes } = bodyResult.success
      ? bodyResult.data
      : { companyId: undefined, date: undefined, graceMinutes: undefined };

    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();

    const lockAcquired = await JobLock.acquire('MARK_NOT_RESPONDED', 300000);
    if (!lockAcquired) {
      return reply.status(409).send({
        success: false,
        error: { code: 'JOB_LOCKED', message: 'Este job já está rodando em outra instância.' }
      });
    }

    const jobRunId = await JobRegistryService.startRun('MARK_NOT_RESPONDED', 'INTERNAL', requestId);

    try {
      const result = await runMarkNotRespondedJob({ companyId, date, graceMinutes });
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const status = (result.processedCount === 0 && result.errorCount === 0) ? 'SKIPPED' : 'SUCCESS';
      await JobRegistryService.completeRun(jobRunId, status, durationMs, result);

      const logObject = {
        jobName: 'mark-not-responded',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status,
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        source: 'INTERNAL_JOB',
      };
      fastify.log.info(logObject, `Job mark-not-responded finished successfully`);

      return reply.status(200).send({
        success: true,
        data: logObject,
        details: result.details,
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });

      const logObject = {
        jobName: 'mark-not-responded',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'FAILED',
        processedCount: 0,
        errorCount: 1,
        source: 'INTERNAL_JOB',
      };
      fastify.log.error({ ...logObject, error: err.message || String(err) }, `Job mark-not-responded failed`);

      return reply.status(500).send({
        success: false,
        error: {
          code: 'JOB_ERROR',
          message: err.message || 'Erro durante a execução do job.',
        },
      });
    } finally {
      await JobLock.release('MARK_NOT_RESPONDED');
    }
  });

  // POST /api/internal/jobs/daily-closing-summary
  fastify.post('/internal/jobs/daily-closing-summary', async (request, reply) => {
    const bodyResult = bodyCompanySchema.safeParse(request.body || {});
    const companyId = bodyResult.success ? bodyResult.data.companyId : undefined;

    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const jobRunId = await JobRegistryService.startRun('DAILY_CLOSING_SUMMARY', 'INTERNAL', requestId);

    try {
      const result = await runDailyClosingSummaryJob({ companyId });
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const status = (result.processedCount === 0 && result.errorCount === 0) ? 'SKIPPED' : 'SUCCESS';
      await JobRegistryService.completeRun(jobRunId, status, durationMs, result);

      const logObject = {
        jobName: 'daily-closing-summary',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status,
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        source: 'INTERNAL_JOB',
      };
      fastify.log.info(logObject, `Job daily-closing-summary finished successfully`);

      return reply.status(200).send({
        success: true,
        data: logObject,
        details: result.details,
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });

      const logObject = {
        jobName: 'daily-closing-summary',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'FAILED',
        processedCount: 0,
        errorCount: 1,
        source: 'INTERNAL_JOB',
      };
      fastify.log.error({ ...logObject, error: err.message || String(err) }, `Job daily-closing-summary failed`);

      return reply.status(500).send({
        success: false,
        error: {
          code: 'JOB_ERROR',
          message: err.message || 'Erro durante a execução do job.',
        },
      });
    }
  });

  // POST /api/internal/jobs/cleanup-old-logs
  fastify.post('/internal/jobs/cleanup-old-logs', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const jobRunId = await JobRegistryService.startRun('CLEANUP_OLD_LOGS', 'INTERNAL', requestId);

    try {
      const result = await runCleanupOldLogsJob();
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const status = (result.processedCount === 0 && result.errorCount === 0) ? 'SKIPPED' : 'SUCCESS';
      await JobRegistryService.completeRun(jobRunId, status, durationMs, result);

      const logObject = {
        jobName: 'cleanup-old-logs',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status,
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        source: 'INTERNAL_JOB',
      };
      fastify.log.info(logObject, `Job cleanup-old-logs finished successfully`);

      return reply.status(200).send({
        success: true,
        data: logObject,
        details: result.details,
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });

      const logObject = {
        jobName: 'cleanup-old-logs',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'FAILED',
        processedCount: 0,
        errorCount: 1,
        source: 'INTERNAL_JOB',
      };
      fastify.log.error({ ...logObject, error: err.message || String(err) }, `Job cleanup-old-logs failed`);

      return reply.status(500).send({
        success: false,
        error: {
          code: 'JOB_ERROR',
          message: err.message || 'Erro durante a execução do job.',
        },
      });
    }
  });

  // POST /api/internal/jobs/commercial-alerts/run
  fastify.post('/internal/jobs/commercial-alerts/run', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const jobRunId = await JobRegistryService.startRun('COMMERCIAL_ALERTS', 'INTERNAL', requestId);

    const sent: any[] = [];
    const skipped: any[] = [];
    const failed: any[] = [];

    const now = new Date();
    const dayRange = getSaoPauloDayRange(now);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1. OVERDUE_FOLLOW_UPS
    try {
      const overdueFollowUpsCount = await prisma.pilotLead.count({
        where: {
          nextFollowUpAt: { lte: now },
          NOT: { status: { in: ['WON', 'LOST'] } },
        },
      });

      if (overdueFollowUpsCount <= 0) {
        skipped.push({ alertType: 'OVERDUE_FOLLOW_UPS', reason: 'no_items' });
      } else {
        const res = await CommercialNotificationService.sendOverdueFollowUpsAlert(overdueFollowUpsCount);
        if (res.emailStatus === 'sent' || res.emailStatus === 'simulated' || res.whatsappStatus === 'sent' || res.whatsappStatus === 'simulated') {
          sent.push({ alertType: 'OVERDUE_FOLLOW_UPS', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else if (res.emailStatus === 'skipped' && res.whatsappStatus === 'skipped') {
          skipped.push({ alertType: 'OVERDUE_FOLLOW_UPS', reason: 'idempotent', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else if (res.emailStatus === 'disabled' && res.whatsappStatus === 'disabled') {
          skipped.push({ alertType: 'OVERDUE_FOLLOW_UPS', reason: 'disabled', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else {
          failed.push({ alertType: 'OVERDUE_FOLLOW_UPS', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        }
      }
    } catch (err: any) {
      fastify.log.error(err, 'Failed executing commercial job for OVERDUE_FOLLOW_UPS');
      failed.push({ alertType: 'OVERDUE_FOLLOW_UPS', error: err.message || String(err) });
    }

    // 2. DEMOS_TODAY
    try {
      const demosTodayCount = await prisma.pilotLead.count({
        where: {
          demoScheduledAt: { gte: dayRange.start, lte: dayRange.end },
          NOT: { status: { in: ['WON', 'LOST'] } },
        },
      });

      if (demosTodayCount <= 0) {
        skipped.push({ alertType: 'DEMOS_TODAY', reason: 'no_items' });
      } else {
        const res = await CommercialNotificationService.sendDemosTodayAlert(demosTodayCount);
        if (res.emailStatus === 'sent' || res.emailStatus === 'simulated' || res.whatsappStatus === 'sent' || res.whatsappStatus === 'simulated') {
          sent.push({ alertType: 'DEMOS_TODAY', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else if (res.emailStatus === 'skipped' && res.whatsappStatus === 'skipped') {
          skipped.push({ alertType: 'DEMOS_TODAY', reason: 'idempotent', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else if (res.emailStatus === 'disabled' && res.whatsappStatus === 'disabled') {
          skipped.push({ alertType: 'DEMOS_TODAY', reason: 'disabled', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else {
          failed.push({ alertType: 'DEMOS_TODAY', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        }
      }
    } catch (err: any) {
      fastify.log.error(err, 'Failed executing commercial job for DEMOS_TODAY');
      failed.push({ alertType: 'DEMOS_TODAY', error: err.message || String(err) });
    }

    // 3. STALE_QUALIFIED_LEADS
    try {
      const qualifiedLeads = await prisma.pilotLead.findMany({
        where: { status: 'QUALIFIED' },
        include: {
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      const staleQualifiedLeadsCount = qualifiedLeads.filter((lead) => {
        const lastActivity = lead.activities[0];
        if (lastActivity) {
          return lastActivity.createdAt < sevenDaysAgo;
        }
        const fallback = lead.updatedAt || lead.createdAt;
        return fallback < sevenDaysAgo;
      }).length;

      if (staleQualifiedLeadsCount <= 0) {
        skipped.push({ alertType: 'STALE_QUALIFIED_LEADS', reason: 'no_items' });
      } else {
        const res = await CommercialNotificationService.sendStaleQualifiedAlert(staleQualifiedLeadsCount);
        if (res.emailStatus === 'sent' || res.emailStatus === 'simulated' || res.whatsappStatus === 'sent' || res.whatsappStatus === 'simulated') {
          sent.push({ alertType: 'STALE_QUALIFIED_LEADS', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else if (res.emailStatus === 'skipped' && res.whatsappStatus === 'skipped') {
          skipped.push({ alertType: 'STALE_QUALIFIED_LEADS', reason: 'idempotent', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else if (res.emailStatus === 'disabled' && res.whatsappStatus === 'disabled') {
          skipped.push({ alertType: 'STALE_QUALIFIED_LEADS', reason: 'disabled', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        } else {
          failed.push({ alertType: 'STALE_QUALIFIED_LEADS', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
        }
      }
    } catch (err: any) {
      fastify.log.error(err, 'Failed executing commercial job for STALE_QUALIFIED_LEADS');
      failed.push({ alertType: 'STALE_QUALIFIED_LEADS', error: err.message || String(err) });
    }

    // 4a. STALE_LEADS_NO_CONTACT (> 3 days without any activity)
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const dateStr = now.toISOString().split('T')[0];

      const leadsForStaleCheck = await prisma.pilotLead.findMany({
        where: {
          NOT: { status: { in: ['WON', 'LOST'] } },
        },
        include: {
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const staleLeads = leadsForStaleCheck.filter((lead) => {
        const lastActivity = lead.activities[0];
        const lastContact = lastActivity ? lastActivity.createdAt : (lead.updatedAt || lead.createdAt);
        return lastContact < threeDaysAgo;
      });

      if (staleLeads.length === 0) {
        skipped.push({ alertType: 'STALE_LEADS_NO_CONTACT', reason: 'no_items' });
      } else {
        for (const lead of staleLeads) {
          NotificationCenterService.createOrUpdateByDedupeKey({
            companyId: null,
            role: null,
            type: 'STALE_LEAD_NO_CONTACT',
            severity: NotificationSeverity.WARNING,
            title: 'Lead sem contato há mais de 3 dias',
            message: `O lead "${(lead as any).name || (lead as any).companyName || lead.id}" não teve contato nos últimos 3 dias.`,
            actionUrl: `/app/admin/leads`,
            entityType: 'PilotLead',
            entityId: lead.id,
            dedupeKey: `lead:${lead.id}:stale:${dateStr}`,
            metadata: { leadId: lead.id },
          }).catch(() => {/* silent */});
        }
        sent.push({ alertType: 'STALE_LEADS_NO_CONTACT', count: staleLeads.length });
      }
    } catch (err: any) {
      fastify.log.error(err, 'Failed executing commercial job for STALE_LEADS_NO_CONTACT');
      failed.push({ alertType: 'STALE_LEADS_NO_CONTACT', error: err.message || String(err) });
    }

    // 4b. URGENT_BACKLOG_OVERDUE (URGENT priority and overdue target release date)
    try {
      const dateStr = now.toISOString().split('T')[0];
      const overdueBacklogItems = await prisma.pilotBacklogItem.findMany({
        where: {
          priority: 'URGENT',
          status: { notIn: ['DONE', 'CANCELED'] },
          targetReleaseDate: { lt: now },
        },
      });

      if (overdueBacklogItems.length === 0) {
        skipped.push({ alertType: 'URGENT_BACKLOG_OVERDUE', reason: 'no_items' });
      } else {
        for (const item of overdueBacklogItems) {
          NotificationCenterService.createOrUpdateByDedupeKey({
            companyId: null,
            role: null,
            type: 'URGENT_BACKLOG_OVERDUE',
            severity: NotificationSeverity.CRITICAL,
            title: 'Item de Backlog Urgente Vencido',
            message: `O item de backlog urgente "${item.title}" está com o prazo de entrega vencido.`,
            actionUrl: `/app/admin/pilots`,
            entityType: 'PilotBacklogItem',
            entityId: item.id,
            dedupeKey: `backlog:${item.id}:urgent-overdue:${dateStr}`,
            metadata: { backlogItemId: item.id },
          }).catch(() => {/* silent */});
        }
        sent.push({ alertType: 'URGENT_BACKLOG_OVERDUE', count: overdueBacklogItems.length });
      }
    } catch (err: any) {
      fastify.log.error(err, 'Failed executing commercial job for URGENT_BACKLOG_OVERDUE');
      failed.push({ alertType: 'URGENT_BACKLOG_OVERDUE', error: err.message || String(err) });
    }

    // 5. DAILY_SUMMARY
    try {
      const spTimeStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(now);

      const [spHour, spMin] = spTimeStr.split(':').map(Number);
      const [targetHour, targetMin] = env.COMMERCIAL_DAILY_SUMMARY_TIME.split(':').map(Number);
      const shouldRunSummary = (spHour * 60 + spMin) >= (targetHour * 60 + targetMin);

      if (!shouldRunSummary) {
        skipped.push({ alertType: 'DAILY_SUMMARY', reason: 'before_summary_time' });
      } else {
        const newLeadsTodayCount = await prisma.pilotLead.count({
          where: {
            createdAt: { gte: dayRange.start, lte: dayRange.end },
          },
        });

        const overdueFollowUpsCount = await prisma.pilotLead.count({
          where: {
            nextFollowUpAt: { lte: now },
            NOT: { status: { in: ['WON', 'LOST'] } },
          },
        });

        const demosTodayCount = await prisma.pilotLead.count({
          where: {
            demoScheduledAt: { gte: dayRange.start, lte: dayRange.end },
            NOT: { status: { in: ['WON', 'LOST'] } },
          },
        });

        const qualifiedLeadsForSummary = await prisma.pilotLead.findMany({
          where: { status: 'QUALIFIED' },
          include: {
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });
        const staleQualifiedLeadsCount = qualifiedLeadsForSummary.filter((lead) => {
          const lastActivity = lead.activities[0];
          if (lastActivity) {
            return lastActivity.createdAt < sevenDaysAgo;
          }
          const fallback = lead.updatedAt || lead.createdAt;
          return fallback < sevenDaysAgo;
        }).length;

        if (
          newLeadsTodayCount === 0 &&
          overdueFollowUpsCount === 0 &&
          demosTodayCount === 0 &&
          staleQualifiedLeadsCount === 0
        ) {
          skipped.push({ alertType: 'DAILY_SUMMARY', reason: 'no_items' });
        } else {
          const summaryData = {
            newLeadsToday: newLeadsTodayCount,
            overdueFollowUps: overdueFollowUpsCount,
            demosToday: demosTodayCount,
            staleQualifiedLeads: staleQualifiedLeadsCount,
          };
          const res = await CommercialNotificationService.sendDailySummaryAlert(summaryData);
          if (res.emailStatus === 'sent' || res.emailStatus === 'simulated' || res.whatsappStatus === 'sent' || res.whatsappStatus === 'simulated') {
            sent.push({ alertType: 'DAILY_SUMMARY', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
          } else if (res.emailStatus === 'skipped' && res.whatsappStatus === 'skipped') {
            skipped.push({ alertType: 'DAILY_SUMMARY', reason: 'idempotent', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
          } else if (res.emailStatus === 'disabled' && res.whatsappStatus === 'disabled') {
            skipped.push({ alertType: 'DAILY_SUMMARY', reason: 'disabled', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
          } else {
            failed.push({ alertType: 'DAILY_SUMMARY', emailStatus: res.emailStatus, whatsappStatus: res.whatsappStatus });
          }
        }
      }
    } catch (err: any) {
      fastify.log.error(err, 'Failed executing commercial job for DAILY_SUMMARY');
      failed.push({ alertType: 'DAILY_SUMMARY', error: err.message || String(err) });
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const status = failed.length > 0 ? 'FAILED' : (sent.length === 0 ? 'SKIPPED' : 'SUCCESS');
    await JobRegistryService.completeRun(jobRunId, status, durationMs, { sent, skipped, failed });

    return reply.status(200).send({
      success: true,
      sent,
      skipped,
      failed
    });
  });

  // POST /api/internal/jobs/retention-alerts/run
  fastify.post('/internal/jobs/retention-alerts/run', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const jobRunId = await JobRegistryService.startRun('RETENTION_ALERTS', 'INTERNAL', requestId);

    try {
      const result = await RetentionService.runRetentionAlertsJob();
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const status = (result.processedCount === 0 && result.alertsSent.length === 0) ? 'SKIPPED' : 'SUCCESS';
      await JobRegistryService.completeRun(jobRunId, status, durationMs, result);

      const logObject = {
        jobName: 'retention-alerts',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status,
        processedCount: result.processedCount,
        alertsSent: result.alertsSent,
        source: 'INTERNAL_JOB',
      };
      fastify.log.info(logObject, `Job retention-alerts finished successfully`);

      return reply.status(200).send({
        success: true,
        data: logObject,
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });

      const logObject = {
        jobName: 'retention-alerts',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'FAILED',
        source: 'INTERNAL_JOB',
      };
      fastify.log.error({ ...logObject, error: err.message || String(err) }, `Job retention-alerts failed`);

      return reply.status(500).send({
        success: false,
        error: {
          code: 'JOB_ERROR',
          message: err.message || 'Erro durante a execução do job de alertas de retenção.',
        },
      });
    }
  });

  // POST /api/internal/jobs/notification-digest/run
  fastify.post('/internal/jobs/notification-digest/run', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const jobRunId = await JobRegistryService.startRun('NOTIFICATION_DIGEST', 'INTERNAL', requestId);

    try {
      const companies = await prisma.company.findMany({ select: { id: true } });
      const users = await prisma.user.findMany({ select: { id: true, role: true, companyId: true } });

      let createdCount = 0;

      // 1. Platform-level digest
      const platformDigest = await NotificationCenterService.createDigest(null, null, null, new Date());
      if (platformDigest) createdCount++;

      // 2. Company-level digests
      for (const company of companies) {
        const d = await NotificationCenterService.createDigest(company.id, null, null, new Date());
        if (d) createdCount++;
      }

      // 3. User & Role level digests
      const processedTargets = new Set<string>();
      for (const user of users) {
        // User digest
        const ud = await NotificationCenterService.createDigest(user.companyId, user.id, null, new Date());
        if (ud) createdCount++;

        // Role digest (scoped to company)
        if (user.companyId && user.role) {
          const roleKey = `${user.companyId}:${user.role}`;
          if (!processedTargets.has(roleKey)) {
            processedTargets.add(roleKey);
            const rd = await NotificationCenterService.createDigest(user.companyId, null, user.role, new Date());
            if (rd) createdCount++;
          }
        }
      }

      // Log success audit
      await prisma.auditLog.create({
        data: {
          companyId: 'global-admin',
          action: 'NOTIFICATION_DIGEST_GENERATED',
          metadata: {
            createdCount,
            computedAt: new Date().toISOString(),
          },
        },
      });

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'SUCCESS', durationMs, { createdCount });

      return reply.status(200).send({
        success: true,
        data: { createdCount },
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'JOB_ERROR', message: err.message || 'Erro no job de digest.' },
      });
    }
  });

  // POST /api/internal/jobs/notification-escalations/run
  fastify.post('/internal/jobs/notification-escalations/run', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const jobRunId = await JobRegistryService.startRun('NOTIFICATION_ESCALATIONS', 'INTERNAL', requestId);

    try {
      const escalatedCount = await NotificationCenterService.runEscalations();

      // Log success audit
      await prisma.auditLog.create({
        data: {
          companyId: 'global-admin',
          action: 'NOTIFICATION_ESCALATION_RUN',
          metadata: {
            escalatedCount,
            computedAt: new Date().toISOString(),
          },
        },
      });

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'SUCCESS', durationMs, { escalatedCount });

      return reply.status(200).send({
        success: true,
        data: { escalatedCount },
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'JOB_ERROR', message: err.message || 'Erro no job de escalação.' },
      });
    }
  });

  // POST /api/internal/jobs/notification-workflow-escalations/run
  // Scheduler-scan step for the Sprint 54 event-driven Notification Engine.
  // Distinct from /notification-escalations/run above (the LEGACY mechanism
  // for stale in-app notifications) — the same event is never processed by
  // both.
  fastify.post('/internal/jobs/notification-workflow-escalations/run', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();

    const lockAcquired = await JobLock.acquire('NOTIFICATION_WORKFLOW_ESCALATIONS', 300000);
    if (!lockAcquired) {
      return reply.status(409).send({
        success: false,
        error: { code: 'JOB_LOCKED', message: 'Este job já está rodando em outra instância.' },
      });
    }

    const jobRunId = await JobRegistryService.startRun('NOTIFICATION_WORKFLOW_ESCALATIONS', 'INTERNAL', requestId);

    try {
      const result = await NotificationEscalationService.scanAndAdvance();
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const status = result.evaluated === 0 ? 'SKIPPED' : 'SUCCESS';
      await JobRegistryService.completeRun(jobRunId, status, durationMs, result as any);

      return reply.status(200).send({ success: true, data: result });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'JOB_ERROR', message: err.message || 'Erro no job de escalonamento do Notification Engine.' },
      });
    } finally {
      await JobLock.release('NOTIFICATION_WORKFLOW_ESCALATIONS');
    }
  });

  // GET /api/internal/jobs/ping
  fastify.get('/internal/jobs/ping', async (request, reply) => {
    return reply.status(200).send({
      success: true,
    });
  });

  // POST /api/internal/jobs/ping
  fastify.post('/internal/jobs/ping', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const jobRunId = await JobRegistryService.startRun('INTERNAL_PING', 'INTERNAL', requestId);

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    await JobRegistryService.completeRun(jobRunId, 'SUCCESS', durationMs, { ping: 'ok' });

    return reply.status(200).send({
      success: true,
    });
  });

  // POST /api/internal/jobs/manager-digest
  fastify.post('/internal/jobs/manager-digest', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const jobRunId = await JobRegistryService.startRun('MANAGER_DAILY_DIGEST', 'INTERNAL', requestId);

    try {
      const managers = await prisma.user.findMany({
        where: {
          role: 'MANAGER',
          email: { not: { contains: 'test' } },
        },
      });

      let sentCount = 0;
      for (const mgr of managers) {
        const employeesCount = await prisma.employee.count({
          where: { managerUserId: mgr.id },
        });

        if (employeesCount === 0) continue;

        fastify.log.info({
          msg: `[SIMULATED WHATSAPP DIGEST] Enviando resumo diário para o Gestor ${mgr.name}`,
          to: mgr.email,
          employeesManaged: employeesCount,
        });

        sentCount++;
      }

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'SUCCESS', durationMs, { sentCount });

      return reply.status(200).send({
        success: true,
        data: { sentCount },
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'JOB_ERROR', message: err.message || 'Erro no job de resumo de gestores.' },
      });
    }
  });

  // POST /api/internal/jobs/biometric-cleanup
  // Removes selfie files from RemoteCheckin after per-company BIOMETRIC_RETENTION_DAYS.
  // Template/embedding data is NEVER logged or exposed in analytics.
  fastify.post('/internal/jobs/biometric-cleanup', async (request, reply) => {
    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();

    const lockAcquired = await JobLock.acquire('BIOMETRIC_CLEANUP', 300000);
    if (!lockAcquired) {
      return reply.status(409).send({
        success: false,
        error: { code: 'JOB_LOCKED', message: 'Este job já está rodando em outra instância.' }
      });
    }

    const jobRunId = await JobRegistryService.startRun('BIOMETRIC_CLEANUP', 'INTERNAL', requestId);

    try {
      // Load per-company retention config. Default to 30 days if not configured.
      const configs = await prisma.biometricProcessingConfiguration.findMany({
        select: { companyId: true, retentionDays: true },
      });

      const retentionMap = new Map<string, number>(
        configs.map(c => [c.companyId, c.retentionDays])
      );

      // Get all distinct companyIds that have selfies to clean
      const companiesWithSelfies = await prisma.remoteCheckin.findMany({
        where: { selfieUrl: { not: null } },
        select: { companyId: true },
        distinct: ['companyId'],
      });

      let deletedCount = 0;
      let failedCount = 0;

      for (const { companyId } of companiesWithSelfies) {
        const retentionDays = retentionMap.get(companyId) ?? 30;
        const thresholdDate = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);

        try {
          const { count } = await prisma.remoteCheckin.updateMany({
            where: {
              companyId,
              selfieUrl: { not: null },
              createdAt: { lt: thresholdDate },
            },
            data: { selfieUrl: null },
          });
          deletedCount += count;
        } catch (_err) {
          failedCount++;
        }
      }

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      // NOTE: individual selfie URLs or template data are never included in logs
      await JobRegistryService.completeRun(jobRunId, 'SUCCESS', durationMs, { deletedCount, failedCount });

      return reply.status(200).send({
        success: true,
        data: { deletedCount, failedCount },
      });
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await JobRegistryService.completeRun(jobRunId, 'FAILED', durationMs, null, {
        code: 'JOB_ERROR',
        message: err.message || String(err),
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'JOB_ERROR', message: err.message || 'Erro no job de limpeza biométrica.' },
      });
    } finally {
      await JobLock.release('BIOMETRIC_CLEANUP');
    }
  });
}


import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { env } from '../config/env';
import { runRemoteCheckinBatchJob } from '../jobs/remote-checkin-batch.job';
import { runMarkNotRespondedJob } from '../jobs/mark-not-responded.job';
import { runDailyClosingSummaryJob } from '../jobs/daily-closing-summary.job';
import { runCleanupOldLogsJob } from '../jobs/cleanup-old-logs.job';
import { prisma } from '../lib/prisma';
import { getSaoPauloDayRange } from '../lib/date-helpers';
import { CommercialNotificationService } from '../services/commercial-notification.service';

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

    try {
      const result = await runRemoteCheckinBatchJob({ companyId });
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const logObject = {
        jobName: 'remote-checkin-batch',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'SUCCESS',
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

    try {
      const result = await runMarkNotRespondedJob({ companyId, date, graceMinutes });
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const logObject = {
        jobName: 'mark-not-responded',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'SUCCESS',
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
    }
  });

  // POST /api/internal/jobs/daily-closing-summary
  fastify.post('/internal/jobs/daily-closing-summary', async (request, reply) => {
    const bodyResult = bodyCompanySchema.safeParse(request.body || {});
    const companyId = bodyResult.success ? bodyResult.data.companyId : undefined;

    const startedAt = new Date();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();

    try {
      const result = await runDailyClosingSummaryJob({ companyId });
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const logObject = {
        jobName: 'daily-closing-summary',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'SUCCESS',
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

    try {
      const result = await runCleanupOldLogsJob();
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const logObject = {
        jobName: 'cleanup-old-logs',
        requestId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        status: 'SUCCESS',
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

    // 4. DAILY_SUMMARY
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
        // Collect summary data
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

        // If no items at all for the entire day summary, return skipped/no_items
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

    return reply.status(200).send({
      success: true,
      sent,
      skipped,
      failed
    });
  });

  // GET /api/internal/jobs/ping
  fastify.get('/internal/jobs/ping', async (request, reply) => {
    return reply.status(200).send({
      success: true,
    });
  });

  // POST /api/internal/jobs/ping
  fastify.post('/internal/jobs/ping', async (request, reply) => {
    return reply.status(200).send({
      success: true,
    });
  });
}

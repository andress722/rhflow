import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../lib/auth-middleware';
import { JobRegistryService } from '../services/job-registry.service';
import { env } from '../config/env';
import { InMemoryCache } from '../lib/cache';
import { prisma } from '../lib/prisma';

export default async function jobsAdminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/jobs
  fastify.get('/admin/jobs', async (request, reply) => {
    try {
      const cacheKey = 'jobs-overview-status';
      const cached = InMemoryCache.get(cacheKey);
      if (cached) {
        return reply.status(200).send({
          success: true,
          data: cached,
        });
      }

      const statuses = await JobRegistryService.getJobsStatus();
      InMemoryCache.set(cacheKey, statuses, 15); // 15s TTL

      return reply.status(200).send({
        success: true,
        data: statuses,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar status dos jobs.',
        },
      });
    }
  });

  // GET /api/admin/jobs/runs
  fastify.get('/admin/jobs/runs', async (request, reply) => {
    try {
      const { jobKey, status, dateFrom, dateTo, page, pageSize } = request.query as {
        jobKey?: string;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: string;
        pageSize?: string;
      };

      const parsedPage = page ? parseInt(page, 10) : 1;
      const parsedPageSize = pageSize ? Math.min(100, parseInt(pageSize, 10)) : 10;
      const skip = (parsedPage - 1) * parsedPageSize;

      const where: any = {};
      if (jobKey) where.jobKey = jobKey;
      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.startedAt = {};
        if (dateFrom) where.startedAt.gte = new Date(dateFrom);
        if (dateTo) where.startedAt.lte = new Date(dateTo);
      }

      const total = await prisma.jobRun.count({ where });
      const items = await prisma.jobRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: parsedPageSize,
      });

      return reply.status(200).send({
        success: true,
        items,
        total,
        page: parsedPage,
        pageSize: parsedPageSize,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao buscar logs de execuções.',
        },
      });
    }
  });

  // GET /api/admin/jobs/:jobKey
  fastify.get('/admin/jobs/:jobKey', async (request, reply) => {
    try {
      const { jobKey } = request.params as { jobKey: string };
      const details = await JobRegistryService.getJobDetails(jobKey);
      return reply.status(200).send({
        success: true,
        data: details,
      });
    } catch (err: any) {
      const code = err.message === 'JOB_NOT_FOUND' ? 'NOT_FOUND' : 'SERVER_ERROR';
      const status = err.message === 'JOB_NOT_FOUND' ? 404 : 500;

      return reply.status(status).send({
        success: false,
        error: {
          code,
          message: err.message === 'JOB_NOT_FOUND' ? 'Job não encontrado no registro.' : err.message,
        },
      });
    }
  });

  // POST /api/admin/jobs/:jobKey/run
  fastify.post('/admin/jobs/:jobKey/run', async (request, reply) => {
    try {
      const { jobKey } = request.params as { jobKey: string };

      // Restrict manual triggers to safe jobs
      const safeJobs = ['COMMERCIAL_ALERTS', 'RETENTION_ALERTS', 'INTERNAL_PING', 'CLEANUP_OLD_LOGS'];
      if (!safeJobs.includes(jobKey)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Execução manual não permitida para este tipo de job operacional/destrutivo.',
          },
        });
      }

      // Map to internal routes
      let path = '';
      if (jobKey === 'COMMERCIAL_ALERTS') path = '/api/internal/jobs/commercial-alerts/run';
      else if (jobKey === 'RETENTION_ALERTS') path = '/api/internal/jobs/retention-alerts/run';
      else if (jobKey === 'INTERNAL_PING') path = '/api/internal/jobs/ping';
      else if (jobKey === 'CLEANUP_OLD_LOGS') path = '/api/internal/jobs/cleanup-old-logs';

      // Trigger the job by injecting a server call
      const res = await request.server.inject({
        method: 'POST',
        url: path,
        headers: {
          'x-internal-job-secret': env.INTERNAL_JOB_SECRET,
          'x-request-id': `manual-run-${Date.now()}`,
        },
        body: {},
      });

      return reply.status(res.statusCode).send(JSON.parse(res.payload));
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao executar o job manualmente.',
        },
      });
    }
  });
}

import { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/auth-middleware';
import { CommandCenterService } from '../services/command-center.service';
import { InMemoryCache } from '../lib/cache';

export default async function commandCenterRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/command-center/overview
  fastify.get('/admin/command-center/overview', async (request, reply) => {
    try {
      const cacheKey = 'command-center-overview';
      const cached = InMemoryCache.get(cacheKey);
      if (cached) {
        return reply.status(200).send({
          success: true,
          data: cached,
        });
      }

      const data = await CommandCenterService.getOverview();
      InMemoryCache.set(cacheKey, data, 30); // 30s TTL

      return reply.status(200).send({
        success: true,
        data
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar resumo do centro de controle.',
        }
      });
    }
  });

  // GET /api/admin/command-center/alerts
  fastify.get('/admin/command-center/alerts', async (request, reply) => {
    try {
      const { severity, type, page, pageSize } = request.query as {
        severity?: string;
        type?: string;
        page?: string;
        pageSize?: string;
      };

      const parsedPage = page ? parseInt(page, 10) : 1;
      const parsedPageSize = pageSize ? Math.min(100, parseInt(pageSize, 10)) : 10;
      const skip = (parsedPage - 1) * parsedPageSize;

      let alerts = await CommandCenterService.getDerivedAlerts();

      if (severity) {
        alerts = alerts.filter(a => a.severity === severity);
      }

      if (type) {
        alerts = alerts.filter(a => a.type === type);
      }

      const total = alerts.length;
      const paginated = alerts.slice(skip, skip + parsedPageSize);

      return reply.status(200).send({
        success: true,
        items: paginated,
        total,
        page: parsedPage,
        pageSize: parsedPageSize
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar detalhamento de alertas.',
        }
      });
    }
  });
}

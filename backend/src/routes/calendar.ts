import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { CalendarSyncService } from '../services/calendar-sync.service';

export default async function calendarRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/calendar/integration (Get integration state)
  fastify.get('/calendar/integration', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;

    const integration = await prisma.calendarIntegration.findUnique({
      where: { companyId }
    });

    return reply.status(200).send({
      success: true,
      data: integration
    });
  });

  // POST /api/calendar/integration/sync-test
  // Performs a REAL connectivity check against the configured provider by
  // forcing a token refresh/validation. It never claims that events were
  // synced: this route does not sync anything by itself, it only reports
  // whether the stored credentials are currently usable.
  fastify.post('/calendar/integration/sync-test', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;
    const correlationId = (request as any).correlationId as string | undefined;

    const integration = await prisma.calendarIntegration.findUnique({
      where: { companyId }
    });

    if (!integration || !integration.isActive) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INTEGRATION_INACTIVE', message: 'Nenhuma integração ativa configurada.' }
      });
    }

    const token = await CalendarSyncService.refreshIfNeeded(companyId, { correlationId });

    if (!token) {
      return reply.status(502).send({
        success: false,
        error: {
          code: 'CALENDAR_TOKEN_INVALID',
          message: 'Não foi possível validar o token com o provedor. A integração pode ter sido revogada.',
        }
      });
    }

    return reply.status(200).send({
      success: true,
      message: `Conexão com ${integration.provider} validada com sucesso. O token de acesso está ativo.`,
      data: {
        provider: integration.provider,
        tokenValid: true,
        checkedAt: new Date(),
      }
    });
  });
}

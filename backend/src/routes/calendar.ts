import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { requireRole } from '../lib/auth-middleware';

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

  // POST /api/calendar/integration (Setup/Activate calendar oauth credentials)
  fastify.post('/calendar/integration', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;

    const schema = z.object({
      provider: z.enum(['GOOGLE', 'MICROSOFT']),
      accessToken: z.string().min(5),
      refreshToken: z.string().optional()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Configurações de integração inválidas.' }
      });
    }

    const { provider, accessToken, refreshToken } = parsed.data;

    const integration = await prisma.calendarIntegration.upsert({
      where: { companyId },
      create: {
        companyId,
        provider,
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: new Date(Date.now() + 3600 * 1000), // Mock 1h expiry
        isActive: true
      },
      update: {
        provider,
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        isActive: true
      }
    });

    return reply.status(200).send({
      success: true,
      data: integration
    });
  });

  // POST /api/calendar/integration/sync-test (Simulates calendar sync webhook)
  fastify.post('/calendar/integration/sync-test', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;

    const integration = await prisma.calendarIntegration.findUnique({
      where: { companyId }
    });

    if (!integration || !integration.isActive) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INTEGRATION_INACTIVE', message: 'Nenhuma integração ativa configurada.' }
      });
    }

    // Mock syncing vacations or schedules to calendars
    const syncedEventsCount = 5; 
    
    return reply.status(200).send({
      success: true,
      message: `Sincronização com o ${integration.provider} finalizada. ${syncedEventsCount} eventos atualizados.`,
      data: {
        provider: integration.provider,
        syncedEventsCount,
        timestamp: new Date()
      }
    });
  });
}

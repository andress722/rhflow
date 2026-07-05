import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { quietHoursSchema } from '../modules/notification-engine/notification-engine.schemas';

export default async function notificationQuietHoursRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/notification-quiet-hours — the company's Quiet Hours config (singleton per tenant).
  fastify.get('/notification-quiet-hours', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;
    const config = await prisma.notificationQuietHours.findUnique({ where: { companyId } });
    return reply.status(200).send({ success: true, data: config });
  });

  // PUT /api/notification-quiet-hours — upsert (there is exactly one config per company).
  fastify.put('/notification-quiet-hours', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;

    const parsed = quietHoursSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Dados inválidos.' } });
    }

    const config = await prisma.notificationQuietHours.upsert({
      where: { companyId },
      create: { companyId, ...parsed.data },
      update: { ...parsed.data },
    });

    return reply.status(200).send({ success: true, data: config });
  });
}

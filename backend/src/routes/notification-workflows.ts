import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import {
  acknowledgeWorkflowSchema,
  resolveWorkflowSchema,
  cancelWorkflowSchema,
  workflowFiltersSchema,
} from '../modules/notification-engine/notification-engine.schemas';
import { NotificationAcknowledgmentService } from '../modules/notification-engine/notification-acknowledgment.service';

export default async function notificationWorkflowsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/notifications/workflows
  fastify.get('/notifications/workflows', async (request, reply) => {
    const { companyId } = request.user;
    const parsed = workflowFiltersSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Filtros inválidos.' } });
    }
    const { status, eventType, priority, recipientUserId, dateFrom, dateTo, page, pageSize } = parsed.data;

    const where: any = { companyId };
    if (status) where.status = status;
    if (eventType) where.eventType = eventType;
    if (priority) where.priority = priority;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (recipientUserId) {
      where.deliveryAttempts = { some: { recipientUserId } };
    }

    const [items, total] = await Promise.all([
      prisma.notificationWorkflowInstance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notificationWorkflowInstance.count({ where }),
    ]);

    return reply.status(200).send({ success: true, data: { items, total, page, pageSize } });
  });

  // GET /api/notifications/workflows/:id
  fastify.get('/notifications/workflows/:id', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const workflow = await prisma.notificationWorkflowInstance.findFirst({
      where: { id, companyId },
      include: { deliveryAttempts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!workflow) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workflow não encontrado.' } });
    }
    return reply.status(200).send({ success: true, data: workflow });
  });

  // POST /api/notifications/workflows/:id/acknowledge
  fastify.post('/notifications/workflows/:id/acknowledge', async (request, reply) => {
    const { companyId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };

    const parsed = acknowledgeWorkflowSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } });
    }

    const result = await NotificationAcknowledgmentService.acknowledge(id, companyId, userId, role);
    if (!result.ok) {
      const status = result.error === 'FORBIDDEN' ? 403 : 404;
      return reply.status(status).send({ success: false, error: { code: result.error, message: result.error === 'FORBIDDEN' ? 'Você não é destinatário deste workflow.' : 'Workflow não encontrado.' } });
    }
    return reply.status(200).send({ success: true, data: { acknowledged: true, alreadyTerminal: Boolean(result.alreadyTerminal) } });
  });

  // POST /api/notifications/workflows/:id/resolve
  fastify.post('/notifications/workflows/:id/resolve', async (request, reply) => {
    const { companyId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };

    const parsed = resolveWorkflowSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'reasonCode é obrigatório.' } });
    }

    const result = await NotificationAcknowledgmentService.resolve(id, companyId, userId, role, parsed.data.reasonCode, parsed.data.notes);
    if (!result.ok) {
      const status = result.error === 'FORBIDDEN' ? 403 : 404;
      return reply.status(status).send({ success: false, error: { code: result.error, message: result.error === 'FORBIDDEN' ? 'Você não é destinatário deste workflow.' : 'Workflow não encontrado.' } });
    }
    return reply.status(200).send({ success: true, data: { resolved: true, alreadyTerminal: Boolean(result.alreadyTerminal) } });
  });

  // POST /api/notifications/workflows/:id/cancel
  fastify.post('/notifications/workflows/:id/cancel', async (request, reply) => {
    const { companyId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };

    const parsed = cancelWorkflowSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } });
    }

    const result = await NotificationAcknowledgmentService.cancel(id, companyId, userId, role, parsed.data.reason);
    if (!result.ok) {
      const status = result.error === 'FORBIDDEN' ? 403 : 404;
      return reply.status(status).send({ success: false, error: { code: result.error, message: result.error === 'FORBIDDEN' ? 'Você não é destinatário deste workflow.' : 'Workflow não encontrado.' } });
    }
    return reply.status(200).send({ success: true, data: { cancelled: true, alreadyTerminal: Boolean(result.alreadyTerminal) } });
  });
}

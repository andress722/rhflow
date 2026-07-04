import { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/auth-middleware';
import { NotificationCenterService } from '../services/notification-center.service';
import { NotificationStatus, NotificationSeverity, NotificationChannel, EscalationScope } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const patchPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      id: z.string().optional(),
      role: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      severity: z.nativeEnum(NotificationSeverity).nullable().optional(),
      enabled: z.boolean().default(true),
      digestEnabled: z.boolean().default(false),
      quietHoursStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(),
      quietHoursEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(),
    })
  ),
});

const createEscalationRuleSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  scope: z.nativeEnum(EscalationScope).default(EscalationScope.COMPANY),
  type: z.string().nullable().optional(),
  severity: z.nativeEnum(NotificationSeverity).nullable().optional(),
  escalateAfterMinutes: z.number().int().positive(),
  targetRole: z.string().min(1),
  enabled: z.boolean().default(true),
});

const patchEscalationRuleSchema = createEscalationRuleSchema.partial();

export default async function adminNotificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/notifications
  fastify.get('/admin/notifications', async (request, reply) => {
    const query = request.query as {
      status?: string;
      severity?: string;
      type?: string;
      page?: string;
      pageSize?: string;
    };

    const result = await NotificationCenterService.getPlatformNotifications({
      status: query.status as NotificationStatus | undefined,
      severity: query.severity as NotificationSeverity | undefined,
      type: query.type,
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? Math.min(100, parseInt(query.pageSize, 10)) : 20,
    });

    return reply.status(200).send({ success: true, ...result });
  });

  // GET /api/admin/notifications/unread-count
  fastify.get('/admin/notifications/unread-count', async (_request, reply) => {
    const count = await NotificationCenterService.getPlatformUnreadCount();
    return reply.status(200).send({ success: true, count });
  });

  // PATCH /api/admin/notifications/:id/read
  fastify.patch('/admin/notifications/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await NotificationCenterService.updatePlatformNotification(id, 'read');
    if (!success) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notificação de plataforma não encontrada.' },
      });
    }
    return reply.status(200).send({ success: true });
  });

  // PATCH /api/admin/notifications/:id/dismiss
  fastify.patch('/admin/notifications/:id/dismiss', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await NotificationCenterService.updatePlatformNotification(id, 'dismiss');
    if (!success) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notificação de plataforma não encontrada.' },
      });
    }
    return reply.status(200).send({ success: true });
  });

  // PATCH /api/admin/notifications/:id/resolve
  fastify.patch('/admin/notifications/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await NotificationCenterService.updatePlatformNotification(id, 'resolve');
    if (!success) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notificação de plataforma não encontrada.' },
      });
    }
    return reply.status(200).send({ success: true });
  });

  // GET /api/admin/notification-preferences
  fastify.get('/admin/notification-preferences', async (_request, reply) => {
    const preferences = await prisma.notificationPreference.findMany({
      where: { companyId: null },
      orderBy: { createdAt: 'asc' },
    });
    return reply.status(200).send({ success: true, data: preferences });
  });

  // PATCH /api/admin/notification-preferences
  fastify.patch('/admin/notification-preferences', async (request, reply) => {
    const bodyResult = patchPreferencesSchema.safeParse(request.body || {});

    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados de preferências inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const results = [];
    for (const pref of bodyResult.data.preferences) {
      if (pref.id) {
        const updated = await prisma.notificationPreference.updateMany({
          where: { id: pref.id, companyId: null },
          data: {
            role: pref.role,
            type: pref.type,
            severity: pref.severity,
            enabled: pref.enabled,
            digestEnabled: pref.digestEnabled,
            quietHoursStart: pref.quietHoursStart,
            quietHoursEnd: pref.quietHoursEnd,
          },
        });
        results.push(updated);
      } else {
        const created = await prisma.notificationPreference.create({
          data: {
            companyId: null,
            role: pref.role,
            type: pref.type,
            severity: pref.severity,
            channel: NotificationChannel.IN_APP,
            enabled: pref.enabled,
            digestEnabled: pref.digestEnabled,
            quietHoursStart: pref.quietHoursStart,
            quietHoursEnd: pref.quietHoursEnd,
          },
        });
        results.push(created);
      }
    }

    return reply.status(200).send({ success: true, count: results.length });
  });

  // GET /api/admin/notification-escalation-rules
  fastify.get('/admin/notification-escalation-rules', async (_request, reply) => {
    const rules = await prisma.notificationEscalationRule.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return reply.status(200).send({ success: true, data: rules });
  });

  // POST /api/admin/notification-escalation-rules
  fastify.post('/admin/notification-escalation-rules', async (request, reply) => {
    const bodyResult = createEscalationRuleSchema.safeParse(request.body || {});

    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Regra de escalação inválida.',
          details: bodyResult.error.errors,
        },
      });
    }

    const created = await prisma.notificationEscalationRule.create({
      data: {
        companyId: bodyResult.data.companyId ?? null,
        scope: bodyResult.data.scope,
        type: bodyResult.data.type,
        severity: bodyResult.data.severity,
        escalateAfterMinutes: bodyResult.data.escalateAfterMinutes,
        targetRole: bodyResult.data.targetRole,
        enabled: bodyResult.data.enabled,
      },
    });

    return reply.status(201).send({ success: true, data: created });
  });

  // PATCH /api/admin/notification-escalation-rules/:id
  fastify.patch('/admin/notification-escalation-rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodyResult = patchEscalationRuleSchema.safeParse(request.body || {});

    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Atualização de regra inválida.',
          details: bodyResult.error.errors,
        },
      });
    }

    const rule = await prisma.notificationEscalationRule.findUnique({
      where: { id },
    });

    if (!rule) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Regra de escalação não encontrada.' },
      });
    }

    const updated = await prisma.notificationEscalationRule.update({
      where: { id },
      data: {
        companyId: bodyResult.data.companyId ?? undefined,
        scope: bodyResult.data.scope,
        type: bodyResult.data.type,
        severity: bodyResult.data.severity,
        escalateAfterMinutes: bodyResult.data.escalateAfterMinutes,
        targetRole: bodyResult.data.targetRole,
        enabled: bodyResult.data.enabled,
      },
    });

    return reply.status(200).send({ success: true, data: updated });
  });

  // GET /api/admin/notifications/digest/today
  fastify.get('/admin/notifications/digest/today', async (_request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const digest = await prisma.notificationDigest.findFirst({
      where: {
        companyId: null,
        userId: null,
        role: null,
        digestDate: today,
        status: 'GENERATED',
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (!digest) {
      return reply.status(444).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resumo diário de hoje ainda não gerado.' },
      });
    }

    return reply.status(200).send({ success: true, data: digest.summary });
  });
}

import { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/auth-middleware';
import { NotificationCenterService } from '../services/notification-center.service';
import { NotificationStatus, NotificationSeverity, NotificationChannel } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
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

export default async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/notifications
  fastify.get('/notifications', async (request, reply) => {
    const { sub: userId, role, companyId } = request.user;

    if (!['ADMIN', 'HR', 'MANAGER', 'VIEWER'].includes(role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso não permitido para este perfil.' },
      });
    }

    const query = request.query as {
      status?: string;
      severity?: string;
      type?: string;
      page?: string;
      pageSize?: string;
    };

    const result = await NotificationCenterService.getNotifications({
      userId,
      role,
      companyId,
      status: query.status as NotificationStatus | undefined,
      severity: query.severity as NotificationSeverity | undefined,
      type: query.type,
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? Math.min(100, parseInt(query.pageSize, 10)) : 20,
    });

    return reply.status(200).send({ success: true, ...result });
  });

  // GET /api/notifications/unread-count
  fastify.get('/notifications/unread-count', async (request, reply) => {
    const { sub: userId, role, companyId } = request.user;

    if (!['ADMIN', 'HR', 'MANAGER', 'VIEWER'].includes(role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso não permitido para este perfil.' },
      });
    }

    const count = await NotificationCenterService.getUnreadCount(userId, role, companyId);
    return reply.status(200).send({ success: true, count });
  });

  // PATCH /api/notifications/:id/read
  fastify.patch('/notifications/:id/read', async (request, reply) => {
    const { sub: userId, role, companyId } = request.user;
    const { id } = request.params as { id: string };

    const success = await NotificationCenterService.markAsRead(id, userId, role, companyId);
    if (!success) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notificação não encontrada ou acesso negado.' },
      });
    }
    return reply.status(200).send({ success: true });
  });

  // PATCH /api/notifications/:id/dismiss
  fastify.patch('/notifications/:id/dismiss', async (request, reply) => {
    const { sub: userId, role, companyId } = request.user;
    const { id } = request.params as { id: string };

    const success = await NotificationCenterService.dismiss(id, userId, role, companyId);
    if (!success) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notificação não encontrada ou acesso negado.' },
      });
    }
    return reply.status(200).send({ success: true });
  });

  // PATCH /api/notifications/:id/resolve
  fastify.patch(
    '/notifications/:id/resolve',
    { preHandler: [requireRole(['ADMIN', 'HR', 'MANAGER'])] },
    async (request, reply) => {
      const { sub: userId, role, companyId } = request.user;
      const { id } = request.params as { id: string };

      const success = await NotificationCenterService.resolve(id, userId, role, companyId);
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Notificação não encontrada ou acesso negado.' },
        });
      }
      return reply.status(200).send({ success: true });
    }
  );

  // GET /api/notification-preferences
  fastify.get(
    '/notification-preferences',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId } = request.user;
      const preferences = await prisma.notificationPreference.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
      });
      return reply.status(200).send({ success: true, data: preferences });
    }
  );

  // PATCH /api/notification-preferences
  fastify.patch(
    '/notification-preferences',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId } = request.user;
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
          // Update existing
          const updated = await prisma.notificationPreference.updateMany({
            where: { id: pref.id, companyId },
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
          // Create new
          const created = await prisma.notificationPreference.create({
            data: {
              companyId,
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
    }
  );

  // GET /api/notifications/digest/today
  fastify.get('/notifications/digest/today', async (request, reply) => {
    const { sub: userId, role, companyId } = request.user;

    if (!['ADMIN', 'HR', 'MANAGER'].includes(role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Perfil não possui acesso ao resumo diário.' },
      });
    }

    const digest = await NotificationCenterService.getDigestForUser(userId, role, companyId);
    if (!digest) {
      return reply.status(444).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resumo diário de hoje ainda não gerado.' },
      });
    }

    return reply.status(200).send({ success: true, data: digest });
  });

  // GET /api/notifications/stream (SSE client connection stream)
  fastify.get('/notifications/stream', async (request, reply) => {
    const { sub: userId, companyId } = request.user;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial handshake
    reply.raw.write('data: ' + JSON.stringify({ event: 'connected', userId }) + '\n\n');

    const sendCallback = (notification: any) => {
      reply.raw.write('data: ' + JSON.stringify({ event: 'notification', data: notification }) + '\n\n');
    };

    NotificationCenterService.registerSseClient(companyId, userId, sendCallback);

    const interval = setInterval(async () => {
      const key = `user:${userId}:sessions`;
      const sessionsRaw = await redis.get(key);
      if (sessionsRaw) {
        const sessions = JSON.parse(sessionsRaw);
        const currentSession = sessions.find((s: any) => s.isCurrent);
        if (!currentSession) {
          clearInterval(interval);
          NotificationCenterService.unregisterSseClient(companyId, userId, sendCallback);
          reply.raw.end();
        }
      }
    }, 5000);

    request.raw.on('close', () => {
      clearInterval(interval);
      NotificationCenterService.unregisterSseClient(companyId, userId, sendCallback);
    });
  });

  // POST /api/notifications/web-push/subscribe (Registers Web Push subscriber endpoint)
  fastify.post('/notifications/web-push/subscribe', async (request, reply) => {
    const { sub: userId } = request.user;
    
    const schema = z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Assinatura Web Push inválida.' },
      });
    }

    const { endpoint, keys } = parsed.data;

    const sub = await prisma.webPushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return reply.status(201).send({
      success: true,
      data: sub,
    });
  });
}

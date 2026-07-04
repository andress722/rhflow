import { FastifyInstance } from 'fastify';
import { redis } from '../lib/redis';
import { z } from 'zod';

export default async function activeSessionsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/security/sessions
  fastify.get('/security/sessions', async (request, reply) => {
    const { sub: userId } = request.user;

    const currentIp = request.ip || '127.0.0.1';
    const currentUserAgent = request.headers['user-agent'] || 'Mozilla/5.0';

    // Retrieve simulated sessions from redis or fallback to defaults
    const key = `user:${userId}:sessions`;
    let sessionsRaw = await redis.get(key);
    
    let sessions = [];
    if (sessionsRaw) {
      sessions = JSON.parse(sessionsRaw);
    } else {
      // Seed with initial high-fidelity sessions
      sessions = [
        {
          id: 'session_current',
          ipAddress: currentIp,
          userAgent: currentUserAgent,
          location: 'São Paulo, SP (Este dispositivo)',
          lastActive: new Date().toISOString(),
          isCurrent: true,
        },
        {
          id: 'session_mobile',
          ipAddress: '177.105.42.12',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
          location: 'Rio de Janeiro, RJ',
          lastActive: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          isCurrent: false,
        },
      ];
      await redis.set(key, JSON.stringify(sessions), 'EX', 86400); // 1 day
    }

    return reply.status(200).send({
      success: true,
      data: sessions,
    });
  });

  // POST /api/security/sessions/revoke
  fastify.post('/security/sessions/revoke', async (request, reply) => {
    const { sub: userId } = request.user;

    const schema = z.object({
      sessionId: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'ID da sessão inválido.' },
      });
    }

    const { sessionId } = parsed.data;

    if (sessionId === 'session_current') {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Você não pode revogar a sessão do dispositivo atual por aqui. Use o botão Sair.' },
      });
    }

    const key = `user:${userId}:sessions`;
    const sessionsRaw = await redis.get(key);

    if (sessionsRaw) {
      let sessions = JSON.parse(sessionsRaw);
      // Remove the revoked session
      sessions = sessions.filter((s: any) => s.id !== sessionId);
      await redis.set(key, JSON.stringify(sessions), 'EX', 86400);
    }

    return reply.status(200).send({
      success: true,
      message: 'Sessão revogada com sucesso.',
    });
  });
}

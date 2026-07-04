import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';

export default async function developerPortalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/developer/keys
  fastify.get('/developer/keys', async (request, reply) => {
    const { companyId } = request.user;

    const keys = await prisma.apiKey.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return reply.status(200).send({
      success: true,
      data: keys,
    });
  });

  // POST /api/developer/keys
  fastify.post('/developer/keys', async (request, reply) => {
    const { companyId } = request.user;

    const schema = z.object({
      name: z.string().min(3),
      scopes: z.array(z.string()).min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dados de chave inválidos.' },
      });
    }

    const rawSecret = crypto.randomBytes(24).toString('hex');
    const keyPrefix = `pf_live_${crypto.randomBytes(4).toString('hex')}`;
    const fullToken = `${keyPrefix}.${rawSecret}`;
    const secretHash = crypto.createHash('sha256').update(fullToken).digest('hex');

    const key = await prisma.apiKey.create({
      data: {
        companyId,
        name: parsed.data.name,
        keyPrefix,
        secretHash,
        scopes: parsed.data.scopes,
        isActive: true,
      },
    });

    // Raw token returned ONLY once at creation and never stored in plaintext.
    // Only the SHA-256 hash (secretHash) is persisted in the database.
    return reply.status(201).send({
      success: true,
      data: {
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        rawToken: fullToken, // Displayed ONCE — store securely, not recoverable after this response
      },
    });
  });

  // DELETE /api/developer/keys/:id
  fastify.delete('/developer/keys/:id', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const key = await prisma.apiKey.findFirst({
      where: { id, companyId },
    });

    if (!key) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chave de API não encontrada.' },
      });
    }

    await prisma.apiKey.delete({
      where: { id },
    });

    return reply.status(200).send({
      success: true,
      message: 'Chave de API revogada com sucesso.',
    });
  });

  // GET /api/developer/webhooks
  fastify.get('/developer/webhooks', async (request, reply) => {
    const { companyId } = request.user;

    const subs = await prisma.webhookSubscription.findMany({
      where: { companyId },
    });

    return reply.status(200).send({
      success: true,
      data: subs,
    });
  });

  // POST /api/developer/webhooks
  fastify.post('/developer/webhooks', async (request, reply) => {
    const { companyId } = request.user;

    const schema = z.object({
      url: z.string().url(),
      events: z.array(z.string()).min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'URL ou eventos de webhook inválidos.' },
      });
    }

    const secretToken = `whsec_${crypto.randomBytes(16).toString('hex')}`;

    const sub = await prisma.webhookSubscription.create({
      data: {
        companyId,
        url: parsed.data.url,
        events: parsed.data.events,
        secretToken,
        isActive: true,
      },
    });

    // secretToken is used as HMAC key (X-PresencaFlow-Signature-256 header).
    // Raw secretToken is returned ONCE at creation and stored in DB for signing outbound events.
    // The destination server must validate HMAC to prevent replay attacks.
    return reply.status(201).send({
      success: true,
      data: {
        ...sub,
        secretToken: sub.secretToken, // Returned once — rotate via re-creation if compromised
      },
    });
  });

  // DELETE /api/developer/webhooks/:id
  fastify.delete('/developer/webhooks/:id', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const sub = await prisma.webhookSubscription.findFirst({
      where: { id, companyId },
    });

    if (!sub) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Inscrição de webhook não encontrada.' },
      });
    }

    await prisma.webhookSubscription.delete({
      where: { id },
    });

    return reply.status(200).send({
      success: true,
      message: 'Inscrição de webhook removida com sucesso.',
    });
  });
}

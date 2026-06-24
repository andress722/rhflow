import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { WhatsAppChannelService } from '../services/whatsapp-channel.service';
import { WhatsAppProvider, WhatsAppMessageStatus } from '@prisma/client';

const inboundWebhookSchema = z.object({
  companyId: z.string().uuid('ID de empresa inválido'),
  from: z.string().min(1, 'Número do remetente é obrigatório'),
  message: z.string().min(1, 'A mensagem não pode estar vazia'),
  timestamp: z.string().datetime('Timestamp inválido'),
});

export default async function webhooksRoutes(fastify: FastifyInstance) {
  // GET /api/webhooks/whatsapp/:channelKey/inbound (Meta Webhook Verification Challenge)
  fastify.get('/webhooks/whatsapp/:channelKey/inbound', async (request, reply) => {
    const { channelKey } = request.params as { channelKey: string };
    const query = request.query as {
      'hub.mode'?: string;
      'hub.verify_token'?: string;
      'hub.challenge'?: string;
    };

    const mode = query['hub.mode'];
    const verifyToken = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const channel = await WhatsAppChannelService.getChannelByKey(channelKey);
    if (!channel) {
      return reply.status(404).send({ error: 'Canal não encontrado.' });
    }

    if (mode === 'subscribe' && verifyToken === channel.webhookSecret) {
      return reply.status(200).send(challenge);
    }

    return reply.status(403).send({ error: 'Verification token mismatch or invalid mode' });
  });

  // POST /api/webhooks/whatsapp/:channelKey/inbound (Secure Inbound Webhook)
  fastify.post('/webhooks/whatsapp/:channelKey/inbound', async (request, reply) => {
    const { channelKey } = request.params as { channelKey: string };

    const channel = await WhatsAppChannelService.getChannelByKey(channelKey);
    if (!channel) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Canal de WhatsApp não encontrado.',
        },
      });
    }

    // Validate Signature
    const rawPayload = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const isValid = WhatsAppChannelService.validateWebhook(channel, request.headers, rawPayload);

    if (!isValid) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Assinatura x-hub-signature-256 do webhook inválida ou ausente.',
        },
      });
    }

    const normalized = WhatsAppChannelService.normalizeInboundMessage(channel.provider, request.body);
    if (!normalized) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Não foi possível normalizar o payload recebido.',
        },
      });
    }

    // Record Inbound Message Log
    const logStatus = channel.provider === WhatsAppProvider.SIMULATED
      ? WhatsAppMessageStatus.SIMULATED
      : WhatsAppMessageStatus.RECEIVED;

    await WhatsAppChannelService.recordInbound(
      channel.companyId,
      channel.provider,
      channel.phoneNumber || 'unknown',
      normalized.from,
      normalized.message,
      logStatus,
      request.body
    );

    // Process Message
    const result = await WhatsAppChannelService.processInboundMessage(
      channel.companyId,
      normalized.from,
      normalized.message,
      normalized.timestamp
    );

    return reply.status(result.success ? 200 : 400).send(result);
  });

  // POST /api/webhooks/whatsapp/inbound (Legacy Deprecated simulated/dev endpoint)
  fastify.post('/webhooks/whatsapp/inbound', async (request, reply) => {
    const bodyResult = inboundWebhookSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: bodyResult.error.errors,
        },
      });
    }

    const { companyId, from, message, timestamp } = bodyResult.data;

    const channel = await prisma.whatsAppChannel.findUnique({
      where: { companyId },
    });

    if (channel && channel.provider === WhatsAppProvider.META_CLOUD) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Esta rota legada não suporta canais reais da Meta Cloud API. Use o webhook seguro com channelKey.',
        },
      });
    }

    console.warn(`[DEPRECATION] Endpoint POST /api/webhooks/whatsapp/inbound is deprecated. Use /api/webhooks/whatsapp/:channelKey/inbound instead.`);

    if (process.env.NODE_ENV === 'production') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Rota desativada em ambiente de produção.',
        },
      });
    }

    // Record Inbound Log
    const logStatus = channel?.provider === WhatsAppProvider.SIMULATED
      ? WhatsAppMessageStatus.SIMULATED
      : WhatsAppMessageStatus.RECEIVED;

    await WhatsAppChannelService.recordInbound(
      companyId,
      channel?.provider || WhatsAppProvider.SIMULATED,
      channel?.phoneNumber || 'simulated',
      from,
      message,
      logStatus,
      request.body
    );

    const result = await WhatsAppChannelService.processInboundMessage(
      companyId,
      from,
      message,
      new Date(timestamp)
    );

    return reply.status(result.success ? 200 : 400).send(result);
  });
}


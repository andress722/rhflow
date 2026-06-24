import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import {
  WhatsAppChannelService,
  maskSecret,
  encryptToken,
  sanitizeProviderConfig
} from '../services/whatsapp-channel.service';
import { WhatsAppProvider, WhatsAppChannelStatus } from '@prisma/client';

const patchChannelSchema = z.object({
  provider: z.enum(['SIMULATED', 'META_CLOUD']).optional(),
  phoneNumber: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  accessToken: z.string().nullable().optional(),
  providerConfig: z.any().optional(),
});

const getLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  status: z.enum(['SENT', 'RECEIVED', 'FAILED', 'SIMULATED']).optional(),
});

export default async function whatsappChannelRoutes(fastify: FastifyInstance) {
  // Enforce auth globally for these settings and logs routes
  fastify.addHook('preHandler', fastify.authenticate);

  // Require ADMIN or HR role globally for channel operations
  fastify.addHook('preHandler', requireRole(['ADMIN', 'HR']));

  // GET /api/whatsapp-channel
  fastify.get('/whatsapp-channel', async (request, reply) => {
    const { companyId } = request.user;

    let channel = await prisma.whatsAppChannel.findUnique({
      where: { companyId },
    });

    if (!channel) {
      channel = await WhatsAppChannelService.getOrCreateSimulatedChannel(companyId);
    }

    return reply.status(200).send({
      success: true,
      data: {
        id: channel.id,
        provider: channel.provider,
        status: channel.status,
        channelKey: channel.channelKey,
        phoneNumber: channel.phoneNumber,
        displayName: channel.displayName,
        webhookSecretMasked: maskSecret(channel.webhookSecret),
        hasToken: !!channel.accessTokenEnc,
        providerConfig: sanitizeProviderConfig(channel.providerConfig, channel.provider),
        lastInboundAt: channel.lastInboundAt,
        lastOutboundAt: channel.lastOutboundAt,
        lastError: channel.lastError,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      },
    });
  });

  // PATCH /api/whatsapp-channel
  fastify.patch('/whatsapp-channel', async (request, reply) => {
    const { companyId } = request.user;

    const bodyResult = patchChannelSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados de atualização inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    let channel = await prisma.whatsAppChannel.findUnique({
      where: { companyId },
    });

    if (!channel) {
      channel = await WhatsAppChannelService.getOrCreateSimulatedChannel(companyId);
    }

    const body = bodyResult.data;
    const updateData: any = {};

    if (body.provider !== undefined) {
      updateData.provider = body.provider;
      // Reset status to simulation if simulated, otherwise disconnected. Do not mark CONNECTED automatically.
      updateData.status = body.provider === WhatsAppProvider.SIMULATED
        ? WhatsAppChannelStatus.SIMULATION
        : WhatsAppChannelStatus.DISCONNECTED;
    }

    if (body.phoneNumber !== undefined) {
      updateData.phoneNumber = body.phoneNumber;
    }

    if (body.displayName !== undefined) {
      updateData.displayName = body.displayName;
    }

    if (body.webhookSecret !== undefined) {
      updateData.webhookSecret = body.webhookSecret;
    }

    if (body.accessToken !== undefined) {
      if (body.accessToken === null || body.accessToken === '') {
        updateData.accessTokenEnc = null;
      } else {
        updateData.accessTokenEnc = encryptToken(body.accessToken);
      }
    }

    if (body.providerConfig !== undefined) {
      const activeProvider = updateData.provider || channel.provider;
      updateData.providerConfig = sanitizeProviderConfig(body.providerConfig, activeProvider);
    }

    const updated = await prisma.whatsAppChannel.update({
      where: { id: channel.id },
      data: updateData,
    });

    return reply.status(200).send({
      success: true,
      data: {
        id: updated.id,
        provider: updated.provider,
        status: updated.status,
        channelKey: updated.channelKey,
        phoneNumber: updated.phoneNumber,
        displayName: updated.displayName,
        webhookSecretMasked: maskSecret(updated.webhookSecret),
        hasToken: !!updated.accessTokenEnc,
        providerConfig: sanitizeProviderConfig(updated.providerConfig, updated.provider),
        lastInboundAt: updated.lastInboundAt,
        lastOutboundAt: updated.lastOutboundAt,
        lastError: updated.lastError,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  });

  // GET /api/whatsapp-channel/logs
  fastify.get('/whatsapp-channel/logs', async (request, reply) => {
    const { companyId } = request.user;

    const queryResult = getLogsQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos.',
          details: queryResult.error.errors,
        },
      });
    }

    const { limit, page, direction, status } = queryResult.data;
    const skip = (page - 1) * limit;

    const whereClause: any = { companyId };
    if (direction) {
      whereClause.direction = direction;
    }
    if (status) {
      whereClause.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.whatsAppMessageLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.whatsAppMessageLog.count({ where: whereClause }),
    ]);

    return reply.status(200).send({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit,
          page,
          pages: Math.ceil(total / limit),
        },
      },
    });
  });
}

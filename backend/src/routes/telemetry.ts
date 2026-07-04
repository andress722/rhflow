import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const logEventSchema = z.object({
  eventName: z.string().min(1, 'eventName é obrigatório'),
  category: z.string().min(1, 'category é obrigatória'),
  properties: z.record(z.any()).default({}),
});

function recursiveMaskCPF(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***.***.***-**')
      .replace(/\b\d{11}\b/g, '***********');
  }
  if (Array.isArray(obj)) {
    return obj.map(recursiveMaskCPF);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = recursiveMaskCPF(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export default async function telemetryRoutes(fastify: FastifyInstance) {
  // POST /api/telemetry/events
  fastify.post('/telemetry/events', async (request, reply) => {
    try {
      const bodyResult = logEventSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parâmetros inválidos.',
            details: bodyResult.error.errors,
          },
        });
      }

      const { eventName, category, properties } = bodyResult.data;

      // Optional Auth
      let userId: string | null = null;
      let companyId: string | null = null;
      try {
        await request.jwtVerify();
        userId = request.user?.sub || null;
        companyId = request.user?.companyId || null;
      } catch (e) {
        // Guest user
      }

      const cleanProperties = recursiveMaskCPF(properties);

      await prisma.usageTelemetry.create({
        data: {
          companyId,
          userId,
          eventName,
          category,
          properties: cleanProperties,
        },
      });

      return reply.status(201).send({
        success: true,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao registrar evento de telemetria.',
        },
      });
    }
  });
}

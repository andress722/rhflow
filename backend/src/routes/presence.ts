import { FastifyInstance } from 'fastify';
import { RemoteCheckinService } from '../services/remote-checkin.service';

export default async function presenceRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication globally for these routes
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/presence (Lists check-ins for the day)
  fastify.get('/presence', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { date, status, employeeId, workModel, sector, managerUserId } = request.query as {
      date?: string;
      status?: string;
      employeeId?: string;
      workModel?: string;
      sector?: string;
      managerUserId?: string;
    };

    try {
      const checkins = await RemoteCheckinService.listCheckins({
        companyId,
        role,
        sub,
        status,
        employeeId,
        date,
        workModel,
        sector,
        managerUserId,
      });

      return reply.status(200).send({
        success: true,
        data: checkins,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao listar presença remota.',
        },
      });
    }
  });

  // GET /api/presence/summary (Dashboard summary counts)
  fastify.get('/presence/summary', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { date, graceMinutes } = request.query as {
      date?: string;
      graceMinutes?: string;
    };

    try {
      const summary = await RemoteCheckinService.getSummary({
        companyId,
        role,
        sub,
        date,
        graceMinutes: graceMinutes ? parseInt(graceMinutes, 10) : undefined,
      });

      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao calcular sumário de presença.',
        },
      });
    }
  });
}

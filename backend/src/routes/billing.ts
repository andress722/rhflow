import { FastifyInstance } from 'fastify';
import { PlanLimitsService } from '../services/plan-limits.service';
import { requireRole } from '../lib/auth-middleware';

export default async function billingRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication and restrict to ADMIN and HR
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['ADMIN', 'HR']));

  // GET /api/billing/plan
  fastify.get('/billing/plan', async (request, reply) => {
    const { companyId } = request.user;

    try {
      const sub = await PlanLimitsService.getCurrentSubscription(companyId);
      return reply.status(200).send({
        success: true,
        data: {
          planName: sub.plan.name,
          planCode: sub.plan.code,
          status: sub.status,
          startedAt: sub.startedAt,
          endsAt: sub.endsAt,
          isFallback: sub.isFallback,
          modules: {
            reports: sub.plan.enableReports,
            batchCheckin: sub.plan.enableBatchCheckin,
            medicalModule: sub.plan.enableMedicalModule,
            exports: sub.plan.enableExports,
          },
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar plano da empresa.',
        },
      });
    }
  });

  // GET /api/billing/usage
  fastify.get('/billing/usage', async (request, reply) => {
    const { companyId } = request.user;

    try {
      const summary = await PlanLimitsService.getUsageSummary(companyId);
      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar sumário de uso mensal.',
        },
      });
    }
  });
}

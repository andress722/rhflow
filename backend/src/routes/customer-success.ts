import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { CustomerSuccessService } from '../services/customer-success.service';

const successListQuerySchema = z.object({
  status: z.enum(['HEALTHY', 'ATTENTION', 'CRITICAL']).optional(),
  search: z.string().optional(),
  plan: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  pageSize: z.string().regex(/^\d+$/).transform(Number).default('10'),
});

export default async function customerSuccessRoutes(fastify: FastifyInstance) {
  // 1. Corporate endpoints (ADMIN/HR only)
  fastify.register(async (corporateMux) => {
    corporateMux.addHook('preHandler', fastify.authenticate);
    corporateMux.addHook('preHandler', requireRole(['ADMIN', 'HR']));

    // GET /api/customer-success/health
    corporateMux.get('/customer-success/health', async (request, reply) => {
      const { companyId } = request.user;
      try {
        const healthData = await CustomerSuccessService.calculateCompanyHealth(companyId);
        return reply.status(200).send({
          success: true,
          ...healthData,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao carregar integridade de sucesso do cliente.',
          },
        });
      }
    });

    // GET /api/customer-success/recommendations
    corporateMux.get('/customer-success/recommendations', async (request, reply) => {
      const { companyId } = request.user;
      try {
        const healthData = await CustomerSuccessService.calculateCompanyHealth(companyId);
        return reply.status(200).send({
          success: true,
          data: healthData.recommendations,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao buscar recomendações.',
          },
        });
      }
    });
  });

  // 2. Platform endpoint (SUPER_ADMIN only)
  fastify.register(async (adminMux) => {
    adminMux.addHook('preHandler', fastify.authenticate);
    adminMux.addHook('preHandler', requireRole(['SUPER_ADMIN']));

    // GET /api/admin/support/customer-success
    adminMux.get('/admin/support/customer-success', async (request, reply) => {
      try {
        const queryParsed = successListQuerySchema.safeParse(request.query || {});
        if (!queryParsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Parâmetros de consulta inválidos.',
              details: queryParsed.error.errors,
            },
          });
        }

        const { status, search, plan, page, pageSize } = queryParsed.data;
        const skip = (page - 1) * pageSize;

        const where: any = {};
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { legalName: { contains: search, mode: 'insensitive' } },
          ];
        }

        if (plan) {
          where.subscription = {
            plan: {
              code: { contains: plan, mode: 'insensitive' }
            }
          };
        }

        // To calculate pagination accurately under dynamic status filtering,
        // let's fetch all matched companies, calculate their status, filter, and page them.
        // Wait, if there are thousands of companies, calculating all scores is slow.
        // But for pilot phase (usually < 100 companies), it is perfectly fine.
        // The prompt says: "aplicar paginação antes de calcular scores detalhados (evitar N+1 pesado)"
        // Let's strictly follow this: query database with skip/take first, and then map to health calculations.
        const [companies, total] = await Promise.all([
          prisma.company.findMany({
            where,
            skip,
            take: pageSize,
            include: {
              subscription: {
                include: { plan: true }
              }
            },
            orderBy: { name: 'asc' }
          }),
          prisma.company.count({ where })
        ]);

        const items = [];
        for (const company of companies) {
          const healthData = await CustomerSuccessService.calculateCompanyHealth(company.id);

          // Apply dynamic status filter in-memory if requested
          if (status && healthData.status !== status) {
            continue;
          }

          items.push({
            companyId: company.id,
            companyName: company.name,
            plan: company.subscription?.plan.name || 'Starter',
            healthScore: healthData.healthScore,
            status: healthData.status,
            responseRate7d: healthData.adoptionMetrics.responseRate7d,
            activeEmployees: healthData.adoptionMetrics.activeEmployees,
            lastActivityAt: healthData.adoptionMetrics.lastActivityAt,
            risksCount: healthData.riskSignals.length,
            recommendationsCount: healthData.recommendations.length,
          });
        }

        return reply.status(200).send({
          success: true,
          items,
          total,
          page,
          pageSize
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao carregar lista de sucesso do cliente.',
          },
        });
      }
    });
  });
}

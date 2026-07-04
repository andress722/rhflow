import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';

export default async function auditLogsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/audit-logs
  fastify.get(
    '/audit-logs',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId } = request.user;
      const { action, from, to, page, limit } = request.query as {
        action?: string;
        from?: string;
        to?: string;
        page?: string;
        limit?: string;
      };

      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '50', 10);
      const skip = (pageNum - 1) * limitNum;

      const where: any = { companyId };

      if (action) {
        where.action = action;
      }

      if (from || to) {
        where.createdAt = {};
        if (from) {
          where.createdAt.gte = new Date(from);
        }
        if (to) {
          where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
        }
      }

      try {
        const [total, logs] = await Promise.all([
          prisma.auditLog.count({ where }),
          prisma.auditLog.findMany({
            where,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limitNum,
          }),
        ]);

        return reply.status(200).send({
          success: true,
          data: {
            logs,
            pagination: {
              total,
              page: pageNum,
              limit: limitNum,
              pages: Math.ceil(total / limitNum),
            },
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao buscar logs de auditoria.',
          },
        });
      }
    }
  );
}

import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export default async function publicKnowledgeRoutes(fastify: FastifyInstance) {
  // Optional auth helper
  const getAllowedAudiences = async (request: any): Promise<('SUPER_ADMIN' | 'ADMIN_HR' | 'MANAGER' | 'EMPLOYEE' | 'PUBLIC')[]> => {
    try {
      // Try to verify token. If signature is valid, extract role.
      await request.jwtVerify();
      const role = request.user?.role;
      if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR') {
        return ['ADMIN_HR', 'MANAGER', 'EMPLOYEE', 'PUBLIC'];
      } else if (role === 'MANAGER') {
        return ['MANAGER', 'EMPLOYEE', 'PUBLIC'];
      } else {
        return ['EMPLOYEE', 'PUBLIC'];
      }
    } catch (e) {
      // Guest or public reader
      return ['PUBLIC'];
    }
  };

  // GET /api/knowledge/articles
  fastify.get('/knowledge/articles', async (request, reply) => {
    try {
      const { category, search } = request.query as any;
      const allowed = await getAllowedAudiences(request);

      const where: any = {
        status: 'PUBLISHED',
        audience: { in: allowed },
      };

      if (category) where.category = category;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
        ];
      }

      const items = await prisma.knowledgeArticle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return reply.status(200).send({
        success: true,
        data: items,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao consultar artigos.',
        },
      });
    }
  });

  // GET /api/knowledge/articles/:slug
  fastify.get('/knowledge/articles/:slug', async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string };
      const allowed = await getAllowedAudiences(request);

      const item = await prisma.knowledgeArticle.findUnique({
        where: { slug },
      });

      if (!item || item.status !== 'PUBLISHED') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Artigo não encontrado.' },
        });
      }

      if (!allowed.includes(item.audience)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Você não tem permissão para visualizar este artigo.' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: item,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao buscar artigo por slug.',
        },
      });
    }
  });
}

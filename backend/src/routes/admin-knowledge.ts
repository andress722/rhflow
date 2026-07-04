import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';

function sanitizeInputString(str: string | null | undefined, maxLength = 255): string | null {
  if (!str) return null;
  const clean = str.replace(/<[^>]*>?/gm, '').trim();
  return clean.substring(0, maxLength);
}

function maskCPF(str: string | null | undefined): string | null {
  if (!str) return null;
  return str
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***.***.***-**')
    .replace(/\b\d{11}\b/g, '***********');
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

const createArticleSchema = z.object({
  title: z.string().min(1, 'title é obrigatório'),
  slug: z.string().optional().nullable(),
  category: z.enum(['ONBOARDING', 'WHATSAPP', 'CHECKIN', 'OCCURRENCES', 'MEDICAL_CERTIFICATES', 'REPORTS', 'BILLING', 'TROUBLESHOOTING', 'FAQ', 'RELEASE_NOTES']),
  audience: z.enum(['SUPER_ADMIN', 'ADMIN_HR', 'MANAGER', 'EMPLOYEE', 'PUBLIC']),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  summary: z.string().min(1, 'summary é obrigatório'),
  contentMarkdown: z.string().min(1, 'contentMarkdown é obrigatório'),
  tags: z.array(z.string()).optional(),
  relatedUrl: z.string().optional().nullable(),
});

const updateArticleSchema = z.object({
  title: z.string().optional(),
  category: z.enum(['ONBOARDING', 'WHATSAPP', 'CHECKIN', 'OCCURRENCES', 'MEDICAL_CERTIFICATES', 'REPORTS', 'BILLING', 'TROUBLESHOOTING', 'FAQ', 'RELEASE_NOTES']).optional(),
  audience: z.enum(['SUPER_ADMIN', 'ADMIN_HR', 'MANAGER', 'EMPLOYEE', 'PUBLIC']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  summary: z.string().optional(),
  contentMarkdown: z.string().optional(),
  tags: z.array(z.string()).optional(),
  relatedUrl: z.string().optional().nullable(),
});

export default async function adminKnowledgeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/knowledge/articles
  fastify.get('/admin/knowledge/articles', async (request, reply) => {
    try {
      const { category, audience, status, search } = request.query as any;

      const where: any = {};
      if (category) where.category = category;
      if (audience) where.audience = audience;
      if (status) where.status = status;

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
          message: err.message || 'Erro ao listar artigos da base de conhecimento.',
        },
      });
    }
  });

  // GET /api/admin/knowledge/articles/:id
  fastify.get('/admin/knowledge/articles/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const item = await prisma.knowledgeArticle.findUnique({ where: { id } });

      if (!item) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Artigo não encontrado.' },
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
          message: err.message || 'Erro ao buscar artigo.',
        },
      });
    }
  });

  // POST /api/admin/knowledge/articles
  fastify.post('/admin/knowledge/articles', async (request, reply) => {
    try {
      const bodyResult = createArticleSchema.safeParse(request.body);
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

      const payload = bodyResult.data;
      const targetSlug = payload.slug ? slugify(payload.slug) : slugify(payload.title);

      // Check slug uniqueness
      const existing = await prisma.knowledgeArticle.findUnique({ where: { slug: targetSlug } });
      if (existing) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'O slug gerado já está em uso por outro artigo. Defina um slug manual único.',
          },
        });
      }

      const cleanTitle = maskCPF(sanitizeInputString(payload.title, 200)) || '';
      const cleanSummary = maskCPF(sanitizeInputString(payload.summary, 500)) || '';
      // contentMarkdown length is up to 20000. Let's sanitize and mask it.
      const cleanContent = maskCPF(payload.contentMarkdown.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')) || '';

      const article = await prisma.$transaction(async (tx) => {
        const item = await tx.knowledgeArticle.create({
          data: {
            title: cleanTitle,
            slug: targetSlug,
            category: payload.category,
            audience: payload.audience,
            status: payload.status || 'DRAFT',
            summary: cleanSummary,
            contentMarkdown: cleanContent,
            tags: payload.tags || [],
            relatedUrl: payload.relatedUrl || null,
            createdByUserId: request.user.sub,
            publishedAt: payload.status === 'PUBLISHED' ? new Date() : null,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: request.user.companyId || 'platform',
            userId: request.user.sub,
            action: 'KNOWLEDGE_ARTICLE_CREATED',
            entity: 'KnowledgeArticle',
            entityId: item.id,
            metadata: {
              title: cleanTitle,
              category: payload.category,
              audience: payload.audience,
              executorEmail: request.user.email,
            },
          },
        });

        return item;
      });

      return reply.status(201).send({
        success: true,
        data: article,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao criar artigo.',
        },
      });
    }
  });

  // PATCH /api/admin/knowledge/articles/:id
  fastify.patch('/admin/knowledge/articles/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const bodyResult = updateArticleSchema.safeParse(request.body);
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

      const payload = bodyResult.data;

      const current = await prisma.knowledgeArticle.findUnique({ where: { id } });
      if (!current) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Artigo não encontrado.' },
        });
      }

      let publishedAt = current.publishedAt;
      if (payload.status === 'PUBLISHED' && current.status !== 'PUBLISHED') {
        publishedAt = new Date();
      }

      const cleanTitle = payload.title !== undefined
        ? maskCPF(sanitizeInputString(payload.title, 200)) || ''
        : current.title;
      const cleanSummary = payload.summary !== undefined
        ? maskCPF(sanitizeInputString(payload.summary, 500)) || ''
        : current.summary;
      const cleanContent = payload.contentMarkdown !== undefined
        ? maskCPF(payload.contentMarkdown.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')) || ''
        : current.contentMarkdown;

      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.knowledgeArticle.update({
          where: { id },
          data: {
            title: cleanTitle,
            summary: cleanSummary,
            contentMarkdown: cleanContent,
            ...(payload.category && { category: payload.category }),
            ...(payload.audience && { audience: payload.audience }),
            ...(payload.status && { status: payload.status }),
            ...(payload.tags && { tags: payload.tags }),
            ...(payload.relatedUrl !== undefined && { relatedUrl: payload.relatedUrl }),
            publishedAt,
            updatedByUserId: request.user.sub,
          },
        });

        const action = payload.status === 'ARCHIVED' ? 'KNOWLEDGE_ARTICLE_ARCHIVED' : 'KNOWLEDGE_ARTICLE_UPDATED';

        await tx.auditLog.create({
          data: {
            companyId: request.user.companyId || 'platform',
            userId: request.user.sub,
            action,
            entity: 'KnowledgeArticle',
            entityId: id,
            metadata: {
              previousStatus: current.status,
              newStatus: payload.status || current.status,
              executorEmail: request.user.email,
            },
          },
        });

        return item;
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao atualizar artigo.',
        },
      });
    }
  });

  // DELETE /api/admin/knowledge/articles/:id (Archiving virtual)
  fastify.delete('/admin/knowledge/articles/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const current = await prisma.knowledgeArticle.findUnique({ where: { id } });
      if (!current) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Artigo não encontrado.' },
        });
      }

      const item = await prisma.$transaction(async (tx) => {
        const art = await tx.knowledgeArticle.update({
          where: { id },
          data: { status: 'ARCHIVED' },
        });

        await tx.auditLog.create({
          data: {
            companyId: request.user.companyId || 'platform',
            userId: request.user.sub,
            action: 'KNOWLEDGE_ARTICLE_ARCHIVED',
            entity: 'KnowledgeArticle',
            entityId: id,
            metadata: {
              reason: 'Deleted by SUPER_ADMIN',
              executorEmail: request.user.email,
            },
          },
        });

        return art;
      });

      return reply.status(200).send({
        success: true,
        message: 'Artigo arquivado com sucesso.',
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao deletar (arquivar) artigo.',
        },
      });
    }
  });
}

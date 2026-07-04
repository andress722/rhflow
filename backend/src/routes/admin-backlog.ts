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

function mapCategoryToType(category: string): 'BUGFIX' | 'TRAINING' | 'IMPROVEMENT' | 'FEATURE_REQUEST' {
  switch (category) {
    case 'BUG':
    case 'INCIDENT':
      return 'BUGFIX';
    case 'QUESTION':
    case 'TRAINING':
      return 'TRAINING';
    case 'FEATURE_REQUEST':
      return 'FEATURE_REQUEST';
    default:
      return 'IMPROVEMENT';
  }
}

function mapSeverityToPriority(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
  switch (severity) {
    case 'CRITICAL':
      return 'URGENT';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

const createBacklogSchema = z.object({
  companyId: z.string().min(1, 'companyId é obrigatório'),
  feedbackId: z.string().optional().nullable(),
  title: z.string().min(1, 'title é obrigatório'),
  description: z.string().min(1, 'description é obrigatória'),
  type: z.enum(['BUGFIX', 'IMPROVEMENT', 'CONFIGURATION', 'TRAINING', 'DOCUMENTATION', 'FEATURE_REQUEST']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  status: z.enum(['TRIAGED', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELED']).optional(),
  impact: z.string().optional().nullable(),
  rootCause: z.string().optional().nullable(),
  plannedAction: z.string().optional().nullable(),
  releaseNote: z.string().optional().nullable(),
  targetReleaseDate: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
});

const updateBacklogSchema = z.object({
  status: z.enum(['TRIAGED', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToUserId: z.string().optional().nullable(),
  rootCause: z.string().optional().nullable(),
  plannedAction: z.string().optional().nullable(),
  releaseNote: z.string().optional().nullable(),
});

const generateReleaseNotesSchema = z.object({
  companyId: z.string().min(1, 'companyId é obrigatório'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export default async function adminBacklogRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/pilot-backlog
  fastify.get('/admin/pilot-backlog', async (request, reply) => {
    try {
      const {
        companyId,
        status,
        priority,
        type,
        assignedToUserId,
        search,
        page = '1',
        pageSize = '10',
      } = request.query as any;

      const p = parseInt(page, 10) || 1;
      const ps = parseInt(pageSize, 10) || 10;

      const where: any = {};
      if (companyId) where.companyId = companyId;
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (type) where.type = type;
      if (assignedToUserId) where.assignedToUserId = assignedToUserId;

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.pilotBacklogItem.findMany({
          where,
          include: {
            company: { select: { id: true, name: true } },
            feedback: { select: { id: true, title: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (p - 1) * ps,
          take: ps,
        }),
        prisma.pilotBacklogItem.count({ where }),
      ]);

      return reply.status(200).send({
        success: true,
        data: items,
        pagination: {
          page: p,
          pageSize: ps,
          total,
          totalPages: Math.ceil(total / ps),
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao buscar backlog do piloto.',
        },
      });
    }
  });

  // GET /api/admin/pilot-backlog/:id
  fastify.get('/admin/pilot-backlog/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const item = await prisma.pilotBacklogItem.findUnique({
        where: { id },
        include: {
          company: { select: { id: true, name: true } },
          feedback: { select: { id: true, title: true, status: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });

      if (!item) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Item do backlog não encontrado.' },
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
          message: err.message || 'Erro ao buscar item do backlog.',
        },
      });
    }
  });

  // POST /api/admin/pilot-backlog
  fastify.post('/admin/pilot-backlog', async (request, reply) => {
    try {
      const bodyResult = createBacklogSchema.safeParse(request.body);
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

      // Verify company exists
      const company = await prisma.company.findUnique({ where: { id: payload.companyId } });
      if (!company) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Empresa não encontrada.' },
        });
      }

      // Verify feedback is from same company
      if (payload.feedbackId) {
        const feedback = await prisma.pilotFeedback.findUnique({ where: { id: payload.feedbackId } });
        if (!feedback) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Feedback associado não encontrado.' },
          });
        }
        if (feedback.companyId !== payload.companyId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'O feedback associado deve pertencer à mesma empresa do item de backlog.',
            },
          });
        }
      }

      const cleanTitle = maskCPF(sanitizeInputString(payload.title, 200)) || '';
      const cleanDescription = maskCPF(sanitizeInputString(payload.description, 5000)) || '';
      const cleanImpact = maskCPF(sanitizeInputString(payload.impact, 3000));
      const cleanRootCause = maskCPF(sanitizeInputString(payload.rootCause, 3000));
      const cleanPlannedAction = maskCPF(sanitizeInputString(payload.plannedAction, 3000));
      const cleanReleaseNote = maskCPF(sanitizeInputString(payload.releaseNote, 3000));

      const backlogItem = await prisma.$transaction(async (tx) => {
        const item = await tx.pilotBacklogItem.create({
          data: {
            companyId: payload.companyId,
            feedbackId: payload.feedbackId || null,
            title: cleanTitle,
            description: cleanDescription,
            type: payload.type,
            priority: payload.priority,
            status: payload.status || 'TRIAGED',
            impact: cleanImpact,
            rootCause: cleanRootCause,
            plannedAction: cleanPlannedAction,
            releaseNote: cleanReleaseNote,
            targetReleaseDate: payload.targetReleaseDate ? new Date(payload.targetReleaseDate) : null,
            assignedToUserId: payload.assignedToUserId || null,
            completedAt: payload.status === 'DONE' ? new Date() : null,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: payload.companyId,
            userId: request.user.sub,
            action: 'PILOT_BACKLOG_CREATED',
            entity: 'PilotBacklogItem',
            entityId: item.id,
            metadata: {
              title: cleanTitle,
              type: payload.type,
              priority: payload.priority,
              executorEmail: request.user.email,
            },
          },
        });

        return item;
      });

      return reply.status(201).send({
        success: true,
        data: backlogItem,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao criar item do backlog.',
        },
      });
    }
  });

  // POST /api/admin/pilot-backlog/from-feedback/:feedbackId
  fastify.post('/admin/pilot-backlog/from-feedback/:feedbackId', async (request, reply) => {
    try {
      const { feedbackId } = request.params as { feedbackId: string };
      const feedback = await prisma.pilotFeedback.findUnique({ where: { id: feedbackId } });
      if (!feedback) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Feedback não encontrado.' },
        });
      }

      const priority = mapSeverityToPriority(feedback.severity);
      const type = mapCategoryToType(feedback.category);

      const backlogItem = await prisma.$transaction(async (tx) => {
        // Create backlog item
        const item = await tx.pilotBacklogItem.create({
          data: {
            companyId: feedback.companyId,
            feedbackId: feedback.id,
            title: feedback.title,
            description: feedback.description,
            type,
            priority,
            status: 'PLANNED',
            impact: feedback.impact,
          },
        });

        // Update feedback status if open or in_review
        if (feedback.status === 'OPEN' || feedback.status === 'IN_REVIEW') {
          await tx.pilotFeedback.update({
            where: { id: feedback.id },
            data: { status: 'PLANNED' },
          });
        }

        // Register AuditLog
        await tx.auditLog.create({
          data: {
            companyId: feedback.companyId,
            userId: request.user.sub,
            action: 'PILOT_BACKLOG_CREATED',
            entity: 'PilotBacklogItem',
            entityId: item.id,
            metadata: {
              title: item.title,
              type,
              priority,
              fromFeedbackId: feedback.id,
              executorEmail: request.user.email,
            },
          },
        });

        return item;
      });

      return reply.status(201).send({
        success: true,
        data: backlogItem,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao converter feedback em backlog.',
        },
      });
    }
  });

  // PATCH /api/admin/pilot-backlog/:id
  fastify.patch('/admin/pilot-backlog/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const bodyResult = updateBacklogSchema.safeParse(request.body);
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

      const current = await prisma.pilotBacklogItem.findUnique({ where: { id } });
      if (!current) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Item do backlog não encontrado.' },
        });
      }

      // Auto completedAt calculation
      let completedAt = current.completedAt;
      if (payload.status === 'DONE' && current.status !== 'DONE') {
        completedAt = new Date();
      } else if (payload.status && payload.status !== 'DONE' && current.status === 'DONE') {
        completedAt = null;
      }

      const cleanRootCause = payload.rootCause !== undefined
        ? maskCPF(sanitizeInputString(payload.rootCause, 3000))
        : current.rootCause;
      const cleanPlannedAction = payload.plannedAction !== undefined
        ? maskCPF(sanitizeInputString(payload.plannedAction, 3000))
        : current.plannedAction;
      const cleanReleaseNote = payload.releaseNote !== undefined
        ? maskCPF(sanitizeInputString(payload.releaseNote, 3000))
        : current.releaseNote;

      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.pilotBacklogItem.update({
          where: { id },
          data: {
            ...(payload.status && { status: payload.status }),
            ...(payload.priority && { priority: payload.priority }),
            ...(payload.assignedToUserId !== undefined && { assignedToUserId: payload.assignedToUserId }),
            rootCause: cleanRootCause,
            plannedAction: cleanPlannedAction,
            releaseNote: cleanReleaseNote,
            completedAt,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: current.companyId,
            userId: request.user.sub,
            action: 'PILOT_BACKLOG_UPDATED',
            entity: 'PilotBacklogItem',
            entityId: id,
            metadata: {
              previousStatus: current.status,
              newStatus: payload.status || current.status,
              previousPriority: current.priority,
              newPriority: payload.priority || current.priority,
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
          message: err.message || 'Erro ao atualizar item do backlog.',
        },
      });
    }
  });

  // POST /api/admin/pilot-backlog/release-notes
  fastify.post('/admin/pilot-backlog/release-notes', async (request, reply) => {
    try {
      const bodyResult = generateReleaseNotesSchema.safeParse(request.body);
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

      const { companyId, startDate, endDate } = bodyResult.data;

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Empresa não encontrada.' },
        });
      }

      const completedAtFilter: any = {};
      if (startDate) completedAtFilter.gte = new Date(startDate);
      if (endDate) completedAtFilter.lte = new Date(endDate);

      const items = await prisma.pilotBacklogItem.findMany({
        where: {
          companyId,
          status: 'DONE',
          completedAt: Object.keys(completedAtFilter).length > 0 ? completedAtFilter : undefined,
        },
        orderBy: { completedAt: 'desc' },
      });

      // Group items by type
      const grouped: Record<string, typeof items> = {};
      items.forEach(item => {
        grouped[item.type] = grouped[item.type] || [];
        grouped[item.type].push(item);
      });

      // Generate markdown
      let md = `# Release Notes — ${company.name}\n`;
      md += `*Período: ${startDate ? new Date(startDate).toLocaleDateString('pt-BR') : 'Início'} até ${endDate ? new Date(endDate).toLocaleDateString('pt-BR') : 'Hoje'}*\n\n`;

      if (items.length === 0) {
        md += `*Nenhuma melhoria ou correção foi marcada como concluída no período selecionado.*\n`;
      } else {
        const typesOrder = ['BUGFIX', 'IMPROVEMENT', 'CONFIGURATION', 'TRAINING', 'DOCUMENTATION', 'FEATURE_REQUEST'];
        for (const type of typesOrder) {
          const list = grouped[type] || [];
          if (list.length > 0) {
            md += `## ${type}\n\n`;
            list.forEach(item => {
              const dateStr = item.completedAt ? new Date(item.completedAt).toLocaleDateString('pt-BR') : '';
              const content = item.releaseNote || item.description;
              md += `- **${item.title}** (${dateStr}): ${content}\n`;
            });
            md += `\n`;
          }
        }
      }

      return reply.status(200).send({
        success: true,
        markdown: md,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao gerar release notes.',
        },
      });
    }
  });
}

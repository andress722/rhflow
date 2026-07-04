import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { NotificationCenterService } from '../services/notification-center.service';
import { NotificationSeverity } from '@prisma/client';

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

const createFeedbackSchema = z.object({
  companyId: z.string().min(1, 'companyId é obrigatório'),
  reportedByName: z.string().min(1, 'reportedByName é obrigatório'),
  reportedByRole: z.string().optional().nullable(),
  source: z.enum(['WHATSAPP', 'CALL', 'EMAIL', 'MEETING', 'INTERNAL', 'SYSTEM']),
  category: z.enum(['BUG', 'QUESTION', 'USABILITY', 'TRAINING', 'FEATURE_REQUEST', 'INCIDENT', 'COMMERCIAL', 'OTHER']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string().min(1, 'title é obrigatório'),
  description: z.string().min(1, 'description é obrigatória'),
  impact: z.string().optional().nullable(),
  actionTaken: z.string().optional().nullable(),
  relatedRequestId: z.string().optional().nullable(),
  relatedUrl: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  knowledgeArticleId: z.string().optional().nullable(),
});

const updateFeedbackSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'DISMISSED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedToUserId: z.string().optional().nullable(),
  actionTaken: z.string().optional().nullable(),
  knowledgeArticleId: z.string().optional().nullable(),
});

export default async function adminFeedbackRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/pilot-feedback
  fastify.get('/admin/pilot-feedback', async (request, reply) => {
    try {
      const {
        companyId,
        status,
        severity,
        category,
        source,
        search,
        page = '1',
        pageSize = '10',
      } = request.query as any;

      const p = parseInt(page, 10) || 1;
      const ps = parseInt(pageSize, 10) || 10;

      const where: any = {};
      if (companyId) where.companyId = companyId;
      if (status) where.status = status;
      if (severity) where.severity = severity;
      if (category) where.category = category;
      if (source) where.source = source;

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { reportedByName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.pilotFeedback.findMany({
          where,
          include: {
            company: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (p - 1) * ps,
          take: ps,
        }),
        prisma.pilotFeedback.count({ where }),
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
          message: err.message || 'Erro ao buscar feedbacks do piloto.',
        },
      });
    }
  });

  // GET /api/admin/pilot-feedback/summary/:companyId
  fastify.get('/admin/pilot-feedback/summary/:companyId', async (request, reply) => {
    try {
      const { companyId } = request.params as { companyId: string };
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Empresa não encontrada.' },
        });
      }

      const feedbacks = await prisma.pilotFeedback.findMany({
        where: { companyId }
      });

      const openItems = feedbacks.filter(f => f.status !== 'RESOLVED' && f.status !== 'DISMISSED').length;
      const criticalItems = feedbacks.filter(
        f => (f.severity === 'CRITICAL' || f.severity === 'HIGH') && f.status !== 'RESOLVED' && f.status !== 'DISMISSED'
      ).length;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const resolvedItems7d = feedbacks.filter(
        f => f.status === 'RESOLVED' && f.resolvedAt && f.resolvedAt >= sevenDaysAgo
      ).length;

      const categoryCounts: Record<string, number> = {};
      feedbacks.forEach(f => {
        categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
      });

      const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, count]) => ({ category, count }));

      const feedbackDates = feedbacks.map(f => f.createdAt.getTime());
      const lastFeedbackAt = feedbackDates.length > 0 ? new Date(Math.max(...feedbackDates)) : null;

      let recommendedNextAction = 'Sem pendências críticas';
      const openIncident = feedbacks.find(f => f.category === 'INCIDENT' && f.status !== 'RESOLVED' && f.status !== 'DISMISSED');
      const unassignedOpen = feedbacks.find(f => f.status === 'OPEN' && !f.assignedToUserId);

      if (criticalItems > 0) {
        recommendedNextAction = 'Resolver incidentes críticos pendentes';
      } else if (openIncident) {
        recommendedNextAction = 'Revisar incidente operacional aberto';
      } else if (unassignedOpen) {
        recommendedNextAction = 'Atribuir feedbacks pendentes sem responsável';
      } else if (openItems > 0) {
        recommendedNextAction = 'Acompanhar itens sob revisão com o cliente';
      }

      return reply.status(200).send({
        success: true,
        data: {
          openItems,
          criticalItems,
          resolvedItems7d,
          topCategories,
          lastFeedbackAt,
          recommendedNextAction,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao calcular resumo de feedbacks.',
        },
      });
    }
  });

  // GET /api/admin/pilot-feedback/:id
  fastify.get('/admin/pilot-feedback/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const feedback = await prisma.pilotFeedback.findUnique({
        where: { id },
        include: {
          company: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });

      if (!feedback) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Item de feedback não encontrado.' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: feedback,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao buscar detalhe do feedback.',
        },
      });
    }
  });

  // POST /api/admin/pilot-feedback
  fastify.post('/admin/pilot-feedback', async (request, reply) => {
    try {
      const bodyResult = createFeedbackSchema.safeParse(request.body);
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
          error: { code: 'NOT_FOUND', message: 'Empresa selecionada não encontrada.' },
        });
      }

      // Sanitization & mask CPF in text fields
      const cleanTitle = maskCPF(sanitizeInputString(payload.title, 200)) || '';
      const cleanDescription = maskCPF(sanitizeInputString(payload.description, 5000)) || '';
      const cleanImpact = maskCPF(sanitizeInputString(payload.impact, 2000));
      const cleanActionTaken = maskCPF(sanitizeInputString(payload.actionTaken, 2000));
      const cleanReportedByName = maskCPF(sanitizeInputString(payload.reportedByName, 120)) || '';
      const cleanReportedByRole = maskCPF(sanitizeInputString(payload.reportedByRole, 100));

      const feedback = await prisma.$transaction(async (tx) => {
        const item = await tx.pilotFeedback.create({
          data: {
            companyId: payload.companyId,
            reportedByName: cleanReportedByName,
            reportedByRole: cleanReportedByRole,
            source: payload.source,
            category: payload.category,
            severity: payload.severity,
            status: 'OPEN',
            title: cleanTitle,
            description: cleanDescription,
            impact: cleanImpact,
            actionTaken: cleanActionTaken,
            relatedRequestId: payload.relatedRequestId,
            relatedUrl: payload.relatedUrl,
            assignedToUserId: payload.assignedToUserId,
            knowledgeArticleId: payload.knowledgeArticleId || null,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: payload.companyId,
            userId: request.user.sub,
            action: 'PILOT_FEEDBACK_CREATED',
            entity: 'PilotFeedback',
            entityId: item.id,
            metadata: {
              title: cleanTitle,
              category: payload.category,
              severity: payload.severity,
              executorEmail: request.user.email,
            },
          },
        });

        return item;
      });

      // Fire-and-forget platform notification for critical feedback
      if (payload.severity === 'CRITICAL') {
        try {
          await NotificationCenterService.createOrUpdateByDedupeKey({
            companyId: null,
            role: null,
            type: 'CRITICAL_PILOT_FEEDBACK',
            severity: NotificationSeverity.CRITICAL,
            title: 'Feedback crítico de piloto recebido',
            message: `Um feedback crítico foi registrado para o piloto. Revisão imediata recomendada.`,
            actionUrl: `/app/admin/pilots`,
            entityType: 'PilotFeedback',
            entityId: feedback.id,
            dedupeKey: `feedback:${feedback.id}:critical`,
            metadata: { feedbackId: feedback.id },
          });
        } catch (_err) {
          // silent
        }
      }

      return reply.status(201).send({
        success: true,
        data: feedback,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao criar feedback do piloto.',
        },
      });
    }
  });

  // PATCH /api/admin/pilot-feedback/:id
  fastify.patch('/admin/pilot-feedback/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const bodyResult = updateFeedbackSchema.safeParse(request.body);
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

      const current = await prisma.pilotFeedback.findUnique({ where: { id } });
      if (!current) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Item de feedback não encontrado.' },
        });
      }

      // Check if status is turning to resolved
      const resolvedAt = payload.status === 'RESOLVED' && current.status !== 'RESOLVED'
        ? new Date()
        : (payload.status !== undefined && payload.status !== 'RESOLVED' ? null : current.resolvedAt);

      const cleanActionTaken = payload.actionTaken !== undefined
        ? maskCPF(sanitizeInputString(payload.actionTaken, 2000))
        : current.actionTaken;

      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.pilotFeedback.update({
          where: { id },
          data: {
            ...(payload.status && { status: payload.status }),
            ...(payload.severity && { severity: payload.severity }),
            ...(payload.assignedToUserId !== undefined && { assignedToUserId: payload.assignedToUserId }),
            ...(payload.knowledgeArticleId !== undefined && { knowledgeArticleId: payload.knowledgeArticleId }),
            actionTaken: cleanActionTaken,
            resolvedAt,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: current.companyId,
            userId: request.user.sub,
            action: 'PILOT_FEEDBACK_UPDATED',
            entity: 'PilotFeedback',
            entityId: id,
            metadata: {
              previousStatus: current.status,
              newStatus: payload.status || current.status,
              previousSeverity: current.severity,
              newSeverity: payload.severity || current.severity,
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
          message: err.message || 'Erro ao atualizar feedback.',
        },
      });
    }
  });
}

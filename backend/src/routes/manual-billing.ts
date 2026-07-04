import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { CustomerSuccessService } from '../services/customer-success.service';

// Helper to sanitize inputs and prevent script/HTML injection
function sanitizeInputString(str: string | null | undefined, maxLength = 255): string | null {
  if (!str) return null;
  const clean = str.replace(/<[^>]*>?/gm, '').trim();
  return clean.substring(0, maxLength);
}

// Effective billing status resolver (dynamic OVERDUE)
function getEffectiveBillingStatus(billingStatus: string, nextBillingAt: Date | null): string {
  if (billingStatus === 'CANCELED') {
    return 'CANCELED';
  }
  if (nextBillingAt && nextBillingAt < new Date() && (billingStatus === 'ACTIVE' || billingStatus === 'PAYMENT_PENDING')) {
    return 'OVERDUE';
  }
  return billingStatus;
}

const billingStatusEnum = z.enum(['TRIAL', 'ACTIVE', 'PAYMENT_PENDING', 'OVERDUE', 'CANCELED']);
const billingCycleEnum = z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']);

const patchBillingSchema = z.object({
  billingStatus: billingStatusEnum.optional(),
  contractedAmountCents: z.number().int('O valor contratado deve ser um número inteiro.').nonnegative('O valor contratado não pode ser negativo.').max(100000000, 'O valor contratado não pode exceder R$ 1.000.000,00.').optional(),
  billingCycle: billingCycleEnum.optional(),
  contractSentAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  contractSignedAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  subscriptionStartedAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  nextBillingAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  canceledAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  cancellationReason: z.string().max(1000, 'A justificativa de cancelamento deve ter no máximo 1000 caracteres.').optional().nullable(),
  financeNotes: z.string().max(5000, 'As notas financeiras devem ter no máximo 5000 caracteres.').optional().nullable(),
});

export default async function manualBillingRoutes(fastify: FastifyInstance) {
  // Require SUPER_ADMIN role for all operations
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/billing/accounts
  fastify.get('/admin/billing/accounts', async (request, reply) => {
    try {
      const { billingStatus, effectiveBillingStatus, plan, overdue, search, page, pageSize } = request.query as {
        billingStatus?: string;
        effectiveBillingStatus?: string;
        plan?: string;
        overdue?: string;
        search?: string;
        page?: string;
        pageSize?: string;
      };

      const parsedPage = page ? parseInt(page, 10) : 1;
      const parsedPageSize = pageSize ? parseInt(pageSize, 10) : 10;
      const skip = (parsedPage - 1) * parsedPageSize;

      const now = new Date();
      const where: any = {};

      if (effectiveBillingStatus) {
        if (effectiveBillingStatus === 'OVERDUE') {
          where.OR = [
            { billingStatus: 'OVERDUE' },
            {
              billingStatus: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
              nextBillingAt: { lt: now }
            }
          ];
        } else if (effectiveBillingStatus === 'ACTIVE') {
          where.billingStatus = 'ACTIVE';
          where.OR = [
            { nextBillingAt: { gte: now } },
            { nextBillingAt: null }
          ];
        } else if (effectiveBillingStatus === 'PAYMENT_PENDING') {
          where.billingStatus = 'PAYMENT_PENDING';
          where.OR = [
            { nextBillingAt: { gte: now } },
            { nextBillingAt: null }
          ];
        } else {
          where.billingStatus = effectiveBillingStatus;
        }
      } else if (billingStatus) {
        where.billingStatus = billingStatus;
      }

      if (overdue === 'true' || overdue === '1') {
        where.OR = [
          { billingStatus: 'OVERDUE' },
          {
            billingStatus: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
            nextBillingAt: { lt: now }
          }
        ];
      }

      if (plan) {
        where.plan = {
          code: { contains: plan, mode: 'insensitive' }
        };
      }

      if (search) {
        where.company = {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { legalName: { contains: search, mode: 'insensitive' } },
          ]
        };
      }

      // Calculate global manual billing KPIs
      const activeSubscriptions = await prisma.companySubscription.count({
        where: { billingStatus: 'ACTIVE' }
      });
      const paymentPendingSubscriptions = await prisma.companySubscription.count({
        where: { billingStatus: 'PAYMENT_PENDING' }
      });
      const overdueSubscriptions = await prisma.companySubscription.count({
        where: {
          OR: [
            { billingStatus: 'OVERDUE' },
            {
              billingStatus: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
              nextBillingAt: { lt: now }
            }
          ]
        }
      });
      const canceledSubscriptions = await prisma.companySubscription.count({
        where: { billingStatus: 'CANCELED' }
      });

      // Calculate Monthly Contracted Revenue (MRR) - Somar apenas ACTIVE ou PAYMENT_PENDING. Ignorar TRIAL e CANCELED.
      const allActiveOrPending = await prisma.companySubscription.findMany({
        where: {
          billingStatus: { in: ['ACTIVE', 'PAYMENT_PENDING'] }
        },
        select: {
          contractedAmountCents: true,
          billingCycle: true
        }
      });

      let monthlyContractedRevenueCents = 0;
      for (const sub of allActiveOrPending) {
        const amount = sub.contractedAmountCents || 0;
        if (sub.billingCycle === 'MONTHLY') {
          monthlyContractedRevenueCents += amount;
        } else if (sub.billingCycle === 'QUARTERLY') {
          monthlyContractedRevenueCents += Math.round(amount / 3);
        } else if (sub.billingCycle === 'YEARLY') {
          monthlyContractedRevenueCents += Math.round(amount / 12);
        }
      }

      // Fetch list applying pagination
      const total = await prisma.companySubscription.count({ where });
      const subscriptions = await prisma.companySubscription.findMany({
        where,
        skip,
        take: parsedPageSize,
        include: {
          company: true,
          plan: true,
        },
        orderBy: { company: { name: 'asc' } }
      });

      const items = [];
      for (const sub of subscriptions) {
        const healthData = await CustomerSuccessService.calculateCompanyHealth(sub.companyId);
        
        const monthlyEquivalentCents = sub.billingCycle === 'MONTHLY'
          ? sub.contractedAmountCents
          : sub.billingCycle === 'QUARTERLY'
          ? Math.round(sub.contractedAmountCents / 3)
          : Math.round(sub.contractedAmountCents / 12);

        items.push({
          companyId: sub.companyId,
          companyName: sub.company.name,
          plan: sub.plan.name,
          billingStatus: sub.billingStatus,
          effectiveBillingStatus: getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt),
          contractedAmountCents: sub.contractedAmountCents,
          billingCycle: sub.billingCycle,
          monthlyEquivalentCents,
          nextBillingAt: sub.nextBillingAt?.toISOString() || null,
          contractSigned: !!sub.contractSignedAt,
          healthScore: healthData.healthScore,
          healthStatus: healthData.status
        });
      }

      return reply.status(200).send({
        success: true,
        items,
        total,
        page: parsedPage,
        pageSize: parsedPageSize,
        kpis: {
          activeSubscriptions,
          paymentPendingSubscriptions,
          overdueSubscriptions,
          canceledSubscriptions,
          monthlyContractedRevenueCents
        }
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar contas de faturamento.',
        }
      });
    }
  });

  // GET /api/admin/billing/accounts/:companyId
  fastify.get('/admin/billing/accounts/:companyId', async (request, reply) => {
    try {
      const { companyId } = request.params as { companyId: string };

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          subscription: {
            include: { plan: true }
          }
        }
      });

      if (!company) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Empresa não encontrada.',
          }
        });
      }

      const healthData = await CustomerSuccessService.calculateCompanyHealth(companyId);
      const sub = company.subscription;
      const effectiveBillingStatus = sub ? getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt) : 'TRIAL';

      return reply.status(200).send({
        success: true,
        data: {
          companyId: company.id,
          companyName: company.name,
          legalName: company.legalName,
          cnpj: company.cnpj,
          plan: sub ? sub.plan.name : 'Starter',
          billingStatus: sub ? sub.billingStatus : 'TRIAL',
          effectiveBillingStatus: sub ? effectiveBillingStatus : 'TRIAL',
          contractedAmountCents: sub ? sub.contractedAmountCents : 0,
          billingCycle: sub ? sub.billingCycle : 'MONTHLY',
          contractSentAt: sub ? (sub.contractSentAt?.toISOString() || null) : null,
          contractSignedAt: sub ? (sub.contractSignedAt?.toISOString() || null) : null,
          subscriptionStartedAt: sub ? (sub.subscriptionStartedAt?.toISOString() || null) : null,
          nextBillingAt: sub ? (sub.nextBillingAt?.toISOString() || null) : null,
          canceledAt: sub ? (sub.canceledAt?.toISOString() || null) : null,
          cancellationReason: sub ? sub.cancellationReason : null,
          financeNotes: sub ? sub.financeNotes : null,
          healthScore: healthData.healthScore,
          healthStatus: healthData.status,
          responseRate7d: healthData.adoptionMetrics.responseRate7d,
          lastActivityAt: healthData.adoptionMetrics.lastActivityAt || null
        }
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar detalhes do faturamento.',
        }
      });
    }
  });

  // PATCH /api/admin/billing/accounts/:companyId
  fastify.patch('/admin/billing/accounts/:companyId', async (request, reply) => {
    try {
      const { companyId } = request.params as { companyId: string };
      const bodyResult = patchBillingSchema.safeParse(request.body || {});

      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: bodyResult.error.errors[0]?.message || 'Dados inválidos.',
          }
        });
      }

      const body = bodyResult.data;

      // Find or create subscription on-demand
      let currentSub = await prisma.companySubscription.findUnique({
        where: { companyId }
      });

      if (!currentSub) {
        // Resolve a default or starter plan
        let plan = await prisma.plan.findFirst({
          where: { code: 'STARTER' }
        });
        if (!plan) {
          plan = await prisma.plan.findFirst();
        }
        if (!plan) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'PLAN_REQUIRED',
              message: 'Não há planos cadastrados no sistema para inicializar a assinatura.',
            }
          });
        }

        currentSub = await prisma.companySubscription.create({
          data: {
            companyId,
            planId: plan.id,
            status: 'ACTIVE',
            billingStatus: 'TRIAL',
            contractedAmountCents: 0,
            billingCycle: 'MONTHLY'
          }
        });
      }

      // Check dates alignment: contractSignedAt >= contractSentAt
      const sentAt = body.contractSentAt !== undefined ? body.contractSentAt : currentSub.contractSentAt;
      const signedAt = body.contractSignedAt !== undefined ? body.contractSignedAt : currentSub.contractSignedAt;
      const startedAt = body.subscriptionStartedAt !== undefined ? body.subscriptionStartedAt : currentSub.subscriptionStartedAt;

      if (sentAt && signedAt && new Date(signedAt) < new Date(sentAt)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A data de assinatura do contrato não pode ser anterior à data de envio.',
          }
        });
      }

      // Check dates alignment: subscriptionStartedAt >= contractSignedAt
      if (signedAt && startedAt && new Date(startedAt) < new Date(signedAt)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A data de início da assinatura não pode ser anterior à data de assinatura do contrato.',
          }
        });
      }

      // Check cancellation reason
      if (body.billingStatus === 'CANCELED') {
        if (!body.cancellationReason || !body.cancellationReason.trim()) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'O motivo de cancelamento é obrigatório para assinaturas canceladas.',
            }
          });
        }
      }

      // Adjust dates and cancellation fields based on status change
      let finalCanceledAt = body.canceledAt !== undefined ? body.canceledAt : currentSub.canceledAt;
      let finalCancellationReason = body.cancellationReason !== undefined ? body.cancellationReason : currentSub.cancellationReason;

      if (body.billingStatus === 'CANCELED') {
        if (!finalCanceledAt && !currentSub.canceledAt) {
          finalCanceledAt = new Date();
        }
      } else if (body.billingStatus) {
        // Clear cancellation reason and date if reactivating (ACTIVE, TRIAL, PAYMENT_PENDING)
        finalCancellationReason = null;
        finalCanceledAt = null;
      }

      // Check dates alignment: canceledAt >= subscriptionStartedAt
      if (startedAt && finalCanceledAt && new Date(finalCanceledAt) < new Date(startedAt)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A data de cancelamento não pode ser anterior à data de início da assinatura.',
          }
        });
      }

      // Sanitize inputs
      const sanitizedNotes = body.financeNotes !== undefined ? sanitizeInputString(body.financeNotes, 5000) : currentSub.financeNotes;
      const sanitizedReason = finalCancellationReason !== undefined ? sanitizeInputString(finalCancellationReason, 1000) : currentSub.cancellationReason;

      // Update fields
      const updatedSub = await prisma.companySubscription.update({
        where: { companyId },
        data: {
          billingStatus: body.billingStatus || undefined,
          contractedAmountCents: body.contractedAmountCents !== undefined ? body.contractedAmountCents : undefined,
          billingCycle: body.billingCycle || undefined,
          contractSentAt: body.contractSentAt !== undefined ? body.contractSentAt : undefined,
          contractSignedAt: body.contractSignedAt !== undefined ? body.contractSignedAt : undefined,
          subscriptionStartedAt: body.subscriptionStartedAt !== undefined ? body.subscriptionStartedAt : undefined,
          nextBillingAt: body.nextBillingAt !== undefined ? body.nextBillingAt : undefined,
          canceledAt: finalCanceledAt,
          cancellationReason: sanitizedReason,
          financeNotes: sanitizedNotes,
        }
      });

      // Audit Logging
      const changedFields: string[] = [];
      const before: any = {};
      const after: any = {};

      const fieldsToTrack = [
        'billingStatus',
        'contractedAmountCents',
        'billingCycle',
        'contractSentAt',
        'contractSignedAt',
        'subscriptionStartedAt',
        'nextBillingAt',
        'canceledAt'
      ];

      for (const field of fieldsToTrack) {
        const valBefore = (currentSub as any)[field];
        const valAfter = (updatedSub as any)[field];
        
        const timeBefore = valBefore instanceof Date ? valBefore.getTime() : valBefore;
        const timeAfter = valAfter instanceof Date ? valAfter.getTime() : valAfter;

        if (timeBefore !== timeAfter) {
          changedFields.push(field);
          before[field] = valBefore instanceof Date ? valBefore.toISOString() : valBefore;
          after[field] = valAfter instanceof Date ? valAfter.toISOString() : valAfter;
        }
      }

      if (currentSub.financeNotes !== updatedSub.financeNotes) {
        changedFields.push('financeNotes');
        before.financeNotesChanged = currentSub.financeNotes ? true : false;
        after.financeNotesChanged = updatedSub.financeNotes ? true : false;
      }

      if (currentSub.cancellationReason !== updatedSub.cancellationReason) {
        changedFields.push('cancellationReason');
        before.cancellationReasonChanged = currentSub.cancellationReason ? true : false;
        after.cancellationReasonChanged = updatedSub.cancellationReason ? true : false;
      }

      if (changedFields.length > 0) {
        await prisma.auditLog.create({
          data: {
            companyId,
            userId: request.user.sub,
            action: 'BILLING_ACCOUNT_UPDATED',
            entity: 'CompanySubscription',
            entityId: currentSub.id,
            metadata: {
              companyId,
              changedFields,
              before,
              after
            }
          }
        });
      }

      return reply.status(200).send({
        success: true,
        data: {
          id: updatedSub.id,
          companyId: updatedSub.companyId,
          billingStatus: updatedSub.billingStatus,
          effectiveBillingStatus: getEffectiveBillingStatus(updatedSub.billingStatus, updatedSub.nextBillingAt),
          contractedAmountCents: updatedSub.contractedAmountCents,
          billingCycle: updatedSub.billingCycle,
          contractSentAt: updatedSub.contractSentAt?.toISOString() || null,
          contractSignedAt: updatedSub.contractSignedAt?.toISOString() || null,
          subscriptionStartedAt: updatedSub.subscriptionStartedAt?.toISOString() || null,
          nextBillingAt: updatedSub.nextBillingAt?.toISOString() || null,
          canceledAt: updatedSub.canceledAt?.toISOString() || null,
          cancellationReason: updatedSub.cancellationReason,
          financeNotes: updatedSub.financeNotes
        }
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao atualizar faturamento da empresa.',
        }
      });
    }
  });
}

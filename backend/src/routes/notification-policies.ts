import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import {
  createPolicySchema,
  updatePolicySchema,
  testPolicySchema,
} from '../modules/notification-engine/notification-engine.schemas';
import { NotificationPolicyService } from '../modules/notification-engine/notification-policy.service';
import { NotificationAudienceService } from '../modules/notification-engine/notification-audience.service';
import { EVENT_CATALOG } from '../modules/notification-engine/notification-engine.types';

export default async function notificationPoliciesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/notification-policies/event-catalog — lists eventTypes that can actually be
  // configured (ACTIVE only). ACTIVE_LEGACY/RESERVED are omitted: a policy for them would
  // never fire, since nothing in the codebase calls processDomainEvent for those yet.
  fastify.get('/notification-policies/event-catalog', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (_request, reply) => {
    const activeEvents = Object.values(EVENT_CATALOG).filter((e) => e.status === 'ACTIVE');
    return reply.status(200).send({ success: true, data: activeEvents });
  });

  // GET /api/notification-policies
  fastify.get('/notification-policies', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;
    const policies = await prisma.notificationPolicy.findMany({
      where: { companyId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.status(200).send({ success: true, data: policies });
  });

  // GET /api/notification-policies/:id
  fastify.get('/notification-policies/:id', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };
    const policy = await prisma.notificationPolicy.findFirst({
      where: { id, companyId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!policy) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Política não encontrada.' } });
    }
    return reply.status(200).send({ success: true, data: policy });
  });

  // POST /api/notification-policies
  fastify.post('/notification-policies', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId, sub: userId } = request.user;

    const parsed = createPolicySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Dados inválidos.' } });
    }

    const stepErrors = await NotificationPolicyService.validateSteps(companyId, parsed.data.steps);
    if (stepErrors.length > 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: stepErrors.join(' ') } });
    }

    const policy = await prisma.notificationPolicy.create({
      data: {
        companyId,
        name: parsed.data.name,
        eventType: parsed.data.eventType,
        priority: parsed.data.priority,
        acknowledgmentRequired: parsed.data.acknowledgmentRequired,
        acknowledgmentTimeoutMinutes: parsed.data.acknowledgmentTimeoutMinutes ?? null,
        maxEscalationLevel: parsed.data.maxEscalationLevel,
        quietHoursBehavior: parsed.data.quietHoursBehavior,
        createdById: userId,
        steps: {
          create: parsed.data.steps.map((step) => ({
            stepOrder: step.stepOrder,
            delayMinutes: step.delayMinutes,
            recipientType: step.recipientType,
            recipientReference: step.recipientReference ?? null,
            channels: step.channels,
            fallbackMode: step.fallbackMode,
            stopOnAcknowledgment: step.stopOnAcknowledgment,
            stopOnResolution: step.stopOnResolution,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    return reply.status(201).send({ success: true, data: policy });
  });

  // PATCH /api/notification-policies/:id
  fastify.patch('/notification-policies/:id', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const existing = await prisma.notificationPolicy.findFirst({ where: { id, companyId } });
    if (!existing) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Política não encontrada.' } });
    }

    const parsed = updatePolicySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Dados inválidos.' } });
    }

    if (parsed.data.steps) {
      const stepErrors = await NotificationPolicyService.validateSteps(companyId, parsed.data.steps);
      if (stepErrors.length > 0) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: stepErrors.join(' ') } });
      }
    }

    const policy = await prisma.$transaction(async (tx) => {
      if (parsed.data.steps) {
        await tx.notificationPolicyStep.deleteMany({ where: { policyId: id } });
        await tx.notificationPolicyStep.createMany({
          data: parsed.data.steps.map((step) => ({
            policyId: id,
            stepOrder: step.stepOrder,
            delayMinutes: step.delayMinutes,
            recipientType: step.recipientType,
            recipientReference: step.recipientReference ?? null,
            channels: step.channels,
            fallbackMode: step.fallbackMode,
            stopOnAcknowledgment: step.stopOnAcknowledgment,
            stopOnResolution: step.stopOnResolution,
          })),
        });
      }

      return tx.notificationPolicy.update({
        where: { id },
        data: {
          name: parsed.data.name,
          eventType: parsed.data.eventType,
          priority: parsed.data.priority,
          acknowledgmentRequired: parsed.data.acknowledgmentRequired,
          acknowledgmentTimeoutMinutes: parsed.data.acknowledgmentTimeoutMinutes,
          maxEscalationLevel: parsed.data.maxEscalationLevel,
          quietHoursBehavior: parsed.data.quietHoursBehavior,
          isActive: parsed.data.isActive,
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    });

    return reply.status(200).send({ success: true, data: policy });
  });

  // DELETE /api/notification-policies/:id — soft disable, never a hard delete.
  fastify.delete('/notification-policies/:id', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const existing = await prisma.notificationPolicy.findFirst({ where: { id, companyId } });
    if (!existing) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Política não encontrada.' } });
    }

    await prisma.notificationPolicy.update({ where: { id }, data: { isActive: false } });
    return reply.status(200).send({ success: true, data: { disabled: true } });
  });

  // POST /api/notification-policies/:id/test — safe dry-run only, never sends a real message.
  fastify.post('/notification-policies/:id/test', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const parsed = testPolicySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'dryRun=true é obrigatório.' } });
    }

    const policy = await prisma.notificationPolicy.findFirst({
      where: { id, companyId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!policy) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Política não encontrada.' } });
    }

    const context = parsed.data.context ?? {};
    const warnings: string[] = [];
    const catalogEntry = EVENT_CATALOG[policy.eventType];
    if (!catalogEntry) warnings.push(`eventType "${policy.eventType}" não está no catálogo de eventos.`);
    else if (catalogEntry.status !== 'ACTIVE') warnings.push(`eventType "${policy.eventType}" está classificado como ${catalogEntry.status}, não ACTIVE — esta política nunca será disparada automaticamente.`);

    const stepsPreview = [];
    for (const step of policy.steps) {
      const recipients = await NotificationAudienceService.resolve(companyId, step.recipientType, step.recipientReference, context);
      const unresolved = recipients.filter((r) => r.skipReasonCode);
      if (unresolved.length > 0) warnings.push(`Step ${step.stepOrder}: ${unresolved.length} destinatário(s) não resolvido(s) (${unresolved[0].skipReasonCode}).`);

      stepsPreview.push({
        stepOrder: step.stepOrder,
        delayMinutes: step.delayMinutes,
        recipientType: step.recipientType,
        channels: step.channels,
        fallbackMode: step.fallbackMode,
        resolvedRecipientCount: recipients.filter((r) => !r.skipReasonCode).length,
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        dryRun: true,
        eventType: policy.eventType,
        priority: policy.priority,
        steps: stepsPreview,
        warnings,
      },
    });
  });
}

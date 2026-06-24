import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { OccurrenceService } from '../services/occurrence.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { requireRole } from '../lib/auth-middleware';
import { OccurrenceType, OccurrenceSource } from '@prisma/client';
import { RemoteCheckinService } from '../services/remote-checkin.service';
import { CompanySettingsService } from '../services/company-settings.service';
import { PlanLimitsService } from '../services/plan-limits.service';
import { UsageService } from '../services/usage.service';



const runAutomationSchema = z.object({
  employeeId: z.string().uuid('ID de funcionário inválido'),
});

const runBatchSchema = z.object({
  workModel: z.string().optional(),
  workScheduleId: z.string().uuid().optional(),
  sector: z.string().optional(),
  managerUserId: z.string().uuid().optional(),
});

const markNotRespondedSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (deve ser YYYY-MM-DD)').optional(),
  graceMinutes: z.number().int().nonnegative().optional(),
});

export default async function automationsRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication and restrict to ADMIN or HR for testing triggers
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['ADMIN', 'HR']));

  // POST /api/automations/missed-clock-in/run
  fastify.post('/automations/missed-clock-in/run', async (request, reply) => {
    const { companyId } = request.user;

    const bodyResult = runAutomationSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: bodyResult.error.errors,
        },
      });
    }

    const { employeeId } = bodyResult.data;

    // Find employee and check if belongs to user's company
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, status: 'ACTIVE' },
    });

    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Funcionário ativo não encontrado nesta empresa.',
        },
      });
    }

    // Call centralized OccurrenceService to create MISSED_CLOCK_IN occurrence
    const { occurrence, isDuplicate } = await OccurrenceService.createOccurrence({
      companyId,
      employeeId,
      type: OccurrenceType.MISSED_CLOCK_IN,
      title: 'Ponto não registrado - Entrada',
      description: 'Gatilho automático de verificação de jornada (entrada ausente).',
      occurrenceDate: new Date(),
      source: OccurrenceSource.AUTOMATION,
      severity: 'LOW',
      managerUserId: employee.managerUserId || undefined,
    });

    // If it was NOT a duplicate, send the WhatsApp outbound notification
    if (!isDuplicate) {
      const messageText = `Prezado(a) ${employee.fullName}, notamos que você não registrou seu ponto de entrada hoje. Por favor, responda a esta mensagem justificando.`;
      
      // WhatsAppService will send message and create WHATSAPP_OUTBOUND_SENT event in occurrence timeline
      await WhatsAppService.sendMessage({
        to: employee.whatsapp,
        message: messageText,
        occurrenceId: occurrence.id,
        companyId,
      });
    }

    return reply.status(isDuplicate ? 200 : 201).send({
      success: true,
      data: occurrence,
      isDuplicate,
    });
  });

  // POST /api/automations/remote-checkin/run (Only ADMIN/HR)
  fastify.post('/automations/remote-checkin/run', async (request, reply) => {
    const { companyId } = request.user;

    const settings = await CompanySettingsService.getOrCreateSettings(companyId);
    if (!settings.enableRemoteCheckin) {
      return reply.status(403).send({
        error: 'FEATURE_DISABLED',
        message: 'Este recurso está desativado nas configurações da empresa.',
      });
    }

    try {
      await PlanLimitsService.assertCanRunCheckin(companyId, 1);
    } catch (err: any) {
      if (err.message === 'PLAN_LIMIT_EXCEEDED') {
        return reply.status(403).send({
          error: 'PLAN_LIMIT_EXCEEDED',
          message: 'Limite do plano atingido.',
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao verificar limites do plano.',
        },
      });
    }

    const bodyResult = runAutomationSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: bodyResult.error.errors,
        },
      });
    }

    const { employeeId } = bodyResult.data;

    // Find active employee
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, status: 'ACTIVE' },
      include: { workSchedule: true },
    });

    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Funcionário ativo não encontrado nesta empresa.',
        },
      });
    }

    // Call service to check duplicate and create check-in request
    const { checkin, isDuplicate } = await RemoteCheckinService.createCheckin({
      companyId,
      employeeId,
      workScheduleId: employee.workScheduleId || undefined,
      expectedAt: employee.workSchedule ? new Date() : undefined,
    });

    if (!isDuplicate) {
      await UsageService.incrementUsage(companyId, 'remote_checkins', 1);

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      const checkinFallback = `Bom dia, {{employeeName}}. Você já iniciou sua jornada remota hoje?\n\n1. Sim, iniciei agora\n2. Vou iniciar mais tarde\n3. Estou com problema técnico\n4. Vou faltar\n5. Estou de atestado`;
      const messageText = RemoteCheckinService.formatMessage(
        settings.whatsappCheckinMessage,
        checkinFallback,
        {
          employeeName: employee.fullName,
          companyName: company?.name || '',
          date: new Date().toLocaleDateString('pt-BR'),
        }
      );

      if (messageText && messageText.trim() !== '') {
        // Simulate sending WhatsApp message
        await WhatsAppService.sendMessage({
          to: employee.whatsapp,
          message: messageText,
          companyId,
        });
      }
    }

    return reply.status(isDuplicate ? 200 : 201).send({
      success: true,
      data: checkin,
      isDuplicate,
    });
  });

  // POST /api/automations/remote-checkin/run-batch (Only ADMIN/HR)
  fastify.post('/automations/remote-checkin/run-batch', async (request, reply) => {
    const { companyId } = request.user;

    const settings = await CompanySettingsService.getOrCreateSettings(companyId);
    if (!settings.enableBatchCheckin) {
      return reply.status(403).send({
        error: 'FEATURE_DISABLED',
        message: 'Este recurso está desativado nas configurações da empresa.',
      });
    }

    try {
      const sub = await PlanLimitsService.getCurrentSubscription(companyId);
      if (!sub.plan.enableBatchCheckin) {
        return reply.status(403).send({
          error: 'PLAN_FEATURE_DISABLED',
          message: 'Este recurso não está disponível no plano atual.',
        });
      }
    } catch (err) {}

    const bodyResult = runBatchSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Filtros de lote inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const filters = bodyResult.data;

    try {
      const result = await RemoteCheckinService.createCheckinBatch(filters, companyId);
      return reply.status(200).send({
        success: true,
        ...result,
      });
    } catch (err: any) {
      if (err.message === 'PLAN_LIMIT_EXCEEDED') {
        return reply.status(403).send({
          error: 'PLAN_LIMIT_EXCEEDED',
          message: 'Limite do plano atingido.',
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao processar check-in em lote.',
        },
      });
    }
  });

  // POST /api/automations/remote-checkin/mark-not-responded (Only ADMIN/HR)
  fastify.post('/automations/remote-checkin/mark-not-responded', async (request, reply) => {
    const { companyId } = request.user;

    const bodyResult = markNotRespondedSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de marcação de não-resposta inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const { date, graceMinutes } = bodyResult.data;

    try {
      const result = await RemoteCheckinService.markNotResponded(date, graceMinutes, companyId);
      return reply.status(200).send({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao marcar check-ins vencidos sem resposta.',
        },
      });
    }
  });
}

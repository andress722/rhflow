import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CompanySettingsService } from '../services/company-settings.service';
import { requireRole } from '../lib/auth-middleware';

const settingsUpdateSchema = z.object({
  defaultCheckinGraceMinutes: z.number().int().min(5, 'A tolerância deve ser de no mínimo 5 minutos').max(240, 'A tolerância deve ser de no máximo 240 minutos').optional(),
  defaultCheckinSendTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Horário de envio deve estar no formato HH:mm').nullable().optional(),
  allowManagerExport: z.boolean().optional(),
  allowViewerReports: z.boolean().optional(),
  enableRemoteCheckin: z.boolean().optional(),
  enableBatchCheckin: z.boolean().optional(),
  enableMedicalCertificates: z.boolean().optional(),
  whatsappCheckinMessage: z.string().max(1000, 'Template de check-in não deve exceder 1000 caracteres').nullable().optional(),
  whatsappNotRespondedMessage: z.string().max(1000, 'Template de sem resposta não deve exceder 1000 caracteres').nullable().optional(),
  whatsappManagerAlertMessage: z.string().max(1000, 'Template de alerta ao gestor não deve exceder 1000 caracteres').nullable().optional(),
}).strict();

export default async function companySettingsRoutes(fastify: FastifyInstance) {
  // Apply authentication and restrict to ADMIN and HR
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['ADMIN', 'HR']));

  // GET /api/company-settings
  fastify.get('/company-settings', async (request, reply) => {
    const { companyId } = request.user;

    try {
      const settings = await CompanySettingsService.getOrCreateSettings(companyId);
      return reply.status(200).send({
        success: true,
        data: settings,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar configurações da empresa.',
        },
      });
    }
  });

  // PATCH /api/company-settings
  fastify.patch('/company-settings', async (request, reply) => {
    const { companyId, sub } = request.user;

    const bodyResult = settingsUpdateSchema.safeParse(request.body);
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

    try {
      const updated = await CompanySettingsService.updateSettings(
        companyId,
        bodyResult.data,
        sub
      );

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao atualizar configurações da empresa.',
        },
      });
    }
  });
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReportsService } from '../services/reports.service';
import { requireRole } from '../lib/auth-middleware';
import { CompanySettingsService } from '../services/company-settings.service';
import { PlanLimitsService } from '../services/plan-limits.service';
import { UsageService } from '../services/usage.service';


const reportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida (deve ser YYYY-MM-DD)'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida (deve ser YYYY-MM-DD)'),
  employeeId: z.string().uuid().optional(),
  managerUserId: z.string().uuid().optional(),
  sector: z.string().optional(),
  occurrenceType: z.string().optional(),
  status: z.string().optional(),
  workModel: z.enum(['PRESENTIAL', 'REMOTE', 'HYBRID']).optional(),
});

export default async function reportsRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication globally for reports routes
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/reports/operational
  fastify.get('/reports/operational', async (request, reply) => {
    const { companyId, role, sub } = request.user;

    const settings = await CompanySettingsService.getOrCreateSettings(companyId);
    if (role === 'VIEWER' && !settings.allowViewerReports) {
      return reply.status(403).send({
        error: 'FEATURE_DISABLED',
        message: 'Este recurso está desativado nas configurações da empresa.',
      });
    }

    const planSub = await PlanLimitsService.getCurrentSubscription(companyId);
    if (!planSub.plan.enableReports) {
      return reply.status(403).send({
        error: 'PLAN_FEATURE_DISABLED',
        message: 'Este recurso não está disponível no plano atual.',
      });
    }

    const parsed = reportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos.',
          details: parsed.error.errors,
        },
      });
    }

    const { from, to, employeeId, managerUserId, sector, occurrenceType, status, workModel } = parsed.data;

    try {
      const report = await ReportsService.getOperationalReport({
        companyId,
        role,
        sub,
        from,
        to,
        employeeId,
        managerUserId,
        sector,
        occurrenceType,
        status,
        workModel,
      });

      return reply.status(200).send({
        success: true,
        data: report,
      });
    } catch (err: any) {
      if (err.message === 'LIMIT_EXCEEDED') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PERIOD',
            message: 'O período do relatório não pode exceder 90 dias.',
          },
        });
      }
      if (err.message === 'INVALID_PERIOD_ORDER') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PERIOD',
            message: 'A data inicial não pode ser maior que a data final.',
          },
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao gerar relatório operacional.',
        },
      });
    }
  });

  // GET /api/reports/closing-pendencies
  fastify.get('/reports/closing-pendencies', async (request, reply) => {
    const { companyId, role, sub } = request.user;

    const settings = await CompanySettingsService.getOrCreateSettings(companyId);
    if (role === 'VIEWER' && !settings.allowViewerReports) {
      return reply.status(403).send({
        error: 'FEATURE_DISABLED',
        message: 'Este recurso está desativado nas configurações da empresa.',
      });
    }

    const planSub = await PlanLimitsService.getCurrentSubscription(companyId);
    if (!planSub.plan.enableReports) {
      return reply.status(403).send({
        error: 'PLAN_FEATURE_DISABLED',
        message: 'Este recurso não está disponível no plano atual.',
      });
    }

    try {
      const pendencies = await ReportsService.getClosingPendencies(companyId, role, sub);

      return reply.status(200).send({
        success: true,
        data: pendencies,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao consultar pendências de fechamento.',
        },
      });
    }
  });

  // GET /api/reports/operational/export?format=csv
  fastify.get('/reports/operational/export', async (request, reply) => {
    const { companyId, role, sub } = request.user;

    const settings = await CompanySettingsService.getOrCreateSettings(companyId);

    // VIEWER cannot export reports
    if (role === 'VIEWER') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Visualizadores não possuem permissão para exportar relatórios.',
        },
      });
    }

    // MANAGER export check
    if (role === 'MANAGER' && !settings.allowManagerExport) {
      return reply.status(403).send({
        error: 'FEATURE_DISABLED',
        message: 'Este recurso está desativado nas configurações da empresa.',
      });
    }

    try {
      await PlanLimitsService.assertCanExportReport(companyId);
    } catch (err: any) {
      if (err.message === 'PLAN_FEATURE_DISABLED') {
        return reply.status(403).send({
          error: 'PLAN_FEATURE_DISABLED',
          message: 'Este recurso não está disponível no plano atual.',
        });
      }
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

    const parsed = reportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos.',
          details: parsed.error.errors,
        },
      });
    }

    const { from, to, employeeId, managerUserId, sector, occurrenceType, status, workModel } = parsed.data;

    try {
      const ip = request.ip;
      const userAgent = request.headers['user-agent'];

      const csv = await ReportsService.exportOperationalReport(
        {
          companyId,
          role,
          sub,
          from,
          to,
          employeeId,
          managerUserId,
          sector,
          occurrenceType,
          status,
          workModel,
        },
        ip,
        userAgent
      );

      // Set proper download headers
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename=relatorio_operacional.csv');

      await UsageService.incrementUsage(companyId, 'report_exports', 1);

      return reply.status(200).send(csv);
    } catch (err: any) {
      if (err.message === 'LIMIT_EXCEEDED') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PERIOD',
            message: 'O período de exportação não pode exceder 90 dias.',
          },
        });
      }
      if (err.message === 'INVALID_PERIOD_ORDER') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PERIOD',
            message: 'A data inicial não pode ser maior que a data final.',
          },
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao exportar relatório operacional.',
        },
      });
    }
  });
}

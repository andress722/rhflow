import { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/auth-middleware';
import { ExecutiveReportService } from '../services/executive-report.service';

export default async function executiveReportsRoutes(fastify: FastifyInstance) {
  // Require authentication for all routes in this plugin
  fastify.addHook('preHandler', fastify.authenticate);

  // 1. GET /api/admin/executive-reports/company/:companyId
  fastify.get(
    '/admin/executive-reports/company/:companyId',
    { preHandler: [requireRole(['SUPER_ADMIN'])] },
    async (request, reply) => {
      try {
        const { companyId } = request.params as { companyId: string };
        const { dateFrom, dateTo } = request.query as { dateFrom?: string; dateTo?: string };

        if (!dateFrom || !dateTo) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Parâmetros dateFrom e dateTo são obrigatórios.',
            },
          });
        }

        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Formatos de data inválidos. Use YYYY-MM-DD.',
            },
          });
        }

        if (fromDate > toDate) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'A data inicial (dateFrom) não pode ser maior que a data final (dateTo).',
            },
          });
        }

        const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 90) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_DATE_RANGE',
              message: 'O intervalo máximo permitido para o relatório executivo é de 90 dias.',
            },
          });
        }

        const data = await ExecutiveReportService.generateReport(companyId, fromDate, toDate, false);

        return reply.status(200).send({
          success: true,
          data,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao gerar relatório executivo de plataforma.',
          },
        });
      }
    }
  );

  // 2. GET /api/executive-reports/my-company
  fastify.get(
    '/executive-reports/my-company',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      try {
        const companyId = request.user?.companyId;

        if (!companyId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Usuário não está associado a nenhuma empresa.',
            },
          });
        }

        const { dateFrom, dateTo } = request.query as { dateFrom?: string; dateTo?: string };

        if (!dateFrom || !dateTo) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Parâmetros dateFrom e dateTo são obrigatórios.',
            },
          });
        }

        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Formatos de data inválidos. Use YYYY-MM-DD.',
            },
          });
        }

        if (fromDate > toDate) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'A data inicial (dateFrom) não pode ser maior que a data final (dateTo).',
            },
          });
        }

        const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 90) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_DATE_RANGE',
              message: 'O intervalo máximo permitido para o relatório executivo é de 90 dias.',
            },
          });
        }

        // isCorporate = true
        const data = await ExecutiveReportService.generateReport(companyId, fromDate, toDate, true);

        return reply.status(200).send({
          success: true,
          data,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao gerar relatório executivo corporativo.',
          },
        });
      }
    }
  );
}

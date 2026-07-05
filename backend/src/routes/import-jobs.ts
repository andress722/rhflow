import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { redis } from '../lib/redis';
import {
  parseCsvBuffer,
  parseXlsxBuffer,
  listXlsxSheets,
  ParsedFileResult,
} from '../lib/file-parser';
import { autoMapHeaders } from '../lib/auto-mapper';
import { ImportJobService } from '../services/import-job.service';

export default async function importJobsRoutes(fastify: FastifyInstance) {
  // Authentication hook
  fastify.addHook('preHandler', fastify.authenticate);

  // Apply HR and ADMIN role restrictions globally to this file
  fastify.addHook('preHandler', requireRole(['ADMIN', 'HR']));

  // 1. POST /api/import-jobs/upload - Safe upload and parse endpoint
  fastify.post('/import-jobs/upload', async (request, reply) => {
    const { companyId, sub } = request.user;

    if (!request.isMultipart()) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MULTIPART_REQUIRED', message: 'A requisição deve ser multipart/form-data.' },
      });
    }

    let part;
    try {
      part = await request.file({
        limits: {
          fileSize: 10 * 1024 * 1024, // Max size 10MB
        },
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: err.message || 'Erro ao carregar arquivo.' },
      });
    }

    if (!part) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'Nenhum arquivo enviado.' },
      });
    }

    const filename = part.filename;
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (ext !== 'csv' && ext !== 'xlsx') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FILE_TYPE', message: 'Apenas extensões .csv e .xlsx são suportadas.' },
      });
    }

    const fileBuffer = await part.toBuffer();
    
    // Check file size limits
    const maxCsvSize = 2 * 1024 * 1024; // 2MB
    const maxXlsxSize = 10 * 1024 * 1024; // 10MB
    if (ext === 'csv' && fileBuffer.length > maxCsvSize) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'O arquivo CSV excede o limite de tamanho permitido (2MB).' },
      });
    }
    if (ext === 'xlsx' && fileBuffer.length > maxXlsxSize) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'O arquivo XLSX excede o limite de tamanho permitido (10MB).' },
      });
    }

    // Safety check against malicious mime/magic bytes
    const isPkZip = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
    if (ext === 'xlsx' && !isPkZip) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MALFORMED_FILE', message: 'O arquivo XLSX está corrompido ou possui formato inválido.' },
      });
    }

    const sheetNameQuery = (request.query as any).sheetName || '';
    let sheets: string[] = [];
    let parsedResult: ParsedFileResult;
    const fileType = ext === 'csv' ? 'CSV' : 'XLSX';

    try {
      if (ext === 'csv') {
        parsedResult = parseCsvBuffer(fileBuffer, { maxRows: 5000 });
      } else {
        sheets = listXlsxSheets(fileBuffer);
        const selectedSheet = sheetNameQuery || sheets[0];
        parsedResult = parseXlsxBuffer(fileBuffer, { sheetName: selectedSheet, maxRows: 5000 });
      }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'PARSING_ERROR', message: err.message || 'Erro ao processar conteúdo do arquivo.' },
      });
    }

    if (parsedResult.totalRows === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'PARSING_ERROR', message: 'O arquivo enviado está vazio.' },
      });
    }

    if (parsedResult.totalRows > 5000) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ROW_LIMIT_EXCEEDED', message: 'O arquivo excede o limite máximo de 5000 linhas.' },
      });
    }

    // Create the ImportJob
    const job = await prisma.importJob.create({
      data: {
        companyId,
        createdByUserId: sub,
        originalFileName: filename,
        fileType,
        selectedWorksheet: fileType === 'XLSX' ? (sheetNameQuery || sheets[0]) : null,
        status: 'UPLOADED',
        totalRows: parsedResult.totalRows,
        parsedData: parsedResult.rows,
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        jobId: job.id,
        filename: job.originalFileName,
        fileType: job.fileType,
        totalRows: job.totalRows,
        availableWorksheets: sheets,
        selectedWorksheet: job.selectedWorksheet,
        preview: {
          headers: parsedResult.headers,
          rows: parsedResult.rows.slice(0, 10),
        },
      },
    });
  });

  // 2. GET /api/import-jobs/:jobId/worksheets - List sheets of XLSX
  fastify.get('/import-jobs/:jobId/worksheets', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        fileType: job.fileType,
        selectedWorksheet: job.selectedWorksheet,
      },
    });
  });

  // 3. GET /api/import-jobs/:jobId/preview - Preview the first 10 rows
  fastify.get('/import-jobs/:jobId/preview', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    const rows = (job.parsedData as any[]) || [];
    const headers = rows.length > 0 ? Object.keys(rows[0]).filter(k => k !== '__rowNum') : [];

    return reply.status(200).send({
      success: true,
      data: {
        headers,
        previewRows: rows.slice(0, 10),
        totalRows: job.totalRows,
      },
    });
  });

  // 4. POST /api/import-jobs/:jobId/auto-map - Suggest column mapping configurations
  fastify.post('/import-jobs/:jobId/auto-map', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    const rows = (job.parsedData as any[]) || [];
    const headers = rows.length > 0 ? Object.keys(rows[0]).filter(k => k !== '__rowNum') : [];
    const mappingSuggestion = autoMapHeaders(headers);

    return reply.status(200).send({
      success: true,
      data: {
        headers,
        suggestion: mappingSuggestion,
      },
    });
  });

  // 5. PUT /api/import-jobs/:jobId/mapping - Update mapping setup and run validate job
  fastify.put('/import-jobs/:jobId/mapping', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const schema = z.object({
      mappings: z.object({
        name: z.string(),
        cpf: z.string(),
        whatsapp: z.string(),
        email: z.string().optional().nullable(),
        sector: z.string().optional().nullable(),
        jobTitle: z.string().optional().nullable(),
        registrationNumber: z.string().optional().nullable(),
        workModel: z.string().optional().nullable(),
        managerUserId: z.string().optional().nullable(),
        workScheduleId: z.string().optional().nullable(),
      }),
      mappingTemplateId: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_MAPPINGS', message: 'Mapeamentos informados são inválidos.' },
      });
    }

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    // Update job with mapping configuration
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        mappings: parsed.data.mappings as any,
        mappingTemplateId: parsed.data.mappingTemplateId,
        status: 'VALIDATING',
      },
    });

    // Run validation immediately (writes issues to DB)
    await ImportJobService.validateJob(jobId);

    const updatedJob = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: {
        issues: {
          take: 100, // limit initial returned count for UI speed
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    return reply.status(200).send({
      success: true,
      data: {
        jobId: updatedJob?.id,
        status: updatedJob?.status,
        validRows: updatedJob?.validRows,
        invalidRows: updatedJob?.invalidRows,
        issuesCount: updatedJob?.invalidRows,
        issues: updatedJob?.issues,
      },
    });
  });

  // 6. POST /api/import-jobs/:jobId/confirm - Confirm mapping and queue for worker processing
  fastify.post('/import-jobs/:jobId/confirm', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const schema = z.object({
      mode: z.enum(['CREATE_ONLY', 'UPDATE_EXISTING', 'UPSERT']).default('CREATE_ONLY'),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_MODE', message: 'Modo de importação inválido.' },
      });
    }

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    if (job.status !== 'READY' && job.status !== 'MAPPING') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Mapeamento deve ser concluído e validado antes da confirmação.' },
      });
    }

    // Set job to QUEUED state
    const updatedJob = await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        mode: parsed.data.mode,
      },
    });

    // Queue in Redis for async worker execution
    await redis.rpush('rhflow:import:queue', jobId);

    return reply.status(200).send({
      success: true,
      data: {
        jobId: updatedJob.id,
        status: updatedJob.status,
        mode: updatedJob.mode,
      },
    });
  });

  // 7. GET /api/import-jobs/:jobId/progress - Get real-time progress information
  fastify.get('/import-jobs/:jobId/progress', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
      select: {
        id: true,
        status: true,
        totalRows: true,
        processedRows: true,
        validRows: true,
        invalidRows: true,
        createdRows: true,
        updatedRows: true,
        skippedRows: true,
        failedRows: true,
      },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    const percent = job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;

    return reply.status(200).send({
      success: true,
      data: {
        ...job,
        percent,
      },
    });
  });

  // 8. POST /api/import-jobs/:jobId/cancel - Secure cancel trigger
  fastify.post('/import-jobs/:jobId/cancel', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    const cancelableStatuses = ['UPLOADED', 'PARSING', 'MAPPING', 'VALIDATING', 'READY', 'QUEUED', 'IMPORTING'];
    if (!cancelableStatuses.includes(job.status)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NOT_CANCELABLE', message: 'Não é possível cancelar job neste estado final.' },
      });
    }

    // Update job in database to CANCELLED (worker check will stop current/future loops)
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return reply.status(200).send({
      success: true,
      data: {
        jobId,
        status: 'CANCELLED',
      },
    });
  });

  // 9. GET /api/import-jobs/:jobId/result - Retrieve final statistics
  fastify.get('/import-jobs/:jobId/result', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
      include: {
        issues: {
          where: { severity: 'ERROR' },
          take: 200,
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        mode: job.mode,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        createdRows: job.createdRows,
        updatedRows: job.updatedRows,
        skippedRows: job.skippedRows,
        failedRows: job.failedRows,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errors: job.issues,
      },
    });
  });

  // 10. GET /api/import-jobs/:jobId/errors/download - Download sanitised error spreadsheet
  fastify.get('/import-jobs/:jobId/errors/download', async (request, reply) => {
    const { companyId } = request.user;
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job de importação não encontrado.' },
      });
    }

    const csvContent = await ImportJobService.buildErrorCsv(jobId);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="erros-importacao-${jobId}.csv"`);
    
    return reply.status(200).send(csvContent);
  });

  // 11. GET /api/import-jobs - Paginated jobs lookup
  fastify.get('/import-jobs', async (request, reply) => {
    const { companyId } = request.user;
    const query = request.query as any;

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.importJob.count({ where: { companyId } }),
      prisma.importJob.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          originalFileName: true,
          fileType: true,
          status: true,
          mode: true,
          totalRows: true,
          processedRows: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    return reply.status(200).send({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  });
}

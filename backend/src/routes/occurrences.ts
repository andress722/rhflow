import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { OccurrenceService } from '../services/occurrence.service';
import { requireRole } from '../lib/auth-middleware';
import { OccurrenceType, OccurrenceStatus, OccurrenceSource } from '@prisma/client';

const createOccurrenceSchema = z.object({
  employeeId: z.string().uuid('ID de funcionário inválido'),
  type: z.nativeEnum(OccurrenceType),
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  occurrenceDate: z.string().datetime('Data da ocorrência inválida (formato ISO8601)'),
  severity: z.string().default('LOW'),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(OccurrenceStatus),
});

const createCommentSchema = z.object({
  message: z.string().min(1, 'A mensagem não pode estar vazia'),
});

const updateOccurrenceSchema = createOccurrenceSchema.partial();

export default async function occurrencesRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication globally for these routes
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/occurrences/summary (Respects RBAC)
  fastify.get('/occurrences/summary', async (request, reply) => {
    const { companyId, role, sub } = request.user;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const baseWhere: any = { companyId };
    const certWhere: any = { companyId, status: { in: ['RECEIVED', 'UNDER_REVIEW'] } };

    // MANAGER sees only stats for employees under their management
    if (role === 'MANAGER') {
      baseWhere.employee = { managerUserId: sub };
      certWhere.employee = { managerUserId: sub };
    }

    // 1. Open occurrences (not resolved/rejected/cancelled)
    const openOccurrences = await prisma.occurrence.count({
      where: {
        ...baseWhere,
        status: {
          in: ['OPEN', 'WAITING_EMPLOYEE', 'WAITING_MANAGER', 'WAITING_HR'],
        },
      },
    });

    // 2. Absences today
    const absencesToday = await prisma.occurrence.count({
      where: {
        ...baseWhere,
        type: 'ABSENCE',
        occurrenceDate: { gte: startOfToday, lte: endOfToday },
      },
    });

    // 3. Late arrivals today
    const lateArrivalsToday = await prisma.occurrence.count({
      where: {
        ...baseWhere,
        type: 'LATE_ARRIVAL',
        occurrenceDate: { gte: startOfToday, lte: endOfToday },
      },
    });

    // 4. Missed clock ins today
    const missedClockInsToday = await prisma.occurrence.count({
      where: {
        ...baseWhere,
        type: 'MISSED_CLOCK_IN',
        occurrenceDate: { gte: startOfToday, lte: endOfToday },
      },
    });

    // 5. Medical certificates under review
    const medicalCertificatesUnderReview = await prisma.medicalCertificate.count({
      where: certWhere,
    });

    return reply.status(200).send({
      success: true,
      data: {
        openOccurrences,
        absencesToday,
        lateArrivalsToday,
        missedClockInsToday,
        medicalCertificatesUnderReview,
      },
    });
  });

  // GET /api/occurrences (Filters by companyId, RBAC manager filtration)
  fastify.get('/occurrences', async (request, reply) => {
    const { companyId, role, sub } = request.user;

    const whereClause: any = { companyId };

    if (role === 'MANAGER') {
      whereClause.employee = { managerUserId: sub };
    }

    const occurrences = await prisma.occurrence.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            cpf: true,
            whatsapp: true,
            sector: true,
            managerUserId: true,
          },
        },
        medicalCertificates: true,
      },
      orderBy: { occurrenceDate: 'desc' },
    });

    return reply.status(200).send({
      success: true,
      data: occurrences,
    });
  });

  // GET /api/occurrences/:id (Timeline included)
  fastify.get('/occurrences/:id', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { id } = request.params as { id: string };

    const occurrence = await prisma.occurrence.findFirst({
      where: { id, companyId },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            cpf: true,
            whatsapp: true,
            sector: true,
            managerUserId: true,
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
        },
        medicalCertificates: true,
      },
    });

    if (!occurrence) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ocorrência não encontrada',
        },
      });
    }

    // 3. Regras de visibilidade: MANAGER só vê ocorrência da equipe
    if (role === 'MANAGER' && occurrence.employee.managerUserId !== sub) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para acessar esta ocorrência',
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: occurrence,
    });
  });

  // POST /api/occurrences (ADMIN and HR only)
  fastify.post(
    '/occurrences',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId, sub } = request.user;

      const bodyResult = createOccurrenceSchema.safeParse(request.body);
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

      const { employeeId, type, title, description, occurrenceDate, severity } = bodyResult.data;

      // Verify if employee exists and belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, companyId },
      });

      if (!employee) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_EMPLOYEE',
            message: 'Funcionário selecionado é inválido.',
          },
        });
      }

      // Use centralized occurrence service to create and check duplicates
      const { occurrence, isDuplicate } = await OccurrenceService.createOccurrence({
        companyId,
        employeeId,
        type,
        title,
        description,
        occurrenceDate: new Date(occurrenceDate),
        source: OccurrenceSource.MANUAL,
        severity,
        managerUserId: employee.managerUserId || undefined,
        actorUserId: sub,
        actorType: 'USER',
      });

      return reply.status(isDuplicate ? 200 : 201).send({
        success: true,
        data: occurrence,
        isDuplicate,
      });
    },
  );

  // PATCH /api/occurrences/:id (ADMIN and HR only)
  fastify.patch(
    '/occurrences/:id',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId } = request.user;
      const { id } = request.params as { id: string };

      const bodyResult = updateOccurrenceSchema.safeParse(request.body);
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

      const occurrence = await prisma.occurrence.findFirst({
        where: { id, companyId },
      });

      if (!occurrence) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ocorrência não encontrada',
          },
        });
      }

      const { title, description, severity } = bodyResult.data;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (severity !== undefined) updateData.severity = severity;

      const updated = await prisma.occurrence.update({
        where: { id },
        data: updateData,
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    },
  );

  // PATCH /api/occurrences/:id/status (ADMIN, HR, MANAGER can alter status. VIEWER is blocked)
  fastify.patch(
    '/occurrences/:id/status',
    { preHandler: [requireRole(['ADMIN', 'HR', 'MANAGER'])] },
    async (request, reply) => {
      const { companyId, role, sub } = request.user;
      const { id } = request.params as { id: string };

      const bodyResult = updateStatusSchema.safeParse(request.body);
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

      // Find occurrence and include employee to check manager permissions
      const occurrence = await prisma.occurrence.findFirst({
        where: { id, companyId },
        include: { employee: { select: { managerUserId: true } } },
      });

      if (!occurrence) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ocorrência não encontrada',
          },
        });
      }

      // Check manager access
      if (role === 'MANAGER' && occurrence.employee.managerUserId !== sub) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Você não tem permissão para alterar o status desta ocorrência',
          },
        });
      }

      const { status } = bodyResult.data;

      // Update status using centralized service (generates STATUS_CHANGED event)
      const updated = await OccurrenceService.updateStatus(id, companyId, status, sub);

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    },
  );

  // POST /api/occurrences/:id/events (ADMIN, HR, MANAGER can add comment. VIEWER blocked)
  fastify.post(
    '/occurrences/:id/events',
    { preHandler: [requireRole(['ADMIN', 'HR', 'MANAGER'])] },
    async (request, reply) => {
      const { companyId, role, sub } = request.user;
      const { id } = request.params as { id: string };

      const bodyResult = createCommentSchema.safeParse(request.body);
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

      // Find occurrence to check manager access
      const occurrence = await prisma.occurrence.findFirst({
        where: { id, companyId },
        include: { employee: { select: { managerUserId: true } } },
      });

      if (!occurrence) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ocorrência não encontrada',
          },
        });
      }

      // Check manager access
      if (role === 'MANAGER' && occurrence.employee.managerUserId !== sub) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Você não tem permissão para adicionar comentários nesta ocorrência',
          },
        });
      }

      const { message } = bodyResult.data;

      // Add comment using centralized service (generates COMMENT_ADDED event)
      const event = await OccurrenceService.addComment(id, companyId, message, sub);

      return reply.status(201).send({
        success: true,
        data: event,
      });
    },
  );
}

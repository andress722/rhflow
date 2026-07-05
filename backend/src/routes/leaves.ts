import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { requireRole } from '../lib/auth-middleware';
import { AbsenceStatus, AbsenceType } from '@prisma/client';
import { CalendarSyncService } from '../services/calendar-sync.service';

export default async function leavesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/leaves (List all leave requests for user's company)
  fastify.get('/leaves', async (request, reply) => {
    const { companyId } = request.user;

    const requests = await prisma.leaveRequest.findMany({
      where: { companyId },
      include: {
        employee: {
          select: { id: true, fullName: true, sector: true, jobTitle: true }
        },
        reviewedByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.status(200).send({
      success: true,
      data: requests
    });
  });

  // POST /api/leaves (Request vacation or programmed leave)
  fastify.post('/leaves', async (request, reply) => {
    const { companyId } = request.user;

    const schema = z.object({
      employeeId: z.string().uuid(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      type: z.string(), // FERIAS, LICENCA_MEDICA, LICENCA_MATERNIDADE, etc.
      justification: z.string().optional()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dados de solicitação inválidos.' }
      });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: parsed.data.employeeId, companyId }
    });

    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Colaborador não encontrado.' }
      });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        companyId,
        employeeId: parsed.data.employeeId,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        type: parsed.data.type,
        justification: parsed.data.justification || null,
        status: 'PENDING'
      }
    });

    return reply.status(201).send({
      success: true,
      data: leave
    });
  });

  // POST /api/leaves/:id/approve
  fastify.post('/leaves/:id/approve', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId, sub: userId } = request.user;
    const { id } = request.params as { id: string };

    const leave = await prisma.leaveRequest.findFirst({
      where: { id, companyId }
    });

    if (!leave) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Solicitação de afastamento não encontrada.' }
      });
    }

    if (leave.status !== 'PENDING') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Apenas solicitações pendentes podem ser aprovadas.' }
      });
    }

    const diffTime = Math.abs(leave.endDate.getTime() - leave.startDate.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Double check status inside transaction to prevent race conditions (idempotency check)
        const currentLeave = await tx.leaveRequest.findUnique({
          where: { id }
        });
        if (!currentLeave || currentLeave.status !== 'PENDING') {
          throw new Error('Solicitação de afastamento já foi processada.');
        }

        // Check if an AbsenceRecord for this leaveRequestId already exists
        const existingAbsence = await tx.absenceRecord.findUnique({
          where: { leaveRequestId: id }
        });
        if (existingAbsence) {
          throw new Error('Registro de ausência já gerado para esta solicitação.');
        }

        // 1. Mark leave request as approved
        const updatedRequest = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedByUserId: userId,
            reviewedAt: new Date()
          }
        });

        // 2. Insert dynamic AbsenceRecord
        await tx.absenceRecord.create({
          data: {
            companyId,
            employeeId: leave.employeeId,
            leaveRequestId: id, // unique link
            startDate: leave.startDate,
            endDate: leave.endDate,
            days: daysCount,
            type: leave.type === 'LICENCA_MEDICA' ? AbsenceType.MEDICAL_LEAVE : AbsenceType.JUSTIFIED_ABSENCE,
            status: AbsenceStatus.ACTIVE,
            createdByUserId: userId
          }
        });

        return updatedRequest;
      });

      // Trigger calendar synchronization asynchronously (fire-and-forget)
      CalendarSyncService.syncLeaveEvent(id, companyId).catch((err) => {
        console.error(`Asynchronous calendar sync failed for leaveRequestId: ${id}`, err);
      });

      return reply.status(200).send({
        success: true,
        data: updated
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'TRANSACTION_ERROR', message: err.message || 'Falha ao aprovar afastamento.' }
      });
    }
  });

  // POST /api/leaves/:id/reject
  fastify.post('/leaves/:id/reject', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId, sub: userId } = request.user;
    const { id } = request.params as { id: string };

    const schema = z.object({
      reason: z.string().min(3)
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Motivo de rejeição obrigatório.' }
      });
    }

    const leave = await prisma.leaveRequest.findFirst({
      where: { id, companyId }
    });

    if (!leave) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Solicitação não encontrada.' }
      });
    }

    if (leave.status !== 'PENDING') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Apenas solicitações pendentes podem ser rejeitadas.' }
      });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        justification: parsed.data.reason,
        reviewedByUserId: userId,
        reviewedAt: new Date()
      }
    });

    return reply.status(200).send({
      success: true,
      data: updated
    });
  });
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';

const workScheduleSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  workDays: z.array(z.string()).min(1, 'Selecione pelo menos um dia de trabalho'),
  expectedClockIn: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
  expectedClockOut: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
  toleranceMinutes: z.number().int().nonnegative().default(10),
  requireRemoteCheckin: z.boolean().default(false),
  requireRemoteCheckout: z.boolean().default(false),
});

const updateWorkScheduleSchema = workScheduleSchema.partial();

export default async function workSchedulesRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication globally for these routes
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/work-schedules (All roles can view)
  fastify.get('/work-schedules', async (request, reply) => {
    const { companyId } = request.user;

    const schedules = await prisma.workSchedule.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return reply.status(200).send({
      success: true,
      data: schedules,
    });
  });

  // GET /api/work-schedules/:id (All roles can view)
  fastify.get('/work-schedules/:id', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const schedule = await prisma.workSchedule.findFirst({
      where: { id, companyId },
    });

    if (!schedule) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Escala de trabalho não encontrada',
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: schedule,
    });
  });

  // POST /api/work-schedules (ADMIN and HR only)
  fastify.post(
    '/work-schedules',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId } = request.user;

      const bodyResult = workScheduleSchema.safeParse(request.body);
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

      const {
        name,
        workDays,
        expectedClockIn,
        expectedClockOut,
        toleranceMinutes,
        requireRemoteCheckin,
        requireRemoteCheckout,
      } = bodyResult.data;

      const schedule = await prisma.workSchedule.create({
        data: {
          companyId,
          name,
          workDays: JSON.stringify(workDays), // Store workDays as a JSON string/array
          expectedClockIn,
          expectedClockOut,
          toleranceMinutes,
          requireRemoteCheckin,
          requireRemoteCheckout,
          isActive: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          ...schedule,
          workDays: JSON.parse(schedule.workDays as string),
        },
      });
    },
  );

  // PATCH /api/work-schedules/:id (ADMIN and HR only)
  fastify.patch(
    '/work-schedules/:id',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId } = request.user;
      const { id } = request.params as { id: string };

      const bodyResult = updateWorkScheduleSchema.safeParse(request.body);
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

      // Ensure work schedule exists in company
      const existing = await prisma.workSchedule.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Escala de trabalho não encontrada',
          },
        });
      }

      const {
        name,
        workDays,
        expectedClockIn,
        expectedClockOut,
        toleranceMinutes,
        requireRemoteCheckin,
        requireRemoteCheckout,
      } = bodyResult.data;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (workDays !== undefined) updateData.workDays = JSON.stringify(workDays);
      if (expectedClockIn !== undefined) updateData.expectedClockIn = expectedClockIn;
      if (expectedClockOut !== undefined) updateData.expectedClockOut = expectedClockOut;
      if (toleranceMinutes !== undefined) updateData.toleranceMinutes = toleranceMinutes;
      if (requireRemoteCheckin !== undefined) updateData.requireRemoteCheckin = requireRemoteCheckin;
      if (requireRemoteCheckout !== undefined) updateData.requireRemoteCheckout = requireRemoteCheckout;

      const updated = await prisma.workSchedule.update({
        where: { id },
        data: updateData,
      });

      return reply.status(200).send({
        success: true,
        data: {
          ...updated,
          workDays: JSON.parse(updated.workDays as string),
        },
      });
    },
  );

  // PATCH /api/work-schedules/:id/deactivate (ADMIN and HR only)
  fastify.patch(
    '/work-schedules/:id/deactivate',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId } = request.user;
      const { id } = request.params as { id: string };

      const existing = await prisma.workSchedule.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Escala de trabalho não encontrada',
          },
        });
      }

      const updated = await prisma.workSchedule.update({
        where: { id },
        data: { isActive: false },
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    },
  );
}

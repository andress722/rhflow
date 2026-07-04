import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

export default async function pulseSurveysRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/pulse-surveys
  fastify.get('/pulse-surveys', async (request, reply) => {
    const { companyId } = request.user;

    const surveys = await prisma.pulseSurvey.findMany({
      where: { companyId },
      include: {
        responses: {
          include: {
            employee: {
              select: { id: true, fullName: true, sector: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add calculations
    const formatted = surveys.map((survey) => {
      const total = survey.responses.length;
      const sum = survey.responses.reduce((acc, curr) => acc + curr.score, 0);
      const average = total > 0 ? parseFloat((sum / total).toFixed(1)) : 0;

      return {
        ...survey,
        stats: {
          totalResponses: total,
          averageScore: average,
        },
      };
    });

    return reply.status(200).send({
      success: true,
      data: formatted,
    });
  });

  // POST /api/pulse-surveys
  fastify.post('/pulse-surveys', async (request, reply) => {
    const { companyId } = request.user;

    const schema = z.object({
      title: z.string().min(3),
      question: z.string().min(5),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dados da pesquisa inválidos.' },
      });
    }

    const survey = await prisma.pulseSurvey.create({
      data: {
        companyId,
        title: parsed.data.title,
        question: parsed.data.question,
        isActive: true,
      },
    });

    return reply.status(201).send({
      success: true,
      data: survey,
    });
  });

  // POST /api/pulse-surveys/:id/respond
  fastify.post('/pulse-surveys/:id/respond', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const schema = z.object({
      employeeId: z.string().uuid(),
      score: z.number().int().min(1).max(5),
      comment: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dados de resposta inválidos.' },
      });
    }

    const survey = await prisma.pulseSurvey.findFirst({
      where: { id, companyId },
    });

    if (!survey) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pesquisa não encontrada.' },
      });
    }

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: { id: parsed.data.employeeId, companyId },
    });

    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Colaborador não encontrado.' },
      });
    }

    // Check if employee already responded
    const existing = await prisma.pulseSurveyResponse.findUnique({
      where: {
        surveyId_employeeId: {
          surveyId: id,
          employeeId: parsed.data.employeeId,
        },
      },
    });

    if (existing) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ALREADY_RESPONDED', message: 'Este colaborador já respondeu a esta pesquisa.' },
      });
    }

    const response = await prisma.pulseSurveyResponse.create({
      data: {
        surveyId: id,
        employeeId: parsed.data.employeeId,
        score: parsed.data.score,
        comment: parsed.data.comment || null,
      },
    });

    return reply.status(201).send({
      success: true,
      data: response,
    });
  });
}

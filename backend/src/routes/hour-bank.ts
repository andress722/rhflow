import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { requireRole } from '../lib/auth-middleware';

export default async function hourBankRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/hour-bank/summary (List balance summary of employees)
  fastify.get('/hour-bank/summary', async (request, reply) => {
    const { companyId } = request.user;

    const balances = await prisma.hourBankBalance.findMany({
      where: {
        employee: { companyId }
      },
      include: {
        employee: {
          select: { id: true, fullName: true, sector: true, jobTitle: true }
        }
      }
    });

    return reply.status(200).send({
      success: true,
      data: balances
    });
  });

  // GET /api/hour-bank/:employeeId (Get balance and transactions for a specific employee)
  fastify.get('/hour-bank/:employeeId', async (request, reply) => {
    const { companyId } = request.user;
    const { employeeId } = request.params as { employeeId: string };

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId }
    });

    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Colaborador não encontrado.' }
      });
    }

    const balance = await prisma.hourBankBalance.findUnique({
      where: { employeeId }
    });

    const transactions = await prisma.hourBankTransaction.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' }
    });

    return reply.status(200).send({
      success: true,
      data: {
        employee,
        balance: balance ? balance.balanceMinutes : 0,
        transactions
      }
    });
  });

  // POST /api/hour-bank/:employeeId/transactions (Add/subtract balance transaction - HR only)
  fastify.post('/hour-bank/:employeeId/transactions', { preHandler: [requireRole(['ADMIN', 'HR'])] }, async (request, reply) => {
    const { companyId } = request.user;
    const { employeeId } = request.params as { employeeId: string };

    const schema = z.object({
      amountMinutes: z.number().int(),
      description: z.string().min(3)
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dados de transação inválidos.' }
      });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId }
    });

    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Colaborador não encontrado.' }
      });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const currentBalance = await tx.hourBankBalance.findUnique({
        where: { employeeId },
      });
      const previousBalance = currentBalance ? currentBalance.balanceMinutes : 0;
      const resultingBalance = previousBalance + parsed.data.amountMinutes;

      const createdTx = await tx.hourBankTransaction.create({
        data: {
          employeeId,
          date: new Date(),
          amountMinutes: parsed.data.amountMinutes,
          description: parsed.data.description,
          actorId: request.user.sub,
          previousBalance,
          resultingBalance,
        }
      });

      await tx.hourBankBalance.upsert({
        where: { employeeId },
        create: {
          employeeId,
          balanceMinutes: resultingBalance
        },
        update: {
          balanceMinutes: resultingBalance
        }
      });

      return createdTx;
    });

    return reply.status(201).send({
      success: true,
      data: transaction
    });
  });
}

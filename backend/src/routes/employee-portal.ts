import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';

export default async function employeePortalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Helper to find employee linked to current authenticated user
  const getLinkedEmployee = async (companyId: string, email: string) => {
    return prisma.employee.findFirst({
      where: { companyId, email },
    });
  };

  // GET /api/employee-portal/me (Fetch profile)
  fastify.get('/employee-portal/me', async (request, reply) => {
    const { companyId, email } = request.user;

    const employee = await getLinkedEmployee(companyId, email);
    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Nenhum perfil de colaborador associado a este usuário.' },
      });
    }

    return reply.status(200).send({
      success: true,
      data: employee,
    });
  });

  // GET /api/employee-portal/timesheet (Fetch personal timesheet records)
  fastify.get('/employee-portal/timesheet', async (request, reply) => {
    const { companyId, email } = request.user;
    const { month } = request.query as { month?: string };

    const employee = await getLinkedEmployee(companyId, email);
    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Nenhum perfil de colaborador associado.' },
      });
    }

    const filterMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const startDate = new Date(`${filterMonth}-01T00:00:00.000Z`);
    const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));

    const checkins = await prisma.remoteCheckin.findMany({
      where: {
        employeeId: employee.id,
        checkinDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: { checkinDate: 'asc' },
    });

    return reply.status(200).send({
      success: true,
      data: checkins,
    });
  });

  // GET /api/employee-portal/hour-bank (Fetch personal hour bank details)
  fastify.get('/employee-portal/hour-bank', async (request, reply) => {
    const { companyId, email } = request.user;

    const employee = await getLinkedEmployee(companyId, email);
    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Nenhum perfil de colaborador associado.' },
      });
    }

    const balance = await prisma.hourBankBalance.findUnique({
      where: { employeeId: employee.id },
    });

    const transactions = await prisma.hourBankTransaction.findMany({
      where: { employeeId: employee.id },
      orderBy: { date: 'desc' },
    });

    return reply.status(200).send({
      success: true,
      data: {
        balance: balance ? balance.balanceMinutes : 0,
        transactions,
      },
    });
  });

  // GET /api/employee-portal/leaves (Fetch personal leave requests)
  fastify.get('/employee-portal/leaves', async (request, reply) => {
    const { companyId, email } = request.user;

    const employee = await getLinkedEmployee(companyId, email);
    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Nenhum perfil de colaborador associado.' },
      });
    }

    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
    });

    return reply.status(200).send({
      success: true,
      data: requests,
    });
  });
}

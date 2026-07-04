import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';

export default async function timesheetSignatureRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/timesheets/signatures
  fastify.get('/timesheets/signatures', async (request, reply) => {
    const { companyId } = request.user;
    const { month } = request.query as { month?: string };

    const filterMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM

    // Fetch all signatures for this month
    const signatures = await prisma.timesheetSignature.findMany({
      where: {
        companyId,
        periodMonth: filterMonth,
      },
      include: {
        employee: {
          select: { id: true, fullName: true, sector: true },
        },
        signedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return reply.status(200).send({
      success: true,
      data: signatures,
    });
  });

  // POST /api/timesheets/sign
  fastify.post('/timesheets/sign', async (request, reply) => {
    const { companyId, sub: userId } = request.user;

    const schema = z.object({
      employeeId: z.string().uuid(),
      periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
      documentHash: z.string().optional(),
      documentVersion: z.number().int().optional(),
      signedPayloadHash: z.string().optional(),
      consentTextVersion: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dados de assinatura inválidos.' },
      });
    }

    const { employeeId, periodMonth, documentHash, documentVersion, signedPayloadHash, consentTextVersion } = parsed.data;

    // Check if already signed
    const existing = await prisma.timesheetSignature.findUnique({
      where: {
        employeeId_periodMonth: { employeeId, periodMonth },
      },
    });

    if (existing) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ALREADY_SIGNED', message: 'Este espelho de ponto já foi assinado eletronicamente.' },
      });
    }

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });

    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Colaborador não encontrado.' },
      });
    }

    const ipAddress = request.ip || '127.0.0.1';
    const userAgent = request.headers['user-agent'] || 'Unknown';
    
    // Create unique audit hash for legality tracking (Lei 14.063/2020)
    const rawPayload = `${companyId}:${employeeId}:${periodMonth}:${userId}:${ipAddress}:${userAgent}`;
    const auditHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

    const documentHashVal = documentHash || crypto.createHash('sha256').update(`timesheet:${employeeId}:${periodMonth}`).digest('hex');
    const documentVersionVal = documentVersion || 1;
    const signedPayloadHashVal = signedPayloadHash || crypto.createHash('sha256').update(rawPayload).digest('hex');
    const consentTextVersionVal = consentTextVersion || 'V1.0-Padrao-MTE';

    const signature = await prisma.timesheetSignature.create({
      data: {
        companyId,
        employeeId,
        periodMonth,
        signedByUserId: userId,
        ipAddress,
        userAgent,
        auditHash,
        documentHash: documentHashVal,
        documentVersion: documentVersionVal,
        signedPayloadHash: signedPayloadHashVal,
        consentTextVersion: consentTextVersionVal,
      },
    });

    return reply.status(200).send({
      success: true,
      data: signature,
    });
  });
}

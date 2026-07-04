import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { PlanLimitsService } from '../services/plan-limits.service';

const workModelSchema = z.enum(['PRESENTIAL', 'REMOTE', 'HYBRID']);
const employeeStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

const createEmployeeSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().min(11, 'CPF inválido').max(14, 'CPF inválido'),
  whatsapp: z.string().min(10, 'WhatsApp deve conter DDD e número'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  sector: z.string().optional().or(z.literal('')),
  jobTitle: z.string().optional().or(z.literal('')),
  workModel: workModelSchema.default('PRESENTIAL'),
  workScheduleId: z.string().uuid('Escala inválida').optional().or(z.literal('')),
  managerUserId: z.string().uuid('Gestor inválido').optional().or(z.literal('')),
});

const updateEmployeeSchema = createEmployeeSchema.partial();

export default async function employeesRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication globally for these routes
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/employees (All roles can view, but managers have filters)
  fastify.get('/employees', async (request, reply) => {
    const { companyId, role, sub } = request.user;

    const whereClause: any = { companyId };

    // 5. MANAGER só pode visualizar funcionários onde managerUserId seja igual ao usuário logado.
    if (role === 'MANAGER') {
      whereClause.managerUserId = sub;
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        workSchedule: {
          select: { id: true, name: true },
        },
        manager: {
          select: { id: true, name: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return reply.status(200).send({
      success: true,
      data: employees,
    });
  });

  // GET /api/employees/:id (All roles can view, managers filtered)
  fastify.get('/employees/:id', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { id } = request.params as { id: string };

    const whereClause: any = { id, companyId };
    if (role === 'MANAGER') {
      whereClause.managerUserId = sub;
    }

    const employee = await prisma.employee.findFirst({
      where: whereClause,
      include: {
        workSchedule: true,
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Funcionário não encontrado',
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: employee,
    });
  });

  // POST /api/employees (ADMIN and HR only)
  fastify.post(
    '/employees',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId, sub } = request.user;

      try {
        await PlanLimitsService.assertCanCreateEmployee(companyId);
      } catch (err: any) {
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

      const bodyResult = createEmployeeSchema.safeParse(request.body);
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
        fullName,
        cpf,
        whatsapp,
        email,
        sector,
        jobTitle,
        workModel,
        workScheduleId,
        managerUserId,
      } = bodyResult.data;

      // Clean mask from CPF
      const cleanCpf = cpf.replace(/\D/g, '');

      // Check unique CPF in company
      const duplicateCpf = await prisma.employee.findFirst({
        where: { companyId, cpf: cleanCpf },
      });
      if (duplicateCpf) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DUPLICATE_CPF',
            message: 'Este CPF já está cadastrado para outro funcionário.',
          },
        });
      }

      // Check if work schedule belongs to company
      if (workScheduleId) {
        const schedule = await prisma.workSchedule.findFirst({
          where: { id: workScheduleId, companyId },
        });
        if (!schedule) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_SCHEDULE',
              message: 'Escala de trabalho selecionada é inválida.',
            },
          });
        }
      }

      // Check if manager belongs to company
      if (managerUserId) {
        const manager = await prisma.user.findFirst({
          where: { id: managerUserId, companyId, role: 'MANAGER' },
        });
        if (!manager) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_MANAGER',
              message: 'Gestor selecionado é inválido.',
            },
          });
        }
      }

      const employee = await prisma.employee.create({
        data: {
          companyId,
          fullName,
          cpf: cleanCpf,
          whatsapp,
          email: email || null,
          sector: sector || null,
          jobTitle: jobTitle || null,
          workModel,
          workScheduleId: workScheduleId || null,
          managerUserId: managerUserId || null,
          status: 'ACTIVE',
        },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          userId: sub,
          action: 'EMPLOYEE_CREATE',
          entity: 'Employee',
          entityId: employee.id,
          metadata: { employeeName: employee.fullName },
        },
      });

      return reply.status(201).send({
        success: true,
        data: employee,
      });
    },
  );

  // PATCH /api/employees/:id (ADMIN and HR only)
  fastify.patch(
    '/employees/:id',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId, sub } = request.user;
      const { id } = request.params as { id: string };

      const bodyResult = updateEmployeeSchema.safeParse(request.body);
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

      const existing = await prisma.employee.findFirst({
        where: { id, companyId },
      });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Funcionário não encontrado',
          },
        });
      }

      const {
        fullName,
        cpf,
        whatsapp,
        email,
        sector,
        jobTitle,
        workModel,
        workScheduleId,
        managerUserId,
      } = bodyResult.data;

      const updateData: any = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
      if (email !== undefined) updateData.email = email || null;
      if (sector !== undefined) updateData.sector = sector || null;
      if (jobTitle !== undefined) updateData.jobTitle = jobTitle || null;
      if (workModel !== undefined) updateData.workModel = workModel;

      if (cpf !== undefined) {
        const cleanCpf = cpf.replace(/\D/g, '');
        const duplicateCpf = await prisma.employee.findFirst({
          where: { companyId, cpf: cleanCpf, id: { not: id } },
        });
        if (duplicateCpf) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'DUPLICATE_CPF',
              message: 'Este CPF já está cadastrado para outro funcionário.',
            },
          });
        }
        updateData.cpf = cleanCpf;
      }

      if (workScheduleId !== undefined) {
        if (workScheduleId) {
          const schedule = await prisma.workSchedule.findFirst({
            where: { id: workScheduleId, companyId },
          });
          if (!schedule) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'INVALID_SCHEDULE',
                message: 'Escala de trabalho selecionada é inválida.',
              },
            });
          }
          updateData.workScheduleId = workScheduleId;
        } else {
          updateData.workScheduleId = null;
        }
      }

      if (managerUserId !== undefined) {
        if (managerUserId) {
          const manager = await prisma.user.findFirst({
            where: { id: managerUserId, companyId, role: 'MANAGER' },
          });
          if (!manager) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'INVALID_MANAGER',
                message: 'Gestor selecionado é inválido.',
              },
            });
          }
          updateData.managerUserId = managerUserId;
        } else {
          updateData.managerUserId = null;
        }
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: updateData,
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          userId: sub,
          action: 'EMPLOYEE_UPDATE',
          entity: 'Employee',
          entityId: updated.id,
          metadata: { employeeName: updated.fullName },
        },
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    },
  );

  // PATCH /api/employees/:id/deactivate (ADMIN and HR only)
  fastify.patch(
    '/employees/:id/deactivate',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId, sub } = request.user;
      const { id } = request.params as { id: string };

      const deactivateBodySchema = z.object({
        reason: z.string().min(1, 'Motivo de inativação é obrigatório'),
      });

      const bodyResult = deactivateBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Motivo de inativação é obrigatório.',
            details: bodyResult.error.errors,
          },
        });
      }

      const { reason } = bodyResult.data;

      const existing = await prisma.employee.findFirst({
        where: { id, companyId },
      });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Funcionário não encontrado',
          },
        });
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: { 
          status: 'INACTIVE',
          inactivationReason: reason,
        },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          userId: sub,
          action: 'EMPLOYEE_DEACTIVATE',
          entity: 'Employee',
          entityId: updated.id,
          metadata: { employeeName: updated.fullName, reason },
        },
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    },
  );

  // PATCH /api/employees/:id/activate (ADMIN and HR only)
  fastify.patch(
    '/employees/:id/activate',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId, sub } = request.user;
      const { id } = request.params as { id: string };

      try {
        await PlanLimitsService.assertCanCreateEmployee(companyId);
      } catch (err: any) {
        if (err.message === 'PLAN_LIMIT_EXCEEDED') {
          return reply.status(403).send({
            error: 'PLAN_LIMIT_EXCEEDED',
            message: 'Limite de funcionários do plano atingido. Não é possível reativar este funcionário.',
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

      const existing = await prisma.employee.findFirst({
        where: { id, companyId },
      });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Funcionário não encontrado',
          },
        });
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: { 
          status: 'ACTIVE',
          inactivationReason: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          userId: sub,
          action: 'EMPLOYEE_ACTIVATE',
          entity: 'Employee',
          entityId: updated.id,
          metadata: { employeeName: updated.fullName },
        },
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    },
  );

  // POST /api/employees/import (ADMIN and HR only)
  fastify.post(
    '/employees/import',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId } = request.user;

      if (!request.isMultipart()) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MULTIPART_REQUIRED',
            message: 'A requisição deve ser multipart/form-data.',
          },
        });
      }

      let fileData;
      try {
        fileData = await request.file({
          limits: {
            fileSize: 2 * 1024 * 1024, // 2MB limit
          },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message || 'Erro ao carregar arquivo.',
          },
        });
      }

      if (!fileData) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: 'Nenhum arquivo enviado.',
          },
        });
      }

      let content = '';
      try {
        const fileBuffer = await fileData.toBuffer();
        content = fileBuffer.toString('utf-8');
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'O arquivo enviado excede o limite de tamanho permitido (2MB).',
          },
        });
      }

      const { headers, rows } = parseCsv(content);

      if (rows.length > 500) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: 'O limite de linhas para importação é de 500.',
          },
        });
      }

      const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
      const colIndex = {
        name: normalizedHeaders.indexOf('name'),
        cpf: normalizedHeaders.indexOf('cpf'),
        email: normalizedHeaders.indexOf('email'),
        whatsapp: normalizedHeaders.indexOf('whatsapp'),
        sector: normalizedHeaders.indexOf('sector'),
        workModel: normalizedHeaders.indexOf('workmodel'),
        managerEmail: normalizedHeaders.indexOf('manageremail'),
        workScheduleName: normalizedHeaders.indexOf('workschedulename'),
      };

      if (colIndex.name === -1 || colIndex.cpf === -1 || colIndex.whatsapp === -1) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_HEADERS',
            message: 'O CSV deve conter pelo menos as colunas name, cpf e whatsapp.',
          },
        });
      }

      const errors: Array<{ line: number; message: string }> = [];
      const skipped: Array<{ line: number; name: string; cpf: string; reason: string }> = [];
      const validRows: Array<{
        name: string;
        cpf: string;
        whatsapp: string;
        email: string | null;
        sector: string | null;
        workModel: 'PRESENTIAL' | 'REMOTE' | 'HYBRID';
        managerUserId: string | null;
        workScheduleId: string | null;
      }> = [];

      const cpfSeenInCsv = new Set<string>();

      for (const row of rows) {
        const getValue = (idx: number): string => {
          if (idx === -1 || idx >= row.data.length) return '';
          return row.data[idx] || '';
        };

        const name = getValue(colIndex.name);
        const rawCpf = getValue(colIndex.cpf);
        const rawWhatsapp = getValue(colIndex.whatsapp);
        const email = getValue(colIndex.email) || null;
        const sector = getValue(colIndex.sector) || null;
        const rawWorkModel = getValue(colIndex.workModel).toUpperCase();
        const managerEmail = getValue(colIndex.managerEmail) || null;
        const workScheduleName = getValue(colIndex.workScheduleName) || null;

        if (!name) {
          errors.push({ line: row.lineNumber, message: 'O nome é obrigatório.' });
          continue;
        }

        const cpf = rawCpf.replace(/\D/g, '');
        if (cpf.length !== 11) {
          errors.push({ line: row.lineNumber, message: `CPF deve conter 11 dígitos (atual: ${cpf.length}).` });
          continue;
        }

        if (cpfSeenInCsv.has(cpf)) {
          errors.push({ line: row.lineNumber, message: `CPF duplicado no mesmo arquivo CSV: ${cpf}.` });
          continue;
        }
        cpfSeenInCsv.add(cpf);

        const whatsapp = rawWhatsapp.replace(/\D/g, '');
        if (whatsapp.length < 10) {
          errors.push({ line: row.lineNumber, message: 'WhatsApp deve conter pelo menos DDD e número.' });
          continue;
        }

        if (email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            errors.push({ line: row.lineNumber, message: `E-mail inválido: ${email}.` });
            continue;
          }
        }

        let workModel: 'PRESENTIAL' | 'REMOTE' | 'HYBRID' = 'PRESENTIAL';
        if (rawWorkModel) {
          if (['PRESENTIAL', 'REMOTE', 'HYBRID'].includes(rawWorkModel)) {
            workModel = rawWorkModel as any;
          } else {
            errors.push({ line: row.lineNumber, message: `Modelo de trabalho inválido: ${rawWorkModel}. Deve ser PRESENTIAL, REMOTE ou HYBRID.` });
            continue;
          }
        }

        let managerUserId: string | null = null;
        let hasRowError = false;
        if (managerEmail) {
          const managerUser = await prisma.user.findFirst({
            where: { companyId, email: managerEmail, role: 'MANAGER' },
          });
          if (!managerUser) {
            errors.push({ line: row.lineNumber, message: `Gestor com e-mail ${managerEmail} não encontrado na empresa.` });
            hasRowError = true;
          } else {
            managerUserId = managerUser.id;
          }
        }

        let workScheduleId: string | null = null;
        if (workScheduleName) {
          const schedule = await prisma.workSchedule.findFirst({
            where: { companyId, name: workScheduleName, isActive: true },
          });
          if (!schedule) {
            errors.push({ line: row.lineNumber, message: `Escala de trabalho com nome "${workScheduleName}" não encontrada.` });
            hasRowError = true;
          } else {
            workScheduleId = schedule.id;
          }
        }

        if (hasRowError) {
          continue;
        }

        // Check company database duplicates
        const existingEmployee = await prisma.employee.findFirst({
          where: { companyId, cpf },
        });

        if (existingEmployee) {
          skipped.push({
            line: row.lineNumber,
            name,
            cpf,
            reason: 'CPF já cadastrado nesta empresa.',
          });
          continue;
        }

        validRows.push({
          name,
          cpf,
          whatsapp,
          email,
          sector,
          workModel,
          managerUserId,
          workScheduleId,
        });
      }

      // Check maxEmployees limit
      const sub = await PlanLimitsService.getCurrentSubscription(companyId);
      const plan = sub.plan;
      const currentActiveCount = await prisma.employee.count({
        where: { companyId, status: 'ACTIVE' },
      });

      if (currentActiveCount + validRows.length > plan.maxEmployees) {
        errors.push({
          line: 0,
          message: `Limite de funcionários do plano excedido. O limite do plano ${plan.name} é de ${plan.maxEmployees} funcionários. Atuais ativos: ${currentActiveCount}. Tentando importar mais ${validRows.length} novos válidos.`,
        });
      }

      if (errors.length > 0) {
        return reply.status(400).send({
          success: false,
          created: 0,
          skipped,
          errors,
        });
      }

      // Perform updates transactionally
      await prisma.$transaction(async (tx) => {
        for (const row of validRows) {
          await tx.employee.create({
            data: {
              companyId,
              fullName: row.name,
              cpf: row.cpf,
              whatsapp: row.whatsapp,
              email: row.email,
              sector: row.sector,
              workModel: row.workModel,
              managerUserId: row.managerUserId,
              workScheduleId: row.workScheduleId,
              status: 'ACTIVE',
            },
          });
        }

        // Create AuditLog (No personal info)
        await tx.auditLog.create({
          data: {
            companyId,
            userId: request.user.sub,
            action: 'EMPLOYEES_IMPORTED',
            entity: 'Employee',
            metadata: {
              createdCount: validRows.length,
              skippedCount: skipped.length,
            },
          },
        });
      });

      return reply.status(200).send({
        success: true,
        data: {
          created: validRows.length,
          skipped,
          errors: [],
        },
      });
    },
  );
}

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/);
  const rawLines = lines.filter((line) => line.trim().length > 0);

  if (rawLines.length === 0) {
    return { headers: [], rows: [] };
  }

  const firstLine = rawLines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result.map((val) => val.replace(/^"|"$/g, '').trim());
  };

  const headers = parseCsvLine(rawLines[0]);
  const rows = rawLines.slice(1).map((line, idx) => ({
    lineNumber: idx + 2,
    data: parseCsvLine(line),
  }));

  return { headers, rows };
}



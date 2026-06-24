import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/crypto';
import { requireRole } from '../lib/auth-middleware';

const onboardSchema = z.object({
  company: z.object({
    legalName: z.string().min(1, 'Razão social é obrigatória'),
    tradeName: z.string().min(1, 'Nome fantasia é obrigatório'),
    cnpj: z.string().min(1, 'CNPJ é obrigatório'),
  }),
  adminUser: z.object({
    name: z.string().min(1, 'Nome do administrador é obrigatório'),
    email: z.string().email('E-mail do administrador inválido'),
  }),
  planCode: z.string().min(1, 'Plano é obrigatório'),
});

const updateCompanySchema = z.object({
  legalName: z.string().optional(),
  tradeName: z.string().optional(),
  cnpj: z.string().optional(),
}).strict();

export default async function adminCompaniesRoutes(fastify: FastifyInstance) {
  // Enforce SUPER_ADMIN role validation for all routes in this plugin
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/companies
  fastify.get('/admin/companies', async (request, reply) => {
    try {
      const companies = await prisma.company.findMany({
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
          _count: {
            select: {
              employees: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Avoid returning super admin's platform company itself in the client list if needed,
      // but standard behavior is to list all companies.
      return reply.status(200).send({
        success: true,
        data: companies,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao listar empresas.',
        },
      });
    }
  });

  // POST /api/admin/companies/onboard
  fastify.post('/admin/companies/onboard', async (request, reply) => {
    const bodyResult = onboardSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const { company, adminUser, planCode } = bodyResult.data;

    // Normalize CNPJ to digits only
    const cnpj = company.cnpj.replace(/\D/g, '');

    // Validate CNPJ has 14 digits
    if (cnpj.length !== 14) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'O CNPJ deve conter exatamente 14 dígitos.',
        },
      });
    }

    try {
      // Validate unique CNPJ
      const existingCompany = await prisma.company.findFirst({
        where: { cnpj },
      });
      if (existingCompany) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CNPJ_DUPLICATED',
            message: 'Este CNPJ já está cadastrado.',
          },
        });
      }

      // Validate unique admin email
      const existingUser = await prisma.user.findFirst({
        where: { email: adminUser.email },
      });
      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'EMAIL_DUPLICATED',
            message: 'Este e-mail de administrador já está cadastrado.',
          },
        });
      }

      // Validate existing planCode
      const plan = await prisma.plan.findUnique({
        where: { code: planCode },
      });
      if (!plan) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PLAN_NOT_FOUND',
            message: 'O plano especificado não existe.',
          },
        });
      }

      // Generate a strong temporary password (e.g. 24 random hex characters)
      const tempPassword = crypto.randomBytes(12).toString('hex');
      const passwordHash = hashPassword(tempPassword);

      // Execute onboarding operations transactionally
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create Company
        const newCompany = await tx.company.create({
          data: {
            name: company.tradeName,
            legalName: company.legalName,
            cnpj,
            timezone: 'America/Sao_Paulo',
            isActive: true,
          },
        });

        // 2. Create CompanySettings default
        await tx.companySettings.create({
          data: {
            companyId: newCompany.id,
            defaultCheckinGraceMinutes: 30,
            allowManagerExport: true,
            allowViewerReports: true,
            enableRemoteCheckin: true,
            enableBatchCheckin: plan.enableBatchCheckin,
            enableMedicalCertificates: plan.enableMedicalModule,
          },
        });

        // 3. Create CompanySubscription ACTIVE
        await tx.companySubscription.create({
          data: {
            companyId: newCompany.id,
            planId: plan.id,
            status: 'ACTIVE',
            startedAt: new Date(),
          },
        });

        // 4. Create User ADMIN inicial with mustChangePassword=true
        const newAdmin = await tx.user.create({
          data: {
            companyId: newCompany.id,
            name: adminUser.name,
            email: adminUser.email,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
            mustChangePassword: true,
          },
        });

        // 5. Create WhatsAppChannel SIMULATED
        await tx.whatsAppChannel.create({
          data: {
            companyId: newCompany.id,
            provider: 'SIMULATED',
            status: 'SIMULATION',
            phoneNumber: '5511999999999',
            displayName: 'WhatsApp Simulado',
            providerConfig: {},
          },
        });

        // 6. Create AuditLog COMPANY_ONBOARDED (No sensitive plaintext password saved)
        await tx.auditLog.create({
          data: {
            companyId: newCompany.id,
            userId: request.user.sub,
            action: 'COMPANY_ONBOARDED',
            entity: 'Company',
            entityId: newCompany.id,
            metadata: {
              legalName: company.legalName,
              cnpj,
              planCode,
              adminEmail: adminUser.email,
            },
          },
        });

        return {
          company: newCompany,
          admin: newAdmin,
        };
      });

      // Return the temporary password ONLY ONCE in the response
      return reply.status(201).send({
        success: true,
        data: {
          company: result.company,
          admin: {
            id: result.admin.id,
            name: result.admin.name,
            email: result.admin.email,
            role: result.admin.role,
          },
          tempPassword,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao realizar o onboarding da empresa.',
        },
      });
    }
  });

  // GET /api/admin/companies/:id
  fastify.get('/admin/companies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
          settings: true,
          whatsappChannel: true,
          _count: {
            select: {
              employees: true,
              users: true,
            },
          },
        },
      });

      if (!company) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Empresa não encontrada.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: company,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar detalhes da empresa.',
        },
      });
    }
  });

  // PATCH /api/admin/companies/:id
  fastify.patch('/admin/companies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const bodyResult = updateCompanySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const { legalName, tradeName, cnpj } = bodyResult.data;

    try {
      const company = await prisma.company.findUnique({
        where: { id },
      });
      if (!company) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Empresa não encontrada.',
          },
        });
      }

      let normalizedCnpj: string | undefined = undefined;
      if (cnpj !== undefined) {
        normalizedCnpj = cnpj.replace(/\D/g, '');
        if (normalizedCnpj.length !== 14) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'O CNPJ deve conter exatamente 14 dígitos.',
            },
          });
        }

        const existingCnpj = await prisma.company.findFirst({
          where: {
            cnpj: normalizedCnpj,
            id: { not: id },
          },
        });
        if (existingCnpj) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'CNPJ_DUPLICATED',
              message: 'Este CNPJ já está cadastrado por outra empresa.',
            },
          });
        }
      }

      const updated = await prisma.company.update({
        where: { id },
        data: {
          legalName: legalName !== undefined ? legalName : undefined,
          name: tradeName !== undefined ? tradeName : undefined,
          cnpj: normalizedCnpj !== undefined ? normalizedCnpj : undefined,
        },
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao atualizar dados da empresa.',
        },
      });
    }
  });

  // POST /api/admin/companies/:id/deactivate
  fastify.post('/admin/companies/:id/deactivate', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const company = await prisma.company.findUnique({
        where: { id },
      });
      if (!company) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Empresa não encontrada.',
          },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id },
          data: { isActive: false },
        });

        await tx.auditLog.create({
          data: {
            companyId: id,
            userId: request.user.sub,
            action: 'COMPANY_DEACTIVATED',
            entity: 'Company',
            entityId: id,
            metadata: {
              executorEmail: request.user.email,
            },
          },
        });
      });

      return reply.status(200).send({
        success: true,
        message: 'Empresa desativada com sucesso.',
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao desativar empresa.',
        },
      });
    }
  });

  // POST /api/admin/companies/:id/reactivate
  fastify.post('/admin/companies/:id/reactivate', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const company = await prisma.company.findUnique({
        where: { id },
      });
      if (!company) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Empresa não encontrada.',
          },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id },
          data: { isActive: true },
        });

        await tx.auditLog.create({
          data: {
            companyId: id,
            userId: request.user.sub,
            action: 'COMPANY_REACTIVATED',
            entity: 'Company',
            entityId: id,
            metadata: {
              executorEmail: request.user.email,
            },
          },
        });
      });

      return reply.status(200).send({
        success: true,
        message: 'Empresa reativada com sucesso.',
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao reativar empresa.',
        },
      });
    }
  });
}

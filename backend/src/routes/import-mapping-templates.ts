import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';

export default async function importMappingTemplatesRoutes(fastify: FastifyInstance) {
  // Authentication hook
  fastify.addHook('preHandler', fastify.authenticate);

  // Apply HR and ADMIN role restrictions globally
  fastify.addHook('preHandler', requireRole(['ADMIN', 'HR']));

  // 1. GET /api/import-mapping-templates - List templates
  fastify.get('/import-mapping-templates', async (request, reply) => {
    const { companyId } = request.user;

    const templates = await prisma.importMappingTemplate.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    return reply.status(200).send({
      success: true,
      data: templates,
    });
  });

  // 2. POST /api/import-mapping-templates - Create template
  fastify.post('/import-mapping-templates', async (request, reply) => {
    const { companyId, sub } = request.user;

    const schema = z.object({
      name: z.string().min(1, 'Nome do template é obrigatório.'),
      sourceType: z.enum(['CSV', 'XLSX']).default('CSV'),
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
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Dados inválidos.' },
      });
    }

    const { name, sourceType, mappings } = parsed.data;

    // Check unique name per tenant
    const existing = await prisma.importMappingTemplate.findFirst({
      where: { companyId, name },
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'DUPLICATE_NAME', message: `Já existe um modelo de mapeamento com o nome "${name}".` },
      });
    }

    const template = await prisma.importMappingTemplate.create({
      data: {
        companyId,
        name,
        sourceType,
        mappings: mappings as any,
        createdByUserId: sub,
      },
    });

    return reply.status(201).send({
      success: true,
      data: template,
    });
  });

  // 3. PUT /api/import-mapping-templates/:id - Update template
  fastify.put('/import-mapping-templates/:id', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const schema = z.object({
      name: z.string().min(1, 'Nome do template é obrigatório.').optional(),
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
      }).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Dados inválidos.' },
      });
    }

    const template = await prisma.importMappingTemplate.findFirst({
      where: { id, companyId },
    });

    if (!template) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template de mapeamento não encontrado.' },
      });
    }

    if (parsed.data.name && parsed.data.name !== template.name) {
      const existing = await prisma.importMappingTemplate.findFirst({
        where: { companyId, name: parsed.data.name, NOT: { id } },
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'DUPLICATE_NAME', message: `Já existe outro modelo de mapeamento com o nome "${parsed.data.name}".` },
        });
      }
    }

    const updated = await prisma.importMappingTemplate.update({
      where: { id },
      data: {
        name: parsed.data.name,
        mappings: parsed.data.mappings ? (parsed.data.mappings as any) : undefined,
      },
    });

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  });

  // 4. DELETE /api/import-mapping-templates/:id - Delete template
  fastify.delete('/import-mapping-templates/:id', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const template = await prisma.importMappingTemplate.findFirst({
      where: { id, companyId },
    });

    if (!template) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template de mapeamento não encontrado.' },
      });
    }

    await prisma.importMappingTemplate.delete({
      where: { id },
    });

    return reply.status(200).send({
      success: true,
      data: { id },
    });
  });
}

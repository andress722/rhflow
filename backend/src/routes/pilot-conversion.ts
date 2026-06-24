import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { CustomerSuccessService } from '../services/customer-success.service';
import { getOnboardingData } from './onboarding';

// Helper to sanitize inputs and prevent script/HTML injection
function sanitizeInputString(str: string | null | undefined, maxLength = 255): string | null {
  if (!str) return null;
  const clean = str.replace(/<[^>]*>?/gm, '').trim();
  return clean.substring(0, maxLength);
}

const pilotStatusEnum = z.enum(['NOT_STARTED', 'ACTIVE', 'PROPOSAL_SENT', 'WON', 'LOST']);

const patchPilotSchema = z.object({
  pilotStatus: pilotStatusEnum.optional(),
  pilotStartedAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  pilotEndsAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  proposalSentAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  convertedAt: z.string().datetime({ precision: 3 }).or(z.string().pipe(z.coerce.date())).optional().nullable(),
  pilotLostReason: z.string().max(1000, 'O motivo de perda deve ter no máximo 1000 caracteres.').optional().nullable(),
  commercialNotes: z.string().max(5000, 'As notas comerciais devem ter no máximo 5000 caracteres.').optional().nullable(),
  planId: z.string().uuid('ID de plano inválido.').optional().nullable(),
});

export default async function pilotConversionRoutes(fastify: FastifyInstance) {
  // Global hook to require authentication and restrict to SUPER_ADMIN
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/plans
  fastify.get('/admin/plans', async (request, reply) => {
    try {
      const plans = await prisma.plan.findMany({
        orderBy: { name: 'asc' }
      });
      return reply.status(200).send({
        success: true,
        data: plans
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar planos.',
        }
      });
    }
  });

  // GET /api/admin/pilots
  fastify.get('/admin/pilots', async (request, reply) => {
    try {
      const { pilotStatus, plan, healthStatus, search, page, pageSize } = request.query as {
        pilotStatus?: string;
        plan?: string;
        healthStatus?: string;
        search?: string;
        page?: string;
        pageSize?: string;
      };

      const parsedPage = page ? parseInt(page, 10) : 1;
      const parsedPageSize = pageSize ? parseInt(pageSize, 10) : 10;
      const skip = (parsedPage - 1) * parsedPageSize;

      const where: any = {};
      if (pilotStatus) {
        where.pilotStatus = pilotStatus;
      }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { legalName: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (plan) {
        where.subscription = {
          plan: {
            code: { contains: plan, mode: 'insensitive' }
          }
        };
      }

      // Calculate global KPIs
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [
        activePilots,
        proposalsSent,
        wonPilots,
        lostPilots,
        expiringIn7Days
      ] = await Promise.all([
        prisma.company.count({ where: { pilotStatus: 'ACTIVE' } }),
        prisma.company.count({ where: { pilotStatus: 'PROPOSAL_SENT' } }),
        prisma.company.count({ where: { pilotStatus: 'WON' } }),
        prisma.company.count({ where: { pilotStatus: 'LOST' } }),
        prisma.company.count({
          where: {
            pilotStatus: { in: ['ACTIVE', 'PROPOSAL_SENT'] },
            pilotEndsAt: { gte: now, lte: sevenDaysFromNow }
          }
        })
      ]);

      // Fetch companies applying database pagination
      const total = await prisma.company.count({ where });
      const companies = await prisma.company.findMany({
        where,
        skip,
        take: parsedPageSize,
        include: {
          subscription: {
            include: { plan: true }
          }
        },
        orderBy: { name: 'asc' }
      });

      const items = [];
      for (const company of companies) {
        const healthData = await CustomerSuccessService.calculateCompanyHealth(company.id);

        // Apply healthStatus filter in-memory if requested
        if (healthStatus && healthData.status !== healthStatus) {
          continue;
        }

        items.push({
          companyId: company.id,
          companyName: company.name,
          plan: company.subscription?.plan.name || 'Starter',
          pilotStatus: company.pilotStatus,
          pilotStartedAt: company.pilotStartedAt?.toISOString() || null,
          pilotEndsAt: company.pilotEndsAt?.toISOString() || null,
          proposalSentAt: company.proposalSentAt?.toISOString() || null,
          convertedAt: company.convertedAt?.toISOString() || null,
          healthScore: healthData.healthScore,
          healthStatus: healthData.status,
          responseRate7d: healthData.adoptionMetrics.responseRate7d,
          activeEmployees: healthData.adoptionMetrics.activeEmployees,
          lastActivityAt: healthData.adoptionMetrics.lastActivityAt
        });
      }

      return reply.status(200).send({
        success: true,
        items,
        total,
        page: parsedPage,
        pageSize: parsedPageSize,
        activePilots,
        proposalsSent,
        wonPilots,
        lostPilots,
        expiringIn7Days
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao listar pilotos comerciais.',
        }
      });
    }
  });

  // GET /api/admin/pilots/:companyId
  fastify.get('/admin/pilots/:companyId', async (request, reply) => {
    try {
      const { companyId } = request.params as { companyId: string };

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          subscription: {
            include: { plan: true }
          }
        }
      });

      if (!company) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Empresa não encontrada.',
          }
        });
      }

      const healthData = await CustomerSuccessService.calculateCompanyHealth(companyId);
      const onboardingData = await getOnboardingData(companyId);

      return reply.status(200).send({
        success: true,
        data: {
          companyId: company.id,
          companyName: company.name,
          legalName: company.legalName,
          cnpj: company.cnpj,
          pilotStatus: company.pilotStatus,
          pilotStartedAt: company.pilotStartedAt?.toISOString() || null,
          pilotEndsAt: company.pilotEndsAt?.toISOString() || null,
          proposalSentAt: company.proposalSentAt?.toISOString() || null,
          convertedAt: company.convertedAt?.toISOString() || null,
          pilotLostReason: company.pilotLostReason,
          commercialNotes: company.commercialNotes,
          healthScore: healthData.healthScore,
          healthStatus: healthData.status,
          readiness: {
            blockers: onboardingData.blockers,
            warnings: onboardingData.warnings,
            completedItems: onboardingData.completedItems,
          },
          mainMetrics: healthData.adoptionMetrics,
          operationalMetrics: healthData.operationalMetrics,
          currentSubscription: {
            planId: company.subscription?.planId || null,
            planName: company.subscription?.plan.name || 'Starter',
            status: company.subscription?.status || 'ACTIVE'
          }
        }
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar detalhes do piloto.',
        }
      });
    }
  });

  // PATCH /api/admin/pilots/:companyId
  fastify.patch('/admin/pilots/:companyId', async (request, reply) => {
    try {
      const { companyId } = request.params as { companyId: string };
      const bodyResult = patchPilotSchema.safeParse(request.body || {});

      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parâmetros inválidos.',
            details: bodyResult.error.errors
          }
        });
      }

      const companyBefore = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          subscription: true
        }
      });

      if (!companyBefore) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Empresa não encontrada.',
          }
        });
      }

      const payload = bodyResult.data;

      // Validate Dates if both exist
      const started = payload.pilotStartedAt !== undefined ? payload.pilotStartedAt : companyBefore.pilotStartedAt;
      const ends = payload.pilotEndsAt !== undefined ? payload.pilotEndsAt : companyBefore.pilotEndsAt;
      if (started && ends && new Date(started) > new Date(ends)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DATES',
            message: 'A data de início do piloto não pode ser posterior à data de término.',
          }
        });
      }

      const proposalSent = payload.proposalSentAt !== undefined ? payload.proposalSentAt : companyBefore.proposalSentAt;
      if (started && proposalSent && new Date(proposalSent) < new Date(started)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DATES',
            message: 'A data de envio da proposta não pode ser anterior ao início do piloto.',
          }
        });
      }

      const converted = payload.convertedAt !== undefined ? payload.convertedAt : companyBefore.convertedAt;
      if (started && converted && new Date(converted) < new Date(started)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DATES',
            message: 'A data de conversão não pode ser anterior ao início do piloto.',
          }
        });
      }

      const nextStatus = payload.pilotStatus || companyBefore.pilotStatus;

      // State adjustments based on status transitions
      let pilotStartedAt = payload.pilotStartedAt;
      let pilotEndsAt = payload.pilotEndsAt;
      let proposalSentAt = payload.proposalSentAt;
      let convertedAt = payload.convertedAt;
      let pilotLostReason = payload.pilotLostReason ? sanitizeInputString(payload.pilotLostReason, 1000) : null;
      const commercialNotes = payload.commercialNotes !== undefined ? sanitizeInputString(payload.commercialNotes, 5000) : undefined;

      const now = new Date();

      if (nextStatus === 'ACTIVE') {
        if (pilotStartedAt === undefined && !companyBefore.pilotStartedAt) {
          pilotStartedAt = now;
        }
        pilotLostReason = null;
        if (convertedAt === undefined) {
          convertedAt = null;
        }
      } else if (nextStatus === 'PROPOSAL_SENT') {
        if (proposalSentAt === undefined && !companyBefore.proposalSentAt) {
          proposalSentAt = now;
        }
        pilotLostReason = null;
      } else if (nextStatus === 'WON') {
        if (convertedAt === undefined && !companyBefore.convertedAt) {
          convertedAt = now;
        }
        pilotLostReason = null;
      } else if (nextStatus === 'LOST') {
        const reasonToCheck = payload.pilotLostReason !== undefined ? payload.pilotLostReason : companyBefore.pilotLostReason;
        if (!reasonToCheck || reasonToCheck.trim() === '') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_LOST_REASON',
              message: 'Motivo de perda é obrigatório ao marcar o piloto como perdido (LOST).',
            }
          });
        }
        convertedAt = null;
      }

      // Update manual subscription billing settings if requested
      if (payload.planId) {
        const planExists = await prisma.plan.findUnique({
          where: { id: payload.planId }
        });

        if (!planExists) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'PLAN_NOT_FOUND',
              message: 'O plano especificado não existe.',
            }
          });
        }

        // Upsert manual subscription setting
        await prisma.companySubscription.upsert({
          where: { companyId },
          update: {
            planId: payload.planId,
            status: 'ACTIVE'
          },
          create: {
            companyId,
            planId: payload.planId,
            status: 'ACTIVE'
          }
        });

        // AuditLog separate signature update event
        await prisma.auditLog.create({
          data: {
            companyId,
            userId: request.user.sub,
            action: 'SUBSCRIPTION_PLAN_CHANGED',
            entity: 'CompanySubscription',
            entityId: companyId,
            metadata: {
              beforePlanId: companyBefore.subscription?.planId || null,
              afterPlanId: payload.planId
            },
            ip: request.ip,
            userAgent: request.headers['user-agent'] || null
          }
        });
      }

      const updateData: any = {};
      if (payload.pilotStatus !== undefined) updateData.pilotStatus = payload.pilotStatus;
      if (pilotStartedAt !== undefined) updateData.pilotStartedAt = pilotStartedAt;
      if (pilotEndsAt !== undefined) updateData.pilotEndsAt = pilotEndsAt;
      if (proposalSentAt !== undefined) updateData.proposalSentAt = proposalSentAt;
      if (convertedAt !== undefined) updateData.convertedAt = convertedAt;
      if (pilotLostReason !== undefined) updateData.pilotLostReason = pilotLostReason;
      if (commercialNotes !== undefined) updateData.commercialNotes = commercialNotes;

      const companyAfter = await prisma.company.update({
        where: { id: companyId },
        data: updateData
      });

      // AuditLog PILOT_UPDATED
      await prisma.auditLog.create({
        data: {
          companyId,
          userId: request.user.sub,
          action: 'PILOT_UPDATED',
          entity: 'Company',
          entityId: companyId,
          metadata: {
            before: {
              pilotStatus: companyBefore.pilotStatus,
              pilotStartedAt: companyBefore.pilotStartedAt,
              pilotEndsAt: companyBefore.pilotEndsAt,
              proposalSentAt: companyBefore.proposalSentAt,
              convertedAt: companyBefore.convertedAt,
              pilotLostReason: companyBefore.pilotLostReason
            },
            after: {
              pilotStatus: companyAfter.pilotStatus,
              pilotStartedAt: companyAfter.pilotStartedAt,
              pilotEndsAt: companyAfter.pilotEndsAt,
              proposalSentAt: companyAfter.proposalSentAt,
              convertedAt: companyAfter.convertedAt,
              pilotLostReason: companyAfter.pilotLostReason
            },
            commercialNotesChanged: companyBefore.commercialNotes !== companyAfter.commercialNotes
          },
          ip: request.ip,
          userAgent: request.headers['user-agent'] || null
        }
      });

      return reply.status(200).send({
        success: true,
        message: 'Piloto comercial atualizado com sucesso.',
        data: companyAfter
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao atualizar dados do piloto comercial.',
        }
      });
    }
  });

  // POST /api/admin/pilots/:companyId/generate-proposal-summary
  fastify.post('/admin/pilots/:companyId/generate-proposal-summary', async (request, reply) => {
    try {
      const { companyId } = request.params as { companyId: string };

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          subscription: {
            include: { plan: true }
          }
        }
      });

      if (!company) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Empresa não encontrada.',
          }
        });
      }

      const healthData = await CustomerSuccessService.calculateCompanyHealth(companyId);

      const planName = company.subscription?.plan.name || 'Starter';
      const startDateStr = company.pilotStartedAt ? company.pilotStartedAt.toLocaleDateString('pt-BR') : 'N/A';
      const endsDateStr = company.pilotEndsAt ? company.pilotEndsAt.toLocaleDateString('pt-BR') : 'N/A';

      const risksList = healthData.riskSignals.map((r: any) => `- **${r.title}** (${r.severity}): ${r.description}`).join('\n') || '- Nenhum risco crítico identificado.';
      const recsList = healthData.recommendations.map((r: any) => `- **${r.title}** (${r.priority}): ${r.description}`).join('\n') || '- Sem pendências pendentes.';

      // Generate clean summary markdown
      const summaryMarkdown = `# Resumo Executivo da Operação Piloto — ${company.name}

Este resumo consolida os resultados operacionais coletados durante o período do piloto comercial na plataforma PresençaFlow.

## 📊 Indicadores Gerais
* **Empresa**: ${company.name}
* **Plano Atual**: ${planName}
* **Status do Piloto**: ${company.pilotStatus}
* **Período**: de ${startDateStr} a ${endsDateStr}
* **Colaboradores Ativos**: ${healthData.adoptionMetrics.activeEmployees}
* **Health Score**: ${healthData.healthScore}/100 (${healthData.status})
* **Taxa de Resposta (Adesão)**: ${healthData.adoptionMetrics.responseRate7d}%

## 📈 Telemetria de Uso (Últimos 7 Dias)
* **Check-ins Disparados**: ${healthData.adoptionMetrics.remoteCheckinsSent7d}
* **Check-ins Respondidos**: ${healthData.adoptionMetrics.remoteCheckinsResponded7d}
* **Ocorrências Criadas**: ${healthData.operationalMetrics.occurrencesCreated7d}
* **Ocorrências Resolvidas**: ${healthData.operationalMetrics.occurrencesResolved7d}
* **Ocorrências em Aberto**: ${healthData.operationalMetrics.openOccurrences}
* **Atestados Médicos Enviados**: ${healthData.operationalMetrics.medicalCertificatesUploaded7d}
* **Atestados Médicos Revisados**: ${healthData.operationalMetrics.medicalCertificatesReviewed7d}
* **Consultas de Relatórios**: ${healthData.adoptionMetrics.reportsViewedOrExported7d}

## ⚠️ Riscos Identificados
${risksList}

## 💡 Próximos Passos & Recomendações
${recsList}
1. Assinatura formal do termo de adesão ao plano de produção.
2. Homologação final com a gerência do cliente.
`;

      const summaryData = {
        companyName: company.name,
        plan: planName,
        pilotStatus: company.pilotStatus,
        pilotPeriod: {
          start: company.pilotStartedAt ? company.pilotStartedAt.toISOString() : null,
          end: company.pilotEndsAt ? company.pilotEndsAt.toISOString() : null
        },
        healthScore: healthData.healthScore,
        healthStatus: healthData.status,
        activeEmployees: healthData.adoptionMetrics.activeEmployees,
        responseRate7d: healthData.adoptionMetrics.responseRate7d,
        checkinsSent7d: healthData.adoptionMetrics.remoteCheckinsSent7d,
        checkinsResponded7d: healthData.adoptionMetrics.remoteCheckinsResponded7d,
        occurrencesCreated7d: healthData.operationalMetrics.occurrencesCreated7d,
        occurrencesResolved7d: healthData.operationalMetrics.occurrencesResolved7d,
        openOccurrences: healthData.operationalMetrics.openOccurrences,
        medicalCertificatesUploaded7d: healthData.operationalMetrics.medicalCertificatesUploaded7d,
        medicalCertificatesReviewed7d: healthData.operationalMetrics.medicalCertificatesReviewed7d,
        reportsViewedOrExported7d: healthData.adoptionMetrics.reportsViewedOrExported7d,
        risksCount: healthData.riskSignals.length,
        recommendationsCount: healthData.recommendations.length
      };

      return reply.status(200).send({
        success: true,
        summaryMarkdown,
        summaryData
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao gerar resumo da proposta.',
        }
      });
    }
  });
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { RateLimiter } from '../lib/rate-limiter';
import { getSaoPauloDayRange, getSaoPauloMonthRange } from '../lib/date-helpers';
import { env } from '../config/env';
import { CommercialNotificationService } from '../services/commercial-notification.service';

// Helper to sanitize inputs and prevent script/HTML injection
function sanitizeInputString(str: string | null | undefined, maxLength = 255): string | null {
  if (!str) return null;
  // Strip tags and script characters
  const clean = str.replace(/<[^>]*>?/gm, '').trim();
  // Cut string to fit within max length constraints
  return clean.substring(0, maxLength);
}

const publicLeadSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(120, 'Nome deve ter no máximo 120 caracteres'),
  companyName: z.string().min(1, 'Empresa é obrigatória').max(160, 'Nome da empresa deve ter no máximo 160 caracteres'),
  role: z.string().max(100, 'Cargo deve ter no máximo 100 caracteres').optional().nullable(),
  email: z.string().email('E-mail inválido'),
  whatsapp: z.string().optional().nullable(),
  employeeCount: z.union([
    z.number().int().min(1).max(100000),
    z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(100000))
  ]).optional().nullable(),
  mainPain: z.string().optional().nullable(),
  
  // Marketing campaign inputs (supporting both camelCase and snake_case)
  utmSource: z.string().optional().nullable(),
  utm_source: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  utmContent: z.string().optional().nullable(),
  utm_content: z.string().optional().nullable(),
  utmTerm: z.string().optional().nullable(),
  utm_term: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
  landingPath: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  websiteUrl: z.string().max(256).optional().nullable(), // honeypot
});

const patchLeadSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST']).optional(),
  notes: z.string().optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  nextFollowUpAt: z.string().optional().nullable(),
  lastContactedAt: z.string().optional().nullable(),
  demoScheduledAt: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
});

const activitySchema = z.object({
  type: z.enum(['NOTE', 'STATUS_CHANGED', 'CONTACTED', 'DEMO_SCHEDULED', 'FOLLOW_UP_SCHEDULED', 'WON', 'LOST']),
  note: z.string().optional().nullable(),
  nextFollowUpAt: z.string().optional().nullable(),
  demoScheduledAt: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
});

export default async function pilotLeadsRoutes(fastify: FastifyInstance) {
  // 1. PUBLIC LEAD CAPTURE
  fastify.post('/public/pilot-leads', async (request, reply) => {
    const clientIp = request.ip;

    // Rate limiting check
    const rateLimitKey = `rate:pilot-leads:ip:${clientIp}`;
    const isBlocked = await RateLimiter.isBlocked(rateLimitKey);
    if (isBlocked) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Muitas solicitações a partir deste IP. Tente novamente mais tarde.',
        },
      });
    }
    await RateLimiter.increment(rateLimitKey);

    // Validate body
    const bodyResult = publicLeadSchema.safeParse(request.body || {});
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const {
      name,
      companyName,
      role,
      email,
      whatsapp,
      employeeCount,
      mainPain,
      utmSource,
      utm_source,
      utmMedium,
      utm_medium,
      utmCampaign,
      utm_campaign,
      utmContent,
      utm_content,
      utmTerm,
      utm_term,
      referrer,
      landingPath,
      source,
      websiteUrl
    } = bodyResult.data;

    // Honeypot check
    if (websiteUrl && websiteUrl.trim() !== '') {
      return reply.status(200).send({
        success: true,
        message: 'Recebemos seu interesse. Em breve entraremos em contato.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedWhatsapp = whatsapp ? whatsapp.replace(/\D/g, '') : null;

    try {
      // Deduplication check: email in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const existingLead = await prisma.pilotLead.findFirst({
        where: {
          email: normalizedEmail,
          createdAt: { gte: sevenDaysAgo },
        },
      });

      if (existingLead) {
        return reply.status(200).send({
          success: true,
          message: 'Recebemos seu interesse. Em breve entraremos em contato.',
        });
      }

      // Hash IP to protect privacy
      const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');
      const userAgent = sanitizeInputString(request.headers['user-agent'] || '', 512);

      // Sanitize campaign inputs
      const uSource = sanitizeInputString(utmSource || utm_source, 100);
      const uMedium = sanitizeInputString(utmMedium || utm_medium, 100);
      const uCampaign = sanitizeInputString(utmCampaign || utm_campaign, 100);
      const uContent = sanitizeInputString(utmContent || utm_content, 100);
      const uTerm = sanitizeInputString(utmTerm || utm_term, 100);
      const ref = sanitizeInputString(referrer, 1024);
      const path = sanitizeInputString(landingPath, 512);
      const src = sanitizeInputString(source, 100);

      // Save lead
      const lead = await prisma.pilotLead.create({
        data: {
          name: sanitizeInputString(name, 120) || '',
          companyName: sanitizeInputString(companyName, 160) || '',
          role: sanitizeInputString(role, 100),
          email: normalizedEmail,
          whatsapp: normalizedWhatsapp,
          employeeCount: employeeCount || null,
          mainPain: sanitizeInputString(mainPain, 100),
          source: src,
          ipHash,
          userAgent,
          metadata: {
            utmSource: uSource,
            utmMedium: uMedium,
            utmCampaign: uCampaign,
            utmContent: uContent,
            utmTerm: uTerm,
            referrer: ref,
            landingPath: path,
            source: src,
          },
        },
      });

      // Best effort commercial alert
      CommercialNotificationService.sendNewLeadAlert(lead).catch((err) => {
        fastify.log.error(err, 'Failed to send new lead commercial alert');
      });

      return reply.status(200).send({
        success: true,
        message: 'Recebemos seu interesse. Em breve entraremos em contato.',
      });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to save public pilot lead');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocorreu um erro interno ao processar sua solicitação.',
        },
      });
    }
  });

  // 2. ADMIN LEADS ROUTES (SUPER_ADMIN ONLY)
  fastify.register(async (adminContext) => {
    adminContext.addHook('preHandler', adminContext.authenticate);
    adminContext.addHook('preHandler', requireRole(['SUPER_ADMIN']));

    // GET /api/admin/commercial/tasks
    adminContext.get('/admin/commercial/tasks', async (request, reply) => {
      try {
        const now = new Date();
        const dayRange = getSaoPauloDayRange(now);
        const monthRange = getSaoPauloMonthRange(now);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 1. newUnassignedLeads
        const newUnassignedLeads = await prisma.pilotLead.count({
          where: {
            status: 'NEW',
            assignedToUserId: null,
          },
        });

        // 2. newUncontactedLeads
        const newUncontactedLeads = await prisma.pilotLead.count({
          where: {
            status: 'NEW',
            lastContactedAt: null,
            createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        // 3. overdueFollowUps
        const overdueFollowUps = await prisma.pilotLead.count({
          where: {
            nextFollowUpAt: { lte: now },
            NOT: { status: { in: ['WON', 'LOST'] } },
          },
        });

        // 4. demosToday
        const demosToday = await prisma.pilotLead.count({
          where: {
            demoScheduledAt: { gte: dayRange.start, lte: dayRange.end },
            NOT: { status: { in: ['WON', 'LOST'] } },
          },
        });

        // 5. staleQualifiedLeads
        const qualifiedLeads = await prisma.pilotLead.findMany({
          where: { status: 'QUALIFIED' },
          include: {
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });
        const staleQualifiedLeads = qualifiedLeads.filter((lead) => {
          const lastActivity = lead.activities[0];
          if (lastActivity) {
            return lastActivity.createdAt < sevenDaysAgo;
          }
          const fallback = lead.updatedAt || lead.createdAt;
          return fallback < sevenDaysAgo;
        }).length;

        // 6. wonThisMonth
        const wonThisMonth = await prisma.pilotLead.count({
          where: {
            status: 'WON',
            wonAt: { gte: monthRange.start, lte: monthRange.end },
          },
        });

        // 7. lostThisMonth
        const lostLeads = await prisma.pilotLead.findMany({
          where: { status: 'LOST' },
          include: {
            activities: {
              where: { type: 'LOST' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });
        const lostThisMonth = lostLeads.filter((lead) => {
          const lostActivity = lead.activities[0];
          if (lostActivity) {
            return lostActivity.createdAt >= monthRange.start && lostActivity.createdAt <= monthRange.end;
          }
          return lead.updatedAt >= monthRange.start && lead.updatedAt <= monthRange.end;
        }).length;

        return reply.status(200).send({
          success: true,
          data: {
            newUnassignedLeads: { count: newUnassignedLeads },
            newUncontactedLeads: { count: newUncontactedLeads },
            overdueFollowUps: { count: overdueFollowUps },
            demosToday: { count: demosToday },
            staleQualifiedLeads: { count: staleQualifiedLeads },
            wonThisMonth: { count: wonThisMonth },
            lostThisMonth: { count: lostThisMonth },
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao carregar tarefas comerciais.',
          },
        });
      }
    });

    // GET /api/admin/commercial/notification-preview
    adminContext.get('/admin/commercial/notification-preview', async (request, reply) => {
      try {
        const now = new Date();
        const dayRange = getSaoPauloDayRange(now);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // newLeadsToday
        const newLeadsToday = await prisma.pilotLead.count({
          where: {
            createdAt: { gte: dayRange.start, lte: dayRange.end },
          },
        });

        // overdueFollowUps
        const overdueFollowUps = await prisma.pilotLead.count({
          where: {
            nextFollowUpAt: { lte: now },
            NOT: { status: { in: ['WON', 'LOST'] } },
          },
        });

        // demosToday
        const demosToday = await prisma.pilotLead.count({
          where: {
            demoScheduledAt: { gte: dayRange.start, lte: dayRange.end },
            NOT: { status: { in: ['WON', 'LOST'] } },
          },
        });

        // staleQualifiedLeads
        const qualifiedLeads = await prisma.pilotLead.findMany({
          where: { status: 'QUALIFIED' },
          include: {
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });
        const staleQualifiedLeads = qualifiedLeads.filter((lead) => {
          const lastActivity = lead.activities[0];
          if (lastActivity) {
            return lastActivity.createdAt < sevenDaysAgo;
          }
          const fallback = lead.updatedAt || lead.createdAt;
          return fallback < sevenDaysAgo;
        }).length;

        const emails = env.COMMERCIAL_ALERT_EMAILS
          ? env.COMMERCIAL_ALERT_EMAILS.split(',').map((e: string) => e.trim()).filter(Boolean)
          : [];
        const phones = env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS
          ? env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS.split(',').map((p: string) => p.trim().replace(/\D/g, '')).filter(Boolean)
          : [];

        return reply.status(200).send({
          config: {
            emailEnabled: env.ENABLE_COMMERCIAL_EMAIL_ALERTS,
            whatsappEnabled: env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS,
            emailRecipientsCount: emails.length,
            whatsappRecipientsCount: phones.length,
            dailySummaryTime: env.COMMERCIAL_DAILY_SUMMARY_TIME,
          },
          summary: {
            newLeadsToday,
            overdueFollowUps,
            demosToday,
            staleQualifiedLeads,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao carregar preview das notificações.',
          },
        });
      }
    });

    // POST /api/admin/commercial/test-notification
    adminContext.post('/admin/commercial/test-notification', async (request, reply) => {
      try {
        const result = await CommercialNotificationService.sendTestNotification();
        return reply.status(200).send({
          success: true,
          ...result
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao enviar notificação de teste.',
          },
        });
      }
    });

    // POST /api/admin/leads/:id/quick-contact
    adminContext.post('/admin/leads/:id/quick-contact', async (request, reply) => {
      const { id } = request.params as { id: string };
      const bodyResult = z.object({
        note: z.string().optional().nullable(),
      }).safeParse(request.body || {});

      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: bodyResult.error.errors,
          },
        });
      }

      const { note } = bodyResult.data;

      try {
        const lead = await prisma.pilotLead.findUnique({
          where: { id },
        });

        if (!lead) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'LEAD_NOT_FOUND',
              message: 'Lead não encontrado.',
            },
          });
        }

        const now = new Date();
        const finalNote = note ? sanitizeInputString(note, 1000) : 'Contato rápido registrado.';

        // Perform updates and logs in transaction
        const updatedLead = await prisma.$transaction(async (tx) => {
          const updated = await tx.pilotLead.update({
            where: { id },
            data: {
              lastContactedAt: now,
            },
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

          await tx.leadActivity.create({
            data: {
              leadId: id,
              type: 'CONTACTED',
              note: finalNote,
              createdByUserId: request.user.sub,
            },
          });

          return updated;
        });

        // Audit Log
        await prisma.auditLog.create({
          data: {
            companyId: request.user.companyId || 'SYSTEM',
            userId: request.user.sub,
            action: 'LEAD_UPDATED',
            entity: 'PilotLead',
            entityId: id,
            metadata: {
              leadId: id,
              activityType: 'CONTACTED',
            },
            ip: request.ip,
            userAgent: request.headers['user-agent'] || null,
          },
        });

        const meta = (updatedLead.metadata as any) || {};
        const formattedLead = {
          id: updatedLead.id,
          name: updatedLead.name,
          companyName: updatedLead.companyName,
          role: updatedLead.role,
          email: updatedLead.email,
          whatsapp: updatedLead.whatsapp,
          employeeCount: updatedLead.employeeCount,
          mainPain: updatedLead.mainPain,
          status: updatedLead.status,
          source: updatedLead.source,
          notes: updatedLead.notes,
          assignedToUserId: updatedLead.assignedToUserId,
          assignedTo: updatedLead.assignedTo,
          nextFollowUpAt: updatedLead.nextFollowUpAt,
          lastContactedAt: updatedLead.lastContactedAt,
          demoScheduledAt: updatedLead.demoScheduledAt,
          lostReason: updatedLead.lostReason,
          wonAt: updatedLead.wonAt,
          createdAt: updatedLead.createdAt,
          updatedAt: updatedLead.updatedAt,
          utmSource: meta.utmSource || null,
          utmMedium: meta.utmMedium || null,
          utmCampaign: meta.utmCampaign || null,
          utmContent: meta.utmContent || null,
          utmTerm: meta.utmTerm || null,
          referrer: meta.referrer || null,
          landingPath: meta.landingPath || null,
        };

        return reply.status(200).send({
          success: true,
          data: formattedLead,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao registrar contato rápido.',
          },
        });
      }
    });

    // GET /api/admin/leads
    adminContext.get('/admin/leads', async (request, reply) => {
      try {
        const {
          status,
          from,
          to,
          search,
          source,
          utmCampaign,
          utmSource,
          limit,
          page,
          assignedToUserId,
          overdue,
          unassigned,
          uncontacted,
          demosToday,
          stale,
          wonThisMonth,
          lostThisMonth
        } = request.query as {
          status?: string;
          from?: string;
          to?: string;
          search?: string;
          source?: string;
          utmCampaign?: string;
          utmSource?: string;
          limit?: string;
          page?: string;
          assignedToUserId?: string;
          overdue?: string;
          unassigned?: string;
          uncontacted?: string;
          demosToday?: string;
          stale?: string;
          wonThisMonth?: string;
          lostThisMonth?: string;
        };

        const parsedLimit = Math.min(100, limit ? parseInt(limit, 10) : 50);
        const parsedPage = page ? parseInt(page, 10) : 1;
        const skip = (parsedPage - 1) * parsedLimit;

        const andFilters: any[] = [];
        const now = new Date();

        if (status) {
          andFilters.push({ status });
        }

        if (from || to) {
          const dateFilter: any = {};
          if (from) dateFilter.gte = new Date(from);
          if (to) dateFilter.lte = new Date(to);
          andFilters.push({ createdAt: dateFilter });
        }

        if (search) {
          andFilters.push({
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { companyName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          });
        }

        if (source) {
          andFilters.push({ source });
        }

        if (utmSource) {
          andFilters.push({
            metadata: {
              path: ['utmSource'],
              equals: utmSource,
            },
          });
        }

        if (utmCampaign) {
          andFilters.push({
            metadata: {
              path: ['utmCampaign'],
              equals: utmCampaign,
            },
          });
        }

        if (assignedToUserId) {
          andFilters.push({ assignedToUserId });
        }

        if (unassigned === 'true') {
          andFilters.push({ assignedToUserId: null });
        }

        if (uncontacted === 'true') {
          andFilters.push({
            status: 'NEW',
            lastContactedAt: null,
            createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          });
        }

        if (overdue === 'true') {
          andFilters.push({
            nextFollowUpAt: { lte: now },
            NOT: { status: { in: ['WON', 'LOST'] } }
          });
        }

        if (demosToday === 'true') {
          const dayRange = getSaoPauloDayRange(now);
          andFilters.push({
            demoScheduledAt: { gte: dayRange.start, lte: dayRange.end },
            NOT: { status: { in: ['WON', 'LOST'] } }
          });
        }

        if (stale === 'true') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          andFilters.push({
            status: 'QUALIFIED',
            OR: [
              {
                AND: [
                  { activities: { some: {} } },
                  { activities: { none: { createdAt: { gte: sevenDaysAgo } } } }
                ]
              },
              {
                activities: { none: {} },
                updatedAt: { lt: sevenDaysAgo }
              }
            ]
          });
        }

        if (wonThisMonth === 'true') {
          const monthRange = getSaoPauloMonthRange(now);
          andFilters.push({
            status: 'WON',
            wonAt: { gte: monthRange.start, lte: monthRange.end }
          });
        }

        if (lostThisMonth === 'true') {
          const monthRange = getSaoPauloMonthRange(now);
          andFilters.push({
            status: 'LOST',
            OR: [
              {
                activities: {
                  some: {
                    type: 'LOST',
                    createdAt: { gte: monthRange.start, lte: monthRange.end }
                  }
                }
              },
              {
                activities: {
                  none: {
                    type: 'LOST'
                  }
                },
                updatedAt: { gte: monthRange.start, lte: monthRange.end }
              }
            ]
          });
        }

        const where = andFilters.length > 0 ? { AND: andFilters } : {};

        const leads = await prisma.pilotLead.findMany({
          where,
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: parsedLimit,
          skip,
        });

        const totalCount = await prisma.pilotLead.count({ where });

        // Map metadata JSON fields to flat response structure
        const formattedLeads = leads.map(lead => {
          const meta = (lead.metadata as any) || {};
          return {
            id: lead.id,
            name: lead.name,
            companyName: lead.companyName,
            role: lead.role,
            email: lead.email,
            whatsapp: lead.whatsapp,
            employeeCount: lead.employeeCount,
            mainPain: lead.mainPain,
            status: lead.status,
            source: lead.source,
            notes: lead.notes,
            assignedToUserId: lead.assignedToUserId,
            assignedTo: lead.assignedTo,
            nextFollowUpAt: lead.nextFollowUpAt,
            lastContactedAt: lead.lastContactedAt,
            demoScheduledAt: lead.demoScheduledAt,
            lostReason: lead.lostReason,
            wonAt: lead.wonAt,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
            utmSource: meta.utmSource || null,
            utmMedium: meta.utmMedium || null,
            utmCampaign: meta.utmCampaign || null,
            utmContent: meta.utmContent || null,
            utmTerm: meta.utmTerm || null,
            referrer: meta.referrer || null,
            landingPath: meta.landingPath || null,
          };
        });

        return reply.status(200).send({
          success: true,
          data: formattedLeads,
          pagination: {
            total: totalCount,
            limit: parsedLimit,
            page: parsedPage,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao carregar lista de leads.',
          },
        });
      }
    });

    // GET /api/admin/leads/follow-ups/due
    adminContext.get('/admin/leads/follow-ups/due', async (request, reply) => {
      try {
        const { assignedToUserId, limit } = request.query as {
          assignedToUserId?: string;
          limit?: string;
        };

        const parsedLimit = Math.min(100, limit ? parseInt(limit, 10) : 50);
        const now = new Date();

        const andFilters: any[] = [
          { nextFollowUpAt: { lte: now } },
          { NOT: { status: { in: ['WON', 'LOST'] } } }
        ];

        if (assignedToUserId) {
          andFilters.push({ assignedToUserId });
        }

        const leads = await prisma.pilotLead.findMany({
          where: { AND: andFilters },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { nextFollowUpAt: 'asc' },
          take: parsedLimit,
        });

        // Map metadata JSON fields to flat response structure
        const formattedLeads = leads.map(lead => {
          const meta = (lead.metadata as any) || {};
          return {
            id: lead.id,
            name: lead.name,
            companyName: lead.companyName,
            role: lead.role,
            email: lead.email,
            whatsapp: lead.whatsapp,
            employeeCount: lead.employeeCount,
            mainPain: lead.mainPain,
            status: lead.status,
            source: lead.source,
            notes: lead.notes,
            assignedToUserId: lead.assignedToUserId,
            assignedTo: lead.assignedTo,
            nextFollowUpAt: lead.nextFollowUpAt,
            lastContactedAt: lead.lastContactedAt,
            demoScheduledAt: lead.demoScheduledAt,
            lostReason: lead.lostReason,
            wonAt: lead.wonAt,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
            utmSource: meta.utmSource || null,
            utmMedium: meta.utmMedium || null,
            utmCampaign: meta.utmCampaign || null,
            utmContent: meta.utmContent || null,
            utmTerm: meta.utmTerm || null,
            referrer: meta.referrer || null,
            landingPath: meta.landingPath || null,
          };
        });

        return reply.status(200).send({
          success: true,
          data: formattedLeads,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao buscar follow-ups vencidos.',
          },
        });
      }
    });

    // GET /api/admin/leads/:id
    adminContext.get('/admin/leads/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const lead = await prisma.pilotLead.findUnique({
          where: { id },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        if (!lead) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'LEAD_NOT_FOUND',
              message: 'Lead não encontrado.',
            },
          });
        }

        const meta = (lead.metadata as any) || {};
        const formattedLead = {
          id: lead.id,
          name: lead.name,
          companyName: lead.companyName,
          role: lead.role,
          email: lead.email,
          whatsapp: lead.whatsapp,
          employeeCount: lead.employeeCount,
          mainPain: lead.mainPain,
          status: lead.status,
          source: lead.source,
          notes: lead.notes,
          assignedToUserId: lead.assignedToUserId,
          assignedTo: lead.assignedTo,
          nextFollowUpAt: lead.nextFollowUpAt,
          lastContactedAt: lead.lastContactedAt,
          demoScheduledAt: lead.demoScheduledAt,
          lostReason: lead.lostReason,
          wonAt: lead.wonAt,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
          utmSource: meta.utmSource || null,
          utmMedium: meta.utmMedium || null,
          utmCampaign: meta.utmCampaign || null,
          utmContent: meta.utmContent || null,
          utmTerm: meta.utmTerm || null,
          referrer: meta.referrer || null,
          landingPath: meta.landingPath || null,
        };

        return reply.status(200).send({
          success: true,
          data: formattedLead,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao buscar detalhe do lead.',
          },
        });
      }
    });

    // PATCH /api/admin/leads/:id
    adminContext.patch('/admin/leads/:id', async (request, reply) => {
      const { id } = request.params as { id: string };

      const bodyResult = patchLeadSchema.safeParse(request.body || {});
      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos para atualização.',
            details: bodyResult.error.errors,
          },
        });
      }

      const {
        status,
        notes,
        assignedToUserId,
        nextFollowUpAt,
        lastContactedAt,
        demoScheduledAt,
        lostReason
      } = bodyResult.data;

      try {
        const lead = await prisma.pilotLead.findUnique({
          where: { id },
        });

        if (!lead) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'LEAD_NOT_FOUND',
              message: 'Lead não encontrado.',
            },
          });
        }

        // Validate assignedToUserId role
        if (assignedToUserId) {
          const userToAssign = await prisma.user.findUnique({
            where: { id: assignedToUserId },
          });
          if (!userToAssign || !userToAssign.isActive || userToAssign.role !== 'SUPER_ADMIN') {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'INVALID_ASSIGNMENT',
                message: 'Responsável deve ser um usuário ativo com privilégios de SUPER_ADMIN.',
              },
            });
          }
        }

        const now = new Date();
        let wonAtUpdate: Date | null = lead.wonAt;
        let lostReasonUpdate: string | null = lead.lostReason;
        let nextFollowUpAtUpdate: Date | null = nextFollowUpAt !== undefined ? (nextFollowUpAt ? new Date(nextFollowUpAt) : null) : lead.nextFollowUpAt;
        let demoScheduledAtUpdate: Date | null = demoScheduledAt !== undefined ? (demoScheduledAt ? new Date(demoScheduledAt) : null) : lead.demoScheduledAt;
        let lastContactedAtUpdate: Date | null = lastContactedAt !== undefined ? (lastContactedAt ? new Date(lastContactedAt) : null) : lead.lastContactedAt;
        let assignedToUserIdUpdate: string | null = assignedToUserId !== undefined ? assignedToUserId : lead.assignedToUserId;

        const activitiesToCreate: any[] = [];

        if (status !== undefined && status !== lead.status) {
          if (status === 'WON') {
            wonAtUpdate = now;
            lostReasonUpdate = null;
            nextFollowUpAtUpdate = null;
            activitiesToCreate.push({
              type: 'WON',
              note: 'Lead marcado como GANHO (Piloto Fechado).',
              createdByUserId: request.user.sub,
            });
          } else if (status === 'LOST') {
            if (!lostReason || !lostReason.trim()) {
              return reply.status(400).send({
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'O motivo de perda (lostReason) é obrigatório ao marcar o lead como PERDIDO.',
                },
              });
            }
            lostReasonUpdate = lostReason;
            wonAtUpdate = null;
            nextFollowUpAtUpdate = null;
            activitiesToCreate.push({
              type: 'LOST',
              note: `Lead marcado como PERDIDO. Motivo: ${lostReason}`,
              createdByUserId: request.user.sub,
              metadata: { lostReason },
            });
          } else {
            // Clean up wonAt if exited WON
            if (lead.status === 'WON') {
              wonAtUpdate = null;
            }
            // Clean up lostReason if exited LOST
            if (lead.status === 'LOST') {
              lostReasonUpdate = null;
            }
            activitiesToCreate.push({
              type: 'STATUS_CHANGED',
              note: `Status alterado de ${lead.status} para ${status}.`,
              createdByUserId: request.user.sub,
              metadata: { fromStatus: lead.status, toStatus: status },
            });
          }
        }

        if (notes !== undefined && notes !== lead.notes) {
          activitiesToCreate.push({
            type: 'NOTE',
            note: notes,
            createdByUserId: request.user.sub,
          });
        }

        // Perform update and activities creation in transaction
        const updatedLead = await prisma.$transaction(async (tx) => {
          const updated = await tx.pilotLead.update({
            where: { id },
            data: {
              ...(status !== undefined && { status }),
              ...(notes !== undefined && { notes: sanitizeInputString(notes, 1000) }),
              assignedToUserId: assignedToUserIdUpdate,
              nextFollowUpAt: nextFollowUpAtUpdate,
              lastContactedAt: lastContactedAtUpdate,
              demoScheduledAt: demoScheduledAtUpdate,
              lostReason: lostReasonUpdate,
              wonAt: wonAtUpdate,
            },
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

          for (const act of activitiesToCreate) {
            await tx.leadActivity.create({
              data: {
                leadId: id,
                type: act.type,
                note: act.note,
                createdByUserId: act.createdByUserId,
                metadata: act.metadata,
              },
            });
          }

          return updated;
        });

        // Create AuditLog entry
        await prisma.auditLog.create({
          data: {
            companyId: request.user.companyId || 'SYSTEM',
            userId: request.user.sub,
            action: 'LEAD_UPDATED',
            entity: 'PilotLead',
            entityId: id,
            metadata: {
              previousStatus: lead.status,
              newStatus: status !== undefined ? status : lead.status,
              notesUpdated: notes !== undefined,
            },
            ip: request.ip,
            userAgent: request.headers['user-agent'] || null,
          },
        });

        const meta = (updatedLead.metadata as any) || {};
        const formattedLead = {
          id: updatedLead.id,
          name: updatedLead.name,
          companyName: updatedLead.companyName,
          role: updatedLead.role,
          email: updatedLead.email,
          whatsapp: updatedLead.whatsapp,
          employeeCount: updatedLead.employeeCount,
          mainPain: updatedLead.mainPain,
          status: updatedLead.status,
          source: updatedLead.source,
          notes: updatedLead.notes,
          assignedToUserId: updatedLead.assignedToUserId,
          assignedTo: updatedLead.assignedTo,
          nextFollowUpAt: updatedLead.nextFollowUpAt,
          lastContactedAt: updatedLead.lastContactedAt,
          demoScheduledAt: updatedLead.demoScheduledAt,
          lostReason: updatedLead.lostReason,
          wonAt: updatedLead.wonAt,
          createdAt: updatedLead.createdAt,
          updatedAt: updatedLead.updatedAt,
          utmSource: meta.utmSource || null,
          utmMedium: meta.utmMedium || null,
          utmCampaign: meta.utmCampaign || null,
          utmContent: meta.utmContent || null,
          utmTerm: meta.utmTerm || null,
          referrer: meta.referrer || null,
          landingPath: meta.landingPath || null,
        };

        return reply.status(200).send({
          success: true,
          data: formattedLead,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao atualizar lead.',
          },
        });
      }
    });

    // POST /api/admin/leads/:id/activities
    adminContext.post('/admin/leads/:id/activities', async (request, reply) => {
      const { id } = request.params as { id: string };
      const bodyResult = activitySchema.safeParse(request.body || {});
      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos para atividade.',
            details: bodyResult.error.errors,
          },
        });
      }

      const { type, note, nextFollowUpAt, demoScheduledAt, lostReason } = bodyResult.data;

      try {
        const lead = await prisma.pilotLead.findUnique({
          where: { id },
        });

        if (!lead) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'LEAD_NOT_FOUND',
              message: 'Lead não encontrado.',
            },
          });
        }

        const now = new Date();
        let updateData: any = {};
        let finalNote = note || '';

        if (type === 'CONTACTED') {
          updateData.lastContactedAt = now;
          if (!finalNote) {
            finalNote = 'Contato realizado com o lead.';
          }
        } else if (type === 'FOLLOW_UP_SCHEDULED') {
          if (!nextFollowUpAt) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'A data do próximo follow-up é obrigatória.',
              },
            });
          }
          const followUpDate = new Date(nextFollowUpAt);
          if (followUpDate <= now) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'A data do próximo follow-up deve ser no futuro.',
              },
            });
          }
          updateData.nextFollowUpAt = followUpDate;
          if (!finalNote) {
            finalNote = `Próximo follow-up agendado para ${followUpDate.toLocaleString()}.`;
          }
        } else if (type === 'DEMO_SCHEDULED') {
          if (!demoScheduledAt) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'A data da demonstração é obrigatória.',
              },
            });
          }
          const demoDate = new Date(demoScheduledAt);
          if (demoDate <= now) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'A data da demonstração deve ser no futuro.',
              },
            });
          }
          updateData.demoScheduledAt = demoDate;
          if (!finalNote) {
            finalNote = `Demonstração agendada para ${demoDate.toLocaleString()}.`;
          }
        } else if (type === 'NOTE') {
          if (!note || !note.trim()) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'O texto da nota é obrigatório.',
              },
            });
          }
        } else if (type === 'WON') {
          updateData.status = 'WON';
          updateData.wonAt = now;
          updateData.lostReason = null;
          updateData.nextFollowUpAt = null;
          if (!finalNote) {
            finalNote = 'Lead ganho! Piloto fechado.';
          }
        } else if (type === 'LOST') {
          const reason = lostReason || note;
          if (!reason || !reason.trim()) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'O motivo de perda é obrigatório no campo lostReason ou note.',
              },
            });
          }
          updateData.status = 'LOST';
          updateData.lostReason = reason;
          updateData.wonAt = null;
          updateData.nextFollowUpAt = null;
          if (!finalNote) {
            finalNote = `Lead perdido. Motivo: ${reason}`;
          }
        }

        // Run updates and create activity inside transaction
        const result = await prisma.$transaction(async (tx) => {
          if (Object.keys(updateData).length > 0) {
            await tx.pilotLead.update({
              where: { id },
              data: updateData,
            });
          }

          const activity = await tx.leadActivity.create({
            data: {
              leadId: id,
              type,
              note: finalNote,
              createdByUserId: request.user.sub,
              metadata: type === 'LOST' ? { lostReason: updateData.lostReason } : undefined,
            },
            include: {
              createdByUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

          return activity;
        });

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao registrar atividade.',
          },
        });
      }
    });

    // GET /api/admin/leads/:id/activities
    adminContext.get('/admin/leads/:id/activities', async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const lead = await prisma.pilotLead.findUnique({
          where: { id },
        });

        if (!lead) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'LEAD_NOT_FOUND',
              message: 'Lead não encontrado.',
            },
          });
        }

        const activities = await prisma.leadActivity.findMany({
          where: { leadId: id },
          include: {
            createdByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const formatted = activities.map(act => ({
          id: act.id,
          type: act.type,
          note: act.note,
          metadata: act.metadata,
          createdAt: act.createdAt,
          createdByUser: act.createdByUser,
        }));

        return reply.status(200).send({
          success: true,
          data: formatted,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: err.message || 'Erro ao carregar atividades do lead.',
          },
        });
      }
    });
  });
}

import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { getLocalDateInSaoPaulo } from '../services/remote-checkin.service';

// Helper to get current period as YYYY-MM
function getCurrentPeriod(): string {
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  };
  const formatter = new Intl.DateTimeFormat('en-US', formatOptions);
  const parts = formatter.formatToParts(new Date());
  const month = parts.find(p => p.type === 'month')?.value;
  const year = parts.find(p => p.type === 'year')?.value;
  return `${year}-${month}`;
}

export default async function adminSupportRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication and SUPER_ADMIN restriction globally to this route file
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/support/overview
  fastify.get('/admin/support/overview', async (request, reply) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        totalCompanies,
        activeCompanies,
        inactiveCompanies,
        activeUsers,
        checkinsToday,
        openOccurrences,
        pendingMedicalCertificates,
        whatsappChannelsInError
      ] = await Promise.all([
        prisma.company.count(),
        prisma.company.count({ where: { isActive: true } }),
        prisma.company.count({ where: { isActive: false } }),
        prisma.user.count({ where: { isActive: true } }),
        prisma.remoteCheckin.count({ where: { checkinDate: getLocalDateInSaoPaulo() } }),
        prisma.occurrence.count({ where: { status: 'OPEN' } }),
        prisma.medicalCertificate.count({ where: { status: 'RECEIVED' } }),
        prisma.whatsAppChannel.count({ where: { status: 'ERROR' } })
      ]);

      const jobsToday = await prisma.auditLog.count({
        where: {
          action: { contains: 'JOB', mode: 'insensitive' },
          createdAt: { gte: todayStart }
        }
      }).catch(() => null);

      // Compute companiesNearPlanLimit (planUsagePercent >= 80)
      const allCompanies = await prisma.company.findMany({
        include: {
          subscription: {
            include: { plan: true }
          },
          _count: {
            select: {
              employees: { where: { status: 'ACTIVE' } }
            }
          }
        }
      });

      const currentPeriod = getCurrentPeriod();
      const allCheckinsUsage = await prisma.usageCounter.findMany({
        where: {
          period: currentPeriod,
          key: 'remote_checkins',
        },
      });
      const checkinsUsageMap = new Map(allCheckinsUsage.map(c => [c.companyId, c.value]));

      let companiesNearPlanLimit = 0;
      for (const company of allCompanies) {
        const sub = company.subscription;
        const maxEmployees = sub?.plan.maxEmployees ?? 5;
        const maxMonthlyCheckins = sub?.plan.maxMonthlyCheckins ?? 100;

        const activeEmployees = company._count.employees;
        const checkinsCount = checkinsUsageMap.get(company.id) ?? 0;

        const empPercent = maxEmployees > 0 ? (activeEmployees / maxEmployees) * 100 : 0;
        const checkinPercent = maxMonthlyCheckins > 0 ? (checkinsCount / maxMonthlyCheckins) * 100 : 0;

        const usagePercent = Math.max(empPercent, checkinPercent);
        if (usagePercent >= 80) {
          companiesNearPlanLimit++;
        }
      }

      return reply.status(200).send({
        success: true,
        data: {
          totalCompanies,
          activeCompanies,
          inactiveCompanies,
          activeUsers,
          checkinsToday,
          openOccurrences,
          pendingMedicalCertificates,
          jobsToday,
          whatsappChannelsInError,
          companiesNearPlanLimit,
        }
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar visão geral de suporte.',
        }
      });
    }
  });

  // GET /api/admin/support/recent-errors
  fastify.get('/admin/support/recent-errors', async (request, reply) => {
    try {
      const { companyId, errorCode, statusCode, from, to, limit, page } = request.query as {
        companyId?: string;
        errorCode?: string;
        statusCode?: string;
        from?: string;
        to?: string;
        limit?: string;
        page?: string;
      };

      const parsedLimit = Math.min(100, limit ? parseInt(limit, 10) : 50);
      const parsedPage = page ? parseInt(page, 10) : 1;
      const skip = (parsedPage - 1) * parsedLimit;

      const where: any = {};
      if (companyId) where.companyId = companyId;
      if (errorCode) where.errorCode = errorCode;
      if (statusCode) where.statusCode = parseInt(statusCode, 10);
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }

      const errors = await prisma.operationalErrorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parsedLimit,
        skip,
        select: {
          id: true,
          companyId: true,
          userId: true,
          requestId: true,
          route: true,
          method: true,
          errorCode: true,
          message: true,
          statusCode: true,
          createdAt: true,
        },
      });

      return reply.status(200).send({
        success: true,
        data: errors,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao consultar erros recentes.',
        }
      });
    }
  });

  // GET /api/admin/support/request/:requestId
  fastify.get('/admin/support/request/:requestId', async (request, reply) => {
    try {
      const { requestId } = request.params as { requestId: string };

      const items = await prisma.operationalErrorLog.findMany({
        where: { requestId },
        orderBy: { createdAt: 'asc' },
      });

      if (items.length === 0) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'REQUEST_NOT_FOUND',
            message: 'Nenhum log encontrado para este requestId.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: {
          requestId,
          items: items.map(item => ({
            errorCode: item.errorCode,
            message: item.message,
            statusCode: item.statusCode,
            route: item.route,
            method: item.method,
            companyId: item.companyId,
            userId: item.userId,
            createdAt: item.createdAt,
            metadata: item.metadata,
          })),
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao buscar requestId.',
        }
      });
    }
  });

  // GET /api/admin/support/company-health
  fastify.get('/admin/support/company-health', async (request, reply) => {
    try {
      const { search, limit, page } = request.query as {
        search?: string;
        limit?: string;
        page?: string;
      };

      const parsedLimit = Math.min(100, limit ? parseInt(limit, 10) : 50);
      const parsedPage = page ? parseInt(page, 10) : 1;
      const skip = (parsedPage - 1) * parsedLimit;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { legalName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const companies = await prisma.company.findMany({
        where,
        include: {
          subscription: {
            include: { plan: true }
          },
          users: {
            orderBy: { lastLoginAt: 'desc' },
            take: 1,
            select: { lastLoginAt: true }
          },
          whatsappChannel: {
            select: { status: true }
          },
          _count: {
            select: {
              employees: { where: { status: 'ACTIVE' } },
              occurrences: { where: { status: 'OPEN' } },
              medicalCertificates: { where: { status: 'RECEIVED' } }
            }
          }
        },
        orderBy: { name: 'asc' },
        take: parsedLimit,
        skip,
      });

      const companyIds = companies.map(c => c.id);

      // Fetch lastErrorAt per company
      const errorLogs = await prisma.operationalErrorLog.groupBy({
        by: ['companyId'],
        where: { companyId: { in: companyIds } },
        _max: { createdAt: true },
      });
      const errorLogMap = new Map(
        errorLogs
          .filter(log => log.companyId !== null)
          .map(log => [log.companyId!, log._max.createdAt])
      );

      // Fetch checkinsLast7Days per company
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const checkins = await prisma.remoteCheckin.groupBy({
        by: ['companyId'],
        where: {
          companyId: { in: companyIds },
          createdAt: { gte: sevenDaysAgo },
        },
        _count: { id: true },
      });
      const checkinsMap = new Map(checkins.map(c => [c.companyId, c._count.id]));

      // Fetch usage counters per company for planUsagePercent
      const currentPeriod = getCurrentPeriod();
      const counters = await prisma.usageCounter.findMany({
        where: {
          companyId: { in: companyIds },
          period: currentPeriod,
          key: 'remote_checkins',
        },
      });
      const checkinsUsageMap = new Map(counters.map(c => [c.companyId, c.value]));

      const data = companies.map(company => {
        const sub = company.subscription;
        const maxEmployees = sub?.plan.maxEmployees ?? 5;
        const maxMonthlyCheckins = sub?.plan.maxMonthlyCheckins ?? 100;

        const activeEmployees = company._count.employees;
        const checkinsCount = checkinsUsageMap.get(company.id) ?? 0;

        const empPercent = maxEmployees > 0 ? (activeEmployees / maxEmployees) * 100 : 0;
        const checkinPercent = maxMonthlyCheckins > 0 ? (checkinsCount / maxMonthlyCheckins) * 100 : 0;

        const planUsagePercent = Math.min(100, Math.max(empPercent, checkinPercent));

        return {
          companyId: company.id,
          tradeName: company.name,
          legalName: company.legalName,
          isActive: company.isActive,
          plan: sub?.plan.name || 'Starter',
          subscriptionStatus: sub?.status || 'ACTIVE',
          activeEmployees,
          openOccurrences: company._count.occurrences,
          pendingMedicalCertificates: company._count.medicalCertificates,
          checkinsLast7Days: checkinsMap.get(company.id) ?? 0,
          lastLoginAt: company.users[0]?.lastLoginAt || null,
          whatsappStatus: company.whatsappChannel?.status || 'DISCONNECTED',
          planUsagePercent,
          lastErrorAt: errorLogMap.get(company.id) || null,
        };
      });

      return reply.status(200).send({
        success: true,
        data,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar saúde das empresas.',
        }
      });
    }
  });

  // GET /api/admin/support/pilot-metrics
  fastify.get('/admin/support/pilot-metrics', async (request, reply) => {
    try {
      const { from, to } = request.query as { from?: string; to?: string };

      const now = new Date();
      let fromDate = from ? new Date(from) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      let toDate = to ? new Date(to) : now;

      // Validate
      if (isNaN(fromDate.getTime())) {
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      if (isNaN(toDate.getTime())) {
        toDate = now;
      }

      // Cap at 90 days
      const diffMs = toDate.getTime() - fromDate.getTime();
      const maxDiffMs = 90 * 24 * 60 * 60 * 1000;
      if (diffMs > maxDiffMs) {
        fromDate = new Date(toDate.getTime() - maxDiffMs);
      }

      const [
        checkinsSent,
        notRespondedCount,
        checkinsResponded,
        occurrencesCreated,
        medicalCertificatesReceived,
        reportsExported,
        activeUsersCount
      ] = await Promise.all([
        prisma.remoteCheckin.count({
          where: { createdAt: { gte: fromDate, lte: toDate } },
        }),
        prisma.remoteCheckin.count({
          where: {
            status: 'NOT_RESPONDED',
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.remoteCheckin.count({
          where: {
            respondedAt: { not: null },
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.occurrence.count({
          where: { createdAt: { gte: fromDate, lte: toDate } },
        }),
        prisma.medicalCertificate.count({
          where: { createdAt: { gte: fromDate, lte: toDate } },
        }),
        prisma.auditLog.count({
          where: {
            action: { contains: 'EXPORT', mode: 'insensitive' },
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.user.count({
          where: {
            isActive: true,
            OR: [
              { lastLoginAt: { gte: fromDate, lte: toDate } },
              { createdAt: { gte: fromDate, lte: toDate } },
            ],
          },
        }),
      ]);

      const responseRate = checkinsSent > 0 ? (checkinsResponded / checkinsSent) * 100 : 0;

      // Group operational error logs
      const errorsByCodeRaw = await prisma.operationalErrorLog.groupBy({
        by: ['errorCode'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: { id: true },
      });
      const errorsByCode = errorsByCodeRaw.map(item => ({
        errorCode: item.errorCode,
        count: item._count.id,
      }));

      const errorsByRouteRaw = await prisma.operationalErrorLog.groupBy({
        by: ['route', 'method'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: { id: true },
      });
      const errorsByRoute = errorsByRouteRaw.map(item => ({
        route: item.route || 'unknown',
        method: item.method || 'unknown',
        count: item._count.id,
      }));

      return reply.status(200).send({
        success: true,
        data: {
          checkinsSent,
          responseRate,
          notRespondedCount,
          occurrencesCreated,
          medicalCertificatesReceived,
          reportsExported,
          activeUsers: activeUsersCount,
          errorsByCode,
          errorsByRoute,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar métricas do piloto.',
        }
      });
    }
  });
}

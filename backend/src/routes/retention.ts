import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { CustomerSuccessService } from '../services/customer-success.service';
import { RetentionService } from '../services/retention.service';
import { InMemoryCache } from '../lib/cache';

export default async function retentionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/retention/overview
  fastify.get('/admin/retention/overview', async (request, reply) => {
    try {
      const cacheKey = 'retention-overview';
      const cached = InMemoryCache.get(cacheKey);
      if (cached) {
        return reply.status(200).send({
          success: true,
          data: cached,
        });
      }

      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch all subscriptions to compute dynamic attributes
      const subs = await prisma.companySubscription.findMany({
        include: {
          company: true,
          plan: true
        }
      });

      let activeAccounts = 0;
      let paymentPendingAccounts = 0;
      let overdueAccounts = 0;
      let renewalsNext7Days = 0;
      let renewalsNext30Days = 0;
      let criticalHealthAccounts = 0;
      let attentionHealthAccounts = 0;
      let churnRiskAccounts = 0;
      let canceledThisMonth = 0;
      let manualMrrCents = 0;

      for (const sub of subs) {
        const health = await CustomerSuccessService.calculateCompanyHealth(sub.companyId);
        const risk = RetentionService.calculateChurnRisk(sub, health);
        const effectiveStatus = RetentionService.getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt);

        // Active count
        if (sub.billingStatus === 'ACTIVE') {
          activeAccounts++;
        }
        // Payment pending count
        if (sub.billingStatus === 'PAYMENT_PENDING') {
          paymentPendingAccounts++;
        }
        // Overdue status check
        if (effectiveStatus === 'OVERDUE') {
          overdueAccounts++;
        }
        // Risk count
        if (risk.level === 'HIGH') {
          churnRiskAccounts++;
        }
        // Health counts
        if (health.status === 'CRITICAL') {
          criticalHealthAccounts++;
        } else if (health.status === 'ATTENTION') {
          attentionHealthAccounts++;
        }

        // Renewals
        const nextBilling = sub.nextBillingAt ? new Date(sub.nextBillingAt) : null;
        if (sub.billingStatus !== 'CANCELED' && nextBilling && nextBilling > now) {
          if (nextBilling <= sevenDays) {
            renewalsNext7Days++;
          }
          if (nextBilling <= thirtyDays) {
            renewalsNext30Days++;
          }
        }

        // Canceled this month
        if (sub.billingStatus === 'CANCELED' && sub.canceledAt) {
          const canceledDate = new Date(sub.canceledAt);
          if (canceledDate >= startOfMonth) {
            canceledThisMonth++;
          }
        }

        // MRR
        if (sub.billingStatus === 'ACTIVE' || sub.billingStatus === 'PAYMENT_PENDING') {
          const amount = sub.contractedAmountCents || 0;
          if (sub.billingCycle === 'MONTHLY') {
            manualMrrCents += amount;
          } else if (sub.billingCycle === 'QUARTERLY') {
            manualMrrCents += Math.round(amount / 3);
          } else if (sub.billingCycle === 'YEARLY') {
            manualMrrCents += Math.round(amount / 12);
          }
        }
      }

      const data = {
        activeAccounts,
        paymentPendingAccounts,
        overdueAccounts,
        renewalsNext7Days,
        renewalsNext30Days,
        criticalHealthAccounts,
        attentionHealthAccounts,
        churnRiskAccounts,
        canceledThisMonth,
        manualMrrCents
      };

      InMemoryCache.set(cacheKey, data, 30); // 30s TTL

      return reply.status(200).send({
        success: true,
        data
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar resumo de retenção.',
        }
      });
    }
  });

  // GET /api/admin/retention/accounts
  fastify.get('/admin/retention/accounts', async (request, reply) => {
    try {
      const { churnRiskLevel, effectiveBillingStatus, healthStatus, plan, renewalWindow, search, page, pageSize } = request.query as {
        churnRiskLevel?: string;
        effectiveBillingStatus?: string;
        healthStatus?: string;
        plan?: string;
        renewalWindow?: string;
        search?: string;
        page?: string;
        pageSize?: string;
      };

      const parsedPage = page ? parseInt(page, 10) : 1;
      const parsedPageSize = pageSize ? Math.min(100, parseInt(pageSize, 10)) : 10;
      const skip = (parsedPage - 1) * parsedPageSize;

      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const where: any = {};

      if (effectiveBillingStatus) {
        if (effectiveBillingStatus === 'OVERDUE') {
          where.OR = [
            { billingStatus: 'OVERDUE' },
            {
              billingStatus: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
              nextBillingAt: { lt: now }
            }
          ];
        } else if (effectiveBillingStatus === 'ACTIVE') {
          where.billingStatus = 'ACTIVE';
          where.OR = [
            { nextBillingAt: { gte: now } },
            { nextBillingAt: null }
          ];
        } else if (effectiveBillingStatus === 'PAYMENT_PENDING') {
          where.billingStatus = 'PAYMENT_PENDING';
          where.OR = [
            { nextBillingAt: { gte: now } },
            { nextBillingAt: null }
          ];
        } else {
          where.billingStatus = effectiveBillingStatus;
        }
      }

      if (renewalWindow) {
        where.NOT = { billingStatus: 'CANCELED' };
        if (renewalWindow === '7d') {
          where.nextBillingAt = { gte: now, lte: sevenDays };
        } else if (renewalWindow === '30d') {
          where.nextBillingAt = { gte: now, lte: thirtyDays };
        }
      }

      if (plan) {
        where.plan = {
          code: { contains: plan, mode: 'insensitive' }
        };
      }

      if (search) {
        where.company = {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { legalName: { contains: search, mode: 'insensitive' } }
          ]
        };
      }

      let items = [];
      let total = 0;

      const hasInMemoryFilters = !!churnRiskLevel || !!healthStatus;

      if (hasInMemoryFilters) {
        // Fetch all matching db records to filter in-memory
        const dbSubs = await prisma.companySubscription.findMany({
          where,
          include: { company: true, plan: true },
          orderBy: { company: { name: 'asc' } }
        });

        for (const sub of dbSubs) {
          const healthData = await CustomerSuccessService.calculateCompanyHealth(sub.companyId);
          const riskData = RetentionService.calculateChurnRisk(sub, healthData);

          items.push({
            companyId: sub.companyId,
            companyName: sub.company.name,
            plan: sub.plan.name,
            billingStatus: sub.billingStatus,
            effectiveBillingStatus: RetentionService.getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt),
            nextBillingAt: sub.nextBillingAt?.toISOString() || null,
            healthScore: healthData.healthScore,
            healthStatus: healthData.status,
            responseRate7d: healthData.adoptionMetrics.responseRate7d,
            lastActivityAt: healthData.adoptionMetrics.lastActivityAt || null,
            churnRiskLevel: riskData.level,
            churnRiskReasons: riskData.reasons,
            recommendedAction: riskData.recommendedAction
          });
        }

        // Apply filters in-memory
        if (churnRiskLevel) {
          items = items.filter(i => i.churnRiskLevel === churnRiskLevel);
        }
        if (healthStatus) {
          items = items.filter(i => i.healthStatus === healthStatus);
        }

        total = items.length;
        items = items.slice(skip, skip + parsedPageSize);
      } else {
        // Standard path with db-level paging
        total = await prisma.companySubscription.count({ where });
        const dbSubs = await prisma.companySubscription.findMany({
          where,
          skip,
          take: parsedPageSize,
          include: { company: true, plan: true },
          orderBy: { company: { name: 'asc' } }
        });

        for (const sub of dbSubs) {
          const healthData = await CustomerSuccessService.calculateCompanyHealth(sub.companyId);
          const riskData = RetentionService.calculateChurnRisk(sub, healthData);

          items.push({
            companyId: sub.companyId,
            companyName: sub.company.name,
            plan: sub.plan.name,
            billingStatus: sub.billingStatus,
            effectiveBillingStatus: RetentionService.getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt),
            nextBillingAt: sub.nextBillingAt?.toISOString() || null,
            healthScore: healthData.healthScore,
            healthStatus: healthData.status,
            responseRate7d: healthData.adoptionMetrics.responseRate7d,
            lastActivityAt: healthData.adoptionMetrics.lastActivityAt || null,
            churnRiskLevel: riskData.level,
            churnRiskReasons: riskData.reasons,
            recommendedAction: riskData.recommendedAction
          });
        }
      }

      return reply.status(200).send({
        success: true,
        items,
        total,
        page: parsedPage,
        pageSize: parsedPageSize
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar contas para retenção.',
        }
      });
    }
  });
}

import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';

export default async function adminAnalyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['SUPER_ADMIN']));

  // GET /api/admin/analytics/overview
  fastify.get('/admin/analytics/overview', async (request, reply) => {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 1. Active Users (DAU / MAU)
      const dauGroup = await prisma.usageTelemetry.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: oneDayAgo },
          userId: { not: null },
        },
      });
      const dau = dauGroup.length;

      const mauGroup = await prisma.usageTelemetry.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: thirtyDaysAgo },
          userId: { not: null },
        },
      });
      const mau = mauGroup.length;

      // 2. Feature Adoption counts
      const checkinCount = await prisma.remoteCheckin.count();
      const certificateCount = await prisma.medicalCertificate.count();
      const occurrencesResolved = await prisma.occurrence.count({
        where: { status: 'RESOLVED' },
      });

      const reportExportsEvents = await prisma.usageTelemetry.count({
        where: { eventName: 'REPORT_EXPORTED' },
      });

      // 3. Most Visited Pages
      const pageViewEvents = await prisma.usageTelemetry.findMany({
        where: {
          eventName: 'PAGE_VIEW',
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { properties: true },
        take: 2000,
      });

      const pageCounts: Record<string, number> = {};
      for (const ev of pageViewEvents) {
        const props = ev.properties as any;
        const path = props?.path || '/app/dashboard';
        pageCounts[path] = (pageCounts[path] || 0) + 1;
      }

      const topPages = Object.entries(pageCounts)
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // 4. Onboarding Funnel (Checklist steps completion rates across all companies)
      const totalCompanies = await prisma.company.count({ where: { isActive: true } });
      
      // Let's query how many companies settings exist
      const companySettingsCount = await prisma.companySettings.count();
      // Count employees imported (companies with at least 1 employee)
      const companiesWithEmployeesGroup = await prisma.employee.groupBy({
        by: ['companyId'],
      });
      const employeesImportedCount = companiesWithEmployeesGroup.length;

      // Count work schedules configured (companies with at least 1 schedule)
      const companiesWithSchedulesGroup = await prisma.workSchedule.groupBy({
        by: ['companyId'],
      });
      const schedulesConfiguredCount = companiesWithSchedulesGroup.length;

      const funnel = {
        totalCompanies,
        settingsConfigured: companySettingsCount,
        employeesImported: employeesImportedCount,
        schedulesConfigured: schedulesConfiguredCount,
      };

      // 5. Knowledge Base Usage
      const articleViews = await prisma.usageTelemetry.findMany({
        where: { eventName: 'ARTICLE_VIEW' },
        select: { properties: true },
      });

      const articleCounts: Record<string, number> = {};
      for (const ev of articleViews) {
        const props = ev.properties as any;
        const title = props?.title || 'Artigo';
        articleCounts[title] = (articleCounts[title] || 0) + 1;
      }

      const topArticles = Object.entries(articleCounts)
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return reply.status(200).send({
        success: true,
        data: {
          activeUsers: { dau, mau },
          featureAdoption: {
            checkinCount,
            certificateCount,
            occurrencesResolved,
            reportExportsEvents,
          },
          topPages,
          funnel,
          topArticles,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar consolidado de telemetria.',
        },
      });
    }
  });
}

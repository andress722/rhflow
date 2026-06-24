import { prisma } from '../lib/prisma';

export class PlanLimitsService {
  /**
   * Helper to format current period as YYYY-MM in America/Sao_Paulo
   */
  private static getCurrentPeriod(): string {
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

  /**
   * Retrieves the current subscription of a company.
   * If not found, returns a virtual fallback STARTER plan subscription.
   */
  static async getCurrentSubscription(companyId: string) {
    const sub = await prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });

    if (sub) {
      return {
        ...sub,
        isFallback: false,
      };
    }

    // Fallback virtual Starter subscription
    return {
      id: 'fallback-starter-sub',
      companyId,
      planId: 'fallback-starter-plan',
      status: 'ACTIVE' as const,
      startedAt: new Date(),
      endsAt: null,
      isFallback: true,
      plan: {
        id: 'fallback-starter-plan',
        name: 'Starter',
        code: 'STARTER',
        maxEmployees: 5,
        maxMonthlyCheckins: 100,
        maxMonthlyUploads: 0,
        maxMonthlyExports: 0,
        enableReports: true,
        enableBatchCheckin: false,
        enableMedicalModule: false,
        enableExports: false,
      },
    };
  }

  /**
   * Retrieves the usage summary for the current month.
   */
  static async getUsageSummary(companyId: string) {
    const sub = await this.getCurrentSubscription(companyId);
    const plan = sub.plan;
    const period = this.getCurrentPeriod();

    // 1. Count active employees
    const activeEmployeesCount = await prisma.employee.count({
      where: { companyId, status: 'ACTIVE' },
    });

    // 2. Fetch usage counters for period YYYY-MM
    const counters = await prisma.usageCounter.findMany({
      where: { companyId, period },
    });

    const checkinsCount = counters.find(c => c.key === 'remote_checkins')?.value ?? 0;
    const uploadsCount = counters.find(c => c.key === 'medical_uploads')?.value ?? 0;
    const exportsCount = counters.find(c => c.key === 'report_exports')?.value ?? 0;

    return {
      period,
      planName: plan.name,
      planCode: plan.code,
      status: sub.status,
      startedAt: sub.startedAt,
      endsAt: sub.endsAt,
      isFallback: sub.isFallback,
      limits: {
        employees: plan.maxEmployees,
        checkins: plan.maxMonthlyCheckins,
        uploads: plan.maxMonthlyUploads,
        exports: plan.maxMonthlyExports,
      },
      usage: {
        employees: activeEmployeesCount,
        checkins: checkinsCount,
        uploads: uploadsCount,
        exports: exportsCount,
      },
      percentages: {
        employees: Math.min(100, Math.round((activeEmployeesCount / plan.maxEmployees) * 100)),
        checkins: Math.min(100, Math.round((checkinsCount / plan.maxMonthlyCheckins) * 100)),
        uploads: plan.maxMonthlyUploads > 0 ? Math.min(100, Math.round((uploadsCount / plan.maxMonthlyUploads) * 100)) : 0,
        exports: plan.maxMonthlyExports > 0 ? Math.min(100, Math.round((exportsCount / plan.maxMonthlyExports) * 100)) : 0,
      },
      modules: {
        reports: plan.enableReports,
        batchCheckin: plan.enableBatchCheckin,
        medicalModule: plan.enableMedicalModule,
        exports: plan.enableExports,
      },
    };
  }

  /**
   * Asserts whether a company can create a new employee.
   */
  static async assertCanCreateEmployee(companyId: string): Promise<void> {
    const sub = await this.getCurrentSubscription(companyId);
    const plan = sub.plan;

    const activeEmployeesCount = await prisma.employee.count({
      where: { companyId, status: 'ACTIVE' },
    });

    if (activeEmployeesCount >= plan.maxEmployees) {
      throw new Error('PLAN_LIMIT_EXCEEDED');
    }
  }

  /**
   * Asserts whether check-ins can be created.
   */
  static async assertCanRunCheckin(companyId: string, count: number): Promise<void> {
    const sub = await this.getCurrentSubscription(companyId);
    const plan = sub.plan;
    const period = this.getCurrentPeriod();

    const counter = await prisma.usageCounter.findUnique({
      where: {
        companyId_period_key: {
          companyId,
          period,
          key: 'remote_checkins',
        },
      },
    });

    const currentCount = counter?.value ?? 0;

    if (currentCount + count > plan.maxMonthlyCheckins) {
      throw new Error('PLAN_LIMIT_EXCEEDED');
    }
  }

  /**
   * Asserts whether a medical certificate upload can be performed.
   */
  static async assertCanUploadMedicalCertificate(companyId: string): Promise<void> {
    const sub = await this.getCurrentSubscription(companyId);
    const plan = sub.plan;

    if (!plan.enableMedicalModule) {
      throw new Error('PLAN_FEATURE_DISABLED');
    }

    const period = this.getCurrentPeriod();
    const counter = await prisma.usageCounter.findUnique({
      where: {
        companyId_period_key: {
          companyId,
          period,
          key: 'medical_uploads',
        },
      },
    });

    const currentCount = counter?.value ?? 0;

    if (currentCount + 1 > plan.maxMonthlyUploads) {
      throw new Error('PLAN_LIMIT_EXCEEDED');
    }
  }

  /**
   * Asserts whether a report export can be performed.
   */
  static async assertCanExportReport(companyId: string): Promise<void> {
    const sub = await this.getCurrentSubscription(companyId);
    const plan = sub.plan;

    if (!plan.enableExports) {
      throw new Error('PLAN_FEATURE_DISABLED');
    }

    const period = this.getCurrentPeriod();
    const counter = await prisma.usageCounter.findUnique({
      where: {
        companyId_period_key: {
          companyId,
          period,
          key: 'report_exports',
        },
      },
    });

    const currentCount = counter?.value ?? 0;

    if (currentCount + 1 > plan.maxMonthlyExports) {
      throw new Error('PLAN_LIMIT_EXCEEDED');
    }
  }
}

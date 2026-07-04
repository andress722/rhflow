import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis before importing the app
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
    },
    employee: {
      count: vi.fn(),
    },
    workSchedule: {
      count: vi.fn(),
    },
    remoteCheckin: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    occurrence: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    medicalCertificate: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    companySubscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock('../src/lib/redis', () => {
  return {
    redis: {
      quit: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    },
  };
});

// We will dynamically mock calculateCompanyHealth inside the tests
let mockCSHealth = {
  healthScore: 85,
  status: 'GOOD',
  adoptionMetrics: {
    activeEmployees: 10,
    responseRate7d: 80,
    lastActivityAt: new Date().toISOString()
  },
  operationalMetrics: {
    openOccurrences: 0,
    resolvedOccurrences: 0,
  }
};

vi.mock('../src/services/customer-success.service', () => {
  return {
    CustomerSuccessService: {
      calculateCompanyHealth: vi.fn().mockImplementation(() => Promise.resolve(mockCSHealth))
    }
  };
});

import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';
import { buildApp } from '../src/app';
import { InMemoryCache } from '../src/lib/cache';

const app = buildApp();

describe('PresençaFlow RH - Retention & Churn Prevention API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    InMemoryCache.clear();

    // Default mock behaviors for authentication
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-user-1',
      isActive: true,
      role: 'ADMIN',
    } as any);

    mockCSHealth = {
      healthScore: 85,
      status: 'GOOD',
      adoptionMetrics: {
        activeEmployees: 10,
        responseRate7d: 80,
        lastActivityAt: new Date().toISOString()
      },
      operationalMetrics: {
        openOccurrences: 0,
        resolvedOccurrences: 0,
      }
    };
  });

  const getAuthHeader = (role: string, companyId = 'company-1', userId = 'user-1') => {
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. RBAC Permissions', () => {
    const blockedRoles = ['ADMIN', 'HR', 'MANAGER', 'VIEWER'];
    const endpoints = [
      { method: 'GET', url: '/api/admin/retention/overview' },
      { method: 'GET', url: '/api/admin/retention/accounts' },
    ];

    blockedRoles.forEach((role) => {
      endpoints.forEach((ep) => {
        it(`should block ${role} from ${ep.method} ${ep.url}`, async () => {
          const res = await app.inject({
            method: ep.method as any,
            url: ep.url,
            headers: getAuthHeader(role),
          });
          expect(res.statusCode).toBe(403);
        });
      });
    });

    endpoints.forEach((ep) => {
      it(`should allow SUPER_ADMIN to access ${ep.method} ${ep.url}`, async () => {
        vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([]);
        vi.mocked(prisma.companySubscription.count).mockResolvedValue(0);

        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: getAuthHeader('SUPER_ADMIN'),
        });
        expect(res.statusCode).toBe(200);
      });
    });
  });

  describe('2. Churn Risk Evaluation Rules', () => {
    it('should assign LOW risk for healthy active subscriptions', async () => {
      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([
        {
          id: 'sub-1',
          companyId: 'company-1',
          billingStatus: 'ACTIVE',
          billingCycle: 'MONTHLY',
          contractedAmountCents: 150000,
          nextBillingAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days out
          company: { id: 'company-1', name: 'Empresa Saudavel' },
          plan: { id: 'plan-1', name: 'Premium', code: 'PREMIUM' }
        }
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/retention/accounts',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items[0].churnRiskLevel).toBe('LOW');
      expect(body.items[0].recommendedAction).toBe('Nenhuma ação recomendada no momento');
    });

    it('should assign HIGH risk for overdue accounts with critical health', async () => {
      // Set health status to CRITICAL
      mockCSHealth = {
        healthScore: 30,
        status: 'CRITICAL',
        adoptionMetrics: {
          activeEmployees: 5,
          responseRate7d: 20,
          lastActivityAt: new Date().toISOString()
        },
        operationalMetrics: {
          openOccurrences: 3,
          resolvedOccurrences: 0,
        }
      };

      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([
        {
          id: 'sub-1',
          companyId: 'company-1',
          billingStatus: 'ACTIVE', // status active, but nextBillingAt makes it effective OVERDUE
          billingCycle: 'MONTHLY',
          contractedAmountCents: 150000,
          nextBillingAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          company: { id: 'company-1', name: 'Empresa Critica' },
          plan: { id: 'plan-1', name: 'Premium', code: 'PREMIUM' }
        }
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/retention/accounts',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items[0].churnRiskLevel).toBe('HIGH');
      expect(body.items[0].churnRiskReasons).toContain('Assinatura vencida com saúde crítica do cliente');
      expect(body.items[0].recommendedAction).toBe('Cobrar pagamento pendente');
    });

    it('should assign HIGH risk for canceled subscriptions', async () => {
      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([
        {
          id: 'sub-1',
          companyId: 'company-1',
          billingStatus: 'CANCELED',
          billingCycle: 'MONTHLY',
          contractedAmountCents: 0,
          nextBillingAt: null,
          company: { id: 'company-1', name: 'Empresa Cancelada' },
          plan: { id: 'plan-1', name: 'Premium', code: 'PREMIUM' }
        }
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/retention/accounts',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items[0].churnRiskLevel).toBe('HIGH');
      expect(body.items[0].recommendedAction).toBe('Registrar motivo de cancelamento');
    });
  });

  describe('3. GET /api/admin/retention/overview - KPIs', () => {
    it('should return correct retention KPIs including manual MRR and next renewals', async () => {
      // 1 ACTIVE (150000 MONTHLY), 1 PAYMENT_PENDING (1200000 YEARLY)
      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([
        {
          id: 'sub-1',
          companyId: 'company-1',
          billingStatus: 'ACTIVE',
          billingCycle: 'MONTHLY',
          contractedAmountCents: 150000,
          nextBillingAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // renewal in 5 days
          company: { id: 'company-1', name: 'A' },
          plan: { name: 'Starter' }
        },
        {
          id: 'sub-2',
          companyId: 'company-2',
          billingStatus: 'PAYMENT_PENDING',
          billingCycle: 'YEARLY',
          contractedAmountCents: 1200000, // 1200000 / 12 = 100000 monthly
          nextBillingAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // renewal in 25 days
          company: { id: 'company-2', name: 'B' },
          plan: { name: 'Starter' }
        }
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/retention/overview',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);

      // MRR: 150000 + (1200000 / 12) = 250000 cents
      expect(body.data.manualMrrCents).toBe(250000);
      expect(body.data.activeAccounts).toBe(1);
      expect(body.data.paymentPendingAccounts).toBe(1);
      expect(body.data.renewalsNext7Days).toBe(1);
      expect(body.data.renewalsNext30Days).toBe(2);
    });
  });

  describe('4. POST /api/internal/jobs/retention-alerts/run', () => {
    it('should return 401 if internal job secret is invalid or missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/retention-alerts/run',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should execute alerts job successfully when secret is provided', async () => {
      // Mock alert config recipients
      process.env.COMMERCIAL_ALERT_EMAILS = 'admin@presencaflow.com';
      process.env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS = '5511999999999';

      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([
        {
          id: 'sub-1',
          companyId: 'company-1',
          billingStatus: 'ACTIVE',
          nextBillingAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Overdue
          company: { id: 'company-1', name: 'Empresa Vencida' },
          plan: { code: 'STARTER' }
        }
      ] as any);

      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]); // no alerts sent today yet
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'log-1' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/retention-alerts/run',
        headers: {
          'x-internal-job-secret': env.INTERNAL_JOB_SECRET || 'test-internal-job-secret-must-be-32-chars',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.processedCount).toBe(1);
      expect(body.data.alertsSent).toHaveLength(2); // Email and WhatsApp for OVERDUE and HIGH risk
    });
  });
});

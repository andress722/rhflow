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

vi.mock('../src/services/customer-success.service', () => {
  return {
    CustomerSuccessService: {
      calculateCompanyHealth: vi.fn().mockResolvedValue({
        healthScore: 85,
        status: 'GOOD',
        adoptionMetrics: {
          activeEmployees: 10,
          responseRate7d: 80,
          lastActivityAt: new Date()
        },
        operationalMetrics: {
          openOccurrences: 0,
          resolvedOccurrences: 0,
        }
      })
    }
  };
});

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';

const app = buildApp();

describe('PresençaFlow RH - Manual Billing & Contracts API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock behaviors for authentication
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-user-1',
      isActive: true,
      role: 'ADMIN',
    } as any);

    vi.mocked(prisma.employee.count).mockResolvedValue(10);
    vi.mocked(prisma.workSchedule.count).mockResolvedValue(1);
    vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(5);
    vi.mocked(prisma.occurrence.count).mockResolvedValue(0);
    vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(0);
    vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
      companyId: 'company-billing-1',
      enableRemoteCheckin: true,
      enableMedicalCertificates: true,
    } as any);
  });

  const getAuthHeader = (role: string, companyId = 'company-billing-1', userId = 'user-1') => {
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. RBAC Permissions on /api/admin/billing/accounts/*', () => {
    const endpoints = [
      { method: 'GET', url: '/api/admin/billing/accounts' },
      { method: 'GET', url: '/api/admin/billing/accounts/company-1' },
      { method: 'PATCH', url: '/api/admin/billing/accounts/company-1' },
    ];

    const rolesToBlock = ['ADMIN', 'HR', 'MANAGER', 'VIEWER'];

    rolesToBlock.forEach((role) => {
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
        // Setup simple mocks to avoid 404/500 errors so we just test permissions
        vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([]);
        vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'company-1', name: 'Test' } as any);
        vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({ id: 'sub-1', companyId: 'company-1' } as any);

        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: getAuthHeader('SUPER_ADMIN'),
          body: ep.method === 'PATCH' ? { billingStatus: 'ACTIVE' } : undefined,
        });

        // Permissions pass (status shouldn't be 403)
        expect(res.statusCode).not.toBe(403);
      });
    });
  });

  describe('2. GET /api/admin/billing/accounts - List & KPIs', () => {
    it('should list accounts with dynamic OVERDUE status and calculate correct MRR and KPIs', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

      // Mock subscription list
      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([
        {
          id: 'sub-1',
          companyId: 'company-1',
          billingStatus: 'ACTIVE',
          contractedAmountCents: 150000, // R$ 1.500,00
          billingCycle: 'MONTHLY',
          nextBillingAt: pastDate, // Overdue because of nextBillingAt
          contractSignedAt: new Date(),
          company: { id: 'company-1', name: 'Empresa A' },
          plan: { id: 'plan-1', name: 'Premium', code: 'PREMIUM' }
        },
        {
          id: 'sub-2',
          companyId: 'company-2',
          billingStatus: 'PAYMENT_PENDING',
          contractedAmountCents: 300000, // R$ 3.000,00
          billingCycle: 'YEARLY', // 300000 / 12 = 25000 MRR
          nextBillingAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // Active
          contractSignedAt: new Date(),
          company: { id: 'company-2', name: 'Empresa B' },
          plan: { id: 'plan-2', name: 'Enterprise', code: 'ENTERPRISE' }
        }
      ] as any);

      // Mock counts
      vi.mocked(prisma.companySubscription.count).mockResolvedValue(2);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/billing/accounts',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.items).toHaveLength(2);

      // Verify dynamic OVERDUE status
      expect(body.items[0].effectiveBillingStatus).toBe('OVERDUE');
      expect(body.items[1].effectiveBillingStatus).toBe('PAYMENT_PENDING');

      // Verify KPIs and MRR
      // MRR: 150000 (monthly) + 300000/12 (yearly) = 150000 + 25000 = 175000 cents
      expect(body.kpis.monthlyContractedRevenueCents).toBe(175000);
    });
  });

  describe('3. GET /api/admin/billing/accounts/:companyId', () => {
    it('should return account details including subscription and health score', async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-1',
        name: 'Empresa A',
        legalName: 'Empresa A Ltda',
        cnpj: '12.345.678/0001-99',
        pilotStatus: 'WON',
        subscription: {
          id: 'sub-1',
          planId: 'plan-1',
          plan: { id: 'plan-1', name: 'Premium', code: 'PREMIUM' },
          billingStatus: 'ACTIVE',
          contractedAmountCents: 150000,
          billingCycle: 'MONTHLY',
          nextBillingAt: new Date(),
        }
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.companyName).toBe('Empresa A');
      expect(body.data.plan).toBe('Premium');
      expect(body.data.healthScore).toBe(85);
      expect(body.data.responseRate7d).toBe(80);
    });

    it('should return 404 if company does not exist', async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/billing/accounts/invalid-company',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('4. PATCH /api/admin/billing/accounts/:companyId', () => {
    it('should update billing status and record audit log', async () => {
      const existingSub = {
        id: 'sub-1',
        companyId: 'company-1',
        billingStatus: 'TRIAL',
        contractedAmountCents: 0,
        billingCycle: 'MONTHLY',
        financeNotes: 'Notas iniciais',
        cancellationReason: null,
      };

      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue(existingSub as any);
      vi.mocked(prisma.companySubscription.update).mockResolvedValue({
        ...existingSub,
        billingStatus: 'ACTIVE',
        contractedAmountCents: 200000,
      } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        body: {
          billingStatus: 'ACTIVE',
          contractedAmountCents: 200000,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.billingStatus).toBe('ACTIVE');
      expect(body.data.contractedAmountCents).toBe(200000);

      // Verify audit log creation
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'BILLING_ACCOUNT_UPDATED',
            companyId: 'company-1',
          }),
        })
      );
    });

    it('should return 400 if contractedAmountCents is negative', async () => {
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({ id: 'sub-1' } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        body: {
          contractedAmountCents: -50,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('não pode ser negativo');
    });

    it('should return 400 if contractedAmountCents exceeds 100,000,000 cents', async () => {
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({ id: 'sub-1' } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        body: {
          contractedAmountCents: 100000001,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('não pode exceder R$ 1.000.000,00');
    });

    it('should return 400 if contractSignedAt is before contractSentAt', async () => {
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        contractSentAt: new Date('2026-06-15T00:00:00Z'),
      } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        body: {
          contractSignedAt: '2026-06-10T00:00:00Z', // Before sent date
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('não pode ser anterior à data de envio');
    });

    it('should return 400 if subscriptionStartedAt is before contractSignedAt', async () => {
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        contractSignedAt: new Date('2026-06-15T00:00:00Z'),
      } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        body: {
          subscriptionStartedAt: '2026-06-10T00:00:00Z', // Before signed date
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.message).toContain('não pode ser anterior à data de assinatura');
    });

    it('should return 400 if canceledAt is before subscriptionStartedAt', async () => {
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        subscriptionStartedAt: new Date('2026-06-15T00:00:00Z'),
      } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        body: {
          billingStatus: 'CANCELED',
          cancellationReason: 'Cancelado pelo cliente',
          canceledAt: '2026-06-10T00:00:00Z', // Before subscription start date
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.message).toContain('não pode ser anterior à data de início da assinatura');
    });

    it('should require cancellationReason if status is CANCELED', async () => {
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({ id: 'sub-1' } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        body: {
          billingStatus: 'CANCELED', // missing reason
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('motivo de cancelamento é obrigatório');
    });

    it('should sanitize financeNotes and cancellationReason', async () => {
      const existingSub = {
        id: 'sub-1',
        companyId: 'company-1',
        billingStatus: 'ACTIVE',
      };

      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue(existingSub as any);
      vi.mocked(prisma.companySubscription.update).mockImplementation((args: any) => {
        return Promise.resolve({
          ...existingSub,
          ...args.data,
        } as any);
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/billing/accounts/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        body: {
          financeNotes: '<script>alert("XSS")</script>Observações seguras',
          billingStatus: 'CANCELED',
          cancellationReason: '<p>Motivo <strong>limpo</strong></p>',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.financeNotes).toBe('alert("XSS")Observações seguras');
      expect(body.data.cancellationReason).toBe('Motivo limpo');
    });
  });
});

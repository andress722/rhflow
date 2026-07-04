import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    pilotLead: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    companySubscription: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    remoteCheckin: {
      count: vi.fn(),
    },
    occurrence: {
      count: vi.fn(),
    },
    medicalCertificate: {
      count: vi.fn(),
    },
    jobRun: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    pilotFeedback: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    pilotBacklogItem: {
      count: vi.fn(),
      findMany: vi.fn(),
    }
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

// Mock CustomerSuccessService to return mocked health data
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
import { buildApp } from '../src/app';
import { InMemoryCache } from '../src/lib/cache';

const app = buildApp();

describe('PresençaFlow RH - Command Center SaaS Cockpit API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    InMemoryCache.clear();

    // Default mock user
    vi.mocked(prisma.user.findUnique).mockImplementation((args: any) => {
      const id = args.where.id;
      let role = 'ADMIN';
      if (id.includes('SUPER_ADMIN')) role = 'SUPER_ADMIN';
      return Promise.resolve({
        id,
        isActive: true,
        role,
      } as any);
    });

    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-1',
      isActive: true,
    } as any);

    // Default mocks to prevent 500 errors during list iterations
    vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.pilotLead.count).mockResolvedValue(0);
    vi.mocked(prisma.company.count).mockResolvedValue(0);
    vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(0);
    vi.mocked(prisma.occurrence.count).mockResolvedValue(0);
    vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(0);
    vi.mocked(prisma.jobRun.count).mockResolvedValue(0);
    vi.mocked(prisma.jobRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.jobRun.findMany).mockResolvedValue([]);
    vi.mocked(prisma.pilotFeedback.count).mockResolvedValue(0);
    vi.mocked(prisma.pilotFeedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.pilotFeedback.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.pilotBacklogItem.count).mockResolvedValue(0);
    vi.mocked(prisma.pilotBacklogItem.findMany).mockResolvedValue([]);
  });

  const getAuthHeader = (role: string, companyId = 'company-1', userId = 'user-1') => {
    const userIdWithRole = `${userId}-SUPER_ADMIN`; // to bypass user role check mock if SUPER_ADMIN
    const token = app.jwt.sign({
      sub: role === 'SUPER_ADMIN' ? userIdWithRole : userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. RBAC Permissions', () => {
    it('should block non-SUPER_ADMIN role with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/command-center/overview',
        headers: getAuthHeader('ADMIN'),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to call overview', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/command-center/overview',
        headers: getAuthHeader('SUPER_ADMIN'),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('2. Consolidated Metrics & KPI Checks', () => {
    it('should calculate global response rate, MRR and list alerts', async () => {
      const now = new Date();
      
      // Setup counts
      vi.mocked(prisma.pilotLead.count).mockResolvedValue(2);
      vi.mocked(prisma.company.count).mockResolvedValue(1);

      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([
        {
          id: 'sub-1',
          companyId: 'company-1',
          billingStatus: 'ACTIVE',
          billingCycle: 'MONTHLY',
          contractedAmountCents: 150000,
          nextBillingAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // Active
          company: { id: 'company-1', name: 'Empresa A' }
        },
        {
          id: 'sub-2',
          companyId: 'company-2',
          billingStatus: 'ACTIVE',
          billingCycle: 'YEARLY',
          contractedAmountCents: 1200000, // 100000 MRR
          nextBillingAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Overdue
          company: { id: 'company-2', name: 'Empresa B' }
        }
      ] as any);

      vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(250);
      vi.mocked(prisma.occurrence.count).mockResolvedValue(3);
      vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(1);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(5);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/command-center/overview',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);

      // Verify blocks presence
      expect(body.data.commercial).toBeDefined();
      expect(body.data.revenue).toBeDefined();
      expect(body.data.customers).toBeDefined();
      expect(body.data.operations).toBeDefined();
      expect(body.data.platform).toBeDefined();
      expect(body.data.alerts).toBeDefined();

      // MRR: 150000 + 100000 = 250000
      expect(body.data.revenue.manualMrrCents).toBe(250000);
      expect(body.data.revenue.overdueAccounts).toBe(1);

      // Active subscriptions
      expect(body.data.revenue.activeSubscriptions).toBe(2);

      // Alerts sorted by severity should contain the overdue alert
      expect(body.data.alerts.length).toBeGreaterThan(0);
      expect(body.data.alerts[0].type).toBe('OVERDUE_ACCOUNT');
    });
  });

  describe('3. GET /api/admin/command-center/alerts - Paging & Filtering', () => {
    it('should paginate derived alerts list', async () => {
      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([
        {
          id: 'sub-1',
          companyId: 'company-1',
          billingStatus: 'ACTIVE',
          billingCycle: 'MONTHLY',
          contractedAmountCents: 150000,
          nextBillingAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Overdue
          company: { id: 'company-1', name: 'Empresa A' }
        }
      ] as any);

      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([
        {
          id: 'lead-1',
          name: 'Lead Overdue',
          status: 'QUALIFIED',
          nextFollowUpAt: new Date(Date.now() - 10000), // Overdue followup
        }
      ] as any);

      vi.mocked(prisma.jobRun.findFirst).mockResolvedValue({
        startedAt: new Date(),
        status: 'SUCCESS',
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/command-center/alerts?page=1&pageSize=1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.items).toHaveLength(1);
      expect(body.total).toBe(2); // Overdue account + Overdue followup
    });
  });
});

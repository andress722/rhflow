import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
    },
    employee: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    workSchedule: {
      count: vi.fn(),
    },
    whatsAppChannel: {
      findUnique: vi.fn(),
    },
    remoteCheckin: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
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
    whatsAppMessageLog: {
      count: vi.fn(),
    },
    operationalErrorLog: {
      count: vi.fn(),
      create: vi.fn(),
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

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';

const app = buildApp();

describe('PresençaFlow RH - Go-Live Readiness Diagnostics API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

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
      name: 'Smoke Company',
      cnpj: '12345678901234',
      isActive: true,
      subscription: {
        plan: {
          name: 'Pro',
          code: 'PRO',
          maxEmployees: 25,
        },
        billingStatus: 'ACTIVE',
        contractedAmountCents: 150000,
      },
      settings: {
        enableRemoteCheckin: true,
      },
      whatsAppChannel: {
        status: 'CONNECTED',
      }
    } as any);

    // Mock CS Health details
    vi.mocked(prisma.companySettings.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.whatsAppMessageLog.count).mockResolvedValue(0);
    vi.mocked(prisma.operationalErrorLog.count).mockResolvedValue(0);
    vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(0);
    vi.mocked(prisma.remoteCheckin.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.occurrence.count).mockResolvedValue(0);
    vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(0);
  });

  const getAuthHeader = (role: string, companyId = 'company-1', userId = 'user-1') => {
    const userIdWithRole = `${userId}-SUPER_ADMIN`;
    const token = app.jwt.sign({
      sub: role === 'SUPER_ADMIN' ? userIdWithRole : userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. RBAC Authentication', () => {
    it('should block non-SUPER_ADMIN users from accessing go-live readiness diagnostics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/go-live/readiness/company-1',
        headers: getAuthHeader('ADMIN'),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to call readiness diagnostic check', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'admin-1' } as any);
      vi.mocked(prisma.employee.count).mockResolvedValue(10);
      vi.mocked(prisma.workSchedule.count).mockResolvedValue(1);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/go-live/readiness/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.goLiveReady).toBe(true);
      expect(body.data.blockingIssues).toHaveLength(0);
    });
  });

  describe('2. Diagnostics Checks', () => {
    it('should flag company as not ready if active employees are zero', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'admin-1' } as any);
      vi.mocked(prisma.employee.count).mockResolvedValue(0); // Zero employees
      vi.mocked(prisma.workSchedule.count).mockResolvedValue(1);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/go-live/readiness/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.goLiveReady).toBe(false);
      expect(body.data.blockingIssues).toContain('Nenhum funcionário ativo cadastrado.');
    });

    it('should trigger warnings if billing is missing or WhatsApp is disconnected', async () => {
      // Mock company with no billing config and disconnected whatsapp
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-1',
        name: 'Smoke Company',
        isActive: true,
        subscription: {
          plan: { maxEmployees: 25 },
          billingStatus: 'TRIAL', // Non active billing status
          contractedAmountCents: 0,
        },
        settings: { enableRemoteCheckin: true },
        whatsAppChannel: { status: 'DISCONNECTED' }
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'admin-1' } as any);
      vi.mocked(prisma.employee.count).mockResolvedValue(5);
      vi.mocked(prisma.workSchedule.count).mockResolvedValue(1);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/go-live/readiness/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.goLiveReady).toBe(true); // Still ready (blocking issues length = 0), but with warnings
      expect(body.data.warnings).toContain('Faturamento manual pendente de configuração comercial.');
      expect(body.data.warnings).toContain('WhatsApp desconectado (envios inativos).');
    });
  });
});

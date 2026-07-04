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
      findMany: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
    },
    companySubscription: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    employee: {
      count: vi.fn(),
      findFirst: vi.fn(),
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
      create: vi.fn(),
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
    },
    pilotLead: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    jobRun: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    pilotFeedback: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';

const app = buildApp();

describe('PresençaFlow RH - Pilot Feedback & Incident Logging API', () => {
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
        email: `${role.toLowerCase()}@test.com`,
      } as any);
    });

    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-1',
      name: 'Smoke Company',
      cnpj: '12345678901234',
      isActive: true,
    } as any);

    // Mock feedback groupBy
    vi.mocked(prisma.pilotFeedback.groupBy).mockResolvedValue([]);

    vi.mocked(prisma.pilotBacklogItem.count).mockResolvedValue(0);
    vi.mocked(prisma.pilotBacklogItem.findMany).mockResolvedValue([]);
  });

  const getAuthHeader = (role: string, companyId = 'company-1', userId = 'user-1') => {
    const userIdWithRole = `${userId}-${role}`;
    const token = app.jwt.sign({
      sub: userIdWithRole,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. RBAC Authentication', () => {
    it('should block non-SUPER_ADMIN users from managing feedback logs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/pilot-feedback',
        headers: getAuthHeader('ADMIN'),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to query feedback list', async () => {
      vi.mocked(prisma.pilotFeedback.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pilotFeedback.count).mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/pilot-feedback',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  describe('2. Sanitization, Input Length, and CPF Masking', () => {
    it('should strip HTML tags and mask any raw CPFs in title and description', async () => {
      vi.mocked(prisma.pilotFeedback.create).mockResolvedValue({
        id: 'feedback-1',
        title: 'Erro ao bater ponto',
        description: 'Colaborador com CPF ***.***.***-** reportou falha',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/pilot-feedback',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          companyId: 'company-1',
          reportedByName: 'Ana Silva',
          reportedByRole: 'HR Manager',
          source: 'WHATSAPP',
          category: 'BUG',
          severity: 'HIGH',
          title: '<h1>Erro ao bater ponto</h1>',
          description: 'Colaborador com CPF 123.456.789-00 reportou falha com script <script>alert("hack")</script>',
        },
      });

      expect(res.statusCode).toBe(201);
      
      const createCall = vi.mocked(prisma.pilotFeedback.create).mock.calls[0][0];
      expect(createCall.data.title).toBe('Erro ao bater ponto');
      expect(createCall.data.description).toContain('***.***.***-**');
      expect(createCall.data.description).not.toContain('<script>');
    });
  });

  describe('3. Updates and Audit Logging', () => {
    it('should update resolvedAt when setting status to RESOLVED', async () => {
      const now = new Date();
      vi.mocked(prisma.pilotFeedback.findUnique).mockResolvedValue({
        id: 'feedback-1',
        companyId: 'company-1',
        status: 'OPEN',
        severity: 'HIGH',
      } as any);

      vi.mocked(prisma.pilotFeedback.update).mockResolvedValue({
        id: 'feedback-1',
        status: 'RESOLVED',
        resolvedAt: now,
      } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/pilot-feedback/feedback-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          status: 'RESOLVED',
          actionTaken: 'Corrigido a rota no webhook da Meta Cloud.',
        },
      });

      expect(res.statusCode).toBe(200);

      const updateCall = vi.mocked(prisma.pilotFeedback.update).mock.calls[0][0];
      expect(updateCall.data.status).toBe('RESOLVED');
      expect(updateCall.data.resolvedAt).toBeInstanceOf(Date);

      // Verify AuditLog creation
      const auditLogCall = vi.mocked(prisma.auditLog.create).mock.calls[0][0];
      expect(auditLogCall.data.action).toBe('PILOT_FEEDBACK_UPDATED');
    });
  });

  describe('4. Company Summary Calculations', () => {
    it('should return aggregated feedback counters and top categories', async () => {
      const createdDate = new Date();
      vi.mocked(prisma.pilotFeedback.findMany).mockResolvedValue([
        { id: '1', companyId: 'company-1', category: 'BUG', severity: 'HIGH', status: 'OPEN', createdAt: createdDate },
        { id: '2', companyId: 'company-1', category: 'BUG', severity: 'CRITICAL', status: 'IN_REVIEW', createdAt: createdDate },
        { id: '3', companyId: 'company-1', category: 'QUESTION', severity: 'LOW', status: 'RESOLVED', resolvedAt: createdDate, createdAt: createdDate },
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/pilot-feedback/summary/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.openItems).toBe(2);
      expect(body.data.criticalItems).toBe(2); // BUG/HIGH + BUG/CRITICAL
      expect(body.data.resolvedItems7d).toBe(1);
      expect(body.data.topCategories[0]).toEqual({ category: 'BUG', count: 2 });
    });
  });

  describe('5. CommandCenter Overview Integration', () => {
    it('should derive correct alerts when open critical feedbacks are present', async () => {
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);
      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
      vi.mocked(prisma.jobRun.count).mockResolvedValue(0);
      vi.mocked(prisma.pilotFeedback.count).mockResolvedValue(1);
      
      // Inject 1 critical open feedback
      vi.mocked(prisma.pilotFeedback.findMany).mockResolvedValue([
        {
          id: 'feedback-1',
          companyId: 'company-1',
          severity: 'CRITICAL',
          status: 'OPEN',
          category: 'BUG',
          company: { name: 'Customer A' },
        }
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/command-center/overview',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      
      expect(body.data.pilotFeedback.criticalFeedbacks).toBe(1);
      expect(body.data.alerts.some((a: any) => a.type === 'PILOT_CRITICAL_FEEDBACK')).toBe(true);
    });
  });
});

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
      findMany: vi.fn(),
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
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

describe('PresençaFlow RH - Pilot Backlog & Release Notes API', () => {
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

    // Mock feedback calls
    vi.mocked(prisma.pilotFeedback.count).mockResolvedValue(0);
    vi.mocked(prisma.pilotFeedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.pilotFeedback.groupBy).mockResolvedValue([]);

    // Mock backlog count defaults
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
    it('should block non-SUPER_ADMIN users from managing backlog items', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/pilot-backlog',
        headers: getAuthHeader('ADMIN'),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to query backlog items list', async () => {
      vi.mocked(prisma.pilotBacklogItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pilotBacklogItem.count).mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/pilot-backlog',
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
      vi.mocked(prisma.pilotBacklogItem.create).mockResolvedValue({
        id: 'backlog-1',
        title: 'Corrigir upload',
        description: 'Colaborador com CPF ***.***.***-** reportou erro.',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/pilot-backlog',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          companyId: 'company-1',
          title: '<h1>Corrigir upload</h1>',
          description: 'Colaborador com CPF 123.456.789-00 reportou erro com script <script>alert("hack")</script>',
          type: 'BUGFIX',
          priority: 'MEDIUM',
        },
      });

      expect(res.statusCode).toBe(201);
      
      const createCall = vi.mocked(prisma.pilotBacklogItem.create).mock.calls[0][0];
      expect(createCall.data.title).toBe('Corrigir upload');
      expect(createCall.data.description).toContain('***.***.***-**');
      expect(createCall.data.description).not.toContain('<script>');
    });
  });

  describe('3. Convert from Feedback and Mappings', () => {
    it('should block linking feedback of a different company', async () => {
      vi.mocked(prisma.pilotFeedback.findUnique).mockResolvedValue({
        id: 'feedback-1',
        companyId: 'company-other',
        title: 'Title',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/pilot-backlog',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          companyId: 'company-1',
          feedbackId: 'feedback-1',
          title: 'Title',
          description: 'Description',
          type: 'BUGFIX',
          priority: 'MEDIUM',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.message).toContain('empresa');
    });

    it('should suggest correct priority mapping from severity', async () => {
      vi.mocked(prisma.pilotFeedback.findUnique).mockResolvedValue({
        id: 'feedback-1',
        companyId: 'company-1',
        severity: 'CRITICAL',
        category: 'BUG',
        status: 'OPEN',
        title: 'Erro Grave',
        description: 'Descrição Grave',
      } as any);

      vi.mocked(prisma.pilotBacklogItem.create).mockResolvedValue({
        id: 'backlog-2',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/pilot-backlog/from-feedback/feedback-1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(201);
      
      const createCall = vi.mocked(prisma.pilotBacklogItem.create).mock.calls[0][0];
      expect(createCall.data.priority).toBe('URGENT'); // CRITICAL -> URGENT
      expect(createCall.data.type).toBe('BUGFIX'); // BUG -> BUGFIX

      // Verify that feedback status was set to PLANNED
      const updateFeedbackCall = vi.mocked(prisma.pilotFeedback.update).mock.calls[0][0];
      expect(updateFeedbackCall.data.status).toBe('PLANNED');
    });
  });

  describe('4. Status Transitions and Release Notes', () => {
    it('should set completedAt automatically when backlog status is DONE', async () => {
      vi.mocked(prisma.pilotBacklogItem.findUnique).mockResolvedValue({
        id: 'backlog-1',
        status: 'OPEN',
      } as any);

      vi.mocked(prisma.pilotBacklogItem.update).mockResolvedValue({
        id: 'backlog-1',
        status: 'DONE',
      } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/pilot-backlog/backlog-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          status: 'DONE',
        },
      });

      expect(res.statusCode).toBe(200);

      const updateCall = vi.mocked(prisma.pilotBacklogItem.update).mock.calls[0][0];
      expect(updateCall.data.status).toBe('DONE');
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
    });

    it('should return release notes containing markdown for DONE items', async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-1',
        name: 'Smoke Company',
      } as any);

      vi.mocked(prisma.pilotBacklogItem.findMany).mockResolvedValue([
        {
          id: '1',
          title: 'Correção webhook Meta',
          description: 'Ajuste de rota',
          type: 'BUGFIX',
          status: 'DONE',
          completedAt: new Date(),
          releaseNote: 'Corrigido o webhook de entrega de WhatsApp.',
        }
      ] as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/pilot-backlog/release-notes',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          companyId: 'company-1',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.markdown).toContain('## BUGFIX');
      expect(body.markdown).toContain('Corrigido o webhook');
    });
  });

  describe('5. CommandCenter Dashboard Integration', () => {
    it('should output backlog counters and raise urgent alerts', async () => {
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);
      vi.mocked(prisma.companySubscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
      vi.mocked(prisma.jobRun.count).mockResolvedValue(0);

      // Inject 1 urgent open backlog item
      vi.mocked(prisma.pilotBacklogItem.findMany).mockResolvedValue([
        {
          id: 'backlog-1',
          companyId: 'company-1',
          priority: 'URGENT',
          status: 'OPEN',
          targetReleaseDate: null,
        }
      ] as any);

      vi.mocked(prisma.pilotBacklogItem.count).mockImplementation((args: any) => {
        if (args?.where?.priority === 'URGENT') return Promise.resolve(1);
        return Promise.resolve(1);
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/command-center/overview',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.pilotBacklog.urgentItems).toBe(1);
      expect(body.data.alerts.some((a: any) => a.type === 'URGENT_BACKLOG_ITEM')).toBe(true);
    });
  });
});

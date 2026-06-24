import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

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
    },
    pilotLead: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leadActivity: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock('../src/lib/redis', () => {
  return {
    redis: {
      status: 'ready',
      quit: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      del: vi.fn(),
    },
  };
});

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';

const app = buildApp();

describe('PresençaFlow RH - Lead CRM Integration Tests', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default authentication checks
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'superadmin-1',
      isActive: true,
      role: 'SUPER_ADMIN',
      mustChangePassword: false,
    } as any);
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'platform-company',
      isActive: true,
    } as any);
  });

  const getAuthHeader = (role: string, companyId = 'company-a', userId = 'user-1') => {
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('CRM Endpoints Authorization', () => {
    it('should block regular users (HR) from accessing CRM admin endpoints', async () => {
      const endpoints = [
        { method: 'GET', url: '/api/admin/leads' },
        { method: 'GET', url: '/api/admin/leads/lead-123' },
        { method: 'PATCH', url: '/api/admin/leads/lead-123' },
        { method: 'POST', url: '/api/admin/leads/lead-123/activities' },
        { method: 'GET', url: '/api/admin/leads/lead-123/activities' },
        { method: 'GET', url: '/api/admin/leads/follow-ups/due' },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method as any,
          url: endpoint.url,
          headers: getAuthHeader('HR'),
          payload: endpoint.method === 'POST' ? { type: 'NOTE', note: 'Blocked test' } : undefined,
        });
        expect(response.statusCode).toBe(403);
      }
    });

    it('should allow SUPER_ADMIN to access CRM admin endpoints', async () => {
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pilotLead.count).mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/leads',
        headers: getAuthHeader('SUPER_ADMIN'),
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('PATCH /api/admin/leads/:id CRM Logic', () => {
    it('should accept assignedToUserId only if they are an active SUPER_ADMIN user', async () => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({
        id: 'lead-123',
        status: 'NEW',
        assignedToUserId: null,
      } as any);

      const targetUserUuid = '00000000-0000-0000-0000-000000000002';

      // 1. Mocking a regular HR user
      vi.mocked(prisma.user.findUnique).mockImplementation(async (args: any) => {
        if (args.where.id === 'user-1') {
          // Authentication check
          return { id: 'user-1', isActive: true, role: 'SUPER_ADMIN' } as any;
        }
        if (args.where.id === targetUserUuid) {
          // Assignment check
          return { id: targetUserUuid, isActive: true, role: 'HR' } as any;
        }
        return null;
      });

      let response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/leads/lead-123',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { assignedToUserId: targetUserUuid },
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error.message).toContain('SUPER_ADMIN');

      // 2. Mocking an inactive SUPER_ADMIN
      vi.mocked(prisma.user.findUnique).mockImplementation(async (args: any) => {
        if (args.where.id === 'user-1') {
          return { id: 'user-1', isActive: true, role: 'SUPER_ADMIN' } as any;
        }
        if (args.where.id === targetUserUuid) {
          return { id: targetUserUuid, isActive: false, role: 'SUPER_ADMIN' } as any;
        }
        return null;
      });

      response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/leads/lead-123',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { assignedToUserId: targetUserUuid },
      });
      expect(response.statusCode).toBe(400);

      // 3. Mocking an active SUPER_ADMIN
      vi.mocked(prisma.user.findUnique).mockImplementation(async (args: any) => {
        if (args.where.id === 'user-1') {
          return { id: 'user-1', isActive: true, role: 'SUPER_ADMIN' } as any;
        }
        if (args.where.id === targetUserUuid) {
          return { id: targetUserUuid, isActive: true, role: 'SUPER_ADMIN' } as any;
        }
        return null;
      });

      vi.mocked(prisma.pilotLead.update).mockResolvedValue({ id: 'lead-123', metadata: {} } as any);

      response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/leads/lead-123',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { assignedToUserId: targetUserUuid },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should create STATUS_CHANGED activity when status changes, and generate AuditLog', async () => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({
        id: 'lead-123',
        status: 'NEW',
        notes: '',
      } as any);

      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({
        id: 'lead-123',
        status: 'CONTACTED',
        metadata: {},
      } as any);
      
      const mockLeadActivityCreate = vi.mocked(prisma.leadActivity.create).mockResolvedValue({} as any);
      const mockAuditLogCreate = vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/leads/lead-123',
        headers: getAuthHeader('SUPER_ADMIN', 'company-a', 'user-1'),
        payload: { status: 'CONTACTED' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockLeadActivityCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-123',
          type: 'STATUS_CHANGED',
          createdByUserId: 'user-1',
        }),
      }));
      expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'LEAD_UPDATED',
          entityId: 'lead-123',
        }),
      }));
    });

    it('should require lostReason when status is changed to LOST', async () => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({
        id: 'lead-123',
        status: 'NEW',
      } as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/leads/lead-123',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { status: 'LOST' },
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error.message).toContain('lostReason');
    });

    it('should successfully update status to LOST with lostReason, and clear nextFollowUpAt', async () => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({
        id: 'lead-123',
        status: 'NEW',
        nextFollowUpAt: new Date(),
      } as any);

      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({
        id: 'lead-123',
        status: 'LOST',
        metadata: {},
      } as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/leads/lead-123',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { status: 'LOST', lostReason: 'Preço alto' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'LOST',
          lostReason: 'Preço alto',
          nextFollowUpAt: null,
          wonAt: null,
        }),
      }));
    });

    it('should set wonAt, clear lostReason and nextFollowUpAt when status changes to WON', async () => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({
        id: 'lead-123',
        status: 'NEW',
        lostReason: 'Preço alto',
        nextFollowUpAt: new Date(),
      } as any);

      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({
        id: 'lead-123',
        status: 'WON',
        metadata: {},
      } as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/leads/lead-123',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { status: 'WON' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'WON',
          lostReason: null,
          nextFollowUpAt: null,
          wonAt: expect.any(Date),
        }),
      }));
    });
  });

  describe('POST /api/admin/leads/:id/activities Rules', () => {
    beforeEach(() => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({
        id: 'lead-123',
        status: 'NEW',
      } as any);
    });

    it('should update lastContactedAt on CONTACTED type activity', async () => {
      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({} as any);
      const mockActivityCreate = vi.mocked(prisma.leadActivity.create).mockResolvedValue({} as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN', 'company-a', 'user-1'),
        payload: { type: 'CONTACTED', note: 'Called client' },
      });

      expect(response.statusCode).toBe(201);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          lastContactedAt: expect.any(Date),
        }),
      }));
      expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'CONTACTED',
          note: 'Called client',
          createdByUserId: 'user-1',
        }),
      }));
    });

    it('should require future date for FOLLOW_UP_SCHEDULED', async () => {
      // 1. Missing date
      let response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'FOLLOW_UP_SCHEDULED' },
      });
      expect(response.statusCode).toBe(400);

      // 2. Past date
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 10);
      response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'FOLLOW_UP_SCHEDULED', nextFollowUpAt: pastDate.toISOString() },
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error.message).toContain('futuro');

      // 3. Future date success
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({} as any);

      response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'FOLLOW_UP_SCHEDULED', nextFollowUpAt: futureDate.toISOString() },
      });
      expect(response.statusCode).toBe(201);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          nextFollowUpAt: expect.any(Date),
        }),
      }));
    });

    it('should require future date for DEMO_SCHEDULED', async () => {
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 10);
      let response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'DEMO_SCHEDULED', demoScheduledAt: pastDate.toISOString() },
      });
      expect(response.statusCode).toBe(400);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({} as any);

      response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'DEMO_SCHEDULED', demoScheduledAt: futureDate.toISOString() },
      });
      expect(response.statusCode).toBe(201);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          demoScheduledAt: expect.any(Date),
        }),
      }));
    });

    it('should require note to be filled for NOTE type', async () => {
      let response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'NOTE', note: '' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should update status, wonAt, and clear nextFollowUpAt for WON activity', async () => {
      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({} as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'WON' },
      });

      expect(response.statusCode).toBe(201);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: {
          status: 'WON',
          wonAt: expect.any(Date),
          lostReason: null,
          nextFollowUpAt: null,
        },
      }));
    });

    it('should require lostReason or note, set status to LOST, and clear nextFollowUpAt for LOST activity', async () => {
      // 1. Missing lostReason / note
      let response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'LOST' },
      });
      expect(response.statusCode).toBe(400);

      // 2. Success with lostReason
      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({} as any);
      response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: { type: 'LOST', lostReason: 'Preço' },
      });

      expect(response.statusCode).toBe(201);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: {
          status: 'LOST',
          lostReason: 'Preço',
          wonAt: null,
          nextFollowUpAt: null,
        },
      }));
    });
  });

  describe('GET /api/admin/leads/follow-ups/due Queries', () => {
    it('should return overdue leads and filter out WON and LOST status', async () => {
      const mockFindMany = vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([
        { id: 'lead-1', name: 'John Doe', status: 'NEW', metadata: {} },
        { id: 'lead-2', name: 'Jane Doe', status: 'CONTACTED', metadata: {} },
      ] as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/leads/follow-ups/due',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { nextFollowUpAt: { lte: expect.any(Date) } },
            { NOT: { status: { in: ['WON', 'LOST'] } } },
          ]),
        }),
      }));
      const payload = JSON.parse(response.payload);
      expect(payload.data).toHaveLength(2);
    });
  });

  describe('GET /api/admin/leads/:id/activities Timeline', () => {
    it('should return activities for a specific lead ordered by createdAt desc', async () => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({ id: 'lead-123' } as any);
      
      const mockFindMany = vi.mocked(prisma.leadActivity.findMany).mockResolvedValue([
        { id: 'act-2', type: 'CONTACTED', note: 'Contact 2', createdAt: new Date() },
        { id: 'act-1', type: 'NOTE', note: 'Note 1', createdAt: new Date(Date.now() - 100000) },
      ] as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/leads/lead-123/activities',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { leadId: 'lead-123' },
        orderBy: { createdAt: 'desc' },
      }));
      const payload = JSON.parse(response.payload);
      expect(payload.data).toHaveLength(2);
      expect(payload.data[0].id).toBe('act-2');
    });
  });
});

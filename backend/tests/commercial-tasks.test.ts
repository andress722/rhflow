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
import { getSaoPauloDayRange, getSaoPauloMonthRange } from '../src/lib/date-helpers';

const app = buildApp();

describe('PresençaFlow RH - Commercial Tasks Integration Tests', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default admin authorization mocks
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

  describe('Authorization Checks', () => {
    it('should block regular users (HR) from commercial tasks and quick contact', async () => {
      let response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('HR'),
      });
      expect(response.statusCode).toBe(403);

      response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/quick-contact',
        headers: getAuthHeader('HR'),
        payload: { note: 'Attempt' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to access commercial tasks', async () => {
      vi.mocked(prisma.pilotLead.count).mockResolvedValue(0);
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('SUPER_ADMIN'),
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toBeDefined();
    });
  });

  describe('GET /api/admin/commercial/tasks Logic', () => {
    it('should query newUnassignedLeads (status NEW, assignedToUserId null)', async () => {
      const mockCount = vi.mocked(prisma.pilotLead.count).mockResolvedValue(5);
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      expect(mockCount).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          status: 'NEW',
          assignedToUserId: null,
        },
      }));
      const payload = JSON.parse(response.payload);
      expect(payload.data.newUnassignedLeads.count).toBe(5);
    });

    it('should query newUncontactedLeads (status NEW, lastContactedAt null, createdAt <= now - 24h)', async () => {
      const mockCount = vi.mocked(prisma.pilotLead.count).mockResolvedValue(3);
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      expect(mockCount).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          status: 'NEW',
          lastContactedAt: null,
          createdAt: { lte: expect.any(Date) },
        },
      }));
      const payload = JSON.parse(response.payload);
      expect(payload.data.newUncontactedLeads.count).toBe(3);
    });

    it('should query overdueFollowUps (nextFollowUpAt <= now, status not WON/LOST)', async () => {
      const mockCount = vi.mocked(prisma.pilotLead.count).mockResolvedValue(4);
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      expect(mockCount).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          nextFollowUpAt: { lte: expect.any(Date) },
          NOT: { status: { in: ['WON', 'LOST'] } },
        },
      }));
      const payload = JSON.parse(response.payload);
      expect(payload.data.overdueFollowUps.count).toBe(4);
    });

    it('should query demosToday within America/Sao_Paulo day range, ignoring WON/LOST', async () => {
      const mockCount = vi.mocked(prisma.pilotLead.count).mockResolvedValue(2);
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      const dayRange = getSaoPauloDayRange(new Date());

      expect(response.statusCode).toBe(200);
      expect(mockCount).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          demoScheduledAt: {
            gte: dayRange.start,
            lte: dayRange.end,
          },
          NOT: { status: { in: ['WON', 'LOST'] } },
        },
      }));
      const payload = JSON.parse(response.payload);
      expect(payload.data.demosToday.count).toBe(2);
    });

    it('should calculate staleQualifiedLeads using last activity, fallback to updatedAt/createdAt', async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const mockFindMany = vi.mocked(prisma.pilotLead.findMany).mockImplementation(async (args: any) => {
        if (args?.where?.status === 'QUALIFIED') {
          return [
            // 1. Stale lead with old activity
            {
              id: 'lead-stale-1',
              status: 'QUALIFIED',
              createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
              updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
              activities: [{ id: 'act-1', createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) }],
            },
            // 2. Active lead with fresh activity
            {
              id: 'lead-active-2',
              status: 'QUALIFIED',
              createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              activities: [{ id: 'act-2', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }],
            },
            // 3. Stale lead with fallback (no activities, old updatedAt)
            {
              id: 'lead-stale-3',
              status: 'QUALIFIED',
              createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
              updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
              activities: [],
            },
          ] as any;
        }
        return [];
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      // lead-stale-1 (8 days ago) and lead-stale-3 (9 days ago fallback) are stale
      expect(payload.data.staleQualifiedLeads.count).toBe(2);
    });

    it('should query wonThisMonth within America/Sao_Paulo month range', async () => {
      const mockCount = vi.mocked(prisma.pilotLead.count).mockResolvedValue(6);
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      const monthRange = getSaoPauloMonthRange(new Date());

      expect(response.statusCode).toBe(200);
      expect(mockCount).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          status: 'WON',
          wonAt: {
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
      }));
      const payload = JSON.parse(response.payload);
      expect(payload.data.wonThisMonth.count).toBe(6);
    });

    it('should query lostThisMonth prioritizing LOST activities, fallback to updatedAt', async () => {
      const monthRange = getSaoPauloMonthRange(new Date());
      vi.mocked(prisma.pilotLead.findMany).mockImplementation(async (args: any) => {
        if (args?.where?.status === 'LOST') {
          return [
            // 1. Lost this month by activity
            {
              id: 'lost-1',
              status: 'LOST',
              updatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // old
              activities: [{ id: 'act-lost-1', type: 'LOST', createdAt: new Date() }], // this month
            },
            // 2. Lost this month by fallback (no activities, updated this month)
            {
              id: 'lost-2',
              status: 'LOST',
              updatedAt: new Date(), // this month
              activities: [],
            },
            // 3. Lost last month
            {
              id: 'lost-3',
              status: 'LOST',
              updatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
              activities: [{ id: 'act-lost-3', type: 'LOST', createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }],
            },
          ] as any;
        }
        return [];
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/tasks',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      // lost-1 and lost-2 are in the month range
      expect(payload.data.lostThisMonth.count).toBe(2);
    });
  });

  describe('GET /api/admin/leads Card Filter Parity', () => {
    it('should apply the same filters that map to commercial task cards', async () => {
      const mockFindMany = vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pilotLead.count).mockResolvedValue(0);

      // 1. test unassigned=true
      await app.inject({
        method: 'GET',
        url: '/api/admin/leads?unassigned=true',
        headers: getAuthHeader('SUPER_ADMIN'),
      });
      expect(mockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: { AND: expect.arrayContaining([{ assignedToUserId: null }]) },
      }));

      // 2. test uncontacted=true
      await app.inject({
        method: 'GET',
        url: '/api/admin/leads?uncontacted=true',
        headers: getAuthHeader('SUPER_ADMIN'),
      });
      expect(mockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            expect.objectContaining({
              status: 'NEW',
              lastContactedAt: null,
              createdAt: expect.any(Object),
            }),
          ]),
        },
      }));

      // 3. test demosToday=true
      await app.inject({
        method: 'GET',
        url: '/api/admin/leads?demosToday=true',
        headers: getAuthHeader('SUPER_ADMIN'),
      });
      const dayRange = getSaoPauloDayRange(new Date());
      expect(mockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            expect.objectContaining({
              demoScheduledAt: { gte: dayRange.start, lte: dayRange.end },
              NOT: { status: { in: ['WON', 'LOST'] } },
            }),
          ]),
        },
      }));

      // 4. test stale=true
      await app.inject({
        method: 'GET',
        url: '/api/admin/leads?stale=true',
        headers: getAuthHeader('SUPER_ADMIN'),
      });
      expect(mockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            expect.objectContaining({
              status: 'QUALIFIED',
              OR: expect.any(Array),
            }),
          ]),
        },
      }));
    });
  });

  describe('POST /api/admin/leads/:id/quick-contact', () => {
    it('should successfully create CONTACTED activity, update lastContactedAt and generate AuditLog', async () => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({
        id: 'lead-123',
        status: 'NEW',
      } as any);

      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({
        id: 'lead-123',
        status: 'NEW',
        metadata: {},
      } as any);

      const mockActivityCreate = vi.mocked(prisma.leadActivity.create).mockResolvedValue({} as any);
      const mockAuditLogCreate = vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/leads/lead-123/quick-contact',
        headers: getAuthHeader('SUPER_ADMIN', 'company-a', 'user-super-99'),
        payload: { note: 'Left a voicemail' },
      });

      expect(response.statusCode).toBe(200);

      // Verify pilotLead update
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'lead-123' },
        data: {
          lastContactedAt: expect.any(Date),
        },
      }));

      // Verify activity creation
      expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: {
          leadId: 'lead-123',
          type: 'CONTACTED',
          note: 'Left a voicemail',
          createdByUserId: 'user-super-99',
        },
      }));

      // Verify AuditLog creation
      expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'LEAD_UPDATED',
          entityId: 'lead-123',
          metadata: {
            leadId: 'lead-123',
            activityType: 'CONTACTED',
          },
        }),
      }));
    });
  });
});

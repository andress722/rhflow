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
    whatsAppChannel: {
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
    whatsAppMessageLog: {
      count: vi.fn(),
    },
    operationalErrorLog: {
      count: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    companySubscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';

const app = buildApp();

describe('PresençaFlow RH - Pilot Conversion commercial funnels API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock behaviors
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-user-1',
      isActive: true,
      role: 'ADMIN',
    } as any);

    vi.mocked(prisma.user.count).mockResolvedValue(1);

    vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
      companyId: 'company-pilot-1',
      enableRemoteCheckin: true,
      enableMedicalCertificates: true,
    } as any);

    vi.mocked(prisma.employee.count).mockResolvedValue(10);
    vi.mocked(prisma.workSchedule.count).mockResolvedValue(1);
    vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(5);
    vi.mocked(prisma.occurrence.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
      status: 'CONNECTED',
    } as any);
  });

  const getAuthHeader = (role: string, companyId = 'company-pilot-1', userId = 'user-1') => {
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. RBAC Permissions on /api/admin/pilots/*', () => {
    const endpoints = [
      { method: 'GET', url: '/api/admin/pilots' },
      { method: 'GET', url: '/api/admin/pilots/company-1' },
      { method: 'PATCH', url: '/api/admin/pilots/company-1' },
      { method: 'POST', url: '/api/admin/pilots/company-1/generate-proposal-summary' },
    ];

    endpoints.forEach((ep) => {
      it(`should block ADMIN from ${ep.method} ${ep.url}`, async () => {
        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: getAuthHeader('ADMIN'),
        });
        expect(res.statusCode).toBe(403);
      });

      it(`should block HR from ${ep.method} ${ep.url}`, async () => {
        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: getAuthHeader('HR'),
        });
        expect(res.statusCode).toBe(403);
      });

      it(`should block MANAGER from ${ep.method} ${ep.url}`, async () => {
        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: getAuthHeader('MANAGER'),
        });
        expect(res.statusCode).toBe(403);
      });

      it(`should block VIEWER from ${ep.method} ${ep.url}`, async () => {
        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: getAuthHeader('VIEWER'),
        });
        expect(res.statusCode).toBe(403);
      });

      it(`should allow SUPER_ADMIN to access ${ep.method} ${ep.url}`, async () => {
        // Setup mock response to prevent 404/500 errors in this RBAC loop
        vi.mocked(prisma.company.count).mockResolvedValue(1);
        vi.mocked(prisma.company.findUnique).mockResolvedValue({
          id: 'company-1',
          name: 'ACME',
          pilotStatus: 'ACTIVE',
        } as any);
        vi.mocked(prisma.company.findMany).mockResolvedValue([
          { id: 'company-1', name: 'ACME', pilotStatus: 'ACTIVE' },
        ] as any);

        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: getAuthHeader('SUPER_ADMIN'),
        });
        // 200/201 or 400 validation error implies it passed RBAC guard, not 403
        expect(res.statusCode).not.toBe(403);
      });
    });
  });

  describe('2. GET /api/admin/pilots and Filtering', () => {
    it('should query and return pilots list with pagination & healthStatus in-memory filtering', async () => {
      vi.mocked(prisma.company.count).mockResolvedValue(10);
      vi.mocked(prisma.company.findMany).mockResolvedValue([
        { id: 'company-1', name: 'ACME 1', pilotStatus: 'ACTIVE' },
        { id: 'company-2', name: 'ACME 2', pilotStatus: 'PROPOSAL_SENT' },
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/pilots?pilotStatus=ACTIVE&page=1&pageSize=10',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.items.length).toBe(2);
      expect(prisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ pilotStatus: 'ACTIVE' }),
          skip: 0,
          take: 10,
        })
      );
    });

    it('should calculate expiringIn7Days correctly', async () => {
      vi.mocked(prisma.company.count).mockImplementation(async (args: any) => {
        // Checking for ends date query
        if (args?.where?.pilotEndsAt) {
          return 3;
        }
        return 10;
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/pilots',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      const json = res.json();
      expect(json.expiringIn7Days).toBe(3);
    });
  });

  describe('3. GET /api/admin/pilots/:companyId', () => {
    it('should return company pilot details with current healthScore', async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-1',
        name: 'ACME Pilot',
        pilotStatus: 'ACTIVE',
        pilotStartedAt: new Date('2026-06-20T00:00:00.000Z'),
        pilotEndsAt: new Date('2026-06-27T00:00:00.000Z'),
        subscription: {
          plan: { name: 'Standard' },
        },
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/pilots/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.companyName).toBe('ACME Pilot');
      expect(json.data.healthScore).toBeDefined();
      expect(json.data.currentSubscription.planName).toBe('Standard');
    });
  });

  describe('4. PATCH /api/admin/pilots/:companyId and Business Rules', () => {
    beforeEach(() => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-1',
        pilotStatus: 'NOT_STARTED',
        pilotStartedAt: null,
      } as any);

      vi.mocked(prisma.company.update).mockResolvedValue({
        id: 'company-1',
        pilotStatus: 'ACTIVE',
      } as any);
    });

    it('should pre-populate pilotStartedAt if status changes to ACTIVE and it was empty', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/pilots/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          pilotStatus: 'ACTIVE',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pilotStatus: 'ACTIVE',
            pilotStartedAt: expect.any(Date),
            pilotLostReason: null,
          }),
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PILOT_UPDATED',
          }),
        })
      );
    });

    it('should pre-populate proposalSentAt on PROPOSAL_SENT', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/pilots/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          pilotStatus: 'PROPOSAL_SENT',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proposalSentAt: expect.any(Date),
          }),
        })
      );
    });

    it('should pre-populate convertedAt on WON and clear lost reason', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/pilots/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          pilotStatus: 'WON',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            convertedAt: expect.any(Date),
            pilotLostReason: null,
          }),
        })
      );
    });

    it('should reject LOST status if pilotLostReason is not provided', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/pilots/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          pilotStatus: 'LOST',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('MISSING_LOST_REASON');
    });

    it('should accept LOST status and clear convertedAt when pilotLostReason is supplied', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/pilots/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          pilotStatus: 'LOST',
          pilotLostReason: 'Client chose a competitor.',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pilotStatus: 'LOST',
            pilotLostReason: 'Client chose a competitor.',
            convertedAt: null,
          }),
        })
      );
    });

    it('should throw 400 validation error if pilotStartedAt is after pilotEndsAt', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/pilots/company-1',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          pilotStartedAt: '2026-06-25T00:00:00.000Z',
          pilotEndsAt: '2026-06-20T00:00:00.000Z', // ends before start
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('INVALID_DATES');
    });
  });

  describe('5. POST /api/admin/pilots/:companyId/generate-proposal-summary', () => {
    it('should generate operational summary without leaking sensitive employee records', async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-1',
        name: 'ACME Corp',
        pilotStatus: 'ACTIVE',
        pilotStartedAt: new Date('2026-06-15T00:00:00.000Z'),
        pilotEndsAt: new Date('2026-06-22T00:00:00.000Z'),
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/pilots/company-1/generate-proposal-summary',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.summaryMarkdown).toContain('Resumo Executivo da Operação Piloto');
      expect(json.summaryMarkdown).toContain('ACME Corp');
      expect(json.summaryData).toBeDefined();

      // Ensure NO sensitive personal employee information exists in response
      expect(json.summaryMarkdown).not.toContain('cpf');
      expect(json.summaryMarkdown).not.toContain('***.***.***-**');
      expect(json.summaryData.employeesList).toBeUndefined();
    });
  });
});

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
    companySettings: {
      count: vi.fn(),
    },
    employee: {
      groupBy: vi.fn(),
    },
    workSchedule: {
      groupBy: vi.fn(),
    },
    remoteCheckin: {
      count: vi.fn(),
    },
    medicalCertificate: {
      count: vi.fn(),
    },
    occurrence: {
      count: vi.fn(),
    },
    usageTelemetry: {
      create: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    pilotFeedback: {
      groupBy: vi.fn(),
    },
    pilotBacklogItem: {
      count: vi.fn(),
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

describe('PresençaFlow RH - Telemetry & Analytics API', () => {
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
        companyId: 'company-1',
        email: `${role.toLowerCase()}@test.com`,
      } as any);
    });

    vi.mocked(prisma.pilotFeedback.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.pilotBacklogItem.count).mockResolvedValue(0);
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

  describe('1. Capture Endpoint (POST /api/telemetry/events)', () => {
    it('should allow guest users to log public telemetry events and mask CPFs', async () => {
      vi.mocked(prisma.usageTelemetry.create).mockResolvedValue({ id: 'event-1' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/telemetry/events',
        payload: {
          eventName: 'ARTICLE_VIEW',
          category: 'KNOWLEDGE_BASE',
          properties: {
            title: 'Visualizando guia do piloto',
            userCpf: '12345678901',
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const createCall = vi.mocked(prisma.usageTelemetry.create).mock.calls[0][0];
      expect(createCall.data.properties.userCpf).toBe('***********');
      expect(createCall.data.userId).toBeNull();
    });

    it('should capture userId and companyId if user is authenticated', async () => {
      vi.mocked(prisma.usageTelemetry.create).mockResolvedValue({ id: 'event-2' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/telemetry/events',
        headers: getAuthHeader('HR', 'company-1', 'user-123'),
        payload: {
          eventName: 'PAGE_VIEW',
          category: 'ONBOARDING',
          properties: { path: '/app/onboarding' },
        },
      });

      expect(res.statusCode).toBe(201);
      const createCall = vi.mocked(prisma.usageTelemetry.create).mock.calls[0][0];
      expect(createCall.data.userId).toBe('user-123-HR');
      expect(createCall.data.companyId).toBe('company-1');
    });
  });

  describe('2. Admin Analytics (GET /api/admin/analytics/overview)', () => {
    it('should block non-SUPER_ADMIN users from getting analytics consolidated data', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/overview',
        headers: getAuthHeader('HR'),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return aggregated telemetry overview for SUPER_ADMIN', async () => {
      vi.mocked(prisma.usageTelemetry.groupBy).mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(100);
      vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(5);
      vi.mocked(prisma.occurrence.count).mockResolvedValue(20);
      vi.mocked(prisma.usageTelemetry.count).mockResolvedValue(15);
      vi.mocked(prisma.company.count).mockResolvedValue(10);
      vi.mocked(prisma.companySettings.count).mockResolvedValue(8);
      vi.mocked(prisma.employee.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.workSchedule.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.usageTelemetry.findMany).mockResolvedValue([
        { properties: { path: '/app/presence' } },
        { properties: { path: '/app/presence' } },
        { properties: { path: '/app/reports' } },
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/overview',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.activeUsers.dau).toBe(2);
      expect(body.data.featureAdoption.checkinCount).toBe(100);
      expect(body.data.topPages[0].path).toBe('/app/presence');
      expect(body.data.topPages[0].count).toBe(2);
    });
  });

  describe('3. Telemetry Seed validation', () => {
    it('should run seed telemetry script and call createMany', async () => {
      const { seedTelemetryEvents } = await import('../src/seeds/telemetry-seed');
      vi.mocked(prisma.usageTelemetry.createMany).mockResolvedValue({ count: 50 } as any);

      await expect(seedTelemetryEvents()).resolves.not.toThrow();
      expect(prisma.usageTelemetry.createMany).toHaveBeenCalled();
    });
  });
});

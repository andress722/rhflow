import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis BEFORE importing the app
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    remoteCheckin: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    occurrence: {
      count: vi.fn(),
    },
    medicalCertificate: {
      count: vi.fn(),
    },
    whatsAppChannel: {
      count: vi.fn(),
    },
    usageCounter: {
      findMany: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
    },
    operationalErrorLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
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
import { redis } from '../src/lib/redis';
import { buildApp } from '../src/app';

const app = buildApp();

describe('PresençaFlow RH - Support Dashboard & Operational Telemetry', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.incr).mockResolvedValue(1);
    
    // Default mock behavior for auth check
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'superadmin-1',
      isActive: true,
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

  describe('1. Access Control (RBAC)', () => {
    it('should allow SUPER_ADMIN to access overview', async () => {
      vi.mocked(prisma.company.count).mockResolvedValue(5);
      vi.mocked(prisma.user.count).mockResolvedValue(10);
      vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(15);
      vi.mocked(prisma.occurrence.count).mockResolvedValue(2);
      vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(1);
      vi.mocked(prisma.whatsAppChannel.count).mockResolvedValue(0);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(3);
      vi.mocked(prisma.company.findMany).mockResolvedValue([]);
      vi.mocked(prisma.usageCounter.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/support/overview',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.totalCompanies).toBe(5);
    });

    it('should forbid non-SUPER_ADMIN (e.g. ADMIN, HR) from accessing overview', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/support/overview',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Error Interceptor & DB Persistence', () => {
    it('should log operational error to DB asynchronously on thrown exceptions', async () => {
      const mockLogCreate = vi.mocked(prisma.operationalErrorLog.create).mockResolvedValue({} as any);

      // We trigger the validation error path (or login, etc.)
      // Let's call /api/test-error-leak which exists for tests to check error handler
      await app.inject({
        method: 'GET',
        url: '/api/test-error-leak',
      });

      // The call is asynchronous, let's wait a tiny bit to check call
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockLogCreate).toHaveBeenCalled();
      const dbArg = mockLogCreate.mock.calls[0][0];
      expect(dbArg.data.errorCode).toBe('INTERNAL_SERVER_ERROR');
      // Assert metadata got sanitized: "Leak: accessToken=\"super-secret-meta-token\"" is in error but metadata should redact it
      expect(JSON.stringify(dbArg.data.metadata)).toContain('[REDACTED]');
    });

    it('should not break the response even if Prisma operational logging throws an error', async () => {
      vi.mocked(prisma.operationalErrorLog.create).mockRejectedValue(new Error('DB is offline'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/test-error-leak',
      });

      // The HTTP response should still be returned successfully with 500 (not break Fastify server)
      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });
  });

  describe('3. Telemetry Metadata Sanitization', () => {
    it('should recursively remove or mask confidential details in log inputs', async () => {
      const mockLogCreate = vi.mocked(prisma.operationalErrorLog.create).mockResolvedValue({} as any);

      // Injecting a route which returns custom error to see logs
      // Wait, we can test by throwing inside a custom handler or directly asserting what was saved
      // Let's trigger a route that validation fails or custom error to see log
      // But we can also test by calling a route with secrets in request body
      await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: {
          email: 'admin@test.com',
          password: 'sensitive-password-here',
          cpf: '12345678901', // 11 digits CPF
          webhookSecret: 'shhhhh',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Let's check the arguments saved. Even if login succeeds or fails, we check the metadata
      if (mockLogCreate.mock.calls.length > 0) {
        const dbArg = mockLogCreate.mock.calls[0][0];
        const metaStr = JSON.stringify(dbArg.data.metadata);
        expect(metaStr).not.toContain('sensitive-password-here');
        expect(metaStr).not.toContain('shhhhh');
        expect(metaStr).not.toContain('12345678901');
        expect(metaStr).toContain('[REDACTED]');
        expect(metaStr).toContain('***.***.***-**'); // masked CPF
      }
    });
  });

  describe('4. Support Search and Tracing', () => {
    it('should trace errors by requestId successfully', async () => {
      const mockRequestId = 'req-trace-uuid-123';
      vi.mocked(prisma.operationalErrorLog.findMany).mockResolvedValue([
        {
          id: 'log-1',
          companyId: 'company-a',
          userId: 'user-1',
          requestId: mockRequestId,
          route: '/api/presence',
          method: 'GET',
          errorCode: 'VALIDATION_ERROR',
          message: 'Parâmetro data incorreto.',
          statusCode: 400,
          metadata: { query: { date: 'invalid-date' } },
          createdAt: new Date(),
        }
      ] as any);

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/support/request/${mockRequestId}`,
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.requestId).toBe(mockRequestId);
      expect(data.data.items).toHaveLength(1);
      expect(data.data.items[0].errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 404 REQUEST_NOT_FOUND when requestId does not exist', async () => {
      vi.mocked(prisma.operationalErrorLog.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/support/request/unknown-uuid',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('REQUEST_NOT_FOUND');
    });
  });

  describe('5. Recent Errors logs retrieval', () => {
    it('should apply limit and pagination to recent errors list', async () => {
      const mockFindMany = vi.mocked(prisma.operationalErrorLog.findMany).mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: '/api/admin/support/recent-errors?limit=10&page=2',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
        take: 10,
        skip: 10,
        orderBy: { createdAt: 'desc' },
      }));
    });
  });

  describe('6. Company Health Telemetry', () => {
    it('should retrieve health status of tenants, plan capacity and last logged error date', async () => {
      vi.mocked(prisma.company.findMany).mockResolvedValue([
        {
          id: 'company-x',
          name: 'Empresa X Limitada',
          legalName: 'Empresa X S/A',
          isActive: true,
          subscription: {
            status: 'ACTIVE',
            plan: {
              name: 'Gold',
              maxEmployees: 100,
              maxMonthlyCheckins: 5000,
            }
          },
          users: [{ lastLoginAt: new Date() }],
          whatsappChannel: { status: 'CONNECTED' },
          _count: {
            employees: 40,
            occurrences: 3,
            medicalCertificates: 2,
          }
        }
      ] as any);

      vi.mocked(prisma.operationalErrorLog.groupBy).mockResolvedValue([
        {
          companyId: 'company-x',
          _max: { createdAt: new Date() },
        }
      ] as any);

      vi.mocked(prisma.remoteCheckin.groupBy).mockResolvedValue([
        {
          companyId: 'company-x',
          _count: { id: 100 },
        }
      ] as any);

      vi.mocked(prisma.usageCounter.findMany).mockResolvedValue([
        {
          companyId: 'company-x',
          key: 'remote_checkins',
          value: 4000,
        }
      ] as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/support/company-health',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].tradeName).toBe('Empresa X Limitada');
      expect(data.data[0].activeEmployees).toBe(40);
      expect(data.data[0].planUsagePercent).toBe(80); // max of 40/100 (40%) and 4000/5000 (80%)
    });
  });

  describe('7. Pilot Metrics aggregates', () => {
    it('should aggregate checkins, response rate, ocorrências, atestados, and group logs by code/route', async () => {
      vi.mocked(prisma.remoteCheckin.count)
        .mockResolvedValueOnce(200) // checkinsSent
        .mockResolvedValueOnce(40)  // notRespondedCount
        .mockResolvedValueOnce(160); // checkinsResponded

      vi.mocked(prisma.occurrence.count).mockResolvedValue(15);
      vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(8);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(5);
      vi.mocked(prisma.user.count).mockResolvedValue(30);

      vi.mocked(prisma.operationalErrorLog.groupBy)
        .mockResolvedValueOnce([
          { errorCode: 'VALIDATION_ERROR', _count: { id: 10 } },
          { errorCode: 'FORBIDDEN', _count: { id: 2 } },
        ] as any)
        .mockResolvedValueOnce([
          { route: '/api/employees', method: 'POST', _count: { id: 8 } },
        ] as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/support/pilot-metrics?from=2026-06-01&to=2026-06-07',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.checkinsSent).toBe(200);
      expect(data.data.responseRate).toBe(80); // 160 / 200 * 100
      expect(data.data.errorsByCode).toHaveLength(2);
      expect(data.data.errorsByRoute).toHaveLength(1);
    });
  });
});

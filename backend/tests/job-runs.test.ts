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
    },
    jobRun: {
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    pilotLead: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    companySubscription: {
      findMany: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      findFirst: vi.fn(),
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
import { JobRegistryService } from '../src/services/job-registry.service';

const app = buildApp();

describe('PresençaFlow RH - Job Runs Governance API', () => {
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
      isActive: true,
    } as any);
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

  describe('1. RBAC Permissions', () => {
    it('should block non-SUPER_ADMIN users from list of jobs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/jobs',
        headers: getAuthHeader('ADMIN'),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to call get registry status', async () => {
      vi.mocked(prisma.jobRun.findFirst).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/jobs',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });

  describe('2. Job Instrumentation and Sanitization', () => {
    it('should create JobRun start log and sanitize sensitive texts on completion', async () => {
      vi.mocked(prisma.jobRun.create).mockResolvedValue({ id: 'run-id-1' } as any);
      vi.mocked(prisma.jobRun.update).mockResolvedValue({} as any);

      const runId = await JobRegistryService.startRun('INTERNAL_PING', 'INTERNAL', 'req-1');
      expect(runId).toBe('run-id-1');
      expect(prisma.jobRun.create).toHaveBeenCalledWith({
        data: {
          jobKey: 'INTERNAL_PING',
          status: 'RUNNING',
          startedAt: expect.any(Date),
          triggeredBy: 'INTERNAL',
          requestId: 'req-1',
        }
      });

      // Complete with error containing connection string secrets
      await JobRegistryService.completeRun('run-id-1', 'FAILED', 150, null, {
        code: 'ERR',
        message: 'Could not connect to postgres://admin:super-secret-password@localhost:5432/db'
      });

      expect(prisma.jobRun.update).toHaveBeenCalledWith({
        where: { id: 'run-id-1' },
        data: {
          status: 'FAILED',
          finishedAt: expect.any(Date),
          durationMs: 150,
          summary: undefined,
          errorCode: 'ERR',
          errorMessage: 'Could not connect to ***REDACTED***'
        }
      });
    });
  });

  describe('3. Execution Safety Controls', () => {
    it('should prevent manual triggers of operational checkin jobs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/jobs/REMOTE_CHECKIN_BATCH/run',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should allow manual triggers of safe internal ping jobs', async () => {
      vi.mocked(prisma.jobRun.create).mockResolvedValue({ id: 'ping-run' } as any);
      vi.mocked(prisma.jobRun.update).mockResolvedValue({} as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/jobs/INTERNAL_PING/run',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });
  });
});

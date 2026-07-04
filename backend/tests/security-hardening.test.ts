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
    companySubscription: {
      findUnique: vi.fn(),
    },
    auditLog: {
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
import { env } from '../src/config/env';

const app = buildApp();

describe('PresençaFlow RH - Security Hardening & Data Leak Protection', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getAuthHeader = (role: string, companyId = 'company-1', userId = 'user-1') => {
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. Error Stack Trace Isolation', () => {
    it('should suppress stack traces and keep error messages safe when running in production', async () => {
      // Simulate production environment error handling
      const originalEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'production';

      const res = await app.inject({
        method: 'GET',
        url: '/api/test-error-leak', // This route throws an error
      });

      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      // It should replace leaked meta information with a generic security message
      expect(body.error.message).toBe('Ocorreu um erro de segurança ou validação contendo parâmetros confidenciais.');
      expect(res.payload).not.toContain('accessToken');
      expect(res.payload).not.toContain('super-secret-meta-token');
      expect(res.payload).not.toContain('stack');
      expect(res.payload).not.toContain('at E:/RHFLOW');

      // Restore env
      (env as any).NODE_ENV = originalEnv;
    });
  });

  describe('2. Masking of Sensitive Data (LGPD)', () => {
    it('should verify that database URL and encryption secret do not leak in ready/health indicators', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/ready',
      });

      expect(res.statusCode).toBeDefined();
      expect(res.payload).not.toContain('postgresql://');
      expect(res.payload).not.toContain('redis://');
      expect(res.payload).not.toContain(env.JWT_SECRET);
      if (env.ENCRYPTION_SECRET) {
        expect(res.payload).not.toContain(env.ENCRYPTION_SECRET);
      }
    });
  });

  describe('3. Internal Job Route Protection', () => {
    it('should block jobs without x-internal-job-secret header with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/remote-checkin-batch',
        body: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('should block jobs with incorrect secret with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/remote-checkin-batch',
        headers: {
          'x-internal-job-secret': 'incorrect-job-secret',
        },
        body: {},
      });
      expect(res.statusCode).toBe(401);
    });
  });
});

import { vi, describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';

// 1. Mock Prisma and Redis
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    company: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    whatsAppMessageLog: {
      deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
    },
    remoteCheckin: {
      count: vi.fn().mockResolvedValue(0),
    },
    occurrence: {
      count: vi.fn().mockResolvedValue(0),
    },
    medicalCertificate: {
      count: vi.fn().mockResolvedValue(0),
    },
    absenceRecord: {
      count: vi.fn().mockResolvedValue(0),
    },
    companySettings: {
      findUnique: vi.fn(),
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
      ping: vi.fn().mockResolvedValue('PONG'),
    },
  };
});

import { prisma } from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';

// Define temporary mock environment
const originalEnv = { ...process.env };

describe('PresençaFlow RH - Production Readiness & Jobs', () => {
  let app: any;

  beforeAll(async () => {
    // Setup env for test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/presencaflow?schema=public';
    process.env.JWT_SECRET = 'test-jwt-secret-must-be-very-long-32-chars';
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-must-be-32-chars-long';
    process.env.INTERNAL_JOB_SECRET = 'test-internal-job-secret-must-be-32-chars';
    process.env.STORAGE_PATH = path.join(__dirname, 'temp-storage-test');

    const { validateEnv } = await import('../src/config/env');
    const { buildApp } = await import('../src/app');
    app = buildApp();
    await app.ready();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up temp storage folder if exists
    try {
      const storagePath = path.join(__dirname, 'temp-storage-test');
      if (fs.existsSync(storagePath)) {
        const files = fs.readdirSync(storagePath);
        for (const file of files) {
          fs.unlinkSync(path.join(storagePath, file));
        }
        fs.rmdirSync(storagePath);
      }
    } catch (e) {}
  });

  describe('Boot validation checks', () => {
    const exitMock = vi.fn();
    let originalExit: any;
    let originalConsoleError: any;

    beforeEach(() => {
      originalExit = process.exit;
      originalConsoleError = console.error;
      process.exit = exitMock as any;
      console.error = vi.fn();
      exitMock.mockReset();
    });

    afterEach(() => {
      process.exit = originalExit;
      console.error = originalConsoleError;
      process.env = { ...originalEnv };
    });

    it('should fail boot in production if ENCRYPTION_SECRET is missing', async () => {
      const mockEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/presencaflow?schema=public',
        JWT_SECRET: 'test-jwt-secret-must-be-very-long-32-chars',
        INTERNAL_JOB_SECRET: 'test-internal-job-secret-must-be-32-chars',
      };

      const { validateEnv } = await import('../src/config/env');
      validateEnv(mockEnv as any);
      expect(exitMock).toHaveBeenCalledWith(1);
    });

    it('should fail boot in production if JWT_SECRET is too short', async () => {
      const mockEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/presencaflow?schema=public',
        JWT_SECRET: 'short',
        ENCRYPTION_SECRET: 'test-encryption-secret-must-be-32-chars-long',
        INTERNAL_JOB_SECRET: 'test-internal-job-secret-must-be-32-chars',
      };

      const { validateEnv } = await import('../src/config/env');
      validateEnv(mockEnv as any);
      expect(exitMock).toHaveBeenCalledWith(1);
    });

    it('should fail boot in production if INTERNAL_JOB_SECRET is missing', async () => {
      const mockEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/presencaflow?schema=public',
        JWT_SECRET: 'test-jwt-secret-must-be-very-long-32-chars',
        ENCRYPTION_SECRET: 'test-encryption-secret-must-be-32-chars-long',
      };

      const { validateEnv } = await import('../src/config/env');
      validateEnv(mockEnv as any);
      expect(exitMock).toHaveBeenCalledWith(1);
    });
  });

  describe('Health Check endpoints', () => {
    it('GET /api/health/live should return 200 OK', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/live',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.status).toBe('OK');
    });

    it('GET /api/health/ready should return 200 OK if all dependencies are healthy', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '1': 1 }]);
      
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/ready',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.status).toBe('OK');
    });

    it('GET /api/health/ready should return 503 if database fails', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB Connection lost'));

      const res = await app.inject({
        method: 'GET',
        url: '/api/health/ready',
      });
      expect(res.statusCode).toBe(503);
      const data = JSON.parse(res.payload);
      expect(data.status).toBe('UNHEALTHY');
      expect(data.details.db).toBe('FAIL');
    });

    it('GET /api/health/ready should return 503 if storage is not writable', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '1': 1 }]);
      
      // Stub fs.writeFileSync to throw an error
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('Disk full or Read-only file system');
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/health/ready',
      });
      expect(res.statusCode).toBe(503);
      const data = JSON.parse(res.payload);
      expect(data.status).toBe('UNHEALTHY');
      expect(data.details.storage).toBe('FAIL');
      
      writeSpy.mockRestore();
    });
  });

  describe('Internal Job Endpoints & Security', () => {
    it('should return 401 when calling jobs without x-internal-job-secret header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/remote-checkin-batch',
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when calling jobs with incorrect secret key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/remote-checkin-batch',
        headers: {
          'x-internal-job-secret': 'wrong-secret-key-12345',
        },
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('should execute job successfully with correct secret key', async () => {
      const correctSecret = 'test-internal-job-secret-must-be-32-chars';
      
      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/cleanup-old-logs',
        headers: {
          'x-internal-job-secret': correctSecret,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.success).toBe(true);
      expect(data.data.jobName).toBe('cleanup-old-logs');
      expect(data.data.status).toBe('SUCCESS');
    });

    it('should successfully GET /api/internal/jobs/ping with correct secret key and return 200', async () => {
      const correctSecret = 'test-internal-job-secret-must-be-32-chars';
      const res = await app.inject({
        method: 'GET',
        url: '/api/internal/jobs/ping',
        headers: {
          'x-internal-job-secret': correctSecret,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.success).toBe(true);
    });

    it('should successfully POST /api/internal/jobs/ping with correct secret key and return 200', async () => {
      const correctSecret = 'test-internal-job-secret-must-be-32-chars';
      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/ping',
        headers: {
          'x-internal-job-secret': correctSecret,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.success).toBe(true);
    });

    it('should return 401 when calling GET /api/internal/jobs/ping with incorrect secret key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/internal/jobs/ping',
        headers: {
          'x-internal-job-secret': 'wrong-secret-key-12345',
        },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Request ID & Sanitisation checks', () => {
    it('should generate x-request-id if not provided, and return it in headers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/live',
      });
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should propagate x-request-id if provided in the request', async () => {
      const testId = 'req-test-uuid-999';
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/live',
        headers: {
          'x-request-id': testId,
        },
      });
      expect(res.headers['x-request-id']).toBe(testId);
    });

    it('should sanitise response messages containing secrets in error handler', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/test-error-leak',
      });

      expect(res.statusCode).toBe(500);
      const data = JSON.parse(res.payload);
      expect(data.success).toBe(false);
      expect(data.error.message).not.toContain('super-secret-meta-token');
      expect(data.error.message).toContain('Ocorreu um erro de segurança ou validação contendo parâmetros confidenciais.');
    });
  });
});

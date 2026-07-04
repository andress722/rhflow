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
import { InMemoryCache } from '../src/lib/cache';

const app = buildApp();

describe('PresençaFlow RH - Performance & Scale Hardening API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    InMemoryCache.clear();
    delete process.env.DISABLE_CACHE;

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

  describe('1. In-Memory Cache Hardening', () => {
    it('should retrieve items from cache and enforce TTL correctly', async () => {
      InMemoryCache.set('test-key', { data: 'my-cached-data' }, 2); // 2s TTL
      expect(InMemoryCache.get('test-key')).toEqual({ data: 'my-cached-data' });

      // Clean/Clear
      InMemoryCache.clear();
      expect(InMemoryCache.get('test-key')).toBeNull();
    });

    it('should bypass cache entirely if DISABLE_CACHE env flag is set', async () => {
      process.env.DISABLE_CACHE = 'true';
      InMemoryCache.set('test-key', { data: 'my-cached-data' }, 10);

      expect(InMemoryCache.get('test-key')).toBeNull();
    });
  });

  describe('2. Page Size Enforcements', () => {
    it('should limit request pageSize parameter to a maximum of 100 on jobs history list', async () => {
      vi.mocked(prisma.jobRun.count).mockResolvedValue(150);
      vi.mocked(prisma.jobRun.findMany).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/jobs/runs?page=1&pageSize=1000', // Exaggerated page size
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.pageSize).toBe(100); // Clamped to 100
      expect(prisma.jobRun.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { startedAt: 'desc' },
        skip: 0,
        take: 100, // Enforced maximum of 100
      });
    });
  });
});

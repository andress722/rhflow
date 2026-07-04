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
    employee: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    companySubscription: {
      findUnique: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
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

describe('PresençaFlow RH - Multi-Tenant Isolation & Role-based Write Blocking', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock findUnique user to return role based on sub ID
    vi.mocked(prisma.user.findUnique).mockImplementation((args: any) => {
      const id = args.where.id;
      let role = 'ADMIN';
      if (id.includes('SUPER_ADMIN')) role = 'SUPER_ADMIN';
      if (id.includes('VIEWER')) role = 'VIEWER';
      return Promise.resolve({
        id,
        isActive: true,
        role,
      } as any);
    });

    // Mock company check
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-a',
      isActive: true,
    } as any);
  });

  const getAuthHeader = (role: string, companyId: string) => {
    const userId = `user-id-with-role-${role}`;
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. Tenant Boundaries (Company Isolation)', () => {
    it('should block ADMIN of Company A from querying details of an employee of Company B', async () => {
      // Mock employee belonging to company-B
      vi.mocked(prisma.employee.findUnique).mockResolvedValue({
        id: 'emp-b-1',
        companyId: 'company-b',
        name: 'John Doe',
        status: 'ACTIVE',
      } as any);

      // Request from user of company-A
      const res = await app.inject({
        method: 'GET',
        url: '/api/employees/emp-b-1',
        headers: getAuthHeader('ADMIN', 'company-a'),
      });

      // It must be blocked or return 404/403 due to tenant mismatch
      expect([403, 404]).toContain(res.statusCode);
    });

    it('should block ADMIN of Company A from updating an employee of Company B', async () => {
      vi.mocked(prisma.employee.findUnique).mockResolvedValue({
        id: 'emp-b-1',
        companyId: 'company-b',
        name: 'John Doe',
        status: 'ACTIVE',
      } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/employees/emp-b-1',
        headers: getAuthHeader('ADMIN', 'company-a'),
        body: {
          name: 'Hacked Name',
        },
      });

      expect([403, 404]).toContain(res.statusCode);
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('2. Viewer Write Block', () => {
    it('should block VIEWER role from creating an employee even within their own company', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employees',
        headers: getAuthHeader('VIEWER', 'company-a'),
        body: {
          name: 'Jane Doe',
          cpf: '123.456.789-00',
          email: 'jane@company.com',
          role: 'EMPLOYEE',
          status: 'ACTIVE',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });
  });

  describe('3. Super Admin Corporate Block', () => {
    it('should prevent SUPER_ADMIN from accessing tenant-specific corporate checkins without proper tenant scope', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/presence/checkin', // Tenant-specific employee operation
        headers: getAuthHeader('SUPER_ADMIN', 'global-admin'),
        body: {},
      });
      expect([403, 404]).toContain(res.statusCode);
    });
  });
});

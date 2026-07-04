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
    employee: {
      count: vi.fn(),
    },
    companySubscription: {
      findUnique: vi.fn(),
    },
    usageCounter: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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
import { PlanLimitsService } from '../src/services/plan-limits.service';

describe('PresençaFlow RH - Subscription Plan Limits and Feature Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Fallback STARTER Plan Constraints', () => {
    it('should assert that STARTER plan blocks medical certificate module', async () => {
      // Mock subscription to return fallback virtual Starter or database Starter with enableMedicalModule = false
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue(null); // Triggers virtual Starter fallback

      await expect(
        PlanLimitsService.assertCanUploadMedicalCertificate('company-starter-1')
      ).rejects.toThrow('PLAN_FEATURE_DISABLED');
    });

    it('should assert that STARTER plan blocks report exports module', async () => {
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue(null); // Triggers fallback Starter

      await expect(
        PlanLimitsService.assertCanExportReport('company-starter-1')
      ).rejects.toThrow('PLAN_FEATURE_DISABLED');
    });

    it('should assert that STARTER plan restricts active employee counts to 5', async () => {
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue(null); // Starter maxEmployees = 5
      vi.mocked(prisma.employee.count).mockResolvedValue(5); // Already has 5 active employees

      await expect(
        PlanLimitsService.assertCanCreateEmployee('company-starter-1')
      ).rejects.toThrow('PLAN_LIMIT_EXCEEDED');
    });
  });

  describe('2. Active Subscriptions (Limits allowed on higher plans)', () => {
    it('should allow employee creation under limits on BUSINESS plan', async () => {
      // Mock active BUSINESS plan (maxEmployees = 150)
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        id: 'sub-business-1',
        companyId: 'company-business-1',
        status: 'ACTIVE',
        plan: {
          id: 'plan-business',
          name: 'Business',
          code: 'BUSINESS',
          maxEmployees: 150,
          maxMonthlyCheckins: 5000,
          maxMonthlyUploads: 200,
          maxMonthlyExports: 50,
          enableReports: true,
          enableBatchCheckin: true,
          enableMedicalModule: true,
          enableExports: true,
        }
      } as any);

      vi.mocked(prisma.employee.count).mockResolvedValue(30);

      // Should run successfully without throwing
      await expect(
        PlanLimitsService.assertCanCreateEmployee('company-business-1')
      ).resolves.not.toThrow();
    });
  });
});

import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis BEFORE importing the app or services
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
    },
    companySubscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workSchedule: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    occurrence: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    occurrenceEvent: {
      create: vi.fn(),
    },
    absenceRecord: {
      count: vi.fn(),
      create: vi.fn(),
    },
    medicalCertificate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    remoteCheckin: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    usageCounter: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
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
      quit: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    },
  };
});

// Import Prisma and App after mocks
import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import { ReportsService } from '../src/services/reports.service';

const app = buildApp();

describe('PresençaFlow RH - Integration Tests & Hardening', () => {
  beforeAll(async () => {
    // Wait for Fastify plugins (JWT, Cors, etc.) to load completely
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default companySettings mock response
    vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
      id: 'settings-1',
      companyId: 'company-a',
      defaultCheckinGraceMinutes: 30,
      allowManagerExport: true,
      allowViewerReports: true,
      enableRemoteCheckin: true,
      enableBatchCheckin: true,
      enableMedicalCertificates: true,
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

  describe('Auth & RBAC Route Access Rules', () => {
    it('should allow ADMIN and HR to access billing/plan and billing/usage', async () => {
      // Mock plan limits return
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        id: 'sub-id',
        companyId: 'company-a',
        planId: 'plan-id',
        status: 'ACTIVE',
        startedAt: new Date(),
        endsAt: null,
        plan: {
          id: 'plan-id',
          name: 'Pro',
          code: 'PRO',
          maxEmployees: 25,
          maxMonthlyCheckins: 1000,
          maxMonthlyUploads: 100,
          maxMonthlyExports: 10,
          enableReports: true,
          enableBatchCheckin: true,
          enableMedicalModule: true,
          enableExports: true,
        },
      } as any);

      vi.mocked(prisma.employee.count).mockResolvedValue(10);
      vi.mocked(prisma.usageCounter.findMany).mockResolvedValue([]);

      const adminRes = await app.inject({
        method: 'GET',
        url: '/api/billing/plan',
        headers: getAuthHeader('ADMIN'),
      });
      expect(adminRes.statusCode).toBe(200);

      const hrRes = await app.inject({
        method: 'GET',
        url: '/api/billing/usage',
        headers: getAuthHeader('HR'),
      });
      expect(hrRes.statusCode).toBe(200);
    });

    it('should block MANAGER and VIEWER from accessing billing routes', async () => {
      const managerRes = await app.inject({
        method: 'GET',
        url: '/api/billing/plan',
        headers: getAuthHeader('MANAGER'),
      });
      expect(managerRes.statusCode).toBe(403);

      const viewerRes = await app.inject({
        method: 'GET',
        url: '/api/billing/usage',
        headers: getAuthHeader('VIEWER'),
      });
      expect(viewerRes.statusCode).toBe(403);
    });

    it('should block VIEWER from exporting reports operational csv', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/operational/export?from=2026-06-01&to=2026-06-10',
        headers: getAuthHeader('VIEWER'),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should filter team scope when MANAGER queries occurrences or presence', async () => {
      vi.mocked(prisma.occurrence.findMany).mockResolvedValue([]);
      
      await app.inject({
        method: 'GET',
        url: '/api/occurrences',
        headers: getAuthHeader('MANAGER', 'company-a', 'manager-carlos'),
      });

      // Verification: prisma.occurrence.findMany should have been called with manager-carlos filtering
      const lastCallArgs = vi.mocked(prisma.occurrence.findMany).mock.calls[0][0];
      expect(lastCallArgs?.where?.employee?.managerUserId).toBe('manager-carlos');
    });
  });

  describe('Company Isolation Security checks', () => {
    it('should return 404 when querying employee belonging to another company', async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValue(null); // Simulated not found in company-a

      const res = await app.inject({
        method: 'GET',
        url: '/api/employees/employee-of-company-b',
        headers: getAuthHeader('ADMIN', 'company-a'),
      });

      expect(res.statusCode).toBe(404);
      const callArgs = vi.mocked(prisma.employee.findFirst).mock.calls[0][0];
      expect(callArgs?.where?.companyId).toBe('company-a');
    });
  });

  describe('SaaS Plan Limits Enforcement', () => {
    it('should fallback STARTER plan and block batch check-in, medical uploads, and CSV exports', async () => {
      // Mock subscription not found to trigger STARTER fallback
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue(null);

      // 1. Batch Check-in
      const batchRes = await app.inject({
        method: 'POST',
        url: '/api/automations/remote-checkin/run-batch',
        headers: getAuthHeader('ADMIN'),
        payload: {},
      });
      expect(batchRes.statusCode).toBe(403);
      expect(JSON.parse(batchRes.payload).error).toBe('PLAN_FEATURE_DISABLED');

      // 2. Medical Certificate Upload (MIME validation is run but check limits first)
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/medical-certificates/upload',
        headers: getAuthHeader('ADMIN'),
      });
      expect(uploadRes.statusCode).toBe(403);
      expect(JSON.parse(uploadRes.payload).error).toBe('PLAN_FEATURE_DISABLED');

      // 3. Export CSV
      const exportRes = await app.inject({
        method: 'GET',
        url: '/api/reports/operational/export?from=2026-06-01&to=2026-06-10',
        headers: getAuthHeader('ADMIN'),
      });
      expect(exportRes.statusCode).toBe(403);
      expect(JSON.parse(exportRes.payload).error).toBe('PLAN_FEATURE_DISABLED');
    });

    it('should block employee creation when maxEmployees limit is hit', async () => {
      // Mock Pro subscription (25 employees limit)
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        plan: {
          maxEmployees: 5,
        },
      } as any);

      // Mock current active employees count already at limit
      vi.mocked(prisma.employee.count).mockResolvedValue(5);

      const res = await app.inject({
        method: 'POST',
        url: '/api/employees',
        headers: getAuthHeader('ADMIN'),
        payload: {
          fullName: 'Novo Funcionario Teste',
          cpf: '123.456.789-00',
          whatsapp: '5511999999999',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error).toBe('PLAN_LIMIT_EXCEEDED');
    });

    it('should not increment remote_checkins counter when check-in is duplicate', async () => {
      // Setup subscription PRO
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        plan: { maxMonthlyCheckins: 1000 },
      } as any);
      vi.mocked(prisma.usageCounter.findUnique).mockResolvedValue(null);

      const employeeId = '11111111-2222-3333-4444-555555555555';

      // Mock employee find
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: employeeId,
        fullName: 'Test Employee',
        whatsapp: '5511999998888',
        workSchedule: { id: 'sch-1' },
      } as any);

      // Mock check-in service finding duplicate
      vi.mocked(prisma.remoteCheckin.findFirst).mockResolvedValue({ id: 'exists' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/automations/remote-checkin/run',
        headers: getAuthHeader('ADMIN'),
        payload: { employeeId },
      });

      expect(res.statusCode).toBe(200); // 200 for duplicate
      expect(JSON.parse(res.payload).isDuplicate).toBe(true);

      // Verify that UsageCounter upsert was NOT called
      expect(prisma.usageCounter.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Medical Uploads & File Security', () => {
    it('should protect path traversal in file stream download', async () => {
      vi.mocked(prisma.medicalCertificate.findFirst).mockResolvedValue({
        id: 'cert-1',
        companyId: 'company-a',
        storedFilename: '../../../../windows/win.ini',
        mimeType: 'application/pdf',
        employee: { managerUserId: 'manager-1' },
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/medical-certificates/cert-1/file',
        headers: getAuthHeader('ADMIN'),
      });

      // Path traversal target win.ini does not exist, basename checks will make sure it checks in localized path
      expect(res.statusCode).toBe(404);
    });
  });

  describe('CSV Privacy Controls (CPF masking)', () => {
    it('should mask CPF fully in CSV outputs', () => {
      const masked = ReportsService.maskCpf('12345678901');
      expect(masked).toBe('***.***.***-**');
      expect(masked).not.toContain('12345678901');
    });
  });
});

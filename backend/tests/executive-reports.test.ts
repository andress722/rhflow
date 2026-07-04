import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import crypto from 'crypto';

// ─── Mock Prisma and Redis ──────────────────────────────────────────────────
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
    },
    employee: {
      count: vi.fn(),
    },
    remoteCheckin: {
      count: vi.fn(),
    },
    occurrence: {
      count: vi.fn(),
    },
    medicalCertificate: {
      count: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
    },
    pilotFeedback: {
      count: vi.fn(),
    },
    pilotBacklogItem: {
      findMany: vi.fn(),
    },
    usageTelemetry: {
      findMany: vi.fn(),
    },
    inAppNotification: {
      count: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
    },
    whatsAppChannel: {
      findUnique: vi.fn(),
    },
    workSchedule: {
      count: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock('../src/lib/redis', () => ({
  redis: { quit: vi.fn(() => Promise.resolve()) },
}));

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';

describe('PresençaFlow RH - Executive Reports API (Sprint 40)', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getAuthHeader = (role: string, companyId = 'company-1', userId = 'user-123') => {
    const token = app.jwt.sign({
      sub: `${userId}-${role}`,
      role,
      companyId,
    });
    return { Authorization: `Bearer ${token}` };
  };

  // Helper mocks for default query success
  const mockBaseQueries = () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-1',
      name: 'Empresa Piloto Teste',
      legalName: 'Empresa Piloto S.A.',
      pilotStatus: 'ACTIVE',
      pilotStartedAt: new Date('2026-06-01'),
      pilotEndsAt: new Date('2026-08-31'),
      proposalSentAt: null,
      convertedAt: null,
      commercialNotes: 'Nota comercial super secreta e confidencial!',
    } as any);

    vi.mocked(prisma.employee.count).mockResolvedValue(100);
    vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(1500);
    vi.mocked(prisma.occurrence.count).mockResolvedValue(10);
    vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(5);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(2);
    vi.mocked(prisma.pilotFeedback.count).mockResolvedValue(4);
    vi.mocked(prisma.inAppNotification.count).mockResolvedValue(3);
    vi.mocked(prisma.workSchedule.count).mockResolvedValue(1);

    vi.mocked(prisma.pilotBacklogItem.findMany).mockResolvedValue([
      {
        id: 'backlog-1',
        title: 'Corrigir vazamento de CPF 123.456.789-00 do relatório',
        type: 'BUGFIX',
        priority: 'HIGH',
        releaseNote: 'Vazamento corrigido para CPF 123.456.789-00.',
        completedAt: new Date(),
      },
    ] as any);

    vi.mocked(prisma.usageTelemetry.findMany).mockResolvedValue([
      { properties: { title: 'Como solicitar atestado' } },
      { properties: { title: 'Como solicitar atestado' } },
      { properties: { title: 'Manual do colaborador' } },
    ] as any);
  };

  describe('1. RBAC Authorization', () => {
    it('should allow SUPER_ADMIN to call overview for any company', async () => {
      mockBaseQueries();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/executive-reports/company/company-1?dateFrom=2026-06-01&dateTo=2026-06-30',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      if (res.statusCode !== 200) {
        console.log("TEST FAILURE DETAILS:", res.payload);
      }
      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.company.commercialNotes).toBe('Nota comercial super secreta e confidencial!');
    });

    it('should allow ADMIN and HR to query their own company report', async () => {
      mockBaseQueries();

      const res = await app.inject({
        method: 'GET',
        url: '/api/executive-reports/my-company?dateFrom=2026-06-01&dateTo=2026-06-30',
        headers: getAuthHeader('ADMIN', 'company-1'),
      });

      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.payload);
      expect(payload.success).toBe(true);
      // Corporate route MUST NOT expose commercialNotes
      expect(payload.data.company.commercialNotes).toBeUndefined();
    });

    it('should block MANAGER and VIEWER with 403', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/executive-reports/my-company?dateFrom=2026-06-01&dateTo=2026-06-30',
        headers: getAuthHeader('MANAGER', 'company-1'),
      });
      expect(res1.statusCode).toBe(403);

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/admin/executive-reports/company/company-1?dateFrom=2026-06-01&dateTo=2026-06-30',
        headers: getAuthHeader('HR', 'company-1'),
      });
      expect(res2.statusCode).toBe(403);
    });
  });

  describe('2. Date Range Validation', () => {
    it('should block range longer than 90 days with 400', async () => {
      mockBaseQueries();

      const res = await app.inject({
        method: 'GET',
        url: '/api/executive-reports/my-company?dateFrom=2026-06-01&dateTo=2026-10-01', // 122 days
        headers: getAuthHeader('ADMIN'),
      });

      expect(res.statusCode).toBe(400);
      const payload = JSON.parse(res.payload);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('should block invalid dates or when fromDate > toDate', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/executive-reports/my-company?dateFrom=2026-06-30&dateTo=2026-06-01',
        headers: getAuthHeader('ADMIN'),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('3. Sanitization & Privacy (LGPD)', () => {
    it('should sanitize CPFs and sensitive details inside Markdown and fields', async () => {
      mockBaseQueries();

      const res = await app.inject({
        method: 'GET',
        url: '/api/executive-reports/my-company?dateFrom=2026-06-01&dateTo=2026-06-30',
        headers: getAuthHeader('ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.payload);
      const md = payload.data.markdownReport;

      // CPF should be masked in the release notes and markdown report
      expect(md).not.toContain('123.456.789-00');
      expect(md).toContain('***.***.***-**');

      // Check backlog item title
      const backlogTitle = payload.data.feedbackAndBacklog.backlogDelivered[0].title;
      expect(backlogTitle).not.toContain('123.456.789-00');
      expect(backlogTitle).toContain('***.***.***-**');
    });
  });
});

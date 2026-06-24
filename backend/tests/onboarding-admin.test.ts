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
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
      count: vi.fn(),
    },
    whatsAppChannel: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
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

describe('Onboarding & Super Admin Platform Integration Tests', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-a',
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

  describe('Super Admin Company Management & Onboarding', () => {
    it('should block regular users from accessing admin routes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/companies',
        headers: getAuthHeader('ADMIN'),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to list companies', async () => {
      vi.mocked(prisma.company.findMany).mockResolvedValue([
        { id: 'company-1', name: 'Company 1', isActive: true },
      ] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/companies',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).success).toBe(true);
    });

    it('should onboard a new company successfully with all defaults in a transaction', async () => {
      // Mocks
      vi.mocked(prisma.company.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue({
        id: 'plan-pro-id',
        code: 'PRO',
        maxEmployees: 25,
        enableBatchCheckin: true,
        enableMedicalModule: true,
      } as any);

      vi.mocked(prisma.company.create).mockResolvedValue({
        id: 'new-company-id',
        name: 'New Company',
        legalName: 'New Company Legal',
        cnpj: '12345678000100',
        isActive: true,
      } as any);

      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-admin-id',
        name: 'Admin User',
        email: 'admin@newcompany.com',
        role: 'ADMIN',
      } as any);

      const payload = {
        company: {
          legalName: 'New Company Legal',
          tradeName: 'New Company',
          cnpj: '12.345.678/0001-00',
        },
        adminUser: {
          name: 'Admin User',
          email: 'admin@newcompany.com',
        },
        planCode: 'PRO',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/companies/onboard',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload,
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.tempPassword).toBeDefined();
      expect(data.tempPassword.length).toBeGreaterThanOrEqual(16);
      expect(data.admin.email).toBe('admin@newcompany.com');

      // Verify transaction queries
      expect(prisma.company.create).toHaveBeenCalled();
      expect(prisma.companySettings.create).toHaveBeenCalled();
      expect(prisma.companySubscription.create).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          mustChangePassword: true,
        }),
      }));
      expect(prisma.whatsAppChannel.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should block onboarding if CNPJ is duplicate', async () => {
      vi.mocked(prisma.company.findFirst).mockResolvedValue({ id: 'existing-id' } as any);

      const payload = {
        company: {
          legalName: 'New Company Legal',
          tradeName: 'New Company',
          cnpj: '12.345.678/0001-00',
        },
        adminUser: {
          name: 'Admin User',
          email: 'admin@newcompany.com',
        },
        planCode: 'PRO',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/companies/onboard',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload,
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error.code).toBe('CNPJ_DUPLICATED');
    });

    it('should block onboarding if admin email is duplicate', async () => {
      vi.mocked(prisma.company.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'existing-user-id' } as any);

      const payload = {
        company: {
          legalName: 'New Company Legal',
          tradeName: 'New Company',
          cnpj: '12.345.678/0001-00',
        },
        adminUser: {
          name: 'Admin User',
          email: 'admin@newcompany.com',
        },
        planCode: 'PRO',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/companies/onboard',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload,
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error.code).toBe('EMAIL_DUPLICATED');
    });
  });

  describe('Deactivation & Active token verification', () => {
    it('should reject login if user company is deactivated', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user-id',
        isActive: true,
        email: 'test@deactivated.com',
        passwordHash: 'hash',
        company: {
          isActive: false, // deactivated
        },
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@deactivated.com',
          password: 'password',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload).error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject access with old valid tokens if company is deactivated', async () => {
      // Mock company findUnique returning inactive
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-a',
        isActive: false, // inactive company
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/employees',
        headers: getAuthHeader('ADMIN', 'company-a'),
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error.code).toBe('COMPANY_DEACTIVATED');
    });
  });

  describe('CSV Employees Bulk Import', () => {
    const buildMultipartCsv = (csvContent: string) => {
      const boundary = '----VitestBoundary';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="employees.csv"',
        'Content-Type: text/csv',
        '',
        csvContent,
        `--${boundary}--`,
      ].join('\r\n');

      return {
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      };
    };

    it('should import valid employees and skip duplicates without rollback', async () => {
      // Setup Pro plan (max 25) and active count (5)
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        plan: { maxEmployees: 25, code: 'PRO', name: 'Pro' },
      } as any);
      vi.mocked(prisma.employee.count).mockResolvedValue(5);

      // Mocks for CSV search:
      // Manager search
      vi.mocked(prisma.user.findFirst).mockImplementation(async (args: any) => {
        if (args?.where?.email === 'gestor@test.com') {
          return { id: 'manager-id', role: 'MANAGER' } as any;
        }
        return null;
      });

      // Work Schedule search
      vi.mocked(prisma.workSchedule.findFirst).mockImplementation(async (args: any) => {
        if (args?.where?.name === 'Escala Flex') {
          return { id: 'schedule-id', isActive: true } as any;
        }
        return null;
      });

      // Employee duplicate database search
      vi.mocked(prisma.employee.findFirst).mockImplementation(async (args: any) => {
        if (args?.where?.cpf === '11111111111') {
          return { id: 'existing-emp' } as any; // duplicate in DB -> skipped
        }
        return null;
      });

      const csvContent = [
        'name,cpf,email,whatsapp,sector,workModel,managerEmail,workScheduleName',
        'Ana Silva,11111111111,ana@test.com,5511999998888,Vendas,REMOTE,gestor@test.com,Escala Flex',
        'Carlos Santos,22222222222,carlos@test.com,5511999997777,T.I.,PRESENTIAL,gestor@test.com,Escala Flex',
      ].join('\n');

      const req = buildMultipartCsv(csvContent);

      const res = await app.inject({
        method: 'POST',
        url: '/api/employees/import',
        headers: {
          ...getAuthHeader('ADMIN', 'company-a'),
          ...req.headers,
        },
        payload: req.payload,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.created).toBe(1); // Carlos Santos
      expect(data.skipped.length).toBe(1); // Ana Silva
      expect(data.skipped[0].cpf).toBe('11111111111');
      expect(prisma.employee.create).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should roll back completely (create nothing) and return error report if critical errors exist', async () => {
      // Setup limits
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        plan: { maxEmployees: 25, code: 'PRO', name: 'Pro' },
      } as any);
      vi.mocked(prisma.employee.count).mockResolvedValue(5);

      // Mock database finds to simulate missing relation errors
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null); // Manager not found
      vi.mocked(prisma.workSchedule.findFirst).mockResolvedValue(null); // Schedule not found
      vi.mocked(prisma.employee.findFirst).mockResolvedValue(null);

      const csvContent = [
        'name,cpf,email,whatsapp,sector,workModel,managerEmail,workScheduleName',
        'Ana Silva,11111111111,ana@test.com,5511999998888,Vendas,REMOTE,inexistent@test.com,Inexistent Schedule',
      ].join('\n');

      const req = buildMultipartCsv(csvContent);

      const res = await app.inject({
        method: 'POST',
        url: '/api/employees/import',
        headers: {
          ...getAuthHeader('ADMIN', 'company-a'),
          ...req.headers,
        },
        payload: req.payload,
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.errors.length).toBe(2); // Inexistent manager + Inexistent schedule
      expect(body.errors[0].line).toBe(2);
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });

    it('should reject import if total active + new candidates exceeds maxEmployees', async () => {
      // Setup Pro plan (max 5) and active count (4) -> trying to import 2 candidates exceeds the limit
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        plan: { maxEmployees: 5, code: 'STARTER', name: 'Starter' },
      } as any);
      vi.mocked(prisma.employee.count).mockResolvedValue(4);

      // Relations exist
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'manager-id' } as any);
      vi.mocked(prisma.workSchedule.findFirst).mockResolvedValue({ id: 'schedule-id' } as any);
      vi.mocked(prisma.employee.findFirst).mockResolvedValue(null);

      const csvContent = [
        'name,cpf,email,whatsapp,sector,workModel,managerEmail,workScheduleName',
        'Ana Silva,11111111111,ana@test.com,5511999998888,Vendas,REMOTE,,',
        'Carlos Santos,22222222222,carlos@test.com,5511999997777,T.I.,PRESENTIAL,,',
      ].join('\n');

      const req = buildMultipartCsv(csvContent);

      const res = await app.inject({
        method: 'POST',
        url: '/api/employees/import',
        headers: {
          ...getAuthHeader('ADMIN', 'company-a'),
          ...req.headers,
        },
        payload: req.payload,
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.errors[0].message).toContain('Limite de funcionários do plano excedido');
    });
  });

  describe('Dynamic Onboarding Checklist Status', () => {
    it('should return checklist steps with correct evaluated boolean values', async () => {
      // Mock database counts and existence checks
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-a',
        name: 'ACME Corp',
        cnpj: '12.345.678/0001-99',
        isActive: true,
      } as any);
      vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
        id: 'exists',
        enableRemoteCheckin: true,
      } as any);
      vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
        status: 'ACTIVE',
        plan: { enableReports: true },
      } as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1); // adminCreated = true
      vi.mocked(prisma.employee.count).mockResolvedValue(5); // employeesImported = true
      vi.mocked(prisma.workSchedule.count).mockResolvedValue(2); // workSchedulesCreated = true
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
        status: 'SIMULATION',
      } as any); // whatsappConfigured = true
      vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(10); // firstCheckinSent = true
      vi.mocked(prisma.occurrence.count).mockResolvedValue(2);
      vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding/checklist',
        headers: getAuthHeader('ADMIN', 'company-a'),
      });

      expect(res.statusCode).toBe(200);
      const dataArray = JSON.parse(res.payload).data;
      const getStep = (key: string) => dataArray.find((item: any) => item.key === key);

      expect(getStep('companyProfileCompleted').completed).toBe(true);
      expect(getStep('adminUserReady').completed).toBe(true);
      expect(getStep('companySettingsConfigured').completed).toBe(true);
      expect(getStep('whatsappChannelConfigured').completed).toBe(true);
      expect(getStep('employeesImported').completed).toBe(true);
      expect(getStep('schedulesConfigured').completed).toBe(true);
      expect(getStep('remoteCheckinEnabled').completed).toBe(true);
    });
  });
});

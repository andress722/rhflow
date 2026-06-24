import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis before importing the app
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
      findMany: vi.fn(),
      count: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
    },
    whatsAppChannel: {
      findUnique: vi.fn(),
    },
    employee: {
      count: vi.fn(),
    },
    workSchedule: {
      count: vi.fn(),
    },
    remoteCheckin: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    occurrence: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    medicalCertificate: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    whatsAppMessageLog: {
      count: vi.fn(),
    },
    operationalErrorLog: {
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

describe('PresençaFlow RH - Customer Success & Health Score API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock behaviors for company and user authenticate checks
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-user-1',
      isActive: true,
      role: 'ADMIN',
    } as any);

    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-pilot-1',
      name: 'ACME Pilot',
      cnpj: '12345678000199',
      isActive: true,
    } as any);

    vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
      companyId: 'company-pilot-1',
      enableRemoteCheckin: true,
      enableMedicalCertificates: true,
    } as any);

    vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
      status: 'CONNECTED',
      provider: 'META_CLOUD',
    } as any);

    // Default metrics to represent a healthy pilot company
    vi.mocked(prisma.employee.count).mockResolvedValue(10); // active employees
    vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(20); // check-ins sent & responded
    vi.mocked(prisma.auditLog.count).mockResolvedValue(5); // report activity
    vi.mocked(prisma.occurrence.count).mockResolvedValue(0); // open/created occurrences
    vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(0); // medical uploads
    vi.mocked(prisma.whatsAppMessageLog.count).mockResolvedValue(0); // whatsapp errors
    vi.mocked(prisma.operationalErrorLog.count).mockResolvedValue(0); // system errors
    vi.mocked(prisma.workSchedule.count).mockResolvedValue(2); // active schedules
    vi.mocked(prisma.user.count).mockResolvedValue(1); // active admins
  });

  const getAuthHeader = (role: string, companyId = 'company-pilot-1', userId = 'user-1') => {
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. RBAC Permissions on /api/customer-success/*', () => {
    it('should allow ADMIN to fetch corporate health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });
      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.healthScore).toBeDefined();
    });

    it('should allow HR to fetch corporate health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('HR'),
      });
      expect(response.statusCode).toBe(200);
    });

    it('should block MANAGER with 403 Forbidden', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('MANAGER'),
      });
      expect(response.statusCode).toBe(403);
    });

    it('should block VIEWER with 403 Forbidden', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('VIEWER'),
      });
      expect(response.statusCode).toBe(403);
    });

    it('should block SUPER_ADMIN from corporate health routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('SUPER_ADMIN'),
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('2. Corporate Health Score & Status Classifications', () => {
    it('should return HEALTHY status when usage metrics are adequate', async () => {
      // Mock lastActivityAt recent
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({
        createdAt: new Date(),
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('HEALTHY');
      expect(json.healthScore).toBeGreaterThanOrEqual(80);
      expect(json.riskSignals.length).toBe(0);
    });

    it('should return ATTENTION status if response rate is moderately low', async () => {
      // Low response rate: 30% (sent 10, responded 3)
      vi.mocked(prisma.remoteCheckin.count).mockImplementation(async (args: any) => {
        if (args?.where?.respondedAt) {
          return 3;
        }
        return 10;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('ATTENTION');
      const lowResponseRisk = json.riskSignals.find((r: any) => r.type === 'LOW_RESPONSE_RATE');
      expect(lowResponseRisk).toBeDefined();
      expect(lowResponseRisk.severity).toBe('MEDIUM');
    });

    it('should return CRITICAL status if there are no active employees', async () => {
      vi.mocked(prisma.employee.count).mockImplementation(async (args: any) => {
        if (args?.where?.status === 'ACTIVE') return 0;
        return 10;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('CRITICAL');
      expect(json.riskSignals).toContainEqual(
        expect.objectContaining({
          type: 'NO_ACTIVE_EMPLOYEES',
          severity: 'HIGH',
        })
      );
    });

    it('should return CRITICAL status if there are no work schedules configured', async () => {
      vi.mocked(prisma.workSchedule.count).mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('CRITICAL');
      expect(json.riskSignals).toContainEqual(
        expect.objectContaining({
          type: 'NO_ACTIVE_SCHEDULES',
          severity: 'HIGH',
        })
      );
    });

    it('should trigger WHATSAPP_ERROR riskSignal with HIGH severity if WhatsApp is down', async () => {
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
        status: 'ERROR',
        provider: 'META_CLOUD',
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('CRITICAL'); // due to HIGH severity WhatsApp error
      expect(json.riskSignals).toContainEqual(
        expect.objectContaining({
          type: 'WHATSAPP_ERROR',
          severity: 'HIGH',
        })
      );
    });

    it('should NOT trigger WHATSAPP_ERROR or HIGH risk status if WhatsApp is SIMULATION', async () => {
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
        status: 'SIMULATION',
        provider: 'SIMULATED',
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('HEALTHY'); // should not downgrade to CRITICAL
      const whatsappErrorRisk = json.riskSignals.find((r: any) => r.type === 'WHATSAPP_ERROR');
      expect(whatsappErrorRisk).toBeUndefined();
    });

    it('should only apply NO_RECENT_CHECKINS riskSignal if remote checkin is enabled', async () => {
      // 0 checkins sent
      vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(0);

      // 1. With remoteCheckin enabled
      vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
        enableRemoteCheckin: true,
      } as any);

      const response1 = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });
      const json1 = response1.json();
      expect(json1.riskSignals).toContainEqual(
        expect.objectContaining({
          type: 'NO_RECENT_CHECKINS',
        })
      );

      // 2. With remoteCheckin disabled
      vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
        enableRemoteCheckin: false,
      } as any);

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });
      const json2 = response2.json();
      const checkinRisk = json2.riskSignals.find((r: any) => r.type === 'NO_RECENT_CHECKINS');
      expect(checkinRisk).toBeUndefined();
    });

    it('should only check PENDING_MEDICAL_CERTIFICATES if medical certificates module is enabled', async () => {
      vi.mocked(prisma.medicalCertificate.count).mockResolvedValue(3); // 3 pending

      // 1. Module enabled
      vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
        enableMedicalCertificates: true,
      } as any);

      const response1 = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });
      const json1 = response1.json();
      expect(json1.riskSignals).toContainEqual(
        expect.objectContaining({
          type: 'PENDING_MEDICAL_CERTIFICATES',
        })
      );

      // 2. Module disabled
      vi.mocked(prisma.companySettings.findUnique).mockResolvedValue({
        enableMedicalCertificates: false,
      } as any);

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/customer-success/health',
        headers: getAuthHeader('ADMIN'),
      });
      const json2 = response2.json();
      const medicalRisk = json2.riskSignals.find((r: any) => r.type === 'PENDING_MEDICAL_CERTIFICATES');
      expect(medicalRisk).toBeUndefined();
    });
  });

  describe('3. Recommendations Endpoint', () => {
    it('should return recommendations with priorities and actionUrls', async () => {
      // Mock missing report activity to trigger recommendation
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/customer-success/recommendations',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      const exportRec = json.data.find((r: any) => r.key === 'EXPORT_FIRST_REPORT');
      expect(exportRec).toBeDefined();
      expect(exportRec.priority).toBe('MEDIUM');
      expect(exportRec.actionUrl).toBe('/app/reports');
    });
  });

  describe('4. SUPER_ADMIN Support Customer Success Platform Endpoint', () => {
    it('should block regular users from accessing platform view', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/support/customer-success',
        headers: getAuthHeader('ADMIN'),
      });
      expect(response.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to list companies with pagination and filters', async () => {
      vi.mocked(prisma.company.count).mockResolvedValue(1);
      vi.mocked(prisma.company.findMany).mockResolvedValue([
        {
          id: 'company-pilot-1',
          name: 'ACME Pilot 1',
          subscription: {
            plan: {
              name: 'Enterprise Pilot',
            },
          },
        },
      ] as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/support/customer-success?page=1&pageSize=10&plan=Enterprise',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.items.length).toBe(1);
      expect(json.total).toBe(1);

      const companyItem = json.items[0];
      expect(companyItem.companyName).toBe('ACME Pilot 1');
      expect(companyItem.healthScore).toBeDefined();
      expect(companyItem.status).toBeDefined();
      expect(companyItem.responseRate7d).toBeDefined();
      expect(companyItem.activeEmployees).toBeDefined();

      // Ensure no sensitive employee list leaked
      expect(companyItem.employees).toBeUndefined();
    });
  });
});

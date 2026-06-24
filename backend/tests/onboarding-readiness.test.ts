import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis BEFORE importing the app
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
    },
    occurrence: {
      count: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    companySubscription: {
      findUnique: vi.fn(),
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

describe('PresençaFlow RH - Onboarding Readiness & Activation API', () => {
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
      defaultCheckinGraceMinutes: 30,
      enableRemoteCheckin: true,
      enableMedicalCertificates: true,
    } as any);

    vi.mocked(prisma.companySubscription.findUnique).mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        name: 'Piloto Standard',
        enableMedicalModule: true,
      },
    } as any);

    vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
      status: 'CONNECTED',
      provider: 'META_CLOUD',
    } as any);

    vi.mocked(prisma.employee.count).mockResolvedValue(10);
    vi.mocked(prisma.workSchedule.count).mockResolvedValue(2);
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.remoteCheckin.count).mockResolvedValue(1);
    vi.mocked(prisma.occurrence.count).mockResolvedValue(1);
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);
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

  describe('1. RBAC Permissions on /api/onboarding/*', () => {
    it('should allow ADMIN to fetch checklist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/checklist',
        headers: getAuthHeader('ADMIN'),
      });
      expect(response.statusCode).toBe(200);
    });

    it('should allow HR to fetch checklist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/checklist',
        headers: getAuthHeader('HR'),
      });
      expect(response.statusCode).toBe(200);
    });

    it('should block MANAGER with 403 Forbidden', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/checklist',
        headers: getAuthHeader('MANAGER'),
      });
      expect(response.statusCode).toBe(403);
    });

    it('should block VIEWER with 403 Forbidden', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/checklist',
        headers: getAuthHeader('VIEWER'),
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('2. Onboarding Checklist Endpoint', () => {
    it('should return operational and manual steps successfully', async () => {
      // Mock kickoff_done as completed in AuditLog
      vi.mocked(prisma.auditLog.findFirst).mockImplementation(async (args: any) => {
        if (args?.where?.metadata?.equals === 'kickoff_done') {
          return {
            metadata: { key: 'kickoff_done', completed: true },
          } as any;
        }
        return null;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/checklist',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      const kickoffItem = json.data.find((item: any) => item.key === 'kickoff_done');
      expect(kickoffItem).toBeDefined();
      expect(kickoffItem.completed).toBe(true);

      const companyProfileItem = json.data.find((item: any) => item.key === 'companyProfileCompleted');
      expect(companyProfileItem.completed).toBe(true);
    });
  });

  describe('3. Manual Onboarding Steps', () => {
    it('should successfully update a manual step with allowlisted key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/onboarding/manual-step',
        headers: getAuthHeader('ADMIN'),
        payload: {
          key: 'customer_trained',
          completed: true,
          note: 'All managers successfully trained.',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ONBOARDING_STEP_UPDATED',
            metadata: expect.objectContaining({
              key: 'customer_trained',
              completed: true,
              note: 'All managers successfully trained.',
            }),
          }),
        })
      );
    });

    it('should reject step update with invalid key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/onboarding/manual-step',
        headers: getAuthHeader('ADMIN'),
        payload: {
          key: 'invalid_step_key',
          completed: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('4. Onboarding Pilot Readiness', () => {
    it('should calculate correct readiness score and pilotReady flag', async () => {
      // Mock all manual required steps as completed
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({
        metadata: { completed: true },
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/pilot-readiness',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.score).toBe(100);
      expect(json.pilotReady).toBe(true);
      expect(json.blockers.length).toBe(0);
    });

    it('should list blocker when there are no active employees', async () => {
      vi.mocked(prisma.employee.count).mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/pilot-readiness',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.pilotReady).toBe(false);
      expect(json.blockers).toContain('Sem funcionários ativos cadastrados');
    });

    it('should list blocker when there are no active work schedules', async () => {
      vi.mocked(prisma.workSchedule.count).mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/pilot-readiness',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.pilotReady).toBe(false);
      expect(json.blockers).toContain('Sem jornada de trabalho (escala) ativa');
    });

    it('should list blocker when there is no active admin user', async () => {
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/pilot-readiness',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.pilotReady).toBe(false);
      expect(json.blockers).toContain('Sem administrador ativo na plataforma');
    });

    it('should list warning when WhatsApp channel is in simulation mode', async () => {
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
        status: 'CONNECTED',
        provider: 'SIMULATED', // Simulated provider
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/pilot-readiness',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.warnings).toContain('WhatsApp operando em modo simulação');
    });

    it('should list warning when there are no managers assigned to employees', async () => {
      vi.mocked(prisma.employee.count).mockImplementation(async (args: any) => {
        // managerUserId: { not: null } check
        if (args?.where?.managerUserId) {
          return 0; // no managers assigned
        }
        return 10;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/onboarding/pilot-readiness',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.warnings).toContain('Nenhum gestor atribuído a funcionários');
    });
  });

  describe('5. Rapid Non-Destructive Pilot Test', () => {
    it('should return diagnostic checks and storage writes validation without modifying operational tables', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/onboarding/run-pilot-test',
        headers: getAuthHeader('ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.checks.length).toBeGreaterThan(0);
      expect(json.blockers.length).toBe(0);

      // Verify no operational creations occurred
      expect(prisma.occurrence.count).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'create' }));
      expect(prisma.remoteCheckin.count).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'create' }));
    });
  });
});

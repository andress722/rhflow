import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis BEFORE importing the app
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
    pilotLead: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
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
      incr: vi.fn(),
      expire: vi.fn(),
      del: vi.fn(),
    },
  };
});

vi.mock('../src/services/whatsapp.service', () => {
  return {
    WhatsAppService: {
      sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
    },
  };
});

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import { CommercialNotificationService } from '../src/services/commercial-notification.service';
import { WhatsAppService } from '../src/services/whatsapp.service';
import { validateEnv } from '../src/config/env';

const app = buildApp();

describe('PresençaFlow RH - Commercial Notifications & CRM Alerts', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock behaviors for admin auth check
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'superadmin-1',
      isActive: true,
      role: 'SUPER_ADMIN',
    } as any);

    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'platform-company',
      isActive: true,
    } as any);
  });

  const getAuthHeader = (role: string, companyId = 'SYSTEM', userId = 'superadmin-1') => {
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. Public Pilot Lead Capture Alerts', () => {
    it('should create new lead and trigger commercial alert best-effort', async () => {
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue(null); // No duplicates
      const mockLead = {
        id: 'lead-new-123',
        name: 'Carlos Sales',
        companyName: 'Sales Tech',
        email: 'carlos@salestech.com',
        whatsapp: '5511999999999',
        employeeCount: 50,
        mainPain: 'Perda de leads',
      };
      vi.mocked(prisma.pilotLead.create).mockResolvedValue(mockLead as any);
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null); // Not idempotent-blocked

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: mockLead.name,
          companyName: mockLead.companyName,
          email: mockLead.email,
          whatsapp: mockLead.whatsapp,
          employeeCount: mockLead.employeeCount,
          mainPain: mockLead.mainPain,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.pilotLead.create).toHaveBeenCalled();

      // Call service directly to check AuditLog & WhatsApp sending behavior
      const result = await CommercialNotificationService.sendNewLeadAlert(mockLead);
      expect(result.emailStatus).toBe('simulated');
      expect(result.whatsappStatus).toBe('sent');
      expect(WhatsAppService.sendMessage).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMMERCIAL_ALERT_SENT',
            metadata: expect.objectContaining({
              alertType: 'NEW_LEAD',
              leadId: 'lead-new-123',
            }),
          }),
        })
      );
    });

    it('should not notify commercial operators if honeypot field is filled', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Spammer Bot',
          companyName: 'Spam Corp',
          email: 'bot@spam.com',
          websiteUrl: 'http://spam.com', // honeypot
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.pilotLead.create).not.toHaveBeenCalled();
    });

    it('should not notify commercial operators if lead is a recent duplicate', async () => {
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue({ id: 'existing-123' } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Carlos Sales',
          companyName: 'Sales Tech',
          email: 'carlos@salestech.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.pilotLead.create).not.toHaveBeenCalled();
    });

    it('should not break public lead capture if alert service throws an error', async () => {
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.pilotLead.create).mockResolvedValue({ id: 'lead-new-123', email: 'carlos@salestech.com' } as any);
      
      // Make WhatsApp throw an error
      vi.mocked(WhatsAppService.sendMessage).mockRejectedValueOnce(new Error('WhatsApp connection failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Carlos Sales',
          companyName: 'Sales Tech',
          email: 'carlos@salestech.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.pilotLead.create).toHaveBeenCalled();
    });
  });

  describe('2. Idempotency and AuditLogs', () => {
    it('should prevent sending duplicate NEW_LEAD alerts for the same leadId + channel', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({ id: 'log-123' } as any); // Mock already sent

      const result = await CommercialNotificationService.sendNewLeadAlert({
        id: 'lead-123',
        name: 'Carlos Sales',
        companyName: 'Sales Tech',
        email: 'carlos@salestech.com',
      });

      expect(result.emailStatus).toBe('skipped');
      expect(result.whatsappStatus).toBe('skipped');
      expect(WhatsAppService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('3. Scheduled Job /api/internal/jobs/commercial-alerts/run', () => {
    it('should fail with 401 if x-internal-job-secret is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/commercial-alerts/run',
        headers: {
          'x-internal-job-secret': 'wrong-secret',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should run commercial notifications job successfully and return operational report', async () => {
      // Mock counts: 2 overdue follow-ups, 0 demos, 1 stale qualified lead
      vi.mocked(prisma.pilotLead.count)
        .mockResolvedValueOnce(2) // overdue follow-ups count
        .mockResolvedValueOnce(0); // demos today count

      vi.mocked(prisma.pilotLead.findMany).mockResolvedValueOnce([
        { id: 'lead-stale', status: 'QUALIFIED', activities: [], createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }
      ] as any);

      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null); // No daily locks

      const response = await app.inject({
        method: 'POST',
        url: '/api/internal/jobs/commercial-alerts/run',
        headers: {
          'x-internal-job-secret': process.env.INTERNAL_JOB_SECRET || 'test-internal-job-secret-must-be-32-chars',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.sent).toContainEqual(expect.objectContaining({ alertType: 'OVERDUE_FOLLOW_UPS' }));
      expect(json.sent).toContainEqual(expect.objectContaining({ alertType: 'STALE_QUALIFIED_LEADS' }));
      expect(json.skipped).toContainEqual(expect.objectContaining({ alertType: 'DEMOS_TODAY', reason: 'no_items' }));
    });
  });

  describe('4. SUPER_ADMIN Previews and Test Notifications', () => {
    it('should allow SUPER_ADMIN to fetch notification previews', async () => {
      vi.mocked(prisma.pilotLead.count).mockResolvedValue(5);
      vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/notification-preview',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.config).toBeDefined();
      expect(json.config.emailEnabled).toBe(true);
      expect(json.summary.newLeadsToday).toBe(5);
    });

    it('should block non-SUPER_ADMIN users from accessing notification previews', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/commercial/notification-preview',
        headers: getAuthHeader('ADMIN'), // Ordinary admin is blocked
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to trigger test notification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/commercial/test-notification',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.emailStatus).toBe('simulated');
      expect(json.whatsappStatus).toBe('sent');
    });

    it('should ensure test notifications do not interfere with real alert idempotency', async () => {
      vi.mocked(prisma.auditLog.create).mockClear();
      
      const result = await CommercialNotificationService.sendTestNotification();
      expect(result.emailStatus).toBe('simulated');
      expect(result.whatsappStatus).toBe('sent');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMMERCIAL_ALERT_SENT',
            metadata: expect.objectContaining({
              alertType: 'TEST',
            }),
          }),
        })
      );
    });
  });

  describe('5. Environment Configurations Validation', () => {
    it('env inválida falha validação adequadamente', () => {
      const originalExit = process.exit;
      const originalConsoleError = console.error;
      const mockExit = vi.fn() as any;
      process.exit = mockExit;
      console.error = vi.fn();

      try {
        validateEnv({
          ENABLE_COMMERCIAL_EMAIL_ALERTS: 'true',
          COMMERCIAL_ALERT_EMAILS: 'invalid-email', // invalid email format
        });
        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
        console.error = originalConsoleError;
      }
    });
  });
});

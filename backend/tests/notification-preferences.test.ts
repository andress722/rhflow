import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Prisma mock ────────────────────────────────────────────────────────────
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    inAppNotification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationPreference: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationEscalationRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    notificationDigest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// ─── Redis mock ──────────────────────────────────────────────────────────────
vi.mock('../src/lib/redis', () => ({
  redis: { quit: vi.fn(() => Promise.resolve()) },
}));

import { prisma } from '../src/lib/prisma';
import { NotificationCenterService } from '../src/services/notification-center.service';
import { NotificationSeverity, NotificationStatus, NotificationChannel, EscalationScope, DigestStatus } from '@prisma/client';

describe('NotificationCenterService Sprint 39', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Test 1: Preference disabled supresses notification ──────────────────
  it('should suppress notification when preference is disabled', async () => {
    // Mock preference check to return a disabled preference
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([
      {
        id: 'pref-1',
        companyId: 'company-1',
        userId: null,
        role: 'HR',
        type: 'PENDING_MEDICAL_CERTIFICATE',
        severity: null,
        channel: NotificationChannel.IN_APP,
        enabled: false,
        digestEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    vi.mocked(prisma.inAppNotification.findFirst).mockResolvedValue(null); // no low priority dupe
    vi.mocked(prisma.inAppNotification.create).mockResolvedValue({ id: 'notif-1' } as any);

    const result = await NotificationCenterService.createNotification({
      companyId: 'company-1',
      role: 'HR',
      type: 'PENDING_MEDICAL_CERTIFICATE',
      severity: NotificationSeverity.WARNING,
      title: 'Atestado médico',
      message: 'Novo atestado.',
    });

    expect(prisma.inAppNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.DISMISSED,
          metadata: expect.objectContaining({ suppressed: true }),
        }),
      })
    );
    expect(result).toEqual({ id: 'notif-1' });
  });

  // ─── Test 2: Critical overrides ignore suppression ───────────────────────
  it('should override suppression for critical platforms alerts', async () => {
    // Disabled preference for BILLING_OVERDUE
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([
      {
        id: 'pref-2',
        companyId: null,
        userId: null,
        role: null,
        type: 'BILLING_OVERDUE',
        severity: null,
        channel: NotificationChannel.IN_APP,
        enabled: false,
        digestEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    vi.mocked(prisma.inAppNotification.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.inAppNotification.create).mockResolvedValue({ id: 'notif-2' } as any);

    const result = await NotificationCenterService.createNotification({
      companyId: null,
      role: null,
      type: 'BILLING_OVERDUE',
      severity: NotificationSeverity.CRITICAL,
      title: 'Faturamento Vencido',
      message: 'Sua assinatura expirou.',
    });

    expect(prisma.inAppNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.UNREAD, // remains UNREAD due to override
        }),
      })
    );
    expect(result).toEqual({ id: 'notif-2' });
  });

  // ─── Test 3: Escalation rule creates escalated notification ─────────────
  it('should escalate pending notifications based on rules', async () => {
    // Mock escalation rule
    vi.mocked(prisma.notificationEscalationRule.findMany).mockResolvedValue([
      {
        id: 'rule-1',
        companyId: 'company-1',
        scope: EscalationScope.COMPANY,
        type: 'PENDING_MEDICAL_CERTIFICATE',
        severity: NotificationSeverity.WARNING,
        condition: null,
        escalateAfterMinutes: 30,
        targetRole: 'ADMIN',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    // Mock unread matching notification older than 30m
    const originalNotif = {
      id: 'notif-3',
      companyId: 'company-1',
      userId: null,
      role: 'HR',
      type: 'PENDING_MEDICAL_CERTIFICATE',
      severity: NotificationSeverity.WARNING,
      status: NotificationStatus.UNREAD,
      title: 'Atestado pendente',
      message: 'Mensagem do atestado.',
      actionUrl: '/app/medical-certificates',
      entityType: 'MedicalCertificate',
      entityId: 'cert-1',
      createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago
    };

    vi.mocked(prisma.inAppNotification.findMany).mockResolvedValue([originalNotif] as any);

    // Mock findUnique for dedupe check (dedupe returns null, meaning not escalated yet)
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.inAppNotification.create).mockResolvedValue({ id: 'escalated-1' } as any);
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([]); // no suppression for admin

    const escalatedCount = await NotificationCenterService.runEscalations();

    expect(escalatedCount).toBe(1);
    expect(prisma.inAppNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'ADMIN',
          title: '[ESCALATION] Atestado pendente',
          dedupeKey: 'escalation:notif-3:ADMIN',
        }),
      })
    );
  });

  // ─── Test 4: Escalation rule does not duplicate ──────────────────────────
  it('should not duplicate escalations if they already exist', async () => {
    vi.mocked(prisma.notificationEscalationRule.findMany).mockResolvedValue([
      {
        id: 'rule-1',
        companyId: 'company-1',
        scope: EscalationScope.COMPANY,
        type: 'PENDING_MEDICAL_CERTIFICATE',
        severity: NotificationSeverity.WARNING,
        condition: null,
        escalateAfterMinutes: 30,
        targetRole: 'ADMIN',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const originalNotif = {
      id: 'notif-3',
      companyId: 'company-1',
      userId: null,
      role: 'HR',
      type: 'PENDING_MEDICAL_CERTIFICATE',
      severity: NotificationSeverity.WARNING,
      status: NotificationStatus.UNREAD,
      title: 'Atestado pendente',
      message: 'Mensagem do atestado.',
      actionUrl: '/app/medical-certificates',
      entityType: 'MedicalCertificate',
      entityId: 'cert-1',
      createdAt: new Date(Date.now() - 40 * 60 * 1000),
    };

    vi.mocked(prisma.inAppNotification.findMany).mockResolvedValue([originalNotif] as any);
    // findUnique returns existing escalation notif, so it updates instead of create
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue({ id: 'escalated-1' } as any);
    vi.mocked(prisma.inAppNotification.update).mockResolvedValue({ id: 'escalated-1' } as any);

    const escalatedCount = await NotificationCenterService.runEscalations();

    expect(escalatedCount).toBe(1);
    expect(prisma.inAppNotification.create).not.toHaveBeenCalled();
    expect(prisma.inAppNotification.update).toHaveBeenCalled();
  });

  // ─── Test 5: Daily digest is generated ────────────────────────────────────
  it('should generate today digest and include counts and items', async () => {
    const today = new Date();
    const mockNotifs = [
      {
        id: 'n-1',
        title: 'Alerta 1',
        message: 'Mensagem 1',
        severity: NotificationSeverity.CRITICAL,
        status: NotificationStatus.UNREAD,
        createdAt: today,
      },
      {
        id: 'n-2',
        title: 'Alerta 2',
        message: 'Mensagem 2',
        severity: NotificationSeverity.WARNING,
        status: NotificationStatus.READ,
        createdAt: today,
      },
    ];

    vi.mocked(prisma.inAppNotification.findMany).mockResolvedValue(mockNotifs as any);
    vi.mocked(prisma.notificationDigest.create).mockResolvedValue({ id: 'digest-1' } as any);

    const result = await NotificationCenterService.createDigest('company-1', null, 'HR', today);

    expect(prisma.notificationDigest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          role: 'HR',
          status: DigestStatus.GENERATED,
          summary: expect.objectContaining({
            totalCount: 2,
            unreadCount: 1,
            criticalCount: 1,
            warningCount: 1,
          }),
        }),
      })
    );
    expect(result).toEqual({ id: 'digest-1' });
  });

  // ─── Test 6: getDigestForUser ─────────────────────────────────────────────
  it('should retrieve consolidated digest for user role', async () => {
    const mockSummary = { totalCount: 2, unreadCount: 1 };
    vi.mocked(prisma.notificationDigest.findFirst).mockResolvedValue({
      id: 'd-1',
      summary: mockSummary,
    } as any);

    const result = await NotificationCenterService.getDigestForUser('user-1', 'HR', 'company-1');

    expect(prisma.notificationDigest.findFirst).toHaveBeenCalledOnce();
    expect(result).toEqual(mockSummary);
  });
});

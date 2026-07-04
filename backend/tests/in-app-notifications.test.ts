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
    },
    company: {
      findUnique: vi.fn(),
    },
    jobRun: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    companySubscription: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    pilotLead: { count: vi.fn(), findMany: vi.fn() },
    remoteCheckin: { count: vi.fn() },
    occurrence: { count: vi.fn() },
    medicalCertificate: { count: vi.fn() },
    auditLog: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    pilotFeedback: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    pilotBacklogItem: { count: vi.fn() },
  };
  return { prisma: mockPrisma };
});

// ─── Redis mock ──────────────────────────────────────────────────────────────
vi.mock('../src/lib/redis', () => ({
  redis: { quit: vi.fn(() => Promise.resolve()) },
}));

// ─── Fastify app mock ─────────────────────────────────────────────────────
vi.mock('../src/app', async () => {
  const buildApp = vi.fn(async () => ({
    inject: vi.fn(),
    close: vi.fn(),
    ready: vi.fn(),
  }));
  return { buildApp };
});

import { prisma } from '../src/lib/prisma';
import { NotificationCenterService } from '../src/services/notification-center.service';
import { NotificationSeverity, NotificationStatus } from '@prisma/client';

const mockNotification = {
  id: 'notif-1',
  companyId: 'company-1',
  userId: null,
  role: 'HR',
  type: 'PENDING_MEDICAL_CERTIFICATE',
  severity: NotificationSeverity.WARNING,
  status: NotificationStatus.UNREAD,
  title: 'Atestado médico aguardando revisão',
  message: 'Um novo atestado médico foi recebido.',
  actionUrl: '/app/medical-certificates',
  entityType: 'MedicalCertificate',
  entityId: 'cert-1',
  dedupeKey: 'certificate:cert-1:pending',
  metadata: null,
  readAt: null,
  dismissedAt: null,
  resolvedAt: null,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPlatformNotification = {
  ...mockNotification,
  id: 'platform-notif-1',
  companyId: null,
  role: null,
  type: 'CRITICAL_JOB_FAILED',
  severity: NotificationSeverity.CRITICAL,
  title: 'Job crítico falhou',
  dedupeKey: 'job:REMOTE_CHECKIN_BATCH:failed:2026-07-01',
};

describe('NotificationCenterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Test 1: Create corporate notification ────────────────────────────────
  it('should create a corporate notification with companyId', async () => {
    vi.mocked(prisma.inAppNotification.create).mockResolvedValue({ id: mockNotification.id } as any);

    const result = await NotificationCenterService.createNotification({
      companyId: 'company-1',
      role: 'HR',
      type: 'PENDING_MEDICAL_CERTIFICATE',
      severity: NotificationSeverity.WARNING,
      title: 'Atestado médico aguardando revisão',
      message: 'Um novo atestado médico foi recebido.',
      dedupeKey: 'certificate:cert-1:pending',
    });

    expect(prisma.inAppNotification.create).toHaveBeenCalledOnce();
    expect(result).toEqual({ id: mockNotification.id });
  });

  // ─── Test 2: Create platform notification (companyId = null) ─────────────
  it('should create a platform notification with companyId=null', async () => {
    vi.mocked(prisma.inAppNotification.create).mockResolvedValue({ id: 'platform-notif-1' } as any);

    const result = await NotificationCenterService.createNotification({
      companyId: null,
      role: null,
      type: 'CRITICAL_JOB_FAILED',
      severity: NotificationSeverity.CRITICAL,
      title: 'Job crítico falhou',
      message: 'O job falhou.',
    });

    expect(prisma.inAppNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: null }) })
    );
    expect(result).toEqual({ id: 'platform-notif-1' });
  });

  // ─── Test 3: Dedupe — same dedupeKey does not create second notification ──
  it('should NOT create a duplicate when dedupeKey already exists', async () => {
    // findUnique returns existing, update is called instead of create
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue(mockNotification as any);
    vi.mocked(prisma.inAppNotification.update).mockResolvedValue(mockNotification as any);

    const result = await NotificationCenterService.createOrUpdateByDedupeKey({
      companyId: 'company-1',
      role: 'HR',
      type: 'PENDING_MEDICAL_CERTIFICATE',
      severity: NotificationSeverity.WARNING,
      title: 'Atestado médico aguardando revisão',
      message: 'Um novo atestado médico foi recebido.',
      dedupeKey: 'certificate:cert-1:pending',
    });

    expect(prisma.inAppNotification.findUnique).toHaveBeenCalledOnce();
    expect(prisma.inAppNotification.update).toHaveBeenCalledOnce();
    expect(prisma.inAppNotification.create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: mockNotification.id });
  });

  // ─── Test 4: createOrUpdateByDedupeKey re-UNREADs existing notification ──
  it('should re-set status to UNREAD on createOrUpdateByDedupeKey for existing key', async () => {
    const readNotif = { ...mockNotification, status: NotificationStatus.READ };
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue(readNotif as any);
    vi.mocked(prisma.inAppNotification.update).mockResolvedValue(readNotif as any);

    await NotificationCenterService.createOrUpdateByDedupeKey({
      companyId: 'company-1',
      role: 'HR',
      type: 'PENDING_MEDICAL_CERTIFICATE',
      severity: NotificationSeverity.WARNING,
      title: 'Atestado médico aguardando revisão',
      message: 'Novo atestado.',
      dedupeKey: 'certificate:cert-1:pending',
    });

    expect(prisma.inAppNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NotificationStatus.UNREAD }),
      })
    );
  });

  // ─── Test 5: Mark as READ ────────────────────────────────────────────────
  it('should mark notification as READ and set readAt', async () => {
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue(mockNotification as any);
    vi.mocked(prisma.inAppNotification.update).mockResolvedValue({ ...mockNotification, status: NotificationStatus.READ } as any);

    const result = await NotificationCenterService.markAsRead('notif-1', 'user-1', 'HR', 'company-1');

    expect(result).toBe(true);
    expect(prisma.inAppNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.READ,
          readAt: expect.any(Date),
        }),
      })
    );
  });

  // ─── Test 6: Mark as DISMISSED ──────────────────────────────────────────
  it('should mark notification as DISMISSED and set dismissedAt', async () => {
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue(mockNotification as any);
    vi.mocked(prisma.inAppNotification.update).mockResolvedValue({ ...mockNotification, status: NotificationStatus.DISMISSED } as any);

    const result = await NotificationCenterService.dismiss('notif-1', 'user-1', 'HR', 'company-1');

    expect(result).toBe(true);
    expect(prisma.inAppNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.DISMISSED,
          dismissedAt: expect.any(Date),
        }),
      })
    );
  });

  // ─── Test 7: Mark as RESOLVED ───────────────────────────────────────────
  it('should mark notification as RESOLVED and set resolvedAt', async () => {
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue(mockNotification as any);
    vi.mocked(prisma.inAppNotification.update).mockResolvedValue({ ...mockNotification, status: NotificationStatus.RESOLVED } as any);

    const result = await NotificationCenterService.resolve('notif-1', 'user-1', 'HR', 'company-1');

    expect(result).toBe(true);
    expect(prisma.inAppNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.RESOLVED,
          resolvedAt: expect.any(Date),
        }),
      })
    );
  });

  // ─── Test 8: Returns false when notification not found ───────────────────
  it('should return false when notification not found on markAsRead', async () => {
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue(null);

    const result = await NotificationCenterService.markAsRead('non-existent', 'user-1', 'HR', 'company-1');

    expect(result).toBe(false);
    expect(prisma.inAppNotification.update).not.toHaveBeenCalled();
  });

  // ─── Test 9: MANAGER cannot act on ADMIN-only notification ──────────────
  it('should return false when MANAGER tries to access HR-only notification', async () => {
    const hrNotif = { ...mockNotification, role: 'HR', userId: null };
    vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue(hrNotif as any);

    const result = await NotificationCenterService.markAsRead('notif-1', 'manager-1', 'MANAGER', 'company-1');

    expect(result).toBe(false);
    expect(prisma.inAppNotification.update).not.toHaveBeenCalled();
  });

  // ─── Test 10: unread-count returns correct value ─────────────────────────
  it('should return correct unread count for ADMIN user', async () => {
    vi.mocked(prisma.inAppNotification.count).mockResolvedValue(5);

    const count = await NotificationCenterService.getUnreadCount('user-1', 'ADMIN', 'company-1');

    expect(count).toBe(5);
    expect(prisma.inAppNotification.count).toHaveBeenCalledOnce();
  });

  // ─── Test 11: Platform unread count ─────────────────────────────────────
  it('should return correct platform unread count', async () => {
    vi.mocked(prisma.inAppNotification.count).mockResolvedValue(3);

    const count = await NotificationCenterService.getPlatformUnreadCount();

    expect(count).toBe(3);
    expect(prisma.inAppNotification.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: null }) })
    );
  });

  // ─── Test 12: Metadata sanitized — CPF masked ────────────────────────────
  it('should mask CPF-like strings in metadata', () => {
    const meta = { cpf: '12345678901', name: 'João', notes: 'ok' };
    const sanitized = NotificationCenterService.sanitizeMetadata(meta);

    expect(sanitized.cpf).toBe('[REDACTED]');
    expect(sanitized.name).toBe('João');
    expect(sanitized.notes).toBe('ok');
  });

  // ─── Test 13: Metadata sanitized — medical fields removed ────────────────
  it('should redact diagnosis and cid fields from metadata', () => {
    const meta = { diagnosis: 'Flu', cid: 'J11', medicalNotes: 'rest required', employeeId: 'emp-1' };
    const sanitized = NotificationCenterService.sanitizeMetadata(meta);

    expect(sanitized.diagnosis).toBe('[REDACTED]');
    expect(sanitized.cid).toBe('[REDACTED]');
    expect(sanitized.medicalNotes).toBe('[REDACTED]');
    expect(sanitized.employeeId).toBe('emp-1'); // safe field preserved
  });

  // ─── Test 14: Metadata sanitized — Bearer token masked ───────────────────
  it('should mask Bearer tokens in metadata string values', () => {
    const sanitized = NotificationCenterService.sanitizeMetadata('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(sanitized).toBe('Bearer **********');
  });

  // ─── Test 15: createOrUpdateByDedupeKey is silent on error ───────────────
  it('should return null silently when createOrUpdateByDedupeKey fails', async () => {
    vi.mocked(prisma.inAppNotification.findUnique).mockRejectedValue(new Error('DB error'));

    // Should not throw
    const result = await NotificationCenterService.createOrUpdateByDedupeKey({
      companyId: 'company-1',
      role: 'HR',
      type: 'PENDING_MEDICAL_CERTIFICATE',
      severity: NotificationSeverity.WARNING,
      title: 'Teste',
      message: 'Mensagem',
      dedupeKey: 'test:dedupeKey',
    });

    expect(result).toBeNull();
  });
});

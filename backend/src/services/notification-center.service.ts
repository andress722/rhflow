import { prisma } from '../lib/prisma';
import { NotificationSeverity, NotificationStatus, NotificationChannel, EscalationScope, DigestStatus } from '@prisma/client';

export interface CreateNotificationInput {
  companyId?: string | null;
  userId?: string | null;
  role?: string | null;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
  metadata?: any;
  expiresAt?: Date | null;
}

export interface GetNotificationsFilters {
  companyId?: string | null;
  userId: string;
  role: string;
  status?: NotificationStatus;
  severity?: NotificationSeverity;
  type?: string;
  page?: number;
  pageSize?: number;
}

const SENSITIVE_KEYS = [
  'cpf', 'document', 'senha', 'password', 'currentpassword', 'newpassword',
  'token', 'accesstoken', 'accesstokenenc', 'webhooksecret', 'jwt', 'secret',
  'authorization', 'cookie', 'diagnosis', 'cid', 'medicalnotes', 'clinicalnotes',
  'rawbody', 'payload'
];

const PHONE_KEYS = ['whatsapp', 'phonenumber', 'phone', 'celular', 'telefone'];

export class NotificationCenterService {
  // SSE connections tracker
  static sseClients: Map<string, Array<{ userId: string, send: (data: any) => void }>> = new Map();

  static registerSseClient(companyId: string, userId: string, send: (data: any) => void) {
    const key = companyId || 'PLATFORM';
    if (!this.sseClients.has(key)) {
      this.sseClients.set(key, []);
    }
    this.sseClients.get(key)!.push({ userId, send });
  }

  static unregisterSseClient(companyId: string, userId: string, send: (data: any) => void) {
    const key = companyId || 'PLATFORM';
    const list = this.sseClients.get(key);
    if (list) {
      this.sseClients.set(key, list.filter(c => c.userId !== userId || c.send !== send));
    }
  }

  static broadcastNotification(companyId: string | null | undefined, notification: any) {
    const key = companyId || 'PLATFORM';
    const list = this.sseClients.get(key);
    if (list) {
      for (const client of list) {
        if (!notification.userId || notification.userId === client.userId) {
          client.send(notification);
        }
      }
    }
  }
  /**
   * Sanitize metadata to comply with LGPD — removes CPF, passwords, medical data, raw WhatsApp messages.
   */
  static sanitizeMetadata(val: any): any {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string') {
      // Mask Bearer tokens
      if (val.toLowerCase().startsWith('bearer ')) return 'Bearer **********';
      // Mask strings that look like CPF (11 consecutive digits)
      const digitsOnly = val.replace(/\D/g, '');
      if (digitsOnly.length === 11 && val.length <= 15) return '***.***.***-**';
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => this.sanitizeMetadata(item));
    }
    if (typeof val === 'object') {
      const res: any = {};
      for (const key of Object.keys(val)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.some((k) => lowerKey.includes(k))) {
          res[key] = '[REDACTED]';
        } else if (PHONE_KEYS.some((k) => lowerKey.includes(k))) {
          // Mask phone: keep first 4 chars and last 2 chars
          const phone = String(val[key] || '');
          res[key] = phone.length > 6 ? `${phone.slice(0, 4)}****${phone.slice(-2)}` : '****';
        } else {
          res[key] = this.sanitizeMetadata(val[key]);
        }
      }
      return res;
    }
    return val;
  }

  /**
   * Check if notification is allowed by preferences.
   */
  static async shouldNotify(
    companyId: string | null | undefined,
    userId: string | null | undefined,
    role: string | null | undefined,
    type: string,
    severity: NotificationSeverity
  ): Promise<boolean> {
    // 1. Critical overrides
    const CRITICAL_OVERRIDES = [
      'CRITICAL_JOB_FAILED',
      'HIGH_CHURN_RISK',
      'BILLING_OVERDUE',
      'WHATSAPP_CHANNEL_ERROR',
      'MANY_OPERATIONAL_ERRORS',
      'CRITICAL_OCCURRENCE',
      'URGENT_BACKLOG_OVERDUE',
      'MANY_UNREAD_CRITICAL_NOTIFICATIONS'
    ];
    if (severity === NotificationSeverity.CRITICAL && CRITICAL_OVERRIDES.includes(type)) {
      return true;
    }

    // 2. Query preferences
    if (!prisma.notificationPreference) {
      return true;
    }
    const preferences = await prisma.notificationPreference.findMany({
      where: {
        AND: [
          {
            OR: [
              { userId: userId ?? undefined },
              { role: role ?? undefined },
              { companyId: companyId ?? undefined, userId: null, role: null },
              { companyId: null, userId: null, role: null }
            ]
          },
          {
            OR: [
              { type },
              { type: null }
            ]
          },
          {
            OR: [
              { severity },
              { severity: null }
            ]
          }
        ]
      }
    });

    if (preferences.length === 0) {
      return true; // Enabled by default
    }

    // Score for specificity
    const score = (pref: any) => {
      let val = 0;
      if (pref.userId === userId && userId) val += 1000;
      else if (pref.role === role && role) val += 500;
      else if (pref.companyId === companyId && companyId) val += 100;
      
      if (pref.type === type && type) val += 10;
      if (pref.severity === severity && severity) val += 5;
      return val;
    };

    preferences.sort((a, b) => score(b) - score(a));
    const activePref = preferences[0];

    if (!activePref.enabled) {
      return false;
    }

    // Quiet hours check
    if (activePref.quietHoursStart && activePref.quietHoursEnd) {
      const spTimeStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date()); // "HH:mm"

      const isTimeBetween = (time: string, start: string, end: string) => {
        if (start <= end) {
          return time >= start && time <= end;
        } else {
          return time >= start || time <= end;
        }
      };

      if (isTimeBetween(spTimeStr, activePref.quietHoursStart, activePref.quietHoursEnd)) {
        if (activePref.digestEnabled) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check for low priority unread duplicates in last 24h.
   */
  static async suppressLowPriorityDuplicates(
    companyId: string | null | undefined,
    userId: string | null | undefined,
    role: string | null | undefined,
    type: string,
    severity: NotificationSeverity
  ): Promise<boolean> {
    if (severity !== NotificationSeverity.INFO && severity !== NotificationSeverity.SUCCESS) {
      return false;
    }
    if (!prisma.inAppNotification) {
      return false;
    }
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.inAppNotification.findFirst({
      where: {
        companyId: companyId ?? null,
        userId: userId ?? null,
        role: role ?? null,
        type,
        severity,
        status: NotificationStatus.UNREAD,
        createdAt: { gte: oneDayAgo }
      },
      select: { id: true }
    });
    return !!existing;
  }

  /**
   * Creates a notification. Silent failure when used as a secondary effect.
   * Set `silent = true` to swallow errors without re-throwing.
   */
  static async createNotification(
    input: CreateNotificationInput,
    silent = false
  ): Promise<{ id: string } | null> {
    try {
      const severity = input.severity ?? NotificationSeverity.INFO;

      // 1. Verify supressions
      const isDuplicateSuppress = await this.suppressLowPriorityDuplicates(
        input.companyId,
        input.userId,
        input.role,
        input.type,
        severity
      );

      const isAllowedByPrefs = await this.shouldNotify(
        input.companyId,
        input.userId,
        input.role,
        input.type,
        severity
      );

      const shouldSuppress = isDuplicateSuppress || !isAllowedByPrefs;

      const sanitizedMetadata = input.metadata
        ? this.sanitizeMetadata(input.metadata)
        : undefined;

      const finalMetadata = shouldSuppress
        ? { ...(sanitizedMetadata || {}), suppressed: true, suppressReason: isDuplicateSuppress ? 'duplicate_low_priority' : 'user_preferences' }
        : sanitizedMetadata;

      const notification = await prisma.inAppNotification.create({
        data: {
          companyId: input.companyId ?? null,
          userId: input.userId ?? null,
          role: input.role ?? null,
          type: input.type,
          severity,
          status: shouldSuppress ? NotificationStatus.DISMISSED : NotificationStatus.UNREAD,
          title: input.title.slice(0, 200),
          message: input.message.slice(0, 1000),
          actionUrl: input.actionUrl ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          dedupeKey: input.dedupeKey ?? null,
          metadata: finalMetadata ?? undefined,
          expiresAt: input.expiresAt ?? null,
          dismissedAt: shouldSuppress ? new Date() : null,
        },
        select: { id: true, companyId: true, userId: true, role: true, title: true, message: true, severity: true, actionUrl: true, createdAt: true },
      });
      if (!shouldSuppress) {
        this.broadcastNotification(notification.companyId, notification);
      }
      return { id: notification.id };
    } catch (err) {
      if (!silent) {
        console.error('[NotificationCenterService] createNotification failed:', err);
      }
      return null;
    }
  }

  /**
   * Idempotent create-or-update by dedupeKey.
   */
  static async createOrUpdateByDedupeKey(
    input: CreateNotificationInput
  ): Promise<{ id: string } | null> {
    if (!input.dedupeKey) {
      return this.createNotification(input, true);
    }

    try {
      const severity = input.severity ?? NotificationSeverity.INFO;

      const isDuplicateSuppress = await this.suppressLowPriorityDuplicates(
        input.companyId,
        input.userId,
        input.role,
        input.type,
        severity
      );

      const isAllowedByPrefs = await this.shouldNotify(
        input.companyId,
        input.userId,
        input.role,
        input.type,
        severity
      );

      const shouldSuppress = isDuplicateSuppress || !isAllowedByPrefs;

      const sanitizedMetadata = input.metadata
        ? this.sanitizeMetadata(input.metadata)
        : undefined;

      const finalMetadata = shouldSuppress
        ? { ...(sanitizedMetadata || {}), suppressed: true, suppressReason: isDuplicateSuppress ? 'duplicate_low_priority' : 'user_preferences' }
        : sanitizedMetadata;

      const existing = await prisma.inAppNotification.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { id: true },
      });

      if (existing) {
        const updated = await prisma.inAppNotification.update({
          where: { dedupeKey: input.dedupeKey },
          data: {
            status: shouldSuppress ? NotificationStatus.DISMISSED : NotificationStatus.UNREAD,
            severity,
            title: input.title.slice(0, 200),
            message: input.message.slice(0, 1000),
            actionUrl: input.actionUrl ?? null,
            metadata: finalMetadata ?? undefined,
            readAt: null,
            dismissedAt: shouldSuppress ? new Date() : null,
            resolvedAt: null,
          },
          select: { id: true, companyId: true, userId: true, role: true, title: true, message: true, severity: true, actionUrl: true, createdAt: true },
        });
        if (!shouldSuppress) {
          this.broadcastNotification(updated.companyId, updated);
        }
        return { id: existing.id };
      }

      return this.createNotification(input, true);
    } catch (err) {
      console.error('[NotificationCenterService] createOrUpdateByDedupeKey failed:', err);
      return null;
    }
  }

  /**
   * Mark a notification as READ.
   */
  static async markAsRead(
    id: string,
    userId: string,
    role: string,
    companyId: string | null
  ): Promise<boolean> {
    const notification = await this.findAndValidateAccess(id, userId, role, companyId);
    if (!notification) return false;

    await prisma.inAppNotification.update({
      where: { id },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return true;
  }

  /**
   * Dismiss a notification.
   */
  static async dismiss(
    id: string,
    userId: string,
    role: string,
    companyId: string | null
  ): Promise<boolean> {
    const notification = await this.findAndValidateAccess(id, userId, role, companyId);
    if (!notification) return false;

    await prisma.inAppNotification.update({
      where: { id },
      data: { status: NotificationStatus.DISMISSED, dismissedAt: new Date() },
    });
    return true;
  }

  /**
   * Resolve a notification.
   */
  static async resolve(
    id: string,
    userId: string,
    role: string,
    companyId: string | null
  ): Promise<boolean> {
    const notification = await this.findAndValidateAccess(id, userId, role, companyId);
    if (!notification) return false;

    await prisma.inAppNotification.update({
      where: { id },
      data: { status: NotificationStatus.RESOLVED, resolvedAt: new Date() },
    });
    return true;
  }

  /**
   * Get paginated notifications for a corporate user.
   */
  static async getNotifications(filters: GetNotificationsFilters): Promise<{
    items: any[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { userId, role, companyId, status, severity, type } = filters;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, filters.pageSize ?? 20);
    const skip = (page - 1) * pageSize;
    const now = new Date();

    const where = this.buildCorporateWhereClause(userId, role, companyId, { status, severity, type, now });

    const [items, total] = await Promise.all([
      prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.inAppNotification.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Get unread count for a corporate user.
   */
  static async getUnreadCount(
    userId: string,
    role: string,
    companyId: string | null
  ): Promise<number> {
    const now = new Date();
    const where = this.buildCorporateWhereClause(userId, role, companyId, {
      status: NotificationStatus.UNREAD,
      now,
    });
    return prisma.inAppNotification.count({ where });
  }

  /**
   * Get paginated platform notifications (SUPER_ADMIN — companyId IS NULL).
   */
  static async getPlatformNotifications(filters: {
    status?: NotificationStatus;
    severity?: NotificationSeverity;
    type?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, filters.pageSize ?? 20);
    const skip = (page - 1) * pageSize;
    const now = new Date();

    const where: any = {
      companyId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.type) where.type = filters.type;

    const [items, total] = await Promise.all([
      prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.inAppNotification.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Get unread count for platform (SUPER_ADMIN).
   */
  static async getPlatformUnreadCount(): Promise<number> {
    const now = new Date();
    return prisma.inAppNotification.count({
      where: {
        companyId: null,
        status: NotificationStatus.UNREAD,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  }

  /**
   * Resolve or mark as read a platform notification (SUPER_ADMIN scope).
   */
  static async updatePlatformNotification(
    id: string,
    action: 'read' | 'dismiss' | 'resolve'
  ): Promise<boolean> {
    const notification = await prisma.inAppNotification.findFirst({
      where: { id, companyId: null },
      select: { id: true },
    });
    if (!notification) return false;

    const data: any = {};
    if (action === 'read') {
      data.status = NotificationStatus.READ;
      data.readAt = new Date();
    } else if (action === 'dismiss') {
      data.status = NotificationStatus.DISMISSED;
      data.dismissedAt = new Date();
    } else {
      data.status = NotificationStatus.RESOLVED;
      data.resolvedAt = new Date();
    }

    await prisma.inAppNotification.update({ where: { id }, data });
    return true;
  }

  /**
   * Consolidate notifications for a target into a daily digest.
   */
  static async createDigest(
    companyId: string | null,
    userId: string | null,
    role: string | null,
    date: Date
  ): Promise<{ id: string } | null> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Find all notifications generated today
      const notifications = await prisma.inAppNotification.findMany({
        where: {
          companyId,
          userId,
          role,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      if (notifications.length === 0) {
        const digest = await prisma.notificationDigest.create({
          data: {
            companyId,
            userId,
            role,
            digestDate: startOfDay,
            status: DigestStatus.SKIPPED,
            summary: { count: 0, message: 'Nenhuma notificação gerada hoje.' }
          },
          select: { id: true }
        });
        return digest;
      }

      const totalCount = notifications.length;
      const unreadCount = notifications.filter(n => n.status === NotificationStatus.UNREAD).length;
      const criticalCount = notifications.filter(n => n.severity === NotificationSeverity.CRITICAL).length;
      const warningCount = notifications.filter(n => n.severity === NotificationSeverity.WARNING).length;

      const byType: Record<string, number> = {};
      for (const n of notifications) {
        byType[n.type] = (byType[n.type] || 0) + 1;
      }

      // Safe metadata representation
      const items = notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        severity: n.severity,
        status: n.status,
        createdAt: n.createdAt.toISOString()
      }));

      const summary = {
        totalCount,
        unreadCount,
        criticalCount,
        warningCount,
        byType,
        items
      };

      const digest = await prisma.notificationDigest.create({
        data: {
          companyId,
          userId,
          role,
          digestDate: startOfDay,
          status: DigestStatus.GENERATED,
          summary: summary as any,
        },
        select: { id: true }
      });

      return digest;
    } catch (err) {
      console.error('[NotificationCenterService] createDigest failed:', err);
      return null;
    }
  }

  /**
   * Retrieve today's daily digest for a specific user, role or company.
   */
  static async getDigestForUser(
    userId: string,
    role: string,
    companyId: string | null
  ): Promise<any | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const digest = await prisma.notificationDigest.findFirst({
        where: {
          digestDate: today,
          OR: [
            { userId },
            { role, userId: null },
            { companyId, userId: null, role: null }
          ],
          status: DigestStatus.GENERATED
        },
        orderBy: { generatedAt: 'desc' }
      });

      return digest ? digest.summary : null;
    } catch (err) {
      console.error('[NotificationCenterService] getDigestForUser failed:', err);
      return null;
    }
  }

  /**
   * Run escalations rule matching against pending notifications.
   */
  static async runEscalations(): Promise<number> {
    try {
      const now = new Date();
      const rules = await prisma.notificationEscalationRule.findMany({
        where: { enabled: true }
      });

      let escalationCount = 0;

      for (const rule of rules) {
        const cutoffDate = new Date(now.getTime() - rule.escalateAfterMinutes * 60 * 1000);

        const notifications = await prisma.inAppNotification.findMany({
          where: {
            companyId: rule.scope === EscalationScope.COMPANY ? rule.companyId : null,
            status: NotificationStatus.UNREAD,
            createdAt: { lte: cutoffDate },
            type: rule.type ? rule.type : undefined,
            severity: rule.severity ? rule.severity : undefined
          }
        });

        for (const notif of notifications) {
          const dedupeKey = `escalation:${notif.id}:${rule.targetRole}`;

          const escalated = await this.createOrUpdateByDedupeKey({
            companyId: rule.scope === EscalationScope.COMPANY ? rule.companyId : null,
            userId: null,
            role: rule.targetRole,
            type: notif.type,
            severity: notif.severity,
            title: `[ESCALATION] ${notif.title}`,
            message: `${notif.message} (Escalada após ${rule.escalateAfterMinutes} min para ${rule.targetRole})`,
            actionUrl: notif.actionUrl,
            entityType: notif.entityType,
            entityId: notif.entityId,
            dedupeKey,
            metadata: {
              escalatedFromId: notif.id,
              originalTitle: notif.title,
              escalatedByRuleId: rule.id
            }
          });

          if (escalated) {
            escalationCount++;
          }
        }
      }

      return escalationCount;
    } catch (err) {
      console.error('[NotificationCenterService] runEscalations failed:', err);
      return 0;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private static buildCorporateWhereClause(
    userId: string,
    role: string,
    companyId: string | null | undefined,
    opts: {
      status?: NotificationStatus;
      severity?: NotificationSeverity;
      type?: string;
      now: Date;
    }
  ): any {
    const baseWhere: any = {
      companyId: companyId ?? undefined,
      OR: [{ expiresAt: null }, { expiresAt: { gt: opts.now } }],
    };

    if (opts.status) baseWhere.status = opts.status;
    if (opts.severity) baseWhere.severity = opts.severity;
    if (opts.type) baseWhere.type = opts.type;

    // Visibility scope by role
    if (role === 'ADMIN' || role === 'HR') {
      baseWhere.OR = [
        ...(baseWhere.OR ?? []),
        // Notification addressed to ADMIN/HR
        { role: 'ADMIN' },
        { role: 'HR' },
        // Notification addressed directly to this user
        { userId },
      ];
      // Wrap the visibility OR with the expiry OR
      const expiryCondition = [{ expiresAt: null }, { expiresAt: { gt: opts.now } }];
      return {
        companyId: companyId ?? undefined,
        AND: [
          { OR: expiryCondition },
          {
            OR: [
              { role: 'ADMIN' },
              { role: 'HR' },
              { userId },
            ],
          },
          ...(opts.status ? [{ status: opts.status }] : []),
          ...(opts.severity ? [{ severity: opts.severity }] : []),
          ...(opts.type ? [{ type: opts.type }] : []),
        ],
      };
    }

    if (role === 'MANAGER') {
      const expiryCondition = [{ expiresAt: null }, { expiresAt: { gt: opts.now } }];
      return {
        companyId: companyId ?? undefined,
        AND: [
          { OR: expiryCondition },
          {
            OR: [
              { role: 'MANAGER' },
              { userId },
            ],
          },
          ...(opts.status ? [{ status: opts.status }] : []),
          ...(opts.severity ? [{ severity: opts.severity }] : []),
          ...(opts.type ? [{ type: opts.type }] : []),
        ],
      };
    }

    // VIEWER: only notifications directed to this specific user
    const expiryCondition = [{ expiresAt: null }, { expiresAt: { gt: opts.now } }];
    return {
      companyId: companyId ?? undefined,
      userId,
      AND: [
        { OR: expiryCondition },
        ...(opts.status ? [{ status: opts.status }] : []),
        ...(opts.severity ? [{ severity: opts.severity }] : []),
        ...(opts.type ? [{ type: opts.type }] : []),
      ],
    };
  }

  private static async findAndValidateAccess(
    id: string,
    userId: string,
    role: string,
    companyId: string | null
  ): Promise<{ id: string } | null> {
    const notification = await prisma.inAppNotification.findUnique({
      where: { id },
      select: { id: true, companyId: true, userId: true, role: true },
    });

    if (!notification) return null;

    // Must belong to the same company
    if (notification.companyId && notification.companyId !== companyId) return null;

    // ADMIN/HR can act on any notification of their company scoped to ADMIN/HR
    if (role === 'ADMIN' || role === 'HR') {
      if (
        notification.role === 'ADMIN' ||
        notification.role === 'HR' ||
        notification.userId === userId
      ) {
        return notification;
      }
      return null;
    }

    // MANAGER can act on MANAGER notifications or own
    if (role === 'MANAGER') {
      if (notification.role === 'MANAGER' || notification.userId === userId) {
        return notification;
      }
      return null;
    }

    // VIEWER: only own
    if (notification.userId === userId) return notification;

    return null;
  }
}

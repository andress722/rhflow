import { prisma } from '../../lib/prisma';
import { NotificationSeverity } from '@prisma/client';
import { NotificationCenterService } from '../../services/notification-center.service';
import { WhatsAppService } from '../../services/whatsapp.service';
import { WebPushSenderService } from '../../services/web-push-sender.service';
import { NotificationEmailService } from './notification-email.service';
import type { ResolvedRecipient, ReasonCode } from './notification-engine.types';

export interface ChannelSendPayload {
  companyId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  dedupeKey: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export interface ChannelSendResult {
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  providerMessageId?: string;
  failureReasonCode?: ReasonCode;
  isTransient?: boolean;
}

const PRIORITY_TO_SEVERITY: Record<string, NotificationSeverity> = {
  LOW: 'INFO',
  NORMAL: 'INFO',
  HIGH: 'WARNING',
  CRITICAL: 'CRITICAL',
};

export interface NotificationChannelProvider {
  channel: string;
  /** Contact capability check: does this recipient have what's needed to receive this channel at all? */
  supports(recipient: ResolvedRecipient): Promise<boolean>;
  send(recipient: ResolvedRecipient, payload: ChannelSendPayload): Promise<ChannelSendResult>;
}

class InAppChannelProvider implements NotificationChannelProvider {
  channel = 'IN_APP';

  async supports(recipient: ResolvedRecipient): Promise<boolean> {
    return Boolean(recipient.recipientUserId);
  }

  async send(recipient: ResolvedRecipient, payload: ChannelSendPayload): Promise<ChannelSendResult> {
    if (!recipient.recipientUserId) {
      return { status: 'SKIPPED', failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE' };
    }
    const created = await NotificationCenterService.createOrUpdateByDedupeKey({
      companyId: payload.companyId,
      userId: recipient.recipientUserId,
      type: payload.eventType,
      severity: PRIORITY_TO_SEVERITY[payload.priority] ?? 'INFO',
      title: payload.title,
      message: payload.message,
      actionUrl: payload.actionUrl ?? undefined,
      entityType: payload.entityType,
      entityId: payload.entityId,
      dedupeKey: `notification-engine:${payload.dedupeKey}`,
    });
    if (!created) return { status: 'FAILED', failureReasonCode: 'NOTIFICATION_PROVIDER_UNAVAILABLE', isTransient: true };
    return { status: 'SENT', providerMessageId: created.id };
  }
}

class WebPushChannelProvider implements NotificationChannelProvider {
  channel = 'WEB_PUSH';

  async supports(recipient: ResolvedRecipient): Promise<boolean> {
    if (!recipient.recipientUserId) return false;
    const count = await prisma.webPushSubscription.count({ where: { userId: recipient.recipientUserId } });
    return count > 0;
  }

  async send(recipient: ResolvedRecipient, payload: ChannelSendPayload): Promise<ChannelSendResult> {
    if (!recipient.recipientUserId) {
      return { status: 'SKIPPED', failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE' };
    }
    const result = await WebPushSenderService.sendToUser(recipient.recipientUserId, {
      title: payload.title,
      body: payload.message,
      url: payload.actionUrl,
    });
    if (result.sent > 0) return { status: 'SENT' };
    return { status: 'FAILED', failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE' };
  }
}

class WhatsAppChannelProviderWrapper implements NotificationChannelProvider {
  channel = 'WHATSAPP';

  async supports(recipient: ResolvedRecipient): Promise<boolean> {
    if (!recipient.recipientEmployeeId) return false;
    const employee = await prisma.employee.findUnique({ where: { id: recipient.recipientEmployeeId } });
    return Boolean(employee?.whatsapp);
  }

  async send(recipient: ResolvedRecipient, payload: ChannelSendPayload): Promise<ChannelSendResult> {
    if (!recipient.recipientEmployeeId) {
      return { status: 'SKIPPED', failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE' };
    }
    const employee = await prisma.employee.findUnique({ where: { id: recipient.recipientEmployeeId } });
    if (!employee?.whatsapp) {
      return { status: 'SKIPPED', failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE' };
    }
    const result = await WhatsAppService.sendMessage({
      to: employee.whatsapp,
      message: payload.message,
      companyId: payload.companyId,
    });
    if (!result.success) return { status: 'FAILED', failureReasonCode: 'NOTIFICATION_PROVIDER_UNAVAILABLE', isTransient: true };
    return { status: 'SENT', providerMessageId: result.messageId };
  }
}

class EmailChannelProvider implements NotificationChannelProvider {
  channel = 'EMAIL';

  private async resolveEmail(recipient: ResolvedRecipient): Promise<string | null> {
    if (recipient.recipientUserId) {
      const user = await prisma.user.findUnique({ where: { id: recipient.recipientUserId } });
      if (user?.email) return user.email;
    }
    if (recipient.recipientEmployeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: recipient.recipientEmployeeId } });
      if (employee?.email) return employee.email;
    }
    return null;
  }

  async supports(recipient: ResolvedRecipient): Promise<boolean> {
    if (!NotificationEmailService.isConfigured()) return false;
    return Boolean(await this.resolveEmail(recipient));
  }

  async send(recipient: ResolvedRecipient, payload: ChannelSendPayload): Promise<ChannelSendResult> {
    const to = await this.resolveEmail(recipient);
    if (!to) return { status: 'SKIPPED', failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE' };

    const result = await NotificationEmailService.send({ to, subject: payload.title, text: payload.message });
    if (!result.ok) {
      const isTransient = result.reasonCode === 'NOTIFICATION_PROVIDER_TIMEOUT' || result.reasonCode === 'NOTIFICATION_PROVIDER_UNAVAILABLE';
      return { status: 'FAILED', failureReasonCode: result.reasonCode, isTransient };
    }
    return { status: 'SENT', providerMessageId: result.providerMessageId };
  }
}

const PROVIDERS: Record<string, NotificationChannelProvider> = {
  IN_APP: new InAppChannelProvider(),
  WEB_PUSH: new WebPushChannelProvider(),
  WHATSAPP: new WhatsAppChannelProviderWrapper(),
  EMAIL: new EmailChannelProvider(),
};

export function getChannelProvider(channel: string): NotificationChannelProvider | null {
  return PROVIDERS[channel] ?? null;
}

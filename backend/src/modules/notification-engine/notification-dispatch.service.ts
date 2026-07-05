import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { NotificationDeliveryStatus } from '@prisma/client';
import { config } from '../../config';
import { getChannelProvider, type ChannelSendPayload } from './notification-channel-provider';
import { NotificationAudienceService } from './notification-audience.service';
import { NotificationQuietHoursService } from './notification-quiet-hours.service';
import type { PolicyStepView, ResolvedRecipient } from './notification-engine.types';

function buildIdempotencyKey(workflowInstanceId: string, stepOrder: number, recipient: ResolvedRecipient, channel: string): string {
  const recipientId = recipient.recipientUserId ?? recipient.recipientEmployeeId ?? 'unresolved';
  return crypto
    .createHash('sha256')
    .update(`${workflowInstanceId}:${stepOrder}:${recipientId}:${channel}`)
    .digest('hex');
}

/** Sleeps briefly for a single inline retry on a transient failure — mirrors the Calendar sync fetchWithRetry precedent. */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DispatchStepOutcome {
  deferredUntil?: Date;
  anySent: boolean;
  allSkippedOrFailed: boolean;
}

export class NotificationDispatchService {
  /**
   * Attempts (or resumes) delivery of a single step for every resolved
   * recipient. Idempotent: retries for the same logical delivery
   * (workflowInstanceId+stepOrder+recipient+channel) update the same
   * NotificationDeliveryAttempt row instead of creating a new one.
   */
  static async dispatchStep(
    workflowInstanceId: string,
    companyId: string,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL',
    quietHoursBehavior: 'DEFER' | 'ALLOW_HIGH_PRIORITY' | 'IGNORE',
    step: PolicyStepView,
    context: Record<string, unknown>,
    title: string,
    message: string,
    actionUrl: string | null,
  ): Promise<DispatchStepOutcome> {
    const recipients = await NotificationAudienceService.resolve(companyId, step.recipientType, step.recipientReference, context);

    let anySent = false;
    let allSkippedOrFailed = true;
    let deferredUntil: Date | undefined;

    for (const recipient of recipients) {
      if (recipient.skipReasonCode) {
        await this.recordUnresolvable(companyId, workflowInstanceId, step, recipient);
        continue;
      }

      const quiet = await NotificationQuietHoursService.evaluate(companyId, priority, quietHoursBehavior, recipient.recipientUserId);
      if (quiet.shouldDefer) {
        deferredUntil = quiet.retryAfter;
        continue;
      }

      const payload: ChannelSendPayload = {
        companyId,
        eventType,
        entityType: aggregateType,
        entityId: aggregateId,
        title,
        message,
        actionUrl,
        dedupeKey: buildIdempotencyKey(workflowInstanceId, step.stepOrder, recipient, 'ANY'),
        priority,
      };

      if (step.fallbackMode === 'SEQUENTIAL') {
        for (const channel of step.channels) {
          const outcome = await this.attemptChannel(companyId, workflowInstanceId, step, recipient, channel, payload);
          if (outcome.status === 'SENT') {
            anySent = true;
            allSkippedOrFailed = false;
            break;
          }
          // Only fall through to the next channel on a PERMANENT failure or
          // an unavailable channel. A transient failure stays on this
          // channel — the escalation scheduler will retry it, it does not
          // immediately jump to the next channel in the list.
          if (outcome.status === 'FAILED' && outcome.isTransient) break;
        }
      } else {
        const results = await Promise.all(
          step.channels.map((channel) => this.attemptChannel(companyId, workflowInstanceId, step, recipient, channel, payload)),
        );
        if (results.some((r) => r.status === 'SENT')) {
          anySent = true;
          allSkippedOrFailed = false;
        }
      }
    }

    return { deferredUntil, anySent, allSkippedOrFailed };
  }

  private static async recordUnresolvable(companyId: string, workflowInstanceId: string, step: PolicyStepView, recipient: ResolvedRecipient) {
    const idempotencyKey = buildIdempotencyKey(workflowInstanceId, step.stepOrder, recipient, 'UNRESOLVED');
    await prisma.notificationDeliveryAttempt.upsert({
      where: { companyId_idempotencyKey: { companyId, idempotencyKey } },
      create: {
        companyId,
        workflowInstanceId,
        policyStepId: step.id,
        channel: 'NONE',
        status: 'SKIPPED',
        idempotencyKey,
        scheduledAt: new Date(),
        failedAt: new Date(),
        failureReasonCode: recipient.skipReasonCode,
      },
      update: { status: 'SKIPPED', failedAt: new Date(), failureReasonCode: recipient.skipReasonCode },
    });
  }

  private static async attemptChannel(
    companyId: string,
    workflowInstanceId: string,
    step: PolicyStepView,
    recipient: ResolvedRecipient,
    channel: string,
    payload: ChannelSendPayload,
  ): Promise<{ status: NotificationDeliveryStatus; isTransient?: boolean }> {
    const idempotencyKey = buildIdempotencyKey(workflowInstanceId, step.stepOrder, recipient, channel);

    const existing = await prisma.notificationDeliveryAttempt.findUnique({
      where: { companyId_idempotencyKey: { companyId, idempotencyKey } },
    });

    // Already terminal — never re-send a delivery that already succeeded.
    if (existing && (existing.status === 'SENT' || existing.status === 'DELIVERED')) {
      return { status: existing.status };
    }
    if (existing && existing.status === 'SKIPPED') {
      return { status: 'SKIPPED' };
    }
    if (existing && existing.attemptNumber >= config.notificationEngine.maxRetries) {
      await prisma.notificationDeliveryAttempt.update({
        where: { id: existing.id },
        data: { status: 'FAILED', failureReasonCode: 'NOTIFICATION_MAX_RETRIES_EXCEEDED' },
      });
      return { status: 'FAILED', isTransient: false };
    }

    const provider = getChannelProvider(channel);
    if (!provider) {
      await this.upsertAttempt(companyId, workflowInstanceId, step, recipient, channel, idempotencyKey, existing, {
        status: 'SKIPPED',
        failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE',
      });
      return { status: 'SKIPPED' };
    }

    const canSend = await provider.supports(recipient);
    if (!canSend) {
      await this.upsertAttempt(companyId, workflowInstanceId, step, recipient, channel, idempotencyKey, existing, {
        status: 'SKIPPED',
        failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE',
      });
      return { status: 'SKIPPED' };
    }

    // Every subsequent upsert in this call must thread through the row just
    // written, never the pre-call `existing` snapshot — otherwise the second
    // upsert also sees "no row" and tries to CREATE again, violating the
    // (companyId, idempotencyKey) unique constraint.
    const processingRow = await this.upsertAttempt(companyId, workflowInstanceId, step, recipient, channel, idempotencyKey, existing, {
      status: 'PROCESSING',
      startedAt: new Date(),
    });

    let result = await provider.send(recipient, payload);
    if (result.status === 'FAILED' && result.isTransient) {
      // Single quick inline retry to smooth over blips, matching the
      // fetchWithRetry precedent from Calendar sync. Anything beyond this is
      // left to the escalation scheduler's own backoff across scan ticks.
      await sleep(config.notificationEngine.retryBaseDelaySeconds * 1000 * 0.1);
      result = await provider.send(recipient, payload);
    }

    if (result.status === 'SENT') {
      await this.upsertAttempt(companyId, workflowInstanceId, step, recipient, channel, idempotencyKey, processingRow, {
        status: 'SENT',
        deliveredAt: new Date(),
        providerMessageId: result.providerMessageId,
        provider: channel,
      }, true);
      return { status: 'SENT' };
    }

    await this.upsertAttempt(companyId, workflowInstanceId, step, recipient, channel, idempotencyKey, processingRow, {
      status: 'FAILED',
      failedAt: new Date(),
      failureReasonCode: result.failureReasonCode,
    }, true);

    return { status: 'FAILED', isTransient: Boolean(result.isTransient) };
  }

  private static async upsertAttempt(
    companyId: string,
    workflowInstanceId: string,
    step: PolicyStepView,
    recipient: ResolvedRecipient,
    channel: string,
    idempotencyKey: string,
    existing: { id: string; attemptNumber: number } | null,
    data: Record<string, unknown>,
    incrementAttempt = false,
  ): Promise<{ id: string; attemptNumber: number }> {
    if (existing) {
      return prisma.notificationDeliveryAttempt.update({
        where: { id: existing.id },
        data: { ...data, attemptNumber: incrementAttempt ? existing.attemptNumber + 1 : existing.attemptNumber },
      });
    }
    return prisma.notificationDeliveryAttempt.create({
      data: {
        companyId,
        workflowInstanceId,
        policyStepId: step.id,
        recipientUserId: recipient.recipientUserId,
        recipientEmployeeId: recipient.recipientEmployeeId,
        channel,
        idempotencyKey,
        scheduledAt: new Date(),
        attemptNumber: 1,
        ...data,
      },
    });
  }
}

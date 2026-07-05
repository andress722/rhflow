import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';
import { NotificationDispatchService } from '../src/modules/notification-engine/notification-dispatch.service';
import * as channelProviderModule from '../src/modules/notification-engine/notification-channel-provider';
import type { NotificationChannelProvider, ChannelSendPayload, ChannelSendResult } from '../src/modules/notification-engine/notification-channel-provider';
import type { PolicyStepView } from '../src/modules/notification-engine/notification-engine.types';

function fakeProvider(channel: string, behavior: (attempt: number) => ChannelSendResult): NotificationChannelProvider & { calls: number } {
  let calls = 0;
  return {
    channel,
    calls: 0,
    async supports() { return true; },
    async send() {
      calls += 1;
      (this as any).calls = calls;
      return behavior(calls);
    },
  } as any;
}

describe('Sprint 54 - Notification Dispatch (idempotency, fallback, retry)', () => {
  let company: any;
  let user: any;

  beforeAll(async () => {
    company = await prisma.company.create({ data: { name: 'Dispatch Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    user = await prisma.user.create({
      data: { companyId: company.id, name: 'Dispatch User', email: `disp-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'VIEWER', isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { companyId: company.id } });
    vi.restoreAllMocks();
  });

  function buildStep(overrides: Partial<PolicyStepView> = {}): PolicyStepView {
    return {
      id: crypto.randomUUID(),
      stepOrder: 1,
      delayMinutes: 0,
      recipientType: 'SPECIFIC_USER' as any,
      recipientReference: user.id,
      channels: ['WEB_PUSH', 'EMAIL'],
      fallbackMode: 'SEQUENTIAL',
      stopOnAcknowledgment: true,
      stopOnResolution: true,
      ...overrides,
    };
  }

  async function baseArgs() {
    const eventType = 'LEAVE_REQUEST_CREATED';
    const aggregateId = crypto.randomUUID();
    const workflow = await prisma.notificationWorkflowInstance.create({
      data: {
        companyId: company.id,
        eventType,
        eventId: crypto.randomUUID(),
        aggregateType: 'LeaveRequest',
        aggregateId,
        priority: 'NORMAL',
        status: 'ACTIVE',
        deduplicationKey: crypto.randomUUID(),
      },
    });
    return {
      workflowInstanceId: workflow.id,
      companyId: company.id,
      eventType,
      aggregateType: 'LeaveRequest',
      aggregateId,
      priority: 'NORMAL' as const,
      quietHoursBehavior: 'DEFER' as const,
      context: {},
      title: 't',
      message: 'm',
      actionUrl: null,
    };
  }

  it('SEQUENTIAL fallback: a PERMANENT failure on the first channel falls through to the second', async () => {
    const webPush = fakeProvider('WEB_PUSH', () => ({ status: 'FAILED', failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE', isTransient: false }));
    const email = fakeProvider('EMAIL', () => ({ status: 'SENT', providerMessageId: 'email-1' }));
    vi.spyOn(channelProviderModule, 'getChannelProvider').mockImplementation((ch) => (ch === 'WEB_PUSH' ? webPush : ch === 'EMAIL' ? email : null));

    const args = await baseArgs();
    const outcome = await NotificationDispatchService.dispatchStep(
      args.workflowInstanceId, args.companyId, args.eventType, args.aggregateType, args.aggregateId,
      args.priority, args.quietHoursBehavior, buildStep({ fallbackMode: 'SEQUENTIAL' }), args.context, args.title, args.message, args.actionUrl,
    );

    expect(outcome.anySent).toBe(true);
    expect(webPush.calls).toBe(1);
    expect(email.calls).toBe(1);

    const attempts = await prisma.notificationDeliveryAttempt.findMany({ where: { companyId: company.id, workflowInstanceId: args.workflowInstanceId } });
    expect(attempts.find((a) => a.channel === 'WEB_PUSH')?.status).toBe('FAILED');
    expect(attempts.find((a) => a.channel === 'EMAIL')?.status).toBe('SENT');
  });

  it('SEQUENTIAL fallback: a TRANSIENT failure on the first channel does NOT fall through to the second', async () => {
    const webPush = fakeProvider('WEB_PUSH', () => ({ status: 'FAILED', failureReasonCode: 'NOTIFICATION_PROVIDER_TIMEOUT', isTransient: true }));
    const email = fakeProvider('EMAIL', () => ({ status: 'SENT', providerMessageId: 'email-1' }));
    vi.spyOn(channelProviderModule, 'getChannelProvider').mockImplementation((ch) => (ch === 'WEB_PUSH' ? webPush : ch === 'EMAIL' ? email : null));

    const args = await baseArgs();
    const outcome = await NotificationDispatchService.dispatchStep(
      args.workflowInstanceId, args.companyId, args.eventType, args.aggregateType, args.aggregateId,
      args.priority, args.quietHoursBehavior, buildStep({ fallbackMode: 'SEQUENTIAL' }), args.context, args.title, args.message, args.actionUrl,
    );

    expect(outcome.anySent).toBe(false);
    // One inline retry happens on a transient failure, so the transient channel is attempted twice.
    expect(webPush.calls).toBe(2);
    expect(email.calls).toBe(0);
  });

  it('PARALLEL fallback: attempts all channels regardless of individual outcomes', async () => {
    const webPush = fakeProvider('WEB_PUSH', () => ({ status: 'FAILED', failureReasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE', isTransient: false }));
    const email = fakeProvider('EMAIL', () => ({ status: 'SENT', providerMessageId: 'email-1' }));
    vi.spyOn(channelProviderModule, 'getChannelProvider').mockImplementation((ch) => (ch === 'WEB_PUSH' ? webPush : ch === 'EMAIL' ? email : null));

    const args = await baseArgs();
    const outcome = await NotificationDispatchService.dispatchStep(
      args.workflowInstanceId, args.companyId, args.eventType, args.aggregateType, args.aggregateId,
      args.priority, args.quietHoursBehavior, buildStep({ fallbackMode: 'PARALLEL' }), args.context, args.title, args.message, args.actionUrl,
    );

    expect(outcome.anySent).toBe(true);
    expect(webPush.calls).toBe(1);
    expect(email.calls).toBe(1);
  });

  it('an already-SENT delivery attempt is never re-sent on a repeated dispatch call for the same step/recipient/channel', async () => {
    const email = fakeProvider('EMAIL', () => ({ status: 'SENT', providerMessageId: 'email-1' }));
    vi.spyOn(channelProviderModule, 'getChannelProvider').mockImplementation((ch) => (ch === 'EMAIL' ? email : null));

    const args = await baseArgs();
    const step = buildStep({ channels: ['EMAIL'], fallbackMode: 'PARALLEL' });

    await NotificationDispatchService.dispatchStep(
      args.workflowInstanceId, args.companyId, args.eventType, args.aggregateType, args.aggregateId,
      args.priority, args.quietHoursBehavior, step, args.context, args.title, args.message, args.actionUrl,
    );
    await NotificationDispatchService.dispatchStep(
      args.workflowInstanceId, args.companyId, args.eventType, args.aggregateType, args.aggregateId,
      args.priority, args.quietHoursBehavior, step, args.context, args.title, args.message, args.actionUrl,
    );

    expect(email.calls).toBe(1);
    const attempts = await prisma.notificationDeliveryAttempt.findMany({ where: { companyId: company.id, workflowInstanceId: args.workflowInstanceId } });
    expect(attempts).toHaveLength(1);
  });

  it('a permanent failure that reaches maxRetries stops retrying and marks NOTIFICATION_MAX_RETRIES_EXCEEDED', { timeout: 20000 }, async () => {
    const email = fakeProvider('EMAIL', () => ({ status: 'FAILED', failureReasonCode: 'NOTIFICATION_PROVIDER_UNAVAILABLE', isTransient: true }));
    vi.spyOn(channelProviderModule, 'getChannelProvider').mockImplementation((ch) => (ch === 'EMAIL' ? email : null));

    const args = await baseArgs();
    const step = buildStep({ channels: ['EMAIL'], fallbackMode: 'PARALLEL' });

    // config.notificationEngine.maxRetries defaults to 3 — dispatch repeatedly until it stops incrementing.
    for (let i = 0; i < 5; i += 1) {
      await NotificationDispatchService.dispatchStep(
        args.workflowInstanceId, args.companyId, args.eventType, args.aggregateType, args.aggregateId,
        args.priority, args.quietHoursBehavior, step, args.context, args.title, args.message, args.actionUrl,
      );
    }

    const attempt = await prisma.notificationDeliveryAttempt.findFirst({ where: { companyId: company.id, workflowInstanceId: args.workflowInstanceId } });
    expect(attempt?.status).toBe('FAILED');
    expect(attempt?.failureReasonCode).toBe('NOTIFICATION_MAX_RETRIES_EXCEEDED');
  });

  it('an unresolved recipient (skipReasonCode) is recorded as a SKIPPED delivery attempt, never silently dropped', async () => {
    const args = await baseArgs();
    const step = buildStep({ recipientType: 'DIRECT_MANAGER' as any, recipientReference: null, channels: ['EMAIL'] });

    const outcome = await NotificationDispatchService.dispatchStep(
      args.workflowInstanceId, args.companyId, args.eventType, args.aggregateType, args.aggregateId,
      args.priority, args.quietHoursBehavior, step, { employeeId: 'non-existent' }, args.title, args.message, args.actionUrl,
    );

    expect(outcome.anySent).toBe(false);
    const attempts = await prisma.notificationDeliveryAttempt.findMany({ where: { companyId: company.id, workflowInstanceId: args.workflowInstanceId } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('SKIPPED');
    expect(attempts[0].failureReasonCode).toBe('NOTIFICATION_RECIPIENT_NOT_FOUND');
  });
});

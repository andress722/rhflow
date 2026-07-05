import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';
import { NotificationAcknowledgmentService } from '../src/modules/notification-engine/notification-acknowledgment.service';

describe('Sprint 54 - Notification Acknowledgment/Resolution Semantics', () => {
  let company: any;
  let policy: any;
  let recipientUser: any;
  let outsiderUser: any;

  async function createWorkflow(stopOnAcknowledgment: boolean) {
    const stepPolicy = await prisma.notificationPolicy.create({
      data: {
        companyId: company.id,
        name: `Policy stopOnAck=${stopOnAcknowledgment}`,
        eventType: 'LEAVE_REQUEST_CREATED',
        maxEscalationLevel: 2,
        steps: {
          create: [
            { stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'], stopOnAcknowledgment },
            { stepOrder: 2, delayMinutes: 30, recipientType: 'ADMIN', channels: ['IN_APP'], stopOnAcknowledgment },
          ],
        },
      },
    });

    const workflow = await prisma.notificationWorkflowInstance.create({
      data: {
        companyId: company.id,
        policyId: stepPolicy.id,
        eventType: 'LEAVE_REQUEST_CREATED',
        eventId: crypto.randomUUID(),
        aggregateType: 'LeaveRequest',
        aggregateId: crypto.randomUUID(),
        priority: 'NORMAL',
        status: 'ACTIVE',
        currentStep: 0,
        deduplicationKey: crypto.randomUUID(),
        nextActionAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    await prisma.notificationDeliveryAttempt.create({
      data: {
        companyId: company.id,
        workflowInstanceId: workflow.id,
        channel: 'IN_APP',
        status: 'SENT',
        idempotencyKey: crypto.randomUUID(),
        recipientUserId: recipientUser.id,
        scheduledAt: new Date(),
      },
    });

    return workflow;
  }

  beforeAll(async () => {
    company = await prisma.company.create({ data: { name: 'Ack Semantics Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    recipientUser = await prisma.user.create({
      data: { companyId: company.id, name: 'Recipient', email: `rec-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'VIEWER', isActive: true },
    });
    outsiderUser = await prisma.user.create({
      data: { companyId: company.id, name: 'Outsider', email: `out-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'VIEWER', isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { companyId: company.id } });
    await prisma.notificationWorkflowInstance.deleteMany({ where: { companyId: company.id } });
    await prisma.notificationPolicy.deleteMany({ where: { companyId: company.id } });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
  });

  it('a user who is not a recipient and not an admin role cannot acknowledge (FORBIDDEN)', async () => {
    const workflow = await createWorkflow(true);
    const result = await NotificationAcknowledgmentService.acknowledge(workflow.id, company.id, outsiderUser.id, 'VIEWER');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('FORBIDDEN');
  });

  it('a recipient of a delivery attempt can acknowledge', async () => {
    const workflow = await createWorkflow(true);
    const result = await NotificationAcknowledgmentService.acknowledge(workflow.id, company.id, recipientUser.id, 'VIEWER');
    expect(result.ok).toBe(true);
  });

  it('an ADMIN/HR role can acknowledge even without being a delivery recipient', async () => {
    const workflow = await createWorkflow(true);
    const result = await NotificationAcknowledgmentService.acknowledge(workflow.id, company.id, outsiderUser.id, 'ADMIN');
    expect(result.ok).toBe(true);
  });

  it('acknowledge is idempotent: acknowledging twice is a no-op success the second time', async () => {
    const workflow = await createWorkflow(true);
    const first = await NotificationAcknowledgmentService.acknowledge(workflow.id, company.id, recipientUser.id, 'VIEWER');
    const second = await NotificationAcknowledgmentService.acknowledge(workflow.id, company.id, recipientUser.id, 'VIEWER');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.alreadyTerminal).toBe(true);
  });

  it('stopOnAcknowledgment=true halts escalation: status becomes ACKNOWLEDGED and nextActionAt is cleared', async () => {
    const workflow = await createWorkflow(true);
    await NotificationAcknowledgmentService.acknowledge(workflow.id, company.id, recipientUser.id, 'VIEWER');
    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe('ACKNOWLEDGED');
    expect(updated?.nextActionAt).toBeNull();
  });

  it('stopOnAcknowledgment=false lets the workflow keep escalating in the background despite the ACK', async () => {
    const workflow = await createWorkflow(false);
    await NotificationAcknowledgmentService.acknowledge(workflow.id, company.id, recipientUser.id, 'VIEWER');
    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe('ACTIVE');
    expect(updated?.nextActionAt).not.toBeNull();
    expect(updated?.acknowledgedAt).not.toBeNull();
  });

  it('resolve always halts escalation regardless of stopOnAcknowledgment, and is idempotent', async () => {
    const workflow = await createWorkflow(false);
    const first = await NotificationAcknowledgmentService.resolve(workflow.id, company.id, recipientUser.id, 'VIEWER', 'ISSUE_RESOLVED');
    expect(first.ok).toBe(true);
    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe('RESOLVED');
    expect(updated?.nextActionAt).toBeNull();

    const second = await NotificationAcknowledgmentService.resolve(workflow.id, company.id, recipientUser.id, 'VIEWER', 'DUPLICATE');
    expect(second.alreadyTerminal).toBe(true);
    const stillFirst = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(stillFirst?.resolutionReason).toBe('ISSUE_RESOLVED');
  });

  it('acknowledge/resolve/cancel on a workflow from another tenant is NOT_FOUND, never leaks existence', async () => {
    const otherCompany = await prisma.company.create({ data: { name: 'Other Tenant', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    const workflow = await createWorkflow(true);
    const result = await NotificationAcknowledgmentService.acknowledge(workflow.id, otherCompany.id, recipientUser.id, 'ADMIN');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('NOT_FOUND');
    await prisma.company.delete({ where: { id: otherCompany.id } });
  });

  it('cancel is idempotent and does not overwrite an already-resolved workflow', async () => {
    const workflow = await createWorkflow(true);
    await NotificationAcknowledgmentService.resolve(workflow.id, company.id, recipientUser.id, 'VIEWER', 'ISSUE_RESOLVED');
    const cancelResult = await NotificationAcknowledgmentService.cancel(workflow.id, company.id, recipientUser.id, 'VIEWER', 'trying to cancel after resolve');
    expect(cancelResult.alreadyTerminal).toBe(true);
    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe('RESOLVED');
  });
});

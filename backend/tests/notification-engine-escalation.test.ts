import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';
import { NotificationEscalationService } from '../src/modules/notification-engine/notification-escalation.service';
import { NotificationPolicyService } from '../src/modules/notification-engine/notification-policy.service';

describe('Sprint 54 - Notification Escalation Scheduler', () => {
  let company: any;
  let adminUser: any;

  beforeAll(async () => {
    company = await prisma.company.create({ data: { name: 'Escalation Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    adminUser = await prisma.user.create({
      data: { companyId: company.id, name: 'Admin', email: `esc-admin-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'ADMIN', isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
  });

  afterEach(async () => {
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { companyId: company.id } });
    await prisma.notificationWorkflowInstance.deleteMany({ where: { companyId: company.id } });
    await prisma.notificationPolicy.deleteMany({ where: { companyId: company.id } });
  });

  async function createPolicyAndWorkflow(maxEscalationLevel: number, stepCount: number) {
    const steps = Array.from({ length: stepCount }, (_, i) => ({
      stepOrder: i + 1,
      delayMinutes: 15,
      recipientType: 'ADMIN' as const,
      channels: ['IN_APP'],
    }));

    const policy = await prisma.notificationPolicy.create({
      data: {
        companyId: company.id,
        name: 'Escalation policy',
        eventType: 'WORKFORCE_RISK_HIGH',
        maxEscalationLevel,
        steps: { create: steps },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    const workflow = await prisma.notificationWorkflowInstance.create({
      data: {
        companyId: company.id,
        policyId: policy.id,
        eventType: 'WORKFORCE_RISK_HIGH',
        eventId: crypto.randomUUID(),
        aggregateType: 'Employee',
        aggregateId: crypto.randomUUID(),
        priority: 'HIGH',
        status: 'ACTIVE',
        currentStep: 0,
        deduplicationKey: crypto.randomUUID(),
        nextActionAt: new Date(Date.now() - 1000), // already due
        payload: { context: {}, title: 'Risk', message: 'msg', actionUrl: null } as any,
      },
    });

    return { policy, workflow };
  }

  it('executeStep advances currentStep and schedules nextActionAt when more steps remain', async () => {
    const { policy, workflow } = await createPolicyAndWorkflow(3, 3);
    const steps = policy.steps.map(NotificationPolicyService.toStepView);

    await NotificationEscalationService.executeStep(workflow as any, steps, policy.quietHoursBehavior, policy.maxEscalationLevel);

    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.currentStep).toBe(1);
    expect(updated?.status).toBe('ACTIVE');
    expect(updated?.nextActionAt).not.toBeNull();
  });

  it('executeStep marks the workflow EXHAUSTED once maxEscalationLevel is reached with no further steps', async () => {
    const { policy, workflow } = await createPolicyAndWorkflow(1, 1);
    const steps = policy.steps.map(NotificationPolicyService.toStepView);

    await NotificationEscalationService.executeStep(workflow as any, steps, policy.quietHoursBehavior, policy.maxEscalationLevel);

    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe('EXHAUSTED');
    expect(updated?.nextActionAt).toBeNull();
  });

  it('scanAndAdvance picks up due ACTIVE workflows and advances them', async () => {
    const { workflow } = await createPolicyAndWorkflow(2, 2);

    const result = await NotificationEscalationService.scanAndAdvance();

    expect(result.evaluated).toBeGreaterThanOrEqual(1);
    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.currentStep).toBe(1);
  });

  it('scanAndAdvance cancels a workflow whose policy has since been disabled', async () => {
    const { policy, workflow } = await createPolicyAndWorkflow(2, 2);
    await prisma.notificationPolicy.update({ where: { id: policy.id }, data: { isActive: false } });

    const result = await NotificationEscalationService.scanAndAdvance();

    expect(result.cancelled).toBeGreaterThanOrEqual(1);
    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe('CANCELLED');
  });

  it('scanAndAdvance does not touch a workflow whose nextActionAt is still in the future', async () => {
    const { workflow } = await createPolicyAndWorkflow(2, 2);
    await prisma.notificationWorkflowInstance.update({
      where: { id: workflow.id },
      data: { nextActionAt: new Date(Date.now() + 60 * 60_000) },
    });

    await NotificationEscalationService.scanAndAdvance();

    const updated = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
    expect(updated?.currentStep).toBe(0);
    expect(updated?.status).toBe('ACTIVE');
  });
});

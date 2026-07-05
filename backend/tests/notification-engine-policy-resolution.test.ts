import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';
import { NotificationPolicyService } from '../src/modules/notification-engine/notification-policy.service';
import { NotificationEngineService } from '../src/modules/notification-engine/notification-engine.service';

describe('Sprint 54 - Notification Policy Resolution', () => {
  let company: any;

  beforeAll(async () => {
    company = await prisma.company.create({ data: { name: 'Policy Resolution Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
  });

  afterAll(async () => {
    await prisma.company.delete({ where: { id: company.id } }).catch(() => undefined);
  });

  afterEach(async () => {
    await prisma.notificationWorkflowInstance.deleteMany({ where: { companyId: company.id } });
    await prisma.notificationPolicy.deleteMany({ where: { companyId: company.id } });
  });

  it('findActivePolicy returns null when no policy is configured for the eventType', async () => {
    const policy = await NotificationPolicyService.findActivePolicy(company.id, 'LEAVE_REQUEST_CREATED');
    expect(policy).toBeNull();
  });

  it('findActivePolicy ignores a policy that has isActive=false', async () => {
    await prisma.notificationPolicy.create({
      data: {
        companyId: company.id,
        name: 'Disabled policy',
        eventType: 'LEAVE_REQUEST_CREATED',
        isActive: false,
        steps: { create: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] },
      },
    });

    const policy = await NotificationPolicyService.findActivePolicy(company.id, 'LEAVE_REQUEST_CREATED');
    expect(policy).toBeNull();
  });

  it('processDomainEvent returns NO_ACTIVE_POLICY when nothing is configured, without creating a workflow', async () => {
    const result = await NotificationEngineService.processDomainEvent({
      companyId: company.id,
      eventType: 'LEAVE_REQUEST_CREATED',
      eventId: crypto.randomUUID(),
      aggregateType: 'LeaveRequest',
      aggregateId: crypto.randomUUID(),
      priority: 'NORMAL',
      context: {},
      defaultTitle: 'x',
      defaultMessage: 'y',
    });

    expect(result.reason).toBe('NO_ACTIVE_POLICY');
    expect(result.workflowId).toBeNull();
    const count = await prisma.notificationWorkflowInstance.count({ where: { companyId: company.id } });
    expect(count).toBe(0);
  });

  it('processDomainEvent rejects an event not classified ACTIVE in the catalog', async () => {
    const result = await NotificationEngineService.processDomainEvent({
      companyId: company.id,
      eventType: 'EMPLOYEE_MISSED_CLOCK_IN', // RESERVED in EVENT_CATALOG
      eventId: crypto.randomUUID(),
      aggregateType: 'RemoteCheckin',
      aggregateId: crypto.randomUUID(),
      priority: 'NORMAL',
      context: {},
      defaultTitle: 'x',
      defaultMessage: 'y',
    });

    expect(result.reason).toBe('EVENT_NOT_ACTIVE');
    expect(result.workflowId).toBeNull();
  });

  it('validateSteps flags a SPECIFIC_USER recipientReference belonging to another company', async () => {
    const otherCompany = await prisma.company.create({ data: { name: 'Other Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    const otherUser = await prisma.user.create({
      data: { companyId: otherCompany.id, name: 'Foreign User', email: `foreign-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'ADMIN', isActive: true },
    });

    const errors = await NotificationPolicyService.validateSteps(company.id, [
      { stepOrder: 1, delayMinutes: 0, recipientType: 'SPECIFIC_USER', recipientReference: otherUser.id, channels: ['IN_APP'], fallbackMode: 'PARALLEL', stopOnAcknowledgment: true, stopOnResolution: true },
    ]);

    expect(errors.length).toBeGreaterThan(0);
    await prisma.user.delete({ where: { id: otherUser.id } });
    await prisma.company.delete({ where: { id: otherCompany.id } });
  });

  it('validateSteps flags an invalid role for a ROLE recipient', async () => {
    const errors = await NotificationPolicyService.validateSteps(company.id, [
      { stepOrder: 1, delayMinutes: 0, recipientType: 'ROLE', recipientReference: 'NOT_A_REAL_ROLE', channels: ['IN_APP'], fallbackMode: 'PARALLEL', stopOnAcknowledgment: true, stopOnResolution: true },
    ]);
    expect(errors.some((e) => e.includes('inválida'))).toBe(true);
  });
});

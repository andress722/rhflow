import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';
import { NotificationEngineService } from '../src/modules/notification-engine/notification-engine.service';

describe('Sprint 54 - Notification Engine Deduplication', () => {
  let companyA: any;
  let companyB: any;

  beforeAll(async () => {
    companyA = await prisma.company.create({ data: { name: 'Dedup Co A', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    companyB = await prisma.company.create({ data: { name: 'Dedup Co B', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });

    for (const companyId of [companyA.id, companyB.id]) {
      await prisma.notificationPolicy.create({
        data: {
          companyId,
          name: 'Leave created',
          eventType: 'LEAVE_REQUEST_CREATED',
          steps: { create: [{ stepOrder: 1, delayMinutes: 5, recipientType: 'ADMIN', channels: ['IN_APP'] }] },
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.notificationWorkflowInstance.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.notificationPolicy.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
  });

  afterEach(async () => {
    await prisma.notificationWorkflowInstance.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  });

  function buildInput(companyId: string, aggregateId: string) {
    return {
      companyId,
      eventType: 'LEAVE_REQUEST_CREATED',
      eventId: crypto.randomUUID(),
      aggregateType: 'LeaveRequest',
      aggregateId,
      priority: 'NORMAL' as const,
      context: {},
      defaultTitle: 'title',
      defaultMessage: 'message',
    };
  }

  it('a second call for the same aggregate returns the same workflowId with reason DEDUPLICATED', async () => {
    const aggregateId = crypto.randomUUID();
    const first = await NotificationEngineService.processDomainEvent(buildInput(companyA.id, aggregateId));
    const second = await NotificationEngineService.processDomainEvent(buildInput(companyA.id, aggregateId));

    expect(first.workflowId).toBeTruthy();
    expect(second.workflowId).toBe(first.workflowId);
    expect(second.reason).toBe('DEDUPLICATED');

    const count = await prisma.notificationWorkflowInstance.count({
      where: { companyId: companyA.id, aggregateId },
    });
    expect(count).toBe(1);
  });

  it('concurrent simultaneous calls for the same aggregate never create two workflows (race condition safety)', async () => {
    const aggregateId = crypto.randomUUID();
    const input = buildInput(companyA.id, aggregateId);

    const results = await Promise.all([
      NotificationEngineService.processDomainEvent(input),
      NotificationEngineService.processDomainEvent(input),
      NotificationEngineService.processDomainEvent(input),
      NotificationEngineService.processDomainEvent(input),
      NotificationEngineService.processDomainEvent(input),
    ]);

    const uniqueWorkflowIds = new Set(results.map((r) => r.workflowId).filter(Boolean));
    expect(uniqueWorkflowIds.size).toBe(1);

    const count = await prisma.notificationWorkflowInstance.count({
      where: { companyId: companyA.id, aggregateId },
    });
    expect(count).toBe(1);
  });

  it('the same aggregateId in a different tenant creates an independent workflow (dedup key is tenant-scoped, not global)', async () => {
    const aggregateId = crypto.randomUUID();
    const resultA = await NotificationEngineService.processDomainEvent(buildInput(companyA.id, aggregateId));
    const resultB = await NotificationEngineService.processDomainEvent(buildInput(companyB.id, aggregateId));

    expect(resultA.workflowId).toBeTruthy();
    expect(resultB.workflowId).toBeTruthy();
    expect(resultA.workflowId).not.toBe(resultB.workflowId);
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import crypto from 'crypto';

describe('Sprint 54 - Notification Policies & Workflows API (tenant isolation, dry-run safety)', () => {
  let app: any;
  let companyA: any;
  let companyB: any;
  let adminA: any;
  let adminAToken: string;
  let viewerA: any;
  let viewerAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    companyA = await prisma.company.create({ data: { name: 'API Tenant A', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    companyB = await prisma.company.create({ data: { name: 'API Tenant B', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });

    adminA = await prisma.user.create({
      data: { companyId: companyA.id, name: 'Admin A', email: `api-admin-a-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'ADMIN', isActive: true },
    });
    adminAToken = app.jwt.sign({ sub: adminA.id, companyId: companyA.id, role: adminA.role, name: adminA.name });

    viewerA = await prisma.user.create({
      data: { companyId: companyA.id, name: 'Viewer A', email: `api-viewer-a-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'VIEWER', isActive: true },
    });
    viewerAToken = app.jwt.sign({ sub: viewerA.id, companyId: companyA.id, role: viewerA.role, name: viewerA.name });

    const adminB = await prisma.user.create({
      data: { companyId: companyB.id, name: 'Admin B', email: `api-admin-b-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'ADMIN', isActive: true },
    });
    adminBToken = app.jwt.sign({ sub: adminB.id, companyId: companyB.id, role: adminB.role, name: adminB.name });
  });

  afterAll(async () => {
    await app.close();
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.notificationWorkflowInstance.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.notificationPolicy.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
  });

  afterEach(async () => {
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.notificationWorkflowInstance.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.notificationPolicy.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  });

  it('event-catalog lists only ACTIVE eventTypes, never ACTIVE_LEGACY or RESERVED', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/notification-policies/event-catalog', headers: { Authorization: `Bearer ${adminAToken}` } });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.every((e: any) => e.status === 'ACTIVE')).toBe(true);
    expect(body.data.map((e: any) => e.eventType)).toContain('LEAVE_REQUEST_CREATED');
    expect(body.data.map((e: any) => e.eventType)).not.toContain('EMPLOYEE_MISSED_CLOCK_IN');
  });

  it('a VIEWER role cannot create a notification policy (403)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notification-policies',
      headers: { Authorization: `Bearer ${viewerAToken}` },
      payload: { name: 'Test Policy', eventType: 'LEAVE_REQUEST_CREATED', steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] },
    });
    expect(response.statusCode).toBe(403);
  });

  it('ADMIN can create a policy, and rejects duplicate stepOrder values (400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notification-policies',
      headers: { Authorization: `Bearer ${adminAToken}` },
      payload: {
        name: 'Bad Policy',
        eventType: 'LEAVE_REQUEST_CREATED',
        steps: [
          { stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] },
          { stepOrder: 1, delayMinutes: 10, recipientType: 'HR', channels: ['IN_APP'] },
        ],
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('a company B admin cannot read, update, or delete a policy belonging to company A (404, not leaking existence)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/notification-policies',
      headers: { Authorization: `Bearer ${adminAToken}` },
      payload: { name: 'Tenant A Policy', eventType: 'LEAVE_REQUEST_CREATED', steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] },
    });
    const policyId = JSON.parse(created.body).data.id;

    const getResponse = await app.inject({ method: 'GET', url: `/api/notification-policies/${policyId}`, headers: { Authorization: `Bearer ${adminBToken}` } });
    expect(getResponse.statusCode).toBe(404);

    const patchResponse = await app.inject({ method: 'PATCH', url: `/api/notification-policies/${policyId}`, headers: { Authorization: `Bearer ${adminBToken}` }, payload: { name: 'Hijacked' } });
    expect(patchResponse.statusCode).toBe(404);

    const deleteResponse = await app.inject({ method: 'DELETE', url: `/api/notification-policies/${policyId}`, headers: { Authorization: `Bearer ${adminBToken}` } });
    expect(deleteResponse.statusCode).toBe(404);

    // Confirm it's untouched from tenant A's perspective.
    const stillActive = await prisma.notificationPolicy.findUnique({ where: { id: policyId } });
    expect(stillActive?.isActive).toBe(true);
    expect(stillActive?.name).toBe('Tenant A Policy');
  });

  it('DELETE soft-disables a policy (isActive=false), never a hard delete', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/notification-policies',
      headers: { Authorization: `Bearer ${adminAToken}` },
      payload: { name: 'To Disable', eventType: 'CALENDAR_SYNC_FAILED', steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] },
    });
    const policyId = JSON.parse(created.body).data.id;

    const deleteResponse = await app.inject({ method: 'DELETE', url: `/api/notification-policies/${policyId}`, headers: { Authorization: `Bearer ${adminAToken}` } });
    expect(deleteResponse.statusCode).toBe(200);

    const row = await prisma.notificationPolicy.findUnique({ where: { id: policyId } });
    expect(row).not.toBeNull();
    expect(row?.isActive).toBe(false);
  });

  it('the /test dry-run endpoint requires dryRun=true and never creates a workflow', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/notification-policies',
      headers: { Authorization: `Bearer ${adminAToken}` },
      payload: { name: 'Dry Run Policy', eventType: 'LEAVE_REQUEST_CREATED', steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] },
    });
    const policyId = JSON.parse(created.body).data.id;

    const missingDryRun = await app.inject({ method: 'POST', url: `/api/notification-policies/${policyId}/test`, headers: { Authorization: `Bearer ${adminAToken}` }, payload: {} });
    expect(missingDryRun.statusCode).toBe(400);

    const dryRun = await app.inject({ method: 'POST', url: `/api/notification-policies/${policyId}/test`, headers: { Authorization: `Bearer ${adminAToken}` }, payload: { dryRun: true, context: { employeeId: 'does-not-exist' } } });
    expect(dryRun.statusCode).toBe(200);
    const body = JSON.parse(dryRun.body);
    expect(body.data.dryRun).toBe(true);
    expect(body.data.steps[0].resolvedRecipientCount).toBeGreaterThanOrEqual(1); // ADMIN role resolves to adminA

    const workflowCount = await prisma.notificationWorkflowInstance.count({ where: { companyId: companyA.id } });
    expect(workflowCount).toBe(0);
  });

  it('the /test dry-run endpoint warns when the eventType is not ACTIVE in the catalog', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/notification-policies',
      headers: { Authorization: `Bearer ${adminAToken}` },
      payload: { name: 'Reserved Event Policy', eventType: 'INTEGRATION_FAILURE', steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] },
    });
    const policyId = JSON.parse(created.body).data.id;

    const dryRun = await app.inject({ method: 'POST', url: `/api/notification-policies/${policyId}/test`, headers: { Authorization: `Bearer ${adminAToken}` }, payload: { dryRun: true } });
    const body = JSON.parse(dryRun.body);
    expect(body.data.warnings.some((w: string) => w.includes('RESERVED'))).toBe(true);
  });

  it('a company B user cannot list, read, or act on a workflow belonging to company A', async () => {
    const policy = await prisma.notificationPolicy.create({
      data: { companyId: companyA.id, name: 'Wf Policy', eventType: 'LEAVE_REQUEST_CREATED', steps: { create: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] } },
    });
    const workflow = await prisma.notificationWorkflowInstance.create({
      data: {
        companyId: companyA.id,
        policyId: policy.id,
        eventType: 'LEAVE_REQUEST_CREATED',
        eventId: crypto.randomUUID(),
        aggregateType: 'LeaveRequest',
        aggregateId: crypto.randomUUID(),
        priority: 'NORMAL',
        status: 'ACTIVE',
        deduplicationKey: crypto.randomUUID(),
      },
    });

    const getResponse = await app.inject({ method: 'GET', url: `/api/notifications/workflows/${workflow.id}`, headers: { Authorization: `Bearer ${adminBToken}` } });
    expect(getResponse.statusCode).toBe(404);

    const ackResponse = await app.inject({ method: 'POST', url: `/api/notifications/workflows/${workflow.id}/acknowledge`, headers: { Authorization: `Bearer ${adminBToken}` }, payload: {} });
    expect(ackResponse.statusCode).toBe(404);

    const listResponse = await app.inject({ method: 'GET', url: '/api/notifications/workflows', headers: { Authorization: `Bearer ${adminBToken}` } });
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data.items.find((w: any) => w.id === workflow.id)).toBeUndefined();
  });

  it('resolve requires a valid reasonCode enum value (400 on garbage input)', async () => {
    const policy = await prisma.notificationPolicy.create({
      data: { companyId: companyA.id, name: 'Wf Policy 2', eventType: 'LEAVE_REQUEST_CREATED', steps: { create: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] } },
    });
    const workflow = await prisma.notificationWorkflowInstance.create({
      data: {
        companyId: companyA.id,
        policyId: policy.id,
        eventType: 'LEAVE_REQUEST_CREATED',
        eventId: crypto.randomUUID(),
        aggregateType: 'LeaveRequest',
        aggregateId: crypto.randomUUID(),
        priority: 'NORMAL',
        status: 'ACTIVE',
        deduplicationKey: crypto.randomUUID(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/notifications/workflows/${workflow.id}/resolve`,
      headers: { Authorization: `Bearer ${adminAToken}` },
      payload: { reasonCode: 'NOT_A_REAL_REASON' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('quiet hours: GET returns null before any config exists, PUT upserts it, and it is tenant-isolated', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/notification-quiet-hours', headers: { Authorization: `Bearer ${adminAToken}` } });
    expect(before.statusCode).toBe(200);
    expect(JSON.parse(before.body).data).toBeNull();

    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/notification-quiet-hours',
      headers: { Authorization: `Bearer ${adminAToken}` },
      payload: { timezone: 'America/Sao_Paulo', startTime: '22:00', endTime: '07:00', daysOfWeek: [] },
    });
    expect(invalid.statusCode).toBe(400);

    const put = await app.inject({
      method: 'PUT',
      url: '/api/notification-quiet-hours',
      headers: { Authorization: `Bearer ${adminAToken}` },
      payload: { timezone: 'America/Sao_Paulo', startTime: '22:00', endTime: '07:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
    });
    expect(put.statusCode).toBe(200);

    const otherTenantView = await app.inject({ method: 'GET', url: '/api/notification-quiet-hours', headers: { Authorization: `Bearer ${adminBToken}` } });
    expect(JSON.parse(otherTenantView.body).data).toBeNull();

    await prisma.notificationQuietHours.deleteMany({ where: { companyId: companyA.id } });
  });
});

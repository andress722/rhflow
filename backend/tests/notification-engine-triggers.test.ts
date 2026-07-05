import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import crypto from 'crypto';

async function waitFor(check: () => Promise<boolean>, timeoutMs = 3000, intervalMs = 50): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('waitFor: condition not met within timeout');
}

describe('Sprint 54 - Real trigger wiring (proves ACTIVE events are actually fired from their origin routes)', () => {
  let app: any;
  let company: any;
  let admin: any;
  let adminToken: string;
  let employee: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    company = await prisma.company.create({ data: { name: 'Trigger Wiring Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    admin = await prisma.user.create({
      data: { companyId: company.id, name: 'Trigger Admin', email: `trigger-admin-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'ADMIN', isActive: true },
    });
    adminToken = app.jwt.sign({ sub: admin.id, companyId: company.id, role: admin.role, name: admin.name });

    employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        fullName: 'Trigger Employee',
        cpf: crypto.randomUUID().replace(/-/g, '').slice(0, 11),
        whatsapp: '5511900000099',
        status: 'ACTIVE',
      },
    });

    // Conservative default policies so the ACTIVE events actually produce a workflow.
    for (const eventType of ['LEAVE_REQUEST_CREATED', 'LEAVE_REQUEST_APPROVED', 'LEAVE_REQUEST_REJECTED', 'OFFLINE_EVENT_REJECTED', 'OFFLINE_SYNC_CONFLICT']) {
      await prisma.notificationPolicy.create({
        data: {
          companyId: company.id,
          name: `${eventType} default`,
          eventType,
          steps: { create: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }] },
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { companyId: company.id } });
    await prisma.notificationWorkflowInstance.deleteMany({ where: { companyId: company.id } });
    await prisma.notificationPolicy.deleteMany({ where: { companyId: company.id } });
    await prisma.leaveRequest.deleteMany({ where: { companyId: company.id } });
    await prisma.absenceRecord.deleteMany({ where: { companyId: company.id } });
    await prisma.employee.deleteMany({ where: { companyId: company.id } });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
  });

  it('POST /leaves fires a LEAVE_REQUEST_CREATED workflow', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/leaves',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        employeeId: employee.id,
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        type: 'FERIAS',
      },
    });
    expect(response.statusCode).toBe(201);
    const leaveId = JSON.parse(response.body).data.id;

    await waitFor(async () => {
      const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { companyId: company.id, eventType: 'LEAVE_REQUEST_CREATED', aggregateId: leaveId } });
      return Boolean(workflow);
    });

    const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { companyId: company.id, eventType: 'LEAVE_REQUEST_CREATED', aggregateId: leaveId } });
    expect(workflow).not.toBeNull();
  });

  it('POST /leaves/:id/approve fires a LEAVE_REQUEST_APPROVED workflow', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/leaves',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        employeeId: employee.id,
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        type: 'FERIAS',
      },
    });
    const leaveId = JSON.parse(createResponse.body).data.id;

    const approveResponse = await app.inject({
      method: 'POST',
      url: `/api/leaves/${leaveId}/approve`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(approveResponse.statusCode).toBe(200);

    await waitFor(async () => {
      const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { companyId: company.id, eventType: 'LEAVE_REQUEST_APPROVED', aggregateId: leaveId } });
      return Boolean(workflow);
    });

    const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { companyId: company.id, eventType: 'LEAVE_REQUEST_APPROVED', aggregateId: leaveId } });
    expect(workflow).not.toBeNull();
  });

  it('POST /leaves/:id/reject fires a LEAVE_REQUEST_REJECTED workflow', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/leaves',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        employeeId: employee.id,
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        type: 'FERIAS',
      },
    });
    const leaveId = JSON.parse(createResponse.body).data.id;

    const rejectResponse = await app.inject({
      method: 'POST',
      url: `/api/leaves/${leaveId}/reject`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Período de alta demanda operacional.' },
    });
    expect(rejectResponse.statusCode).toBe(200);

    await waitFor(async () => {
      const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { companyId: company.id, eventType: 'LEAVE_REQUEST_REJECTED', aggregateId: leaveId } });
      return Boolean(workflow);
    });

    const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { companyId: company.id, eventType: 'LEAVE_REQUEST_REJECTED', aggregateId: leaveId } });
    expect(workflow).not.toBeNull();
    expect((workflow?.payload as any)?.context?.reason).toContain('alta demanda');
  });
});

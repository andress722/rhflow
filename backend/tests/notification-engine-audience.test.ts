import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';
import { NotificationAudienceService } from '../src/modules/notification-engine/notification-audience.service';

describe('Sprint 54 - Notification Audience Resolution', () => {
  let companyA: any;
  let companyB: any;
  let manager: any;
  let employee: any;
  let hrUser: any;
  let adminUser: any;
  let foreignUser: any;

  beforeAll(async () => {
    companyA = await prisma.company.create({ data: { name: 'Audience Co A', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    companyB = await prisma.company.create({ data: { name: 'Audience Co B', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });

    manager = await prisma.user.create({
      data: { companyId: companyA.id, name: 'Manager A', email: `mgr-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'MANAGER', isActive: true },
    });
    hrUser = await prisma.user.create({
      data: { companyId: companyA.id, name: 'HR A', email: `hr-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'HR', isActive: true },
    });
    adminUser = await prisma.user.create({
      data: { companyId: companyA.id, name: 'Admin A', email: `admin-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'ADMIN', isActive: true },
    });
    foreignUser = await prisma.user.create({
      data: { companyId: companyB.id, name: 'Foreign Admin', email: `foreign-admin-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'ADMIN', isActive: true },
    });

    const employeeEmail = `emp-${crypto.randomUUID()}@x.com`;
    employee = await prisma.employee.create({
      data: {
        companyId: companyA.id,
        fullName: 'Employee A',
        cpf: crypto.randomUUID().replace(/-/g, '').slice(0, 11),
        whatsapp: '5511900000000',
        email: employeeEmail,
        status: 'ACTIVE',
        managerUserId: manager.id,
      },
    });
    // Link a User to this Employee via matching email, mirroring the Employee Portal convention.
    await prisma.user.create({
      data: { companyId: companyA.id, name: 'Employee A (portal user)', email: employeeEmail, passwordHash: 'h', role: 'VIEWER', isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.employee.deleteMany({ where: { companyId: companyA.id } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
  });

  it('resolves EMPLOYEE by matching linked User email within the same tenant', async () => {
    const result = await NotificationAudienceService.resolve(companyA.id, 'EMPLOYEE', null, { employeeId: employee.id });
    expect(result).toHaveLength(1);
    expect(result[0].recipientEmployeeId).toBe(employee.id);
    expect(result[0].recipientUserId).toBeTruthy();
    expect(result[0].skipReasonCode).toBeUndefined();
  });

  it('resolves DIRECT_MANAGER via Employee.managerUserId', async () => {
    const result = await NotificationAudienceService.resolve(companyA.id, 'DIRECT_MANAGER', null, { employeeId: employee.id });
    expect(result).toHaveLength(1);
    expect(result[0].recipientUserId).toBe(manager.id);
  });

  it('returns skipReasonCode when the employee has no manager assigned', async () => {
    const orphanEmployee = await prisma.employee.create({
      data: { companyId: companyA.id, fullName: 'Orphan', cpf: crypto.randomUUID().replace(/-/g, '').slice(0, 11), whatsapp: '5511900000001', status: 'ACTIVE' },
    });
    const result = await NotificationAudienceService.resolve(companyA.id, 'DIRECT_MANAGER', null, { employeeId: orphanEmployee.id });
    expect(result[0].skipReasonCode).toBe('NOTIFICATION_RECIPIENT_NOT_FOUND');
    await prisma.employee.delete({ where: { id: orphanEmployee.id } });
  });

  it('resolves HR and ADMIN by role, scoped to the tenant', async () => {
    const hrResult = await NotificationAudienceService.resolve(companyA.id, 'HR', null, {});
    expect(hrResult.map((r) => r.recipientUserId)).toContain(hrUser.id);

    const adminResult = await NotificationAudienceService.resolve(companyA.id, 'ADMIN', null, {});
    expect(adminResult.map((r) => r.recipientUserId)).toContain(adminUser.id);
    expect(adminResult.map((r) => r.recipientUserId)).not.toContain(foreignUser.id);
  });

  it('never resolves a SPECIFIC_USER recipient from a different tenant', async () => {
    const result = await NotificationAudienceService.resolve(companyA.id, 'SPECIFIC_USER', foreignUser.id, {});
    expect(result[0].skipReasonCode).toBe('NOTIFICATION_RECIPIENT_NOT_FOUND');
  });

  it('resolves SPECIFIC_USER correctly when the user belongs to the same tenant', async () => {
    const result = await NotificationAudienceService.resolve(companyA.id, 'SPECIFIC_USER', adminUser.id, {});
    expect(result[0].recipientUserId).toBe(adminUser.id);
  });

  it('resolves REQUESTER and EVENT_ACTOR from context, and flags missing context', async () => {
    const withContext = await NotificationAudienceService.resolve(companyA.id, 'REQUESTER', null, { requesterUserId: manager.id });
    expect(withContext[0].recipientUserId).toBe(manager.id);

    const withoutContext = await NotificationAudienceService.resolve(companyA.id, 'EVENT_ACTOR', null, {});
    expect(withoutContext[0].skipReasonCode).toBe('NOTIFICATION_RECIPIENT_NOT_FOUND');
  });

  it('ROLE recipient with no matching users returns skipReasonCode, never throws', async () => {
    const result = await NotificationAudienceService.resolve(companyA.id, 'ROLE', 'VIEWER'.length ? 'MANAGER' : 'MANAGER', {});
    // MANAGER exists (manager user), so instead test a role with zero matches: use a fresh company with no MANAGER users.
    const emptyCo = await prisma.company.create({ data: { name: 'Empty Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    const empty = await NotificationAudienceService.resolve(emptyCo.id, 'ROLE', 'MANAGER', {});
    expect(empty[0].skipReasonCode).toBe('NOTIFICATION_RECIPIENT_NOT_FOUND');
    await prisma.company.delete({ where: { id: emptyCo.id } });
    expect(result.length).toBeGreaterThan(0);
  });
});

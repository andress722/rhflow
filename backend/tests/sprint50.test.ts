import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import crypto from 'crypto';

describe('PresençaFlow RH - Sprint 50 (Live Feed, PWA, Hour Bank, Leave Requests) Integration Tests', () => {
  let app: any;
  let company: any;
  let adminUser: any;
  let adminToken: any;
  let employee: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create seed data
    company = await prisma.company.create({
      data: {
        name: 'Sprint 50 Test Company',
        legalName: 'Sprint 50 Test LTDA',
        cnpj: '12345678000199',
      },
    });

    const userEmail = `admin-${crypto.randomUUID()}@sprint50.com`;
    adminUser = await prisma.user.create({
      data: {
        companyId: company.id,
        name: 'Sprint 50 Admin',
        email: userEmail,
        passwordHash: 'dummy-hash',
        role: 'ADMIN',
        isActive: true,
      },
    });

    adminToken = app.jwt.sign({
      sub: adminUser.id,
      companyId: company.id,
      role: adminUser.role,
      name: adminUser.name,
    });

    employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        fullName: 'João da Silva Sprint 50',
        cpf: '12345678901',
        whatsapp: '5511999999999',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    // Cleanup safely
    if (employee?.id) {
      await prisma.hourBankTransaction.deleteMany({ where: { employeeId: employee.id } });
      await prisma.hourBankBalance.deleteMany({ where: { employeeId: employee.id } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: employee.id } });
      await prisma.absenceRecord.deleteMany({ where: { employeeId: employee.id } });
    }
    if (adminUser?.id) {
      await prisma.webPushSubscription.deleteMany({ where: { userId: adminUser.id } });
    }
    if (employee?.id) {
      await prisma.employee.delete({ where: { id: employee.id } });
    }
    if (adminUser?.id) {
      await prisma.user.delete({ where: { id: adminUser.id } });
    }
    if (company?.id) {
      await prisma.company.delete({ where: { id: company.id } });
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Web Push Subscription', () => {
    it('should subscribe successfully to Web Push notifications', async () => {
      const payload = {
        endpoint: `https://updates.push.com/v2/sub-${crypto.randomUUID()}`,
        keys: {
          p256dh: 'BN123_abc_key',
          auth: 'auth_token_sig',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/notifications/web-push/subscribe',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.endpoint).toBe(payload.endpoint);
    });
  });

  describe('2. Hour Bank CLT', () => {
    it('should initially return zero balance and no transactions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/hour-bank/${employee.id}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.balance).toBe(0);
      expect(body.data.transactions).toHaveLength(0);
    });

    it('should allow manual credit transaction by admin', async () => {
      const payload = {
        amountMinutes: 120, // 2 hours credit
        description: 'Compensação por viagem a trabalho',
      };

      const response = await app.inject({
        method: 'POST',
        url: `/api/hour-bank/${employee.id}/transactions`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.amountMinutes).toBe(120);

      // Verify balance updated
      const balanceRes = await app.inject({
        method: 'GET',
        url: `/api/hour-bank/${employee.id}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const balanceBody = JSON.parse(balanceRes.body);
      expect(balanceBody.data.balance).toBe(120);
      expect(balanceBody.data.transactions).toHaveLength(1);
    });
  });

  describe('3. Leave Requests workflow', () => {
    it('should create leave request as pending', async () => {
      const payload = {
        employeeId: employee.id,
        startDate: new Date('2026-08-01T00:00:00.000Z').toISOString(),
        endDate: new Date('2026-08-15T00:00:00.000Z').toISOString(),
        type: 'FERIAS',
        justification: 'Férias regulamentares coletivas',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/leaves',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('PENDING');

      // Approve leaves and check dynamic AbsenceRecord creation
      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/leaves/${body.data.id}/approve`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(approveRes.statusCode).toBe(200);
      const approveBody = JSON.parse(approveRes.body);
      expect(approveBody.success).toBe(true);
      expect(approveBody.data.status).toBe('APPROVED');

      // Verify AbsenceRecord exists in DB
      const absenceRecord = await prisma.absenceRecord.findFirst({
        where: { employeeId: employee.id, companyId: company.id },
      });
      expect(absenceRecord).not.toBeNull();
      expect(absenceRecord?.days).toBe(14); // 15 - 1 days
    });
  });
});

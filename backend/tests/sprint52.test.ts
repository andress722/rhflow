import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import crypto from 'crypto';
import { presenceEmitter } from '../src/routes/presence';
import { getLocalDateInSaoPaulo } from '../src/services/remote-checkin.service';

describe('PresençaFlow RH - Sprint 52 Gap Closure & Security Hardening Integration Tests', () => {
  let app: any;
  let companyA: any;
  let companyB: any;
  
  let adminA: any;
  let adminB: any;
  let adminAToken: string;
  let adminBToken: string;

  let employeeA: any;
  let employeeAToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // 1. Create two separate companies (Tenants)
    companyA = await prisma.company.create({
      data: { name: 'Company Tenant A', cnpj: '11111111000111' }
    });
    companyB = await prisma.company.create({
      data: { name: 'Company Tenant B', cnpj: '22222222000122' }
    });

    // 2. Create admin for company A
    const adminAEmail = `admin-a-${crypto.randomUUID()}@tenant.com`;
    adminA = await prisma.user.create({
      data: {
        companyId: companyA.id,
        name: 'Admin A',
        email: adminAEmail,
        passwordHash: 'hash',
        role: 'ADMIN',
        isActive: true
      }
    });
    adminAToken = app.jwt.sign({
      sub: adminA.id,
      companyId: companyA.id,
      role: adminA.role,
      name: adminA.name
    });

    // 3. Create admin for company B
    const adminBEmail = `admin-b-${crypto.randomUUID()}@tenant.com`;
    adminB = await prisma.user.create({
      data: {
        companyId: companyB.id,
        name: 'Admin B',
        email: adminBEmail,
        passwordHash: 'hash',
        role: 'ADMIN',
        isActive: true
      }
    });
    adminBToken = app.jwt.sign({
      sub: adminB.id,
      companyId: companyB.id,
      role: adminB.role,
      name: adminB.name
    });

    // 4. Create employee for company A
    const empEmail = `emp-a-${crypto.randomUUID()}@tenant.com`;
    employeeA = await prisma.employee.create({
      data: {
        companyId: companyA.id,
        fullName: 'Employee Tenant A',
        cpf: '33344455566',
        whatsapp: '5511999999999',
        email: empEmail,
        status: 'ACTIVE'
      }
    });
    const empUser = await prisma.user.create({
      data: {
        companyId: companyA.id,
        name: 'Employee A User',
        email: empEmail,
        passwordHash: 'hash',
        role: 'VIEWER',
        isActive: true
      }
    });
    employeeAToken = app.jwt.sign({
      sub: empUser.id,
      companyId: companyA.id,
      role: empUser.role,
      name: empUser.name,
      email: empEmail
    });
  });

  afterAll(async () => {
    // Cleanup records
    await prisma.hourBankTransaction.deleteMany({
      where: { employee: { companyId: { in: [companyA.id, companyB.id] } } }
    });
    await prisma.hourBankBalance.deleteMany({
      where: { employee: { companyId: { in: [companyA.id, companyB.id] } } }
    });
    await prisma.absenceRecord.deleteMany({
      where: { employee: { companyId: { in: [companyA.id, companyB.id] } } }
    });
    await prisma.leaveRequest.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } }
    });
    await prisma.remoteCheckin.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } }
    });
    await prisma.employee.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } }
    });
    await prisma.user.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } }
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyA.id, companyB.id] } }
    });

    await app.close();
  });

  describe('1. Cross-Tenant Isolation checks (Security/IDOR Hardening)', () => {
    it('should block employee portal access to other tenants data', async () => {
      // Logged as employee of Company A, should only get their own data, not company B
      const response = await app.inject({
        method: 'GET',
        url: '/api/employee-portal/me',
        headers: { Authorization: `Bearer ${employeeAToken}` }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.companyId).toBe(companyA.id);
    });

    it('should prevent cross-tenant leave request approvals', async () => {
      // Create a leave request in company A
      const leave = await prisma.leaveRequest.create({
        data: {
          companyId: companyA.id,
          employeeId: employeeA.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          type: 'FERIAS',
          status: 'PENDING'
        }
      });

      // Try to approve it using company B's admin token
      const response = await app.inject({
        method: 'POST',
        url: `/api/leaves/${leave.id}/approve`,
        headers: { Authorization: `Bearer ${adminBToken}` }
      });

      // Must return 404 since company B has no visibility of company A's leave request
      expect(response.statusCode).toBe(404);
      
      const checkInDb = await prisma.leaveRequest.findUnique({ where: { id: leave.id } });
      expect(checkInDb?.status).toBe('PENDING');
    });

    it('should reject batch validate mapping if managerUserId belongs to another tenant', async () => {
      const payload = {
        rows: [
          { 'Nome': 'João', 'CPF': '12345678901', 'Whatsapp': '5511999999999', 'Gestor': adminB.id } // adminB belongs to company B
        ],
        mappings: {
          name: 'Nome',
          cpf: 'CPF',
          whatsapp: 'Whatsapp',
          managerUserId: 'Gestor'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/employees/batch-validate',
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.errors[0].message).toContain('gestor informado é inválido ou pertence a outra empresa');
    });
  });

  describe('2. Replay & Sequence Offline checks', () => {
    it('should reject offline check-ins with duplicated offlineEventId', async () => {
      const checkin = await prisma.remoteCheckin.create({
        data: {
          companyId: companyA.id,
          employeeId: employeeA.id,
          checkinDate: getLocalDateInSaoPaulo(),
          status: 'PENDING'
        }
      });

      const uniqueEventId = crypto.randomUUID();

      // First response simulation succeeds
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/presence/${checkin.id}/simulate-response`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          message: '1. Sim, iniciei agora',
          offlineEventId: uniqueEventId
        }
      });
      expect(res1.statusCode).toBe(200);

      // Replay request using same offlineEventId fails with 409 Conflict
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/presence/${checkin.id}/simulate-response`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          message: '1. Sim, iniciei agora',
          offlineEventId: uniqueEventId
        }
      });
      expect(res2.statusCode).toBe(409);
    });

    it('should validate chronological order sequencing and payload integrity', async () => {
      const yesterday = new Date(getLocalDateInSaoPaulo().getTime() - 86400000);
      const checkin = await prisma.remoteCheckin.create({
        data: {
          companyId: companyA.id,
          employeeId: employeeA.id,
          checkinDate: yesterday,
          status: 'PENDING'
        }
      });

      // Sincronizar seq: 2 sem ter a seq: 1 falha com 400 Out of Order
      const res = await app.inject({
        method: 'POST',
        url: `/api/presence/${checkin.id}/simulate-response`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          message: '1. Sim',
          offlineEventId: crypto.randomUUID(),
          offlineSequence: 2,
          previousEventHash: 'some_hash_abc_123',
          payloadHash: 'invalid_or_altered_payload_hash',
          clientCapturedAt: yesterday.toISOString()
        }
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('3. Idempotency Leave Request approvals', () => {
    it('should create exactly one AbsenceRecord and sync to calendar once', async () => {
      const leave = await prisma.leaveRequest.create({
        data: {
          companyId: companyA.id,
          employeeId: employeeA.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          type: 'FERIAS',
          status: 'PENDING'
        }
      });

      // 1. First approval succeeds
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/leaves/${leave.id}/approve`,
        headers: { Authorization: `Bearer ${adminAToken}` }
      });
      expect(res1.statusCode).toBe(200);

      // 2. Second approval attempt returns error and does NOT duplicate record
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/leaves/${leave.id}/approve`,
        headers: { Authorization: `Bearer ${adminAToken}` }
      });
      expect(res2.statusCode).toBe(400);

      const count = await prisma.absenceRecord.count({
        where: { leaveRequestId: leave.id }
      });
      expect(count).toBe(1);
    });
  });

  describe('4. Hour Bank transactional auditing', () => {
    it('should save previousBalance, resultingBalance, and actorId during manual adjustments', async () => {
      // Initial balance is 0
      const res = await app.inject({
        method: 'POST',
        url: `/api/hour-bank/${employeeA.id}/transactions`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          amountMinutes: 120,
          description: 'Ajuste de horas extras'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);

      const tx = await prisma.hourBankTransaction.findUnique({
        where: { id: body.data.id }
      });

      expect(tx).toBeDefined();
      expect(tx?.actorId).toBe(adminA.id);
      expect(tx?.previousBalance).toBe(0);
      expect(tx?.resultingBalance).toBe(120);
    });
  });
});

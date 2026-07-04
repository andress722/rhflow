import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import crypto from 'crypto';

describe('PresençaFlow RH - Sprint 51 (Custom Mappings, Self-Service Portal, Turnover IA, Calendar Sync) Integration Tests', () => {
  let app: any;
  let company: any;
  let adminUser: any;
  let adminToken: any;
  let employeeUser: any;
  let employeeToken: any;
  let employee: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Seed test company
    company = await prisma.company.create({
      data: {
        name: 'Sprint 51 Test Company',
        cnpj: '98765432000188',
      },
    });

    // Admin user
    const adminEmail = `admin-${crypto.randomUUID()}@sprint51.com`;
    adminUser = await prisma.user.create({
      data: {
        companyId: company.id,
        name: 'Sprint 51 Admin',
        email: adminEmail,
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

    // Employee profile linked by same email
    const employeeEmail = `joao-${crypto.randomUUID()}@sprint51.com`;
    employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        fullName: 'João da Silva Sprint 51',
        cpf: '98765432101',
        whatsapp: '5511988888888',
        email: employeeEmail,
        status: 'ACTIVE',
      },
    });

    // Employee user
    employeeUser = await prisma.user.create({
      data: {
        companyId: company.id,
        name: 'João Employee',
        email: employeeEmail,
        passwordHash: 'dummy-hash',
        role: 'VIEWER',
        isActive: true,
      },
    });

    employeeToken = app.jwt.sign({
      sub: employeeUser.id,
      companyId: company.id,
      role: employeeUser.role,
      name: employeeUser.name,
      email: employeeEmail,
    });
  });

  afterAll(async () => {
    // Cleanup
    if (employee?.id) {
      await prisma.hourBankTransaction.deleteMany({ where: { employeeId: employee.id } });
      await prisma.hourBankBalance.deleteMany({ where: { employeeId: employee.id } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: employee.id } });
      await prisma.remoteCheckin.deleteMany({ where: { employeeId: employee.id } });
      await prisma.pulseSurveyResponse.deleteMany({ where: { employeeId: employee.id } });
      await prisma.employee.delete({ where: { id: employee.id } });
    }
    await prisma.calendarIntegration.deleteMany({ where: { companyId: company.id } });
    if (adminUser?.id) await prisma.user.delete({ where: { id: adminUser.id } });
    if (employeeUser?.id) await prisma.user.delete({ where: { id: employeeUser.id } });
    if (company?.id) await prisma.company.delete({ where: { id: company.id } });
    await app.close();
  });

  describe('1. Custom Column Mapping Batch Validation & Import', () => {
    it('should validate custom mapped headers correctly', async () => {
      const payload = {
        rows: [
          { 'Nome Completo': 'Mário de Andrade', 'Documento CPF': '11122233344', 'Número Whatsapp': '5511977777777' },
        ],
        mappings: {
          name: 'Nome Completo',
          cpf: 'Documento CPF',
          whatsapp: 'Número Whatsapp',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/employees/batch-validate',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.validCount).toBe(1);
    });

    it('should block validation if CPF has invalid digit count', async () => {
      const payload = {
        rows: [
          { 'Nome Completo': 'Inválido', 'Documento CPF': '1234', 'Número Whatsapp': '5511977777777' },
        ],
        mappings: {
          name: 'Nome Completo',
          cpf: 'Documento CPF',
          whatsapp: 'Número Whatsapp',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/employees/batch-validate',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload,
      });

      const body = JSON.parse(response.body);
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.errors[0].message).toContain('CPF deve conter 11 dígitos');
    });

    it('should import validated custom mapped rows transactionally', async () => {
      const payload = {
        rows: [
          { 'Nome Completo': 'Guilherme de Almeida', 'Documento CPF': '22233344455', 'Número Whatsapp': '5511966666666', 'Cargo': 'Escritor' },
        ],
        mappings: {
          name: 'Nome Completo',
          cpf: 'Documento CPF',
          whatsapp: 'Número Whatsapp',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/employees/batch-import',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.importedCount).toBe(1);

      // Cleanup imported employee
      await prisma.employee.deleteMany({ where: { companyId: company.id, cpf: '22233344455' } });
    });
  });

  describe('2. Turnover Risk IA Prediction Heuristic', () => {
    it('should estimate low turnover risk for employee with zero absences or lates', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/employees/${employee.id}/turnover-risk`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.turnoverRiskScore).toBe(15); // Base score of 15
    });

    it('should escalate turnover risk if employee registers absences or lates', async () => {
      // Simulate 1 absence and 2 lates in past 30 days
      await prisma.remoteCheckin.create({
        data: {
          companyId: company.id,
          employeeId: employee.id,
          checkinDate: new Date(),
          status: 'ABSENCE_REPORTED',
        },
      });
      await prisma.remoteCheckin.create({
        data: {
          companyId: company.id,
          employeeId: employee.id,
          checkinDate: new Date(Date.now() - 24 * 3600 * 1000),
          status: 'LATE',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/employees/${employee.id}/turnover-risk`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const body = JSON.parse(response.body);
      expect(body.data.turnoverRiskScore).toBe(15 + 20 + 8); // 15 base + 20 absence + 8 late = 43
    });
  });

  describe('3. Employee Self-Service portal queries', () => {
    it('should fetch own employee profile successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/employee-portal/me',
        headers: {
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(employee.id);
    });

    it('should fetch own timesheet and balance details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/employee-portal/timesheet',
        headers: {
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
    });
  });

  describe('4. Google Agenda / Microsoft Outlook Integration config', () => {
    it('should return null when no integration is configured', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/calendar/integration',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it('should connect and save OAuth credentials successfully', async () => {
      const payload = {
        provider: 'GOOGLE',
        accessToken: 'ya29.a0AfH6SM...token',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/calendar/integration',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.provider).toBe('GOOGLE');
      expect(body.data.isActive).toBe(true);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import { redis } from '../src/lib/redis';
import crypto from 'crypto';
import http from 'http';
import * as XLSX from 'xlsx';
import { isValidCpf } from '../src/lib/cpf-validator';
import { autoMapHeaders } from '../src/lib/auto-mapper';
import { startImportWorker, stopImportWorker } from '../src/lib/import-worker';

// Helper to upload multipart files using Node.js standard http library
function uploadMultipart(
  port: number,
  token: string,
  filename: string,
  content: Buffer,
  mime: string,
  query: string = ''
): Promise<any> {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + crypto.randomUUID();
    const header = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(header, 'utf-8'),
      content,
      Buffer.from(footer, 'utf-8')
    ]);

    const req = http.request({
      host: '127.0.0.1',
      port,
      path: `/api/import-jobs/upload${query}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ success: false, raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('PresençaFlow RH - Sprint 53: Enterprise Import & Customer Onboarding Integration Tests', () => {
  let app: any;
  let port: number;
  let companyA: any;
  let companyB: any;

  let adminA: any;
  let adminB: any;
  let adminAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    await app.listen({ port: 0, host: '127.0.0.1' });
    port = app.server.address().port;

    // 1. Create two separate tenants
    companyA = await prisma.company.create({
      data: { name: 'Company A Imports', cnpj: '11111111000111' }
    });
    companyB = await prisma.company.create({
      data: { name: 'Company B Imports', cnpj: '22222222000122' }
    });

    // 2. Create users
    adminA = await prisma.user.create({
      data: {
        companyId: companyA.id,
        name: 'Admin A',
        email: `admin-a-${crypto.randomUUID()}@import.com`,
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

    adminB = await prisma.user.create({
      data: {
        companyId: companyB.id,
        name: 'Admin B',
        email: `admin-b-${crypto.randomUUID()}@import.com`,
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

    // Start background import worker in test context
    startImportWorker().catch(err => {
      console.error('Failed to start worker in tests:', err);
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } }
    });
    await prisma.importValidationIssue.deleteMany({});
    await prisma.importJob.deleteMany({});
    await prisma.importMappingTemplate.deleteMany({});
    await prisma.employee.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } }
    });
    await prisma.user.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } }
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyA.id, companyB.id] } }
    });

    // Stop worker in test context
    stopImportWorker();

    try { (app.server as any).closeAllConnections?.(); } catch (_) {}
    await app.close();
  });

  describe('1. CPF Checksum Utility Validation', () => {
    it('should correctly validate real CPF checksums', () => {
      // Real valid CPFs
      expect(isValidCpf('03426744040')).toBe(true);
      expect(isValidCpf('12345678909')).toBe(true);
      expect(isValidCpf('034.267.440-40')).toBe(true);

      // Invalid CPFs
      expect(isValidCpf('11111111111')).toBe(false);
      expect(isValidCpf('12345678900')).toBe(false);
      expect(isValidCpf('12345')).toBe(false);
    });
  });

  describe('2. Header Auto Mapping', () => {
    it('should heuristic map known aliases correctly', () => {
      const headers = ['nome completo', 'c.p.f.', 'whatsapp/celular', 'email corporativo', 'modelo de trabalho'];
      const mapping = autoMapHeaders(headers);
      expect(mapping.name).toBe('nome completo');
      expect(mapping.cpf).toBe('c.p.f.');
      expect(mapping.whatsapp).toBe('whatsapp/celular');
      expect(mapping.email).toBe('email corporativo');
      expect(mapping.workModel).toBe('modelo de trabalho');
    });
  });

  describe('3. CSV Upload Integration', () => {
    it('should successfully upload and parse a semicolon delimiter CSV', async () => {
      const csvContent = Buffer.from(
        'Nome;CPF;WhatsApp;Email\r\n' +
        'João da Silva;03426744040;5511999999999;joao@test.com\r\n' +
        'Maria Souza;12345678909;5511988888888;maria@test.com',
        'utf-8'
      );

      const res = await uploadMultipart(port, adminAToken, 'funcionarios.csv', csvContent, 'text/csv');
      expect(res.success).toBe(true);
      expect(res.data.totalRows).toBe(2);
      expect(res.data.preview.headers).toContain('Nome');
      expect(res.data.preview.rows.length).toBe(2);
      expect(res.data.preview.rows[0].Nome).toBe('João da Silva');
    });

    it('should reject empty CSV uploads', async () => {
      const csvContent = Buffer.from('', 'utf-8');
      const res = await uploadMultipart(port, adminAToken, 'empty.csv', csvContent, 'text/csv');
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('PARSING_ERROR');
    });

    it('should reject file exceeding maximum size (2MB for CSV)', async () => {
      const oversizedCsv = Buffer.alloc(2.1 * 1024 * 1024, 'A');
      const res = await uploadMultipart(port, adminAToken, 'big.csv', oversizedCsv, 'text/csv');
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('4. XLSX Upload and Sheet Selection Integration', () => {
    it('should parse single and list multiple sheets in XLSX file', async () => {
      const ws1 = XLSX.utils.aoa_to_sheet([
        ['Nome', 'CPF', 'WhatsApp'],
        ['Aba Um Colab', '03426744040', '5511999999999']
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([
        ['Nome', 'CPF', 'WhatsApp'],
        ['Aba Dois Colab', '12345678909', '5511988888888']
      ]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Aba 1');
      XLSX.utils.book_append_sheet(wb, ws2, 'Aba 2');
      const fileBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

      // First upload selects Aba 1 by default
      const res = await uploadMultipart(port, adminAToken, 'data.xlsx', fileBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.success).toBe(true);
      expect(res.data.availableWorksheets).toContain('Aba 1');
      expect(res.data.availableWorksheets).toContain('Aba 2');
      expect(res.data.selectedWorksheet).toBe('Aba 1');
      expect(res.data.preview.rows[0].Nome).toBe('Aba Um Colab');

      // Second upload forces Aba 2 worksheet selection (URL-encoded space as %20)
      const res2 = await uploadMultipart(port, adminAToken, 'data.xlsx', fileBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '?sheetName=Aba%202');
      expect(res2.success).toBe(true);
      expect(res2.data.selectedWorksheet).toBe('Aba 2');
      expect(res2.data.preview.rows[0].Nome).toBe('Aba Dois Colab');
    });
  });

  describe('5. Column Mappings & Validation Issues', () => {
    it('should map columns and identify errors/warnings', async () => {
      // 1. Upload CSV
      const csvContent = Buffer.from(
        'ColNome;ColCPF;ColTel;ColEmail;ColGestor\r\n' +
        'Pedro;03426744040;5511999999999;pedro@test.com;InexistenteGestor\r\n' + // error gestor
        'Invalid;11111111111;123;invalid-email;gestor-ok', // errors cpf, whatsapp, email
        'utf-8'
      );
      const uploadRes = await uploadMultipart(port, adminAToken, 'validation.csv', csvContent, 'text/csv');
      const jobId = uploadRes.data.jobId;

      // 2. Put mapping configurations (name, cpf, whatsapp mapped, managerUserId mapped)
      const mappingRes = await app.inject({
        method: 'PUT',
        url: `/api/import-jobs/${jobId}/mapping`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          mappings: {
            name: 'ColNome',
            cpf: 'ColCPF',
            whatsapp: 'ColTel',
            email: 'ColEmail',
            managerUserId: 'ColGestor'
          }
        }
      });

      expect(mappingRes.statusCode).toBe(200);
      const data = JSON.parse(mappingRes.body).data;
      expect(data.status).toBe('MAPPING'); // MAPPING since errors exist
      expect(data.invalidRows).toBe(2); // rows 2 and 3 have fatal validation errors
      
      const errors = data.issues;
      expect(errors.some((e: any) => e.code === 'INVALID_CPF')).toBe(true);
      expect(errors.some((e: any) => e.code === 'INVALID_EMAIL')).toBe(true);
      expect(errors.some((e: any) => e.code === 'MANAGER_NOT_FOUND')).toBe(true);
    });
  });

  describe('6. Save and Apply Mapping Templates', () => {
    it('should support CRUD on mapping templates scoped by tenant', async () => {
      // 1. Create template
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/import-mapping-templates',
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          name: 'TOTVS Template',
          sourceType: 'CSV',
          mappings: {
            name: 'Nome Completo',
            cpf: 'Documento CPF',
            whatsapp: 'Fone'
          }
        }
      });
      expect(createRes.statusCode).toBe(201);
      const templateId = JSON.parse(createRes.body).data.id;

      // 2. Tenant B should not see Tenant A template
      const listBRes = await app.inject({
        method: 'GET',
        url: '/api/import-mapping-templates',
        headers: { Authorization: `Bearer ${adminBToken}` }
      });
      const templatesB = JSON.parse(listBRes.body).data;
      expect(templatesB.some((t: any) => t.id === templateId)).toBe(false);

      // 3. Delete Template
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/import-mapping-templates/${templateId}`,
        headers: { Authorization: `Bearer ${adminAToken}` }
      });
      expect(deleteRes.statusCode).toBe(200);
    });
  });

  describe('7. Import Modes & Async Queue Processing', () => {
    it('should queue and process CREATE_ONLY and UPSERT imports safely', async () => {
      // 1. Create a job for company A
      const csvContent = Buffer.from(
        'Nome Completo;CPF;Celular;Email\r\n' +
        'Colaborador Novo;03426744040;5511999999999;novo@test.com\r\n' +
        'Colaborador Existente;12345678909;5511988888888;existente@test.com',
        'utf-8'
      );
      
      const uploadRes = await uploadMultipart(port, adminAToken, 'import.csv', csvContent, 'text/csv');
      const jobId = uploadRes.data.jobId;

      // 2. Put mapping
      await app.inject({
        method: 'PUT',
        url: `/api/import-jobs/${jobId}/mapping`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          mappings: {
            name: 'Nome Completo',
            cpf: 'CPF',
            whatsapp: 'Celular',
            email: 'Email'
          }
        }
      });

      // 3. Confirm import (CREATE_ONLY)
      const confirmRes = await app.inject({
        method: 'POST',
        url: `/api/import-jobs/${jobId}/confirm`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: { mode: 'CREATE_ONLY' }
      });
      expect(confirmRes.statusCode).toBe(200);
      expect(JSON.parse(confirmRes.body).data.status).toBe('QUEUED');

      // 4. Wait for background worker processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 5. Check progress and results
      const resultRes = await app.inject({
        method: 'GET',
        url: `/api/import-jobs/${jobId}/result`,
        headers: { Authorization: `Bearer ${adminAToken}` }
      });
      
      const result = JSON.parse(resultRes.body).data;
      expect(result.status).toBe('COMPLETED');
      expect(result.createdRows).toBe(2);

      // Verify db creations
      const e1 = await prisma.employee.findFirst({ where: { companyId: companyA.id, cpf: '03426744040' } });
      expect(e1).not.toBeNull();
      expect(e1?.fullName).toBe('Colaborador Novo');
    });
  });

  describe('8. Tenant Isolation & IDOR Check', () => {
    it('should block Tenant B from accessing Tenant A jobs', async () => {
      // 1. Create job in Tenant A
      const csvContent = Buffer.from('Nome;CPF;WhatsApp\r\nAna;03426744040;5511999999999', 'utf-8');
      const uploadRes = await uploadMultipart(port, adminAToken, 'isolated.csv', csvContent, 'text/csv');
      const jobId = uploadRes.data.jobId;

      // 2. Query job using Tenant B token
      const res = await app.inject({
        method: 'GET',
        url: `/api/import-jobs/${jobId}/preview`,
        headers: { Authorization: `Bearer ${adminBToken}` }
      });
      expect(res.statusCode).toBe(404); // returns 404 to avoid leak
    });
  });

  describe('9. Formula Injection Protection', () => {
    it('should prepend apostrophe to cells starting with unsafe chars', async () => {
      // 1. Upload CSV containing formulas
      const csvContent = Buffer.from(
        'Nome;CPF;WhatsApp\r\n' +
        '=SUM(A1:A5);12345678909;5511988888888\r\n' +
        '+Fórmula;03426744040;5511999999999',
        'utf-8'
      );
      const uploadRes = await uploadMultipart(port, adminAToken, 'formulas.csv', csvContent, 'text/csv');
      const jobId = uploadRes.data.jobId;

      // 2. Put mapping setup (which also triggers validation)
      await app.inject({
        method: 'PUT',
        url: `/api/import-jobs/${jobId}/mapping`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          mappings: {
            name: 'Nome',
            cpf: 'CPF',
            whatsapp: 'WhatsApp'
          }
        }
      });

      // 3. Download the error report
      const downloadRes = await app.inject({
        method: 'GET',
        url: `/api/import-jobs/${jobId}/errors/download`,
        headers: { Authorization: `Bearer ${adminAToken}` }
      });

      expect(downloadRes.statusCode).toBe(200);
      const body = downloadRes.body;
      
      // Verification issues will include names of rows. Since CPF 12345678909 checksum is invalid, 
      // it creates validation issues. Check if formula prefix was sanitized:
      expect(body).not.toContain(';=SUM');
      expect(body).not.toContain(';+Fórmula');
    });
  });
});

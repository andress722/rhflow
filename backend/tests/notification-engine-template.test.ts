import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';
import { renderTemplate, NotificationTemplateService } from '../src/modules/notification-engine/notification-template.service';

describe('Sprint 54 - Notification Template Rendering (allowlist, no injection)', () => {
  it('substitutes only allowlisted variables for the given eventType', () => {
    const result = renderTemplate('LEAVE_REQUEST_CREATED', 'Olá {{managerName}}, {{employeeName}} solicitou férias de {{startDate}} a {{endDate}}.', {
      employeeName: 'Maria Silva',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      managerName: 'João',
    });
    // managerName is NOT in LEAVE_REQUEST_CREATED's allowlist -> stripped to empty string.
    expect(result).toBe('Olá , Maria Silva solicitou férias de 2026-08-01 a 2026-08-10.');
  });

  it('strips a variable not in ANY allowlist entry, even if present in the provided variables object', () => {
    const result = renderTemplate('CALENDAR_SYNC_FAILED', 'Provider: {{provider}}. Secret: {{apiSecretKey}}.', {
      provider: 'GOOGLE',
      apiSecretKey: 'super-secret-value',
    });
    expect(result).toBe('Provider: GOOGLE. Secret: .');
    expect(result).not.toContain('super-secret-value');
  });

  it('unknown eventType falls back to the default allowlist, still excluding non-listed variables', () => {
    const result = renderTemplate('SOME_UNKNOWN_EVENT', '{{employeeName}} - {{ssn}}', { employeeName: 'X', ssn: '123-45-6789' });
    expect(result).toBe('X - ');
  });

  it('does not evaluate expressions or traverse object prototypes — pure string substitution only', () => {
    const malicious = '{{constructor}}{{__proto__}}{{employeeName}}';
    const result = renderTemplate('WORKFORCE_RISK_HIGH', malicious, { employeeName: 'Safe Name', constructor: 'ignored', __proto__: 'ignored' } as any);
    expect(result).toBe('Safe Name');
  });

  it('a template with no matching placeholders returns the template unchanged', () => {
    const result = renderTemplate('LEAVE_REQUEST_APPROVED', 'Static message with no variables.', {});
    expect(result).toBe('Static message with no variables.');
  });

  it('null/undefined values for an allowlisted variable render as empty string, not "null"/"undefined"', () => {
    const result = renderTemplate('LEAVE_REQUEST_APPROVED', 'Start: {{startDate}}', { startDate: null });
    expect(result).toBe('Start: ');
  });
});

describe('Sprint 54 - Notification Template Resolution (tenant vs global)', () => {
  let company: any;

  beforeAll(async () => {
    company = await prisma.company.create({ data: { name: 'Template Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
  });

  afterAll(async () => {
    await prisma.company.delete({ where: { id: company.id } });
  });

  afterEach(async () => {
    await prisma.notificationMessageTemplate.deleteMany({ where: { OR: [{ companyId: company.id }, { companyId: null, eventType: 'LEAVE_REQUEST_CREATED', channel: 'IN_APP' }] } });
  });

  it('prefers a tenant-specific template over a global one for the same (eventType, channel)', async () => {
    await prisma.notificationMessageTemplate.create({
      data: { companyId: null, eventType: 'LEAVE_REQUEST_CREATED', channel: 'IN_APP', name: 'Global default', subjectTemplate: 'Global subject', bodyTemplate: 'Global body' },
    });
    await prisma.notificationMessageTemplate.create({
      data: { companyId: company.id, eventType: 'LEAVE_REQUEST_CREATED', channel: 'IN_APP', name: 'Tenant override', subjectTemplate: 'Tenant subject', bodyTemplate: 'Tenant body' },
    });

    const resolved = await NotificationTemplateService.resolve(company.id, 'LEAVE_REQUEST_CREATED', 'IN_APP');
    expect(resolved?.bodyTemplate).toBe('Tenant body');
  });

  it('falls back to the global template when no tenant-specific one exists', async () => {
    await prisma.notificationMessageTemplate.create({
      data: { companyId: null, eventType: 'LEAVE_REQUEST_CREATED', channel: 'IN_APP', name: 'Global default', subjectTemplate: 'Global subject', bodyTemplate: 'Global body' },
    });

    const resolved = await NotificationTemplateService.resolve(company.id, 'LEAVE_REQUEST_CREATED', 'IN_APP');
    expect(resolved?.bodyTemplate).toBe('Global body');
  });

  it('never resolves a template belonging to a different tenant', async () => {
    const otherCompany = await prisma.company.create({ data: { name: 'Other Template Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    await prisma.notificationMessageTemplate.create({
      data: { companyId: otherCompany.id, eventType: 'LEAVE_REQUEST_CREATED', channel: 'IN_APP', name: 'Foreign', subjectTemplate: 'x', bodyTemplate: 'y' },
    });

    const resolved = await NotificationTemplateService.resolve(company.id, 'LEAVE_REQUEST_CREATED', 'IN_APP');
    expect(resolved).toBeNull();
    await prisma.notificationMessageTemplate.deleteMany({ where: { companyId: otherCompany.id } });
    await prisma.company.delete({ where: { id: otherCompany.id } });
  });
});

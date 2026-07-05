import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';
import { buildApp } from '../src/app';
import crypto from 'crypto';
import { CalendarSyncService } from '../src/services/calendar-sync.service';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

describe('PresençaFlow RH - Sprint 52.1 Calendar Integration (OAuth, refresh, retry, idempotency)', () => {
  let app: any;
  let companyA: any;
  let companyB: any;
  let adminA: any;
  let adminAToken: string;
  let employeeA: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    companyA = await prisma.company.create({ data: { name: 'Calendar Tenant A', cnpj: '99988877000111' } });
    companyB = await prisma.company.create({ data: { name: 'Calendar Tenant B', cnpj: '99988877000122' } });

    const adminAEmail = `cal-admin-a-${crypto.randomUUID()}@tenant.com`;
    adminA = await prisma.user.create({
      data: { companyId: companyA.id, name: 'Admin A', email: adminAEmail, passwordHash: 'hash', role: 'ADMIN', isActive: true },
    });
    adminAToken = app.jwt.sign({ sub: adminA.id, companyId: companyA.id, role: adminA.role, name: adminA.name });

    employeeA = await prisma.employee.create({
      data: {
        companyId: companyA.id,
        fullName: 'Employee Calendar A',
        cpf: '55566677788',
        whatsapp: '5511988887777',
        email: `emp-cal-a-${crypto.randomUUID()}@tenant.com`,
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await prisma.absenceRecord.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.leaveRequest.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.calendarIntegration.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  });

  describe('OAuth initiation and state validation', () => {
    it('redirects to the provider authorize URL and stores a one-time state in Redis', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/calendar/oauth/GOOGLE/start',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(302);
      const location = response.headers.location as string;
      expect(location).toContain('accounts.google.com');
      const state = new URL(location).searchParams.get('state');
      expect(state).toBeTruthy();

      const stored = await redis.get(`calendar_oauth_state:${state}`);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toMatchObject({ companyId: companyA.id, provider: 'GOOGLE' });
    });

    it('rejects an invalid or unknown provider', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/calendar/oauth/DROPBOX/start',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('callback with a missing/invalid state redirects with an error, without creating an integration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/calendar/oauth/GOOGLE/callback?code=abc&state=does-not-exist',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('calendar=error');
      expect(response.headers.location).toContain('reason=invalid_or_expired_state');

      const integration = await prisma.calendarIntegration.findUnique({ where: { companyId: companyA.id } });
      expect(integration).toBeNull();
    });

    it('callback state is single-use: replaying the same state fails the second time', async () => {
      const state = crypto.randomUUID();
      await redis.set(`calendar_oauth_state:${state}`, JSON.stringify({ companyId: companyA.id, provider: 'GOOGLE' }), 'EX', 600);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {
        access_token: 'real-exchanged-token',
        refresh_token: 'real-refresh-token',
        expires_in: 3600,
      })));

      const first = await app.inject({ method: 'GET', url: `/api/calendar/oauth/GOOGLE/callback?code=abc&state=${state}` });
      expect(first.statusCode).toBe(302);
      expect(first.headers.location).toContain('calendar=connected');

      const second = await app.inject({ method: 'GET', url: `/api/calendar/oauth/GOOGLE/callback?code=abc&state=${state}` });
      expect(second.statusCode).toBe(302);
      expect(second.headers.location).toContain('calendar=error');
    });

    it('successful token exchange persists a real access/refresh token pair for the initiating company', async () => {
      const state = crypto.randomUUID();
      await redis.set(`calendar_oauth_state:${state}`, JSON.stringify({ companyId: companyA.id, provider: 'MICROSOFT' }), 'EX', 600);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {
        access_token: 'ms-access-token',
        refresh_token: 'ms-refresh-token',
        expires_in: 3600,
      })));

      const response = await app.inject({ method: 'GET', url: `/api/calendar/oauth/MICROSOFT/callback?code=xyz&state=${state}` });
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('calendar=connected');

      const integration = await prisma.calendarIntegration.findUnique({ where: { companyId: companyA.id } });
      expect(integration?.provider).toBe('MICROSOFT');
      expect(integration?.accessToken).toBe('ms-access-token');
      expect(integration?.isActive).toBe(true);
    });
  });

  describe('Token refresh and revocation', () => {
    beforeEach(async () => {
      await prisma.calendarIntegration.create({
        data: {
          companyId: companyA.id,
          provider: 'GOOGLE',
          accessToken: 'stale-token',
          refreshToken: 'refresh-token-123',
          expiresAt: new Date(Date.now() - 60_000), // already expired
          isActive: true,
        },
      });
    });

    it('refreshes an expired token successfully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { access_token: 'fresh-token', expires_in: 3600 })));

      const token = await CalendarSyncService.refreshIfNeeded(companyA.id);
      expect(token).toBe('fresh-token');

      const integration = await prisma.calendarIntegration.findUnique({ where: { companyId: companyA.id } });
      expect(integration?.accessToken).toBe('fresh-token');
      expect(integration?.isActive).toBe(true);
    });

    it('marks the integration inactive when the refresh token was revoked (invalid_grant)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse(400, 'invalid_grant: token has been revoked')));

      const token = await CalendarSyncService.refreshIfNeeded(companyA.id);
      expect(token).toBeNull();

      const integration = await prisma.calendarIntegration.findUnique({ where: { companyId: companyA.id } });
      expect(integration?.isActive).toBe(false);
    });

    it('a transient provider failure (500) does not deactivate the integration', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse(500, 'internal error')));

      const token = await CalendarSyncService.refreshIfNeeded(companyA.id);
      expect(token).toBeNull();

      const integration = await prisma.calendarIntegration.findUnique({ where: { companyId: companyA.id } });
      expect(integration?.isActive).toBe(true);
    });
  });

  describe('Leave sync: retry, idempotency and tenant isolation', () => {
    async function approvedLeaveWithAbsence(companyId: string) {
      const emp = companyId === companyA.id ? employeeA : await prisma.employee.create({
        data: { companyId, fullName: 'Employee B', cpf: '11122233344', whatsapp: '5511977776666', email: `emp-b-${crypto.randomUUID()}@tenant.com`, status: 'ACTIVE' },
      });
      const leave = await prisma.leaveRequest.create({
        data: { companyId, employeeId: emp.id, startDate: new Date('2026-08-01'), endDate: new Date('2026-08-05'), type: 'FERIAS', status: 'APPROVED' },
      });
      const absence = await prisma.absenceRecord.create({
        data: {
          companyId, employeeId: emp.id, leaveRequestId: leave.id,
          startDate: leave.startDate, endDate: leave.endDate, days: 5,
          type: 'JUSTIFIED_ABSENCE', status: 'ACTIVE', createdByUserId: adminA.id,
        },
      });
      return { leave, absence };
    }

    beforeEach(async () => {
      await prisma.calendarIntegration.create({
        data: {
          companyId: companyA.id, provider: 'GOOGLE', accessToken: 'valid-token',
          refreshToken: 'refresh-1', expiresAt: new Date(Date.now() + 3600_000), isActive: true,
        },
      });
    });

    it('retries once on a transient 429 and then succeeds', async () => {
      const { leave } = await approvedLeaveWithAbsence(companyA.id);
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(textResponse(429, 'rate limited'))
        .mockResolvedValueOnce(jsonResponse(200, { id: 'google-event-1' }));
      vi.stubGlobal('fetch', fetchMock);

      const eventId = await CalendarSyncService.syncLeaveEvent(leave.id, companyA.id);
      expect(eventId).toBe('google-event-1');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a permanent error (400) and does not corrupt the leave domain', async () => {
      const { leave } = await approvedLeaveWithAbsence(companyA.id);
      const fetchMock = vi.fn().mockResolvedValue(textResponse(400, 'bad request'));
      vi.stubGlobal('fetch', fetchMock);

      const eventId = await CalendarSyncService.syncLeaveEvent(leave.id, companyA.id);
      expect(eventId).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const stillApproved = await prisma.leaveRequest.findUnique({ where: { id: leave.id } });
      expect(stillApproved?.status).toBe('APPROVED');
    });

    it('is idempotent: syncing the same approved leave twice updates the existing event instead of creating a duplicate', async () => {
      const { leave } = await approvedLeaveWithAbsence(companyA.id);
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'google-event-dup' }));
      vi.stubGlobal('fetch', fetchMock);

      const firstId = await CalendarSyncService.syncLeaveEvent(leave.id, companyA.id);
      expect(firstId).toBe('google-event-dup');
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');

      const secondId = await CalendarSyncService.syncLeaveEvent(leave.id, companyA.id);
      expect(secondId).toBe('google-event-dup');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    });

    it('never syncs a leave request belonging to a different tenant', async () => {
      const { leave: leaveB } = await approvedLeaveWithAbsence(companyB.id);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      // companyA has the active integration; leaveB belongs to companyB.
      const eventId = await CalendarSyncService.syncLeaveEvent(leaveB.id, companyA.id);
      expect(eventId).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats a 404/410 on delete as a successful (idempotent) removal', async () => {
      const fetchMock = vi.fn().mockResolvedValue(textResponse(404, 'not found'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await CalendarSyncService.deleteCalendarEvent(companyA.id, 'already-gone-event');
      expect(result).toBe(true);
    });
  });
});

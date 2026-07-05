import { prisma } from '../lib/prisma';
import { redactPII } from '../lib/pii-redactor';
import { NotificationEngineService } from '../modules/notification-engine/notification-engine.service';

type SyncLogger = {
  correlationId?: string;
};

function log(event: string, meta: Record<string, unknown>, ctx?: SyncLogger) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(redactPII({
    event,
    correlationId: ctx?.correlationId ?? null,
    ...meta,
    ts: new Date().toISOString(),
  })));
}

/** Errors from provider APIs that are safe to retry once (transient/server-side). */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchWithRetry(url: string, init: RequestInit, ctx?: SyncLogger): Promise<Response> {
  const first = await fetch(url, init);
  if (first.ok || !isRetryableStatus(first.status)) return first;
  log('CALENDAR_PROVIDER_RETRY', { url, status: first.status }, ctx);
  // Single retry with a short backoff; permanent errors (400/401/403/404) are never retried.
  await new Promise((resolve) => setTimeout(resolve, 250));
  return fetch(url, init);
}

export class CalendarSyncService {
  /**
   * Refreshes the OAuth access token if expired or close to expiration.
   * If token is revoked or cannot be refreshed, marks integration inactive.
   */
  static async refreshIfNeeded(companyId: string, ctx?: SyncLogger): Promise<string | null> {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { companyId }
    });

    if (!integration || !integration.isActive) return null;

    // Check if token expires in the next 5 minutes (300 seconds)
    const buffer = 5 * 60 * 1000;
    const isExpired = integration.expiresAt
      ? new Date().getTime() + buffer >= integration.expiresAt.getTime()
      : true;

    if (!isExpired) {
      return integration.accessToken;
    }

    if (!integration.refreshToken) {
      // No refresh token available, mark inactive
      await prisma.calendarIntegration.update({
        where: { companyId },
        data: { isActive: false }
      });
      log('CALENDAR_TOKEN_MISSING_REFRESH', { companyId, provider: integration.provider }, ctx);
      return null;
    }

    try {
      let newAccessToken = '';
      let newExpiresIn = 3600;

      if (integration.provider === 'GOOGLE') {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || 'mock_google_id',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || 'mock_google_secret',
            refresh_token: integration.refreshToken,
            grant_type: 'refresh_token',
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 400 && (errText.includes('invalid_grant') || errText.includes('revoked'))) {
            await prisma.calendarIntegration.update({
              where: { companyId },
              data: { isActive: false }
            });
            log('CALENDAR_TOKEN_REVOKED', { companyId, provider: 'GOOGLE' }, ctx);
            return null;
          }
          throw new Error(`Google OAuth refresh error: ${errText}`);
        }

        const data = await res.json() as any;
        newAccessToken = data.access_token;
        newExpiresIn = data.expires_in || 3600;
      } else if (integration.provider === 'MICROSOFT') {
        const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID || 'mock_ms_id',
            client_secret: process.env.MICROSOFT_CLIENT_SECRET || 'mock_ms_secret',
            refresh_token: integration.refreshToken,
            grant_type: 'refresh_token',
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 400 && (errText.includes('invalid_grant') || errText.includes('revoked'))) {
            await prisma.calendarIntegration.update({
              where: { companyId },
              data: { isActive: false }
            });
            log('CALENDAR_TOKEN_REVOKED', { companyId, provider: 'MICROSOFT' }, ctx);
            return null;
          }
          throw new Error(`Microsoft OAuth refresh error: ${errText}`);
        }

        const data = await res.json() as any;
        newAccessToken = data.access_token;
        newExpiresIn = data.expires_in || 3600;
      } else {
        return null;
      }

      const updated = await prisma.calendarIntegration.update({
        where: { companyId },
        data: {
          accessToken: newAccessToken,
          expiresAt: new Date(Date.now() + newExpiresIn * 1000)
        }
      });

      log('CALENDAR_TOKEN_REFRESHED', { companyId, provider: integration.provider }, ctx);
      return updated.accessToken;
    } catch (err) {
      log('CALENDAR_TOKEN_REFRESH_FAILED', { companyId, provider: integration.provider, error: String(err) }, ctx);
      return null;
    }
  }

  /**
   * Syncs a LeaveRequest to the integration's target calendar (Google or MS Graph).
   * Idempotent: if the absence record already has an externalCalendarEventId, the
   * existing event is updated instead of a new one being created.
   */
  static async syncLeaveEvent(leaveId: string, companyId: string, ctx?: SyncLogger): Promise<string | null> {
    const leave = await prisma.leaveRequest.findFirst({
      where: { id: leaveId, companyId },
      include: { employee: true, absenceRecord: true }
    });

    if (!leave || leave.status !== 'APPROVED') return null;

    const token = await this.refreshIfNeeded(companyId, ctx);
    if (!token) return null;

    const integration = await prisma.calendarIntegration.findUnique({
      where: { companyId }
    });
    if (!integration) return null;

    const eventTitle = `Afastamento/Férias - ${leave.employee.fullName}`;
    const eventDescription = `Período de afastamento do colaborador. Justificativa: ${leave.justification || 'Não informada'}`;

    const existingEventId = leave.absenceRecord?.externalCalendarEventId ?? null;
    const existingProvider = leave.absenceRecord?.externalCalendarProvider ?? null;

    // Idempotency guard: never create a second event for the same absence record.
    if (existingEventId && existingProvider === integration.provider) {
      const updated = await this.updateCalendarEvent(companyId, existingEventId, {
        title: eventTitle,
        description: eventDescription,
        startDate: leave.startDate,
        endDate: leave.endDate,
      }, ctx);
      return updated ? existingEventId : null;
    }

    try {
      let eventId: string | null = null;

      if (integration.provider === 'GOOGLE') {
        const res = await fetchWithRetry('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            summary: eventTitle,
            description: eventDescription,
            start: { date: leave.startDate.toISOString().split('T')[0] },
            end: { date: leave.endDate.toISOString().split('T')[0] }
          })
        }, ctx);

        if (res.status === 401) {
          await prisma.calendarIntegration.update({ where: { companyId }, data: { isActive: false } });
          log('CALENDAR_TOKEN_REVOKED', { companyId, provider: 'GOOGLE' }, ctx);
          return null;
        }
        if (!res.ok) {
          throw new Error(`Google Calendar create event error (${res.status}): ${await res.text()}`);
        }
        const data = await res.json() as any;
        eventId = data.id;
      } else if (integration.provider === 'MICROSOFT') {
        const res = await fetchWithRetry('https://graph.microsoft.com/v1.0/me/calendar/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subject: eventTitle,
            body: { contentType: 'text', content: eventDescription },
            start: { dateTime: leave.startDate.toISOString(), timeZone: 'UTC' },
            end: { dateTime: leave.endDate.toISOString(), timeZone: 'UTC' }
          })
        }, ctx);

        if (res.status === 401) {
          await prisma.calendarIntegration.update({ where: { companyId }, data: { isActive: false } });
          log('CALENDAR_TOKEN_REVOKED', { companyId, provider: 'MICROSOFT' }, ctx);
          return null;
        }
        if (!res.ok) {
          throw new Error(`Microsoft Graph create event error (${res.status}): ${await res.text()}`);
        }
        const data = await res.json() as any;
        eventId = data.id;
      }

      if (eventId && leave.absenceRecord) {
        await prisma.absenceRecord.update({
          where: { id: leave.absenceRecord.id },
          data: { externalCalendarEventId: eventId, externalCalendarProvider: integration.provider }
        });
      }

      log('CALENDAR_EVENT_CREATED', { companyId, leaveId, provider: integration.provider, eventId }, ctx);
      return eventId;
    } catch (err) {
      log('CALENDAR_SYNC_FAILED', { companyId, leaveId, provider: integration.provider, error: String(err) }, ctx);
      NotificationEngineService.processDomainEvent({
        companyId,
        eventType: 'CALENDAR_SYNC_FAILED',
        eventId: `${leaveId}-calendar-sync-failure`,
        aggregateType: 'CalendarIntegration',
        aggregateId: leaveId,
        priority: 'LOW',
        correlationId: ctx?.correlationId,
        context: { provider: integration.provider },
        defaultTitle: 'Falha na sincronização com o calendário',
        defaultMessage: `Não foi possível sincronizar um evento de afastamento com ${integration.provider}. A aprovação em si não foi afetada.`,
        actionUrl: '/app/settings/company',
      }).catch(() => undefined);
      return null;
    }
  }

  /** Updates an existing calendar event. Used for idempotent re-sync. */
  static async updateCalendarEvent(
    companyId: string,
    eventId: string,
    changes: { title: string; description: string; startDate: Date; endDate: Date },
    ctx?: SyncLogger,
  ): Promise<boolean> {
    const token = await this.refreshIfNeeded(companyId, ctx);
    if (!token) return false;

    const integration = await prisma.calendarIntegration.findUnique({ where: { companyId } });
    if (!integration) return false;

    try {
      if (integration.provider === 'GOOGLE') {
        const res = await fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: changes.title,
            description: changes.description,
            start: { date: changes.startDate.toISOString().split('T')[0] },
            end: { date: changes.endDate.toISOString().split('T')[0] }
          })
        }, ctx);
        log('CALENDAR_EVENT_UPDATED', { companyId, eventId, provider: 'GOOGLE', ok: res.ok }, ctx);
        return res.ok;
      } else if (integration.provider === 'MICROSOFT') {
        const res = await fetchWithRetry(`https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: changes.title,
            body: { contentType: 'text', content: changes.description },
            start: { dateTime: changes.startDate.toISOString(), timeZone: 'UTC' },
            end: { dateTime: changes.endDate.toISOString(), timeZone: 'UTC' }
          })
        }, ctx);
        log('CALENDAR_EVENT_UPDATED', { companyId, eventId, provider: 'MICROSOFT', ok: res.ok }, ctx);
        return res.ok;
      }
    } catch (err) {
      log('CALENDAR_EVENT_UPDATE_FAILED', { companyId, eventId, error: String(err) }, ctx);
    }
    return false;
  }

  /**
   * Delete calendar event by provider and id. Idempotent: a 404/410 from the
   * provider (already deleted) is treated as success, not an error.
   */
  static async deleteCalendarEvent(companyId: string, eventId: string, ctx?: SyncLogger): Promise<boolean> {
    const token = await this.refreshIfNeeded(companyId, ctx);
    if (!token) return false;

    const integration = await prisma.calendarIntegration.findUnique({
      where: { companyId }
    });
    if (!integration) return false;

    try {
      let res: Response;
      if (integration.provider === 'GOOGLE') {
        res = await fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }, ctx);
      } else if (integration.provider === 'MICROSOFT') {
        res = await fetchWithRetry(`https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }, ctx);
      } else {
        return false;
      }
      const ok = res.ok || res.status === 404 || res.status === 410;
      log('CALENDAR_EVENT_DELETED', { companyId, eventId, provider: integration.provider, ok, status: res.status }, ctx);
      return ok;
    } catch (err) {
      log('CALENDAR_EVENT_DELETE_FAILED', { companyId, eventId, error: String(err) }, ctx);
    }
    return false;
  }
}

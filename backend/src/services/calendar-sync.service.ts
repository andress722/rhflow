import { prisma } from '../lib/prisma';

export class CalendarSyncService {
  /**
   * Refreshes the OAuth access token if expired or close to expiration.
   * If token is revoked or cannot be refreshed, marks integration inactive.
   */
  static async refreshIfNeeded(companyId: string): Promise<string | null> {
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
      return null;
    }

    try {
      let newAccessToken = '';
      let newExpiresIn = 3600;

      if (integration.provider === 'GOOGLE') {
        // Real Google token refresh request
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
          // Check if token was revoked
          if (res.status === 400 && (errText.includes('invalid_grant') || errText.includes('revoked'))) {
            await prisma.calendarIntegration.update({
              where: { companyId },
              data: { isActive: false }
            });
            return null;
          }
          throw new Error(`Google OAuth refresh error: ${errText}`);
        }

        const data = await res.json() as any;
        newAccessToken = data.access_token;
        newExpiresIn = data.expires_in || 3600;
      } else if (integration.provider === 'MICROSOFT') {
        // Real Microsoft Graph token refresh request
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
            return null;
          }
          throw new Error(`Microsoft OAuth refresh error: ${errText}`);
        }

        const data = await res.json() as any;
        newAccessToken = data.access_token;
        newExpiresIn = data.expires_in || 3600;
      }

      const updated = await prisma.calendarIntegration.update({
        where: { companyId },
        data: {
          accessToken: newAccessToken,
          expiresAt: new Date(Date.now() + newExpiresIn * 1000)
        }
      });

      return updated.accessToken;
    } catch (err) {
      console.error(`Failed to refresh token for companyId: ${companyId}`, err);
      return null;
    }
  }

  /**
   * Syncs a LeaveRequest to the integration's target calendar (Google or MS Graph).
   */
  static async syncLeaveEvent(leaveId: string, companyId: string): Promise<string | null> {
    const leave = await prisma.leaveRequest.findFirst({
      where: { id: leaveId, companyId },
      include: { employee: true }
    });

    if (!leave || leave.status !== 'APPROVED') return null;

    const token = await this.refreshIfNeeded(companyId);
    if (!token) return null;

    const integration = await prisma.calendarIntegration.findUnique({
      where: { companyId }
    });
    if (!integration) return null;

    const eventTitle = `Afastamento/Férias - ${leave.employee.fullName}`;
    const eventDescription = `Período de afastamento do colaborador. Justificativa: ${leave.justification || 'Não informada'}`;

    try {
      if (integration.provider === 'GOOGLE') {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            summary: eventTitle,
            description: eventDescription,
            start: {
              date: leave.startDate.toISOString().split('T')[0]
            },
            end: {
              date: leave.endDate.toISOString().split('T')[0]
            }
          })
        });

        if (res.status === 401) {
          // Token revoked or unauthorized
          await prisma.calendarIntegration.update({
            where: { companyId },
            data: { isActive: false }
          });
          return null;
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Google Calendar create event error: ${errText}`);
        }

        const data = await res.json() as any;
        return data.id; // Returns Google Event ID
      } else if (integration.provider === 'MICROSOFT') {
        const res = await fetch('https://graph.microsoft.com/v1.0/me/calendar/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subject: eventTitle,
            body: {
              contentType: 'text',
              content: eventDescription
            },
            start: {
              dateTime: leave.startDate.toISOString(),
              timeZone: 'UTC'
            },
            end: {
              dateTime: leave.endDate.toISOString(),
              timeZone: 'UTC'
            }
          })
        });

        if (res.status === 401) {
          await prisma.calendarIntegration.update({
            where: { companyId },
            data: { isActive: false }
          });
          return null;
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Microsoft Graph create event error: ${errText}`);
        }

        const data = await res.json() as any;
        return data.id; // Returns Microsoft Event ID
      }
    } catch (err) {
      console.error(`Error syncing leave event for company: ${companyId}`, err);
    }
    return null;
  }

  /**
   * Delete calendar event by provider and id.
   */
  static async deleteCalendarEvent(companyId: string, eventId: string): Promise<boolean> {
    const token = await this.refreshIfNeeded(companyId);
    if (!token) return false;

    const integration = await prisma.calendarIntegration.findUnique({
      where: { companyId }
    });
    if (!integration) return false;

    try {
      if (integration.provider === 'GOOGLE') {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.ok;
      } else if (integration.provider === 'MICROSOFT') {
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.ok;
      }
    } catch (err) {
      console.error(`Error deleting calendar event: ${eventId}`, err);
    }
    return false;
  }
}

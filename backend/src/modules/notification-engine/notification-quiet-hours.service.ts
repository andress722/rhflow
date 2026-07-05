import { DateTime } from 'luxon';
import { prisma } from '../../lib/prisma';
import { QuietHoursBehavior, NotificationPriority } from '@prisma/client';
import { config } from '../../config';

function parseHHmm(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map((n) => Number(n));
  return { hour, minute };
}

/**
 * Determines whether `now` (already resolved in the target timezone) falls
 * within the configured quiet window. Handles both same-day windows
 * (e.g. 12:00-14:00) and windows that cross midnight (e.g. 22:00-07:00).
 * `daysOfWeek` uses JS convention: 0=Sunday .. 6=Saturday, and refers to the
 * day the window *starts* on.
 */
export function isWithinQuietWindow(
  now: DateTime,
  startTime: string,
  endTime: string,
  daysOfWeek: number[],
): boolean {
  const start = parseHHmm(startTime);
  const end = parseHHmm(endTime);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  const nowMinutes = now.hour * 60 + now.minute;
  // Luxon weekday: 1=Monday..7=Sunday. Convert to JS convention 0=Sunday..6=Saturday.
  const jsWeekday = now.weekday % 7;

  if (startMinutes === endMinutes) return false; // zero-length window never applies

  if (startMinutes < endMinutes) {
    // Same-day window: applies only on days listed, and only while inside [start, end).
    return daysOfWeek.includes(jsWeekday) && nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  // Crosses midnight: window is [start, 24:00) on the start day, or [00:00, end) on the following day.
  const previousJsWeekday = (jsWeekday + 6) % 7;
  const isInLateSegment = daysOfWeek.includes(jsWeekday) && nowMinutes >= startMinutes;
  const isInEarlySegment = daysOfWeek.includes(previousJsWeekday) && nowMinutes < endMinutes;
  return isInLateSegment || isInEarlySegment;
}

export interface QuietHoursDecision {
  shouldDefer: boolean;
  /** Best-effort estimate of when the deferred notification could be attempted again. Not persisted automatically. */
  retryAfter?: Date;
}

export class NotificationQuietHoursService {
  static async evaluate(
    companyId: string,
    priority: NotificationPriority,
    policyBehavior: QuietHoursBehavior,
    recipientUserId?: string | null,
  ): Promise<QuietHoursDecision> {
    if (!config.notificationEngine.quietHoursEnabled) {
      return { shouldDefer: false };
    }

    // 1. Policy precedence: IGNORE opts the whole step out of quiet hours entirely.
    if (policyBehavior === 'IGNORE') {
      return { shouldDefer: false };
    }
    // ALLOW_HIGH_PRIORITY: HIGH and CRITICAL bypass the organizational window;
    // LOW/NORMAL remain subject to it.
    if (policyBehavior === 'ALLOW_HIGH_PRIORITY' && (priority === 'HIGH' || priority === 'CRITICAL')) {
      return { shouldDefer: false };
    }

    // 2. Company-level quiet hours window (organizational floor).
    const companyConfig = await prisma.notificationQuietHours.findUnique({ where: { companyId } });
    let inCompanyWindow = false;
    let companyEnd: string | null = null;
    let companyTimezone = 'America/Sao_Paulo';

    if (companyConfig?.isActive) {
      companyTimezone = companyConfig.timezone;
      const now = DateTime.now().setZone(companyTimezone);
      const daysOfWeek = Array.isArray(companyConfig.daysOfWeek) ? (companyConfig.daysOfWeek as number[]) : [];
      inCompanyWindow = isWithinQuietWindow(now, companyConfig.startTime, companyConfig.endTime, daysOfWeek);
      companyEnd = companyConfig.endTime;
    }

    // CRITICAL never bypasses the organizational floor unless the policy
    // explicitly said IGNORE above — an individual preference can restrict
    // further, but nothing amplifies a block the company already set.
    let shouldDefer = inCompanyWindow;

    // 3. User-level NotificationPreference can only ADD restriction, never remove it.
    if (recipientUserId) {
      const preference = await prisma.notificationPreference.findFirst({
        where: { companyId, userId: recipientUserId, quietHoursStart: { not: null }, quietHoursEnd: { not: null } },
      });
      if (preference?.quietHoursStart && preference.quietHoursEnd) {
        const now = DateTime.now().setZone(companyTimezone);
        const inUserWindow = isWithinQuietWindow(now, preference.quietHoursStart, preference.quietHoursEnd, [0, 1, 2, 3, 4, 5, 6]);
        shouldDefer = shouldDefer || inUserWindow;
      }
    }

    if (!shouldDefer) return { shouldDefer: false };

    if (companyEnd) {
      const { hour, minute } = parseHHmm(companyEnd);
      let retry = DateTime.now().setZone(companyTimezone).set({ hour, minute, second: 0, millisecond: 0 });
      if (retry <= DateTime.now().setZone(companyTimezone)) retry = retry.plus({ days: 1 });
      return { shouldDefer: true, retryAfter: retry.toJSDate() };
    }

    return { shouldDefer: true };
  }
}

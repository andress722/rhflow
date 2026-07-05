import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';
import { isWithinQuietWindow, NotificationQuietHoursService } from '../src/modules/notification-engine/notification-quiet-hours.service';

describe('Sprint 54 - Quiet Hours (pure window logic)', () => {
  it('same-day window: inside range on a listed day returns true', () => {
    const now = DateTime.fromObject({ year: 2026, month: 7, day: 6, hour: 13, minute: 0 }, { zone: 'America/Sao_Paulo' }); // Monday
    expect(isWithinQuietWindow(now, '12:00', '14:00', [1])).toBe(true);
  });

  it('same-day window: outside range returns false', () => {
    const now = DateTime.fromObject({ year: 2026, month: 7, day: 6, hour: 15, minute: 0 }, { zone: 'America/Sao_Paulo' });
    expect(isWithinQuietWindow(now, '12:00', '14:00', [1])).toBe(false);
  });

  it('same-day window: inside range but on a day not listed returns false', () => {
    const now = DateTime.fromObject({ year: 2026, month: 7, day: 6, hour: 13, minute: 0 }, { zone: 'America/Sao_Paulo' }); // Monday=1
    expect(isWithinQuietWindow(now, '12:00', '14:00', [2, 3])).toBe(false);
  });

  it('midnight-crossing window: late segment on the start day returns true', () => {
    const now = DateTime.fromObject({ year: 2026, month: 7, day: 6, hour: 23, minute: 0 }, { zone: 'America/Sao_Paulo' }); // Monday 23:00, window 22:00-07:00
    expect(isWithinQuietWindow(now, '22:00', '07:00', [1])).toBe(true);
  });

  it('midnight-crossing window: early segment on the following day returns true', () => {
    const now = DateTime.fromObject({ year: 2026, month: 7, day: 7, hour: 5, minute: 0 }, { zone: 'America/Sao_Paulo' }); // Tuesday 05:00 — early segment of Monday's window
    expect(isWithinQuietWindow(now, '22:00', '07:00', [1])).toBe(true);
  });

  it('midnight-crossing window: outside both segments returns false', () => {
    const now = DateTime.fromObject({ year: 2026, month: 7, day: 7, hour: 10, minute: 0 }, { zone: 'America/Sao_Paulo' });
    expect(isWithinQuietWindow(now, '22:00', '07:00', [1])).toBe(false);
  });

  it('midnight-crossing window: early segment on the following day is false if the START day is not listed', () => {
    // now is Tuesday 05:00 (early segment of what would be Monday's window), but only Wednesday(3) is listed.
    const now = DateTime.fromObject({ year: 2026, month: 7, day: 7, hour: 5, minute: 0 }, { zone: 'America/Sao_Paulo' });
    expect(isWithinQuietWindow(now, '22:00', '07:00', [3])).toBe(false);
  });

  it('zero-length window (start === end) never applies', () => {
    const now = DateTime.fromObject({ year: 2026, month: 7, day: 6, hour: 13, minute: 0 }, { zone: 'America/Sao_Paulo' });
    expect(isWithinQuietWindow(now, '12:00', '12:00', [0, 1, 2, 3, 4, 5, 6])).toBe(false);
  });
});

describe('Sprint 54 - Quiet Hours (service precedence)', () => {
  let company: any;
  let user: any;

  beforeAll(async () => {
    company = await prisma.company.create({ data: { name: 'Quiet Hours Co', cnpj: crypto.randomUUID().replace(/-/g, '').slice(0, 14) } });
    user = await prisma.user.create({
      data: { companyId: company.id, name: 'QH User', email: `qh-${crypto.randomUUID()}@x.com`, passwordHash: 'h', role: 'VIEWER', isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
  });

  afterEach(async () => {
    await prisma.notificationQuietHours.deleteMany({ where: { companyId: company.id } });
    await prisma.notificationPreference.deleteMany({ where: { companyId: company.id } });
  });

  it('policy IGNORE bypasses quiet hours entirely, even with an active company window covering now', async () => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    await prisma.notificationQuietHours.create({
      data: { companyId: company.id, timezone: 'America/Sao_Paulo', startTime: '00:00', endTime: '23:59', daysOfWeek: [now.weekday % 7], isActive: true },
    });

    const decision = await NotificationQuietHoursService.evaluate(company.id, 'NORMAL', 'IGNORE', user.id);
    expect(decision.shouldDefer).toBe(false);
  });

  it('policy ALLOW_HIGH_PRIORITY bypasses for HIGH/CRITICAL but not for NORMAL', async () => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    await prisma.notificationQuietHours.create({
      data: { companyId: company.id, timezone: 'America/Sao_Paulo', startTime: '00:00', endTime: '23:59', daysOfWeek: [now.weekday % 7], isActive: true },
    });

    const highDecision = await NotificationQuietHoursService.evaluate(company.id, 'HIGH', 'ALLOW_HIGH_PRIORITY', user.id);
    expect(highDecision.shouldDefer).toBe(false);

    const normalDecision = await NotificationQuietHoursService.evaluate(company.id, 'NORMAL', 'ALLOW_HIGH_PRIORITY', user.id);
    expect(normalDecision.shouldDefer).toBe(true);
  });

  it('company-level window sets the floor: defers even with no user preference set', async () => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    await prisma.notificationQuietHours.create({
      data: { companyId: company.id, timezone: 'America/Sao_Paulo', startTime: '00:00', endTime: '23:59', daysOfWeek: [now.weekday % 7], isActive: true },
    });

    const decision = await NotificationQuietHoursService.evaluate(company.id, 'NORMAL', 'DEFER', user.id);
    expect(decision.shouldDefer).toBe(true);
    expect(decision.retryAfter).toBeInstanceOf(Date);
  });

  it('a user preference can only ADD restriction, never remove the company-level restriction', async () => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    // Company window covers all day (always restricted).
    await prisma.notificationQuietHours.create({
      data: { companyId: company.id, timezone: 'America/Sao_Paulo', startTime: '00:00', endTime: '23:59', daysOfWeek: [now.weekday % 7], isActive: true },
    });
    // User preference is a narrow window that does NOT cover now (should not lift the company-wide restriction).
    const farPast = now.minus({ hours: 5 }).toFormat('HH:mm');
    const farPastEnd = now.minus({ hours: 4 }).toFormat('HH:mm');
    await prisma.notificationPreference.create({
      data: { companyId: company.id, userId: user.id, quietHoursStart: farPast, quietHoursEnd: farPastEnd },
    });

    const decision = await NotificationQuietHoursService.evaluate(company.id, 'NORMAL', 'DEFER', user.id);
    expect(decision.shouldDefer).toBe(true);
  });

  it('with no company config and no user preference, quiet hours never defer', async () => {
    const decision = await NotificationQuietHoursService.evaluate(company.id, 'NORMAL', 'DEFER', user.id);
    expect(decision.shouldDefer).toBe(false);
  });

  it('an inactive company quiet-hours config is not applied', async () => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    await prisma.notificationQuietHours.create({
      data: { companyId: company.id, timezone: 'America/Sao_Paulo', startTime: '00:00', endTime: '23:59', daysOfWeek: [now.weekday % 7], isActive: false },
    });

    const decision = await NotificationQuietHoursService.evaluate(company.id, 'NORMAL', 'DEFER', user.id);
    expect(decision.shouldDefer).toBe(false);
  });
});

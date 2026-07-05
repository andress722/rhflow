/**
 * Seeds conservative default NotificationPolicy rows for every company that
 * does not already have a policy for a given ACTIVE eventType. Idempotent:
 * safe to run repeatedly, never overwrites an existing policy.
 *
 * Usage: npx ts-node scripts/seed-default-notification-policies.ts
 */
import { prisma } from '../src/lib/prisma';

type DefaultStep = {
  stepOrder: number;
  delayMinutes: number;
  recipientType: 'EMPLOYEE' | 'DIRECT_MANAGER' | 'HR' | 'ADMIN';
  channels: string[];
};

type DefaultPolicy = {
  eventType: string;
  name: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  maxEscalationLevel: number;
  steps: DefaultStep[];
};

// Conservative defaults: no aggressive escalation, HR/Admin-only audiences
// for anything sensitive (WORKFORCE_RISK_HIGH never targets EMPLOYEE).
const DEFAULT_POLICIES: DefaultPolicy[] = [
  {
    eventType: 'LEAVE_REQUEST_CREATED',
    name: 'Solicitação de afastamento criada - Padrão',
    priority: 'NORMAL',
    maxEscalationLevel: 1,
    steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'DIRECT_MANAGER', channels: ['IN_APP', 'WEB_PUSH'] }],
  },
  {
    eventType: 'LEAVE_REQUEST_APPROVED',
    name: 'Solicitação de afastamento aprovada - Padrão',
    priority: 'NORMAL',
    maxEscalationLevel: 1,
    steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'EMPLOYEE', channels: ['IN_APP', 'WHATSAPP'] }],
  },
  {
    eventType: 'LEAVE_REQUEST_REJECTED',
    name: 'Solicitação de afastamento rejeitada - Padrão',
    priority: 'NORMAL',
    maxEscalationLevel: 1,
    steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'EMPLOYEE', channels: ['IN_APP', 'WHATSAPP'] }],
  },
  {
    eventType: 'WORKFORCE_RISK_HIGH',
    name: 'Sinais de risco operacional (HIGH) - Padrão',
    priority: 'HIGH',
    maxEscalationLevel: 2,
    steps: [
      { stepOrder: 1, delayMinutes: 0, recipientType: 'HR', channels: ['IN_APP'] },
      { stepOrder: 2, delayMinutes: 60, recipientType: 'ADMIN', channels: ['IN_APP'] },
    ],
  },
  {
    eventType: 'CALENDAR_SYNC_FAILED',
    name: 'Falha de sincronização de calendário - Padrão',
    priority: 'LOW',
    maxEscalationLevel: 1,
    steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'] }],
  },
  {
    eventType: 'OFFLINE_SYNC_CONFLICT',
    name: 'Conflito de sincronização offline - Padrão',
    priority: 'LOW',
    maxEscalationLevel: 1,
    steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'HR', channels: ['IN_APP'] }],
  },
  {
    eventType: 'OFFLINE_EVENT_REJECTED',
    name: 'Evento offline rejeitado - Padrão',
    priority: 'LOW',
    maxEscalationLevel: 1,
    steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'HR', channels: ['IN_APP'] }],
  },
  {
    eventType: 'OPERATIONAL_INCIDENT_OPENED',
    name: 'Incidente operacional - Padrão',
    priority: 'HIGH',
    maxEscalationLevel: 1,
    steps: [{ stepOrder: 1, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP', 'EMAIL'] }],
  },
];

export async function seedDefaultNotificationPolicies(): Promise<{ created: number; skipped: number }> {
  const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true } });
  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    for (const def of DEFAULT_POLICIES) {
      const existing = await prisma.notificationPolicy.findFirst({
        where: { companyId: company.id, eventType: def.eventType },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await prisma.notificationPolicy.create({
        data: {
          companyId: company.id,
          name: def.name,
          eventType: def.eventType,
          priority: def.priority,
          acknowledgmentRequired: false,
          maxEscalationLevel: def.maxEscalationLevel,
          quietHoursBehavior: 'DEFER',
          steps: {
            create: def.steps.map((step) => ({
              stepOrder: step.stepOrder,
              delayMinutes: step.delayMinutes,
              recipientType: step.recipientType,
              channels: step.channels,
              fallbackMode: 'PARALLEL',
              stopOnAcknowledgment: true,
              stopOnResolution: true,
            })),
          },
        },
      });
      created += 1;
    }
  }

  return { created, skipped };
}

if (require.main === module) {
  seedDefaultNotificationPolicies()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log(`Notification policies seeded: ${result.created} created, ${result.skipped} skipped (already existed).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to seed default notification policies:', err);
      process.exit(1);
    });
}

import { prisma } from '../../lib/prisma';

/**
 * Variables allowed per eventType. Anything not listed here is stripped from
 * the rendered output rather than interpolated — this is a pure string
 * substitution (no eval, no expression language, no prototype traversal).
 */
const DEFAULT_ALLOWLIST = ['employeeName', 'eventDate', 'managerName', 'companyName', 'actionUrl'];

const EVENT_ALLOWLISTS: Record<string, string[]> = {
  LEAVE_REQUEST_CREATED: ['employeeName', 'startDate', 'endDate', 'leaveType', 'companyName', 'actionUrl'],
  LEAVE_REQUEST_APPROVED: ['employeeName', 'startDate', 'endDate', 'companyName', 'actionUrl'],
  LEAVE_REQUEST_REJECTED: ['employeeName', 'startDate', 'endDate', 'companyName', 'actionUrl'],
  CALENDAR_SYNC_FAILED: ['provider', 'companyName', 'actionUrl'],
  WORKFORCE_RISK_HIGH: ['employeeName', 'companyName', 'actionUrl'],
  OFFLINE_SYNC_CONFLICT: ['employeeName', 'eventDate', 'companyName', 'actionUrl'],
  OFFLINE_EVENT_REJECTED: ['employeeName', 'eventDate', 'companyName', 'actionUrl'],
  OPERATIONAL_INCIDENT_OPENED: ['companyName', 'actionUrl'],
};

function allowlistFor(eventType: string): string[] {
  return EVENT_ALLOWLISTS[eventType] ?? DEFAULT_ALLOWLIST;
}

/**
 * Renders `{{variable}}` placeholders using only the allowlisted variables
 * for the given eventType. Unknown placeholders and any variable not in the
 * allowlist are removed (replaced with an empty string), never interpolated
 * as-is and never evaluated.
 */
export function renderTemplate(eventType: string, template: string, variables: Record<string, unknown>): string {
  const allowlist = new Set(allowlistFor(eventType));
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (!allowlist.has(key)) return '';
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

export class NotificationTemplateService {
  /**
   * Resolves the active template for (eventType, channel): tenant-specific
   * override first, falling back to the global (companyId=null) template.
   * Never returns a template belonging to a different company.
   */
  static async resolve(companyId: string, eventType: string, channel: string) {
    const tenantTemplate = await prisma.notificationMessageTemplate.findFirst({
      where: { companyId, eventType, channel, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (tenantTemplate) return tenantTemplate;

    return prisma.notificationMessageTemplate.findFirst({
      where: { companyId: null, eventType, channel, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  static render(eventType: string, template: string, variables: Record<string, unknown>): string {
    return renderTemplate(eventType, template, variables);
  }
}

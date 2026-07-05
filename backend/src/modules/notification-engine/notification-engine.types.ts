import {
  NotificationPriority,
  NotificationRecipientType,
  ChannelFallbackMode,
} from '@prisma/client';

/**
 * Event catalog status:
 *
 * - ACTIVE: the new Notification Engine is wired to a confirmed real trigger
 *   point in the codebase, with no existing ad-hoc notification for it.
 * - ACTIVE_LEGACY: the event has a confirmed real trigger, but is already
 *   served today by the ad-hoc NotificationCenterService calls in the
 *   originating service. It is NOT migrated to the new engine this sprint
 *   to avoid double-processing/regressions. See docs/notifications/architecture.md.
 * - RESERVED: no confirmed distinct trigger exists in the codebase today.
 *   These events have no wiring and no default policy — activating them
 *   requires confirming a real origin first.
 */
export type EventCatalogStatus = 'ACTIVE' | 'ACTIVE_LEGACY' | 'RESERVED';

export interface EventCatalogEntry {
  eventType: string;
  status: EventCatalogStatus;
  aggregateType: string;
  description: string;
}

export const EVENT_CATALOG: Record<string, EventCatalogEntry> = {
  // ACTIVE — wired to the new engine in this sprint.
  LEAVE_REQUEST_CREATED: { eventType: 'LEAVE_REQUEST_CREATED', status: 'ACTIVE', aggregateType: 'LeaveRequest', description: 'A leave/vacation request was created by an employee.' },
  LEAVE_REQUEST_APPROVED: { eventType: 'LEAVE_REQUEST_APPROVED', status: 'ACTIVE', aggregateType: 'LeaveRequest', description: 'A leave/vacation request was approved.' },
  LEAVE_REQUEST_REJECTED: { eventType: 'LEAVE_REQUEST_REJECTED', status: 'ACTIVE', aggregateType: 'LeaveRequest', description: 'A leave/vacation request was rejected.' },
  CALENDAR_SYNC_FAILED: { eventType: 'CALENDAR_SYNC_FAILED', status: 'ACTIVE', aggregateType: 'CalendarIntegration', description: 'A calendar provider sync attempt failed (create/update/delete event or token refresh).' },
  WORKFORCE_RISK_HIGH: { eventType: 'WORKFORCE_RISK_HIGH', status: 'ACTIVE', aggregateType: 'Employee', description: 'Workforce Risk Signals heuristic reported HIGH level for an employee. HR/Admin audience only, never sent to the employee.' },
  OFFLINE_SYNC_CONFLICT: { eventType: 'OFFLINE_SYNC_CONFLICT', status: 'ACTIVE', aggregateType: 'RemoteCheckin', description: 'An offline check-in sync produced a conflict (out-of-order sequence or hash mismatch).' },
  OFFLINE_EVENT_REJECTED: { eventType: 'OFFLINE_EVENT_REJECTED', status: 'ACTIVE', aggregateType: 'RemoteCheckin', description: 'An offline check-in event was rejected by the server (duplicate offlineEventId or invalid payload).' },
  OPERATIONAL_INCIDENT_OPENED: { eventType: 'OPERATIONAL_INCIDENT_OPENED', status: 'ACTIVE', aggregateType: 'OperationalErrorLog', description: 'A new operational error was logged (5xx / unhandled exception).' },

  // ACTIVE_LEGACY — real origin, still served by the existing ad-hoc path.
  REMOTE_CHECKIN_SENT: { eventType: 'REMOTE_CHECKIN_SENT', status: 'ACTIVE_LEGACY', aggregateType: 'RemoteCheckin', description: 'A batch of remote check-in requests was sent. Served today by remote-checkin-batch.job.ts.' },
  REMOTE_CHECKIN_NOT_RESPONDED: { eventType: 'REMOTE_CHECKIN_NOT_RESPONDED', status: 'ACTIVE_LEGACY', aggregateType: 'RemoteCheckin', description: 'A remote check-in was not answered within the grace period. Served today by mark-not-responded.job.ts + NotificationCenterService ad-hoc calls.' },
  EMPLOYEE_LATE: { eventType: 'EMPLOYEE_LATE', status: 'ACTIVE_LEGACY', aggregateType: 'Occurrence', description: 'Maps to OccurrenceType.LATE_ARRIVAL, created from WhatsApp intent classification in remote-checkin.service.ts.' },
  EMPLOYEE_ABSENCE_REPORTED: { eventType: 'EMPLOYEE_ABSENCE_REPORTED', status: 'ACTIVE_LEGACY', aggregateType: 'Occurrence', description: 'Maps to OccurrenceType.ABSENCE, created from WhatsApp intent classification in remote-checkin.service.ts.' },
  MEDICAL_CERTIFICATE_SUBMITTED: { eventType: 'MEDICAL_CERTIFICATE_SUBMITTED', status: 'ACTIVE_LEGACY', aggregateType: 'MedicalCertificate', description: 'Served today by ad-hoc NotificationCenterService calls in medical-certificates.ts.' },
  MEDICAL_CERTIFICATE_APPROVED: { eventType: 'MEDICAL_CERTIFICATE_APPROVED', status: 'ACTIVE_LEGACY', aggregateType: 'MedicalCertificate', description: 'Served today by ad-hoc NotificationCenterService calls in medical-certificates.ts.' },
  MEDICAL_CERTIFICATE_REJECTED: { eventType: 'MEDICAL_CERTIFICATE_REJECTED', status: 'ACTIVE_LEGACY', aggregateType: 'MedicalCertificate', description: 'Served today by ad-hoc NotificationCenterService calls in medical-certificates.ts.' },

  // RESERVED — no confirmed distinct trigger. No wiring, no default policy.
  EMPLOYEE_MISSED_CLOCK_IN: { eventType: 'EMPLOYEE_MISSED_CLOCK_IN', status: 'RESERVED', aggregateType: 'RemoteCheckin', description: 'Not distinct from REMOTE_CHECKIN_NOT_RESPONDED in the current codebase.' },
  EMPLOYEE_NO_RESPONSE: { eventType: 'EMPLOYEE_NO_RESPONSE', status: 'RESERVED', aggregateType: 'RemoteCheckin', description: 'Same real-world concept as REMOTE_CHECKIN_NOT_RESPONDED; kept as a documented alias, not a distinct event.' },
  MEDICAL_CERTIFICATE_RESEND_REQUESTED: { eventType: 'MEDICAL_CERTIFICATE_RESEND_REQUESTED', status: 'RESERVED', aggregateType: 'MedicalCertificate', description: 'No "resend" concept exists in medical-certificates.ts today.' },
  INTEGRATION_FAILURE: { eventType: 'INTEGRATION_FAILURE', status: 'RESERVED', aggregateType: 'Integration', description: 'Too generic; CALENDAR_SYNC_FAILED already covers the one confirmed integration failure type.' },
  OPERATIONAL_INCIDENT_CRITICAL: { eventType: 'OPERATIONAL_INCIDENT_CRITICAL', status: 'RESERVED', aggregateType: 'OperationalErrorLog', description: 'No existing severity classification distinguishes a "critical incident" from a regular operational error.' },
};

export function isEventActive(eventType: string): boolean {
  return EVENT_CATALOG[eventType]?.status === 'ACTIVE';
}

export interface DomainEventInput {
  companyId: string;
  eventType: string;
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  priority: NotificationPriority;
  correlationId?: string;
  /** Extra context available to audience resolution and templates (e.g. employeeId, requesterId, actorUserId). */
  context: Record<string, unknown>;
  /** Used when no NotificationMessageTemplate is configured for (eventType, channel). Must never include sensitive data (see docs/notifications/security.md). */
  defaultTitle: string;
  defaultMessage: string;
  actionUrl?: string | null;
}

export interface ResolvedRecipient {
  recipientUserId: string | null;
  recipientEmployeeId: string | null;
  /** Populated when the recipient could not be resolved; the delivery attempt must be recorded as SKIPPED, never silently dropped. */
  skipReasonCode?: string;
}

export interface PolicyStepView {
  id: string;
  stepOrder: number;
  delayMinutes: number;
  recipientType: NotificationRecipientType;
  recipientReference: string | null;
  channels: string[];
  fallbackMode: ChannelFallbackMode;
  stopOnAcknowledgment: boolean;
  stopOnResolution: boolean;
}

export const TRANSIENT_FAILURE_REASON_CODES = new Set([
  'NOTIFICATION_PROVIDER_RATE_LIMITED',
  'NOTIFICATION_PROVIDER_TIMEOUT',
  'NOTIFICATION_PROVIDER_UNAVAILABLE',
]);

export const PERMANENT_FAILURE_REASON_CODES = new Set([
  'NOTIFICATION_RECIPIENT_NOT_FOUND',
  'NOTIFICATION_CHANNEL_UNAVAILABLE',
  'NOTIFICATION_PROVIDER_UNAUTHORIZED',
  'NOTIFICATION_TEMPLATE_INVALID',
  'NOTIFICATION_SUPPRESSED',
]);

export type ReasonCode =
  | 'NOTIFICATION_RECIPIENT_NOT_FOUND'
  | 'NOTIFICATION_CHANNEL_UNAVAILABLE'
  | 'NOTIFICATION_PROVIDER_RATE_LIMITED'
  | 'NOTIFICATION_PROVIDER_UNAUTHORIZED'
  | 'NOTIFICATION_PROVIDER_TIMEOUT'
  | 'NOTIFICATION_PROVIDER_UNAVAILABLE'
  | 'NOTIFICATION_TEMPLATE_INVALID'
  | 'NOTIFICATION_MAX_RETRIES_EXCEEDED'
  | 'NOTIFICATION_SUPPRESSED'
  | 'NOTIFICATION_ESCALATION_EXHAUSTED';

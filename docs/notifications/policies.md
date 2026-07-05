# Notification Policies (Sprint 54)

## Event catalog (source of truth: `notification-engine.types.ts#EVENT_CATALOG`)

### ACTIVE — wired to the Notification Engine this sprint

| eventType | aggregateType | Real trigger point |
|---|---|---|
| `LEAVE_REQUEST_CREATED` | LeaveRequest | `POST /leaves` (routes/leaves.ts) |
| `LEAVE_REQUEST_APPROVED` | LeaveRequest | `POST /leaves/:id/approve` |
| `LEAVE_REQUEST_REJECTED` | LeaveRequest | `POST /leaves/:id/reject` |
| `CALENDAR_SYNC_FAILED` | CalendarIntegration | catch block of `CalendarSyncService`'s event-create sync |
| `WORKFORCE_RISK_HIGH` | Employee | `WorkforceRiskSignalsService.calculate()` when `level === 'HIGH'` |
| `OFFLINE_SYNC_CONFLICT` | RemoteCheckin | `POST /presence/:id/simulate-response`, out-of-order offline sequence |
| `OFFLINE_EVENT_REJECTED` | RemoteCheckin | same route, duplicate `offlineEventId` replay |
| `OPERATIONAL_INCIDENT_OPENED` | OperationalErrorLog | `app.ts` error-logging hook, tenant-scoped 5xx only |

### ACTIVE_LEGACY — real trigger exists, still served by the pre-existing ad-hoc path

| eventType | Served today by |
|---|---|
| `REMOTE_CHECKIN_SENT` | `remote-checkin-batch.job.ts` |
| `REMOTE_CHECKIN_NOT_RESPONDED` | `mark-not-responded.job.ts` + ad-hoc `NotificationCenterService` calls |
| `EMPLOYEE_LATE` | WhatsApp intent classification in `remote-checkin.service.ts` |
| `EMPLOYEE_ABSENCE_REPORTED` | same |
| `MEDICAL_CERTIFICATE_SUBMITTED` / `_APPROVED` / `_REJECTED` | `medical-certificates.ts` ad-hoc calls |

These are intentionally **not** migrated this sprint. Migrating them would
require removing the existing ad-hoc call sites in the same change to avoid
double notification — out of scope, and explicitly excluded by the sprint's
approval constraints ("não unifique o mecanismo legado").

### RESERVED — no confirmed distinct origin; no wiring, no default policy

`EMPLOYEE_MISSED_CLOCK_IN`, `EMPLOYEE_NO_RESPONSE`,
`MEDICAL_CERTIFICATE_RESEND_REQUESTED`, `INTEGRATION_FAILURE`,
`OPERATIONAL_INCIDENT_CRITICAL`. A policy can be created for these (for
future-proofing) but it will never fire; the dry-run test endpoint and the
Policy Builder UI warn about this explicitly.

## Policy model

A `NotificationPolicy` belongs to exactly one `(companyId, eventType)` and
has an ordered list of `NotificationPolicyStep`s. Each step defines:

- `delayMinutes` — relative to the step that just ran (or to trigger time,
  for step 1). Computed and persisted once when the step becomes due, never
  recalculated from scratch on a later scan.
- `recipientType` — one of `EMPLOYEE`, `DIRECT_MANAGER`, `HR`, `ADMIN`,
  `SPECIFIC_USER` (+ `recipientReference` = userId, same-tenant enforced),
  `ROLE` (+ `recipientReference` = role name), `REQUESTER` / `EVENT_ACTOR`
  (read from the triggering event's `context`).
- `channels` — any subset of `IN_APP`, `WEB_PUSH`, `WHATSAPP`, `EMAIL`.
- `fallbackMode` — `PARALLEL` (all channels attempted at once) or
  `SEQUENTIAL` (falls through to the next channel only on a **permanent**
  failure; a transient failure stays on the same channel for the next scan
  to retry).
- `stopOnAcknowledgment` — whether an ACK on this step halts escalation
  (`ACKNOWLEDGED`, no further steps) or lets it keep running in the
  background (see `docs/notifications/escalation.md`).

## Default seeded policies

`backend/scripts/seed-default-notification-policies.ts` seeds one
conservative policy per ACTIVE eventType, for every active company, if none
already exists (idempotent — never overwrites a manually-edited policy):

| eventType | Steps |
|---|---|
| `LEAVE_REQUEST_CREATED` | DIRECT_MANAGER, IN_APP+WEB_PUSH, immediate |
| `LEAVE_REQUEST_APPROVED` | EMPLOYEE, IN_APP+WHATSAPP, immediate |
| `LEAVE_REQUEST_REJECTED` | EMPLOYEE, IN_APP+WHATSAPP, immediate |
| `WORKFORCE_RISK_HIGH` | HR (immediate) → ADMIN (+60min). **Never EMPLOYEE** — this event carries a heuristic disclaimer and requires human review; it must not reach the employee directly. |
| `CALENDAR_SYNC_FAILED` | ADMIN, IN_APP, immediate |
| `OFFLINE_SYNC_CONFLICT` / `OFFLINE_EVENT_REJECTED` | HR, IN_APP, immediate |
| `OPERATIONAL_INCIDENT_OPENED` | ADMIN, IN_APP+EMAIL, immediate |

Run with `npx ts-node scripts/seed-default-notification-policies.ts` from
`backend/`. It is not run automatically on boot/deploy — it must be invoked
explicitly per environment, and homologated per company before relying on
it in production (see `docs/notifications/security.md` pending items).

## API

- `GET/POST/PATCH/DELETE /api/notification-policies[/:id]` — CRUD, ADMIN/HR
  only. `DELETE` is a soft-disable (`isActive=false`), never a hard delete.
- `GET /api/notification-policies/event-catalog` — lists ACTIVE eventTypes
  only (for the Policy Builder's event dropdown).
- `POST /api/notification-policies/:id/test` — dry-run only
  (`{dryRun: true}` required in the body); resolves the real audience for
  each step and reports resolved-recipient counts and catalog-status
  warnings, but **never** creates a workflow or sends a real message.

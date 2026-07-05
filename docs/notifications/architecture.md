# Notification Engine — Architecture (Sprint 54)

## Why a new engine, and why it reuses existing infrastructure

Before this sprint, PresençaFlow had two separate ad-hoc notification paths:
`NotificationCenterService` (in-app notifications + digest) and
`NotificationEscalationRule` (a simple type/severity-based escalation timer).
Neither could express "notify the manager, then HR after 30 minutes, then
Admin after 2 hours, across IN_APP + WhatsApp, and don't notify again until
this is acknowledged."

The Notification Engine adds that capability as a **new layer on top of**,
not a replacement for, the existing infrastructure:

- The `IN_APP` channel provider (`notification-channel-provider.ts`) still
  writes through `NotificationCenterService.createOrUpdateByDedupeKey`, so
  every engine-triggered in-app alert already appears in the existing
  `/app/notifications` Notification Center and admin digest — no duplicate
  UI, no duplicate storage.
- `NotificationEscalationRule` (the legacy severity-based escalation) is
  **untouched and still running**. It is classified `ACTIVE_LEGACY` in the
  event catalog. No event is ever processed by both mechanisms — see
  "Event catalog" below.

### Explicit mechanism boundary

| | `NotificationEscalationRule` | `NotificationPolicy` / `NotificationPolicyStep` |
|---|---|---|
| Status | **LEGACY / MAINTENANCE** — kept running, not extended, not unified this sprint | **Target architecture** — the mechanism new event types should be wired to going forward |
| Model | Flat severity/type → delay → single target role | Ordered multi-step workflow, per-step recipient/channels/fallback |
| Scope | IN_APP only | IN_APP, WEB_PUSH, WHATSAPP, EMAIL |
| Applies to | Events already served by ad-hoc `NotificationCenterService` calls (`ACTIVE_LEGACY` in the catalog) | Events wired this sprint (`ACTIVE` in the catalog) |

A single eventType is never processed by both. Deciding to migrate an
`ACTIVE_LEGACY` event to the new engine is a future, explicit decision that
must remove the old ad-hoc call site in the same change — not done here.

## Components

| Component | File | Responsibility |
|---|---|---|
| Engine entry point | `notification-engine.service.ts` | `processDomainEvent()` — dedup, cooldown, policy lookup, workflow creation |
| Event catalog | `notification-engine.types.ts` | Governs which eventTypes may actually create a workflow |
| Audience resolution | `notification-audience.service.ts` | Turns a `recipientType` into concrete User(s)/Employee(s), tenant-scoped |
| Quiet hours | `notification-quiet-hours.service.ts` | Policy → Company → User precedence, timezone-aware (Luxon) |
| Templates | `notification-template.service.ts` | Tenant-then-global template resolution, allowlisted variable substitution |
| Channel providers | `notification-channel-provider.ts` | IN_APP, WEB_PUSH, WHATSAPP, EMAIL — each wraps an existing service |
| Dispatch | `notification-dispatch.service.ts` | Per-recipient, per-channel idempotent delivery, sequential/parallel fallback |
| Escalation | `notification-escalation.service.ts` | Advances/exhausts a workflow; `scanAndAdvance()` is the scheduler entry point |
| Acknowledgment | `notification-acknowledgment.service.ts` | ACK / RESOLVE / CANCEL semantics |
| Policy CRUD | `notification-policy.service.ts` + `routes/notification-policies.ts` | Tenant-scoped policy management, dry-run test |
| Workflow API | `routes/notification-workflows.ts` | List/get/acknowledge/resolve/cancel |

## Data model

- `NotificationPolicy` (+ `NotificationPolicyStep`): one policy per
  `(companyId, eventType)`, an ordered list of escalation steps.
- `NotificationWorkflowInstance`: one row per triggered event occurrence.
  Deduplicated via `@@unique([companyId, deduplicationKey])` where
  `deduplicationKey = eventType:aggregateType:aggregateId`. Carries a
  `payload Json?` snapshot (`{context, title, message, actionUrl}`) so the
  scheduler can execute later steps without the original call's in-memory
  context.
- `NotificationDeliveryAttempt`: one row per `(workflowInstanceId, stepOrder,
  recipient, channel)`, deduplicated via `@@unique([companyId,
  idempotencyKey])`.
- `NotificationQuietHours`: one row per company (singleton).
- `NotificationMessageTemplate`: tenant-specific (companyId set) or global
  (companyId null), enforced by two partial unique indexes added via raw SQL
  (see `migrations/20260707000000_notification_engine/migration.sql`) —
  Prisma's schema DSL cannot express a filtered/partial unique index.

## Scheduler, not delayed jobs

There is no BullMQ or equivalent in this stack. Escalation works by scanning:
`NotificationWorkflowInstance` rows with `status='ACTIVE' AND nextActionAt <=
now()`, in batches of 200, via `NotificationEscalationService.scanAndAdvance()`,
exposed at `POST /internal/jobs/notification-workflow-escalations/run`
(protected by `x-internal-job-secret`, same convention as every other
internal job). It must be invoked periodically by an external scheduler
(cron/systemd timer) — this sprint does not add a new in-process scheduler.
The route acquires `JobLock` before running and releases it in a `finally`,
matching the existing job-locking convention (see [[project-port-hardening]]
in memory / Sprint 52.1 audit).

## Event catalog: ACTIVE / ACTIVE_LEGACY / RESERVED

`notification-engine.types.ts#EVENT_CATALOG` is the single source of truth
for which eventTypes exist and whether they can currently fire:

- **ACTIVE** — wired to a real trigger point in this sprint. Listed in full
  in `docs/notifications/policies.md`.
- **ACTIVE_LEGACY** — a real trigger exists, but it is still served by the
  pre-existing ad-hoc `NotificationCenterService` calls (e.g. medical
  certificates, remote check-in reminders). Not migrated this sprint, to
  avoid double-processing the same event through two mechanisms.
- **RESERVED** — no confirmed, distinct origin exists in the codebase today
  (e.g. `EMPLOYEE_MISSED_CLOCK_IN` is not distinct from
  `REMOTE_CHECKIN_NOT_RESPONDED`). No wiring, no default policy. Creating a
  policy for a RESERVED event is allowed (for future-proofing) but it will
  never fire — the `/test` dry-run endpoint and the Policy Builder UI both
  surface a warning when this happens.

`NotificationPolicyService.findActivePolicy()` does not itself check the
catalog — `NotificationEngineService.processDomainEvent()` does, at the very
start, before any DB write. See `docs/notifications/policies.md` for the
complete catalog table.

## Known simplifications (honestly documented, not hidden)

- **Per-recipient cooldown** (`NOTIFICATION_RECIPIENT_MAX_PER_HOUR`) is
  approximated by a coarse `(companyId, eventType)` count over the cooldown
  window, not a true per-recipient counter. Documented in
  `notification-engine.service.ts#isRecipientCooldownActive`.
- **Delivery retry** does one quick inline retry on a transient failure
  (mirroring Calendar sync's `fetchWithRetry` precedent), then relies on the
  next escalation scan to retry further, up to `NOTIFICATION_MAX_RETRIES`.
  There is no separate retry-only scheduler.
- **WhatsApp requires `Employee.whatsapp`** — Users have no phone field in
  this schema, so WHATSAPP delivery is only possible when the resolved
  recipient has `recipientEmployeeId` set (e.g. `EMPLOYEE` recipient type).
  `DIRECT_MANAGER`/`HR`/`ADMIN` resolve to `User` records only, so WHATSAPP
  is a no-op (`NOTIFICATION_CHANNEL_UNAVAILABLE`, recorded as SKIPPED, never
  silently dropped) for those recipient types today.

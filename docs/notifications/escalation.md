# Escalation Semantics (Sprint 54)

## Workflow lifecycle

`PENDING → ACTIVE → (ACKNOWLEDGED) → RESOLVED | CANCELLED | EXHAUSTED | FAILED`

- A workflow is created `ACTIVE` by `NotificationEngineService.processDomainEvent()`
  once a matching active policy is found. If the first step's `delayMinutes`
  is `0`, it executes immediately in the same call; otherwise `nextActionAt`
  is set and the scheduler picks it up later.
- `NotificationEscalationService.scanAndAdvance()` (invoked by
  `POST /internal/jobs/notification-workflow-escalations/run`) finds every
  `ACTIVE` workflow whose `nextActionAt <= now()` (batch limit 200) and calls
  `executeStep()` on each.
- `executeStep()` dispatches the current step to its resolved audience, then:
  - If quiet hours defer the delivery, the **same step** stays current and
    `nextActionAt` is pushed to the deferral's `retryAfter` (or left for the
    next scan tick if no specific retry time is known).
  - Otherwise it advances `currentStep` and schedules `nextActionAt` for the
    next step's `delayMinutes` from now — or, if there is no next step or
    `maxEscalationLevel` has been reached, marks the workflow `EXHAUSTED`.
- If the policy backing a workflow has since been disabled
  (`isActive=false`), `scanAndAdvance()` cancels the workflow instead of
  advancing it (status `CANCELLED`).

## Acknowledgment vs Resolution — these are not the same thing

- **Acknowledge (ACK)** means "someone has seen this." It does **not**
  imply the underlying issue is fixed. Whether an ACK halts escalation
  depends on the **current step's** `stopOnAcknowledgment` flag:
  - `true` (the default): the workflow moves to `ACKNOWLEDGED`,
    `nextActionAt` is cleared, escalation stops.
  - `false`: the ACK is recorded (`acknowledgedAt`/`acknowledgedById` set)
    but the workflow stays `ACTIVE` and keeps escalating in the background
    — useful for "I've seen it, but I still want my manager notified if it
    isn't actually resolved."
- **Resolve** always halts escalation, unconditionally, regardless of any
  step's `stopOnAcknowledgment`. It requires a `reasonCode` from a fixed
  enum (`EMPLOYEE_CONTACTED`, `ISSUE_RESOLVED`, `FALSE_ALARM`,
  `MANUAL_OVERRIDE`, `DUPLICATE`, `OTHER`) plus optional free-text `notes`,
  stored in `resolutionReason`.
- **Cancel** is an administrative override, distinct from resolve (no
  `reasonCode` enum required, just a free-text `reason`).
- All three actions are **idempotent**: calling them again on an
  already-terminal workflow returns `{ok: true, alreadyTerminal: true}}`
  rather than erroring or double-processing.

## Who can act on a workflow

`NotificationAcknowledgmentService.canActOn()`: `ADMIN`, `HR`, and
`SUPER_ADMIN` roles can always act. Any other user can only act if they are
a recorded recipient of one of the workflow's `NotificationDeliveryAttempt`
rows (i.e. the notification was actually sent to them). This is checked
before every ACK/resolve/cancel call, and combined with the tenant scope
(`companyId` match) — a request for a workflow in another tenant or from a
non-recipient, non-admin user returns 404/403 without leaking whether the
workflow exists.

## Audience resolution timing — resolved live, frozen once attempted

`NotificationAudienceService.resolve()` is called fresh every time
`NotificationDispatchService.dispatchStep()` runs for a step — i.e. audience
is resolved **when the step becomes eligible** (trigger time for step 1
with `delayMinutes=0`, or scan time when the scheduler picks it up),
not once at policy-authoring time. This matters for `DIRECT_MANAGER`/`HR`/
`ADMIN`-type recipients, whose concrete membership can change between when
a workflow is created and when a later step actually runs (e.g. a manager
reassignment).

Once a `NotificationDeliveryAttempt` row exists for a given
`(workflowInstanceId, stepOrder, recipient, channel)` idempotency key, that
row's `recipientUserId`/`recipientEmployeeId` are **frozen** —
`notification-dispatch.service.ts#upsertAttempt()`'s update path only ever
touches status/timestamp/failure fields, never the recipient columns. If a
later re-resolution of the same step returns a *different* concrete
recipient (e.g. the manager changed), that produces a *new* idempotency key
and therefore a *new* delivery attempt row for the new recipient — it does
not silently redirect the old row. This means the delivery history is an
accurate, immutable record of who was actually notified at each attempt,
even if the underlying audience definition (`recipientType`) later resolves
to someone else.

## Reliability guarantees under concurrency

- Two simultaneous domain-event triggers for the same
  `(companyId, eventType, aggregateType, aggregateId)` create at most one
  workflow: `processDomainEvent()` does a `findUnique` first, and if the
  subsequent `create` still races and hits the
  `@@unique([companyId, deduplicationKey])` constraint (Postgres error
  P2002), it re-fetches and returns the winning row instead of throwing or
  duplicating. Covered by `tests/notification-engine-dedup.test.ts`
  (concurrent `Promise.all` test).
- `scanAndAdvance()` only ever operates on workflows whose `nextActionAt`
  has already passed; it does not lock rows against a second concurrent
  scheduler run in this sprint (see `docs/notifications/security.md` for
  the operational implication — run the scheduler job as a single
  instance, or accept idempotent-but-wasteful double dispatch attempts,
  which the delivery-attempt idempotency key still prevents from actually
  double-sending).

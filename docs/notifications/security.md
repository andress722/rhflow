# Notification Engine — Security & Tenant Isolation (Sprint 54)

## Tenant isolation

- Every table added this sprint (`NotificationPolicy`, `NotificationPolicyStep`
  via its parent, `NotificationWorkflowInstance`, `NotificationDeliveryAttempt`,
  `NotificationQuietHours`) is scoped by `companyId`, and every unique
  constraint that needs cross-tenant safety is composite
  (`@@unique([companyId, ...])`), never a bare global unique — this was an
  explicit correction carried over from Sprint 52.1's audit findings.
- `NotificationAudienceService`: `resolveSpecificUser()` and
  `resolveByRole()` both filter by `companyId` — a `SPECIFIC_USER` step can
  never resolve a user from another tenant, even if an attacker supplies a
  foreign `recipientReference` (covered by
  `tests/notification-engine-audience.test.ts`).
- API routes (`notification-policies.ts`, `notification-workflows.ts`) all
  scope every query by `request.user.companyId`. A request for another
  tenant's policy/workflow returns 404 (not 403), so existence is never
  leaked across tenants. Covered by
  `tests/notification-engine-api.test.ts`'s cross-tenant tests.
- `NotificationAcknowledgmentService.canActOn()` additionally requires the
  acting user to either hold an administrative role (`ADMIN`/`HR`/
  `SUPER_ADMIN`) or be a recorded recipient of the workflow — a same-tenant
  user who was never a recipient still cannot ACK/resolve/cancel someone
  else's workflow.

## Template rendering — no injection surface

`notification-template.service.ts#renderTemplate()` is pure string
substitution against a per-eventType **allowlist** of variable names
(`EVENT_ALLOWLISTS`). Anything not on the allowlist — including if the
caller's `variables` object happens to contain it — is stripped to an empty
string, never interpolated. There is no `eval`, no expression language, no
object/prototype traversal (`{{constructor}}`, `{{__proto__}}` render as
empty). Covered by `tests/notification-engine-template.test.ts`.

## No fabricated events, no fabricated success

- `NotificationEngineService.processDomainEvent()` rejects any `eventType`
  not classified `ACTIVE` in the catalog (`EVENT_NOT_ACTIVE`), so a policy
  configured for a `RESERVED` or mistyped eventType simply never fires —
  it cannot be triggered by guesswork from the frontend or from a stray
  internal call.
- Channel providers never report `SENT` unless the underlying service call
  actually succeeded (see `docs/notifications/provider-failures.md`).
- The `/test` dry-run endpoint is hard-gated by `dryRun: true` in the
  request body (zod literal, not a truthy-string check) and never creates a
  `NotificationWorkflowInstance` or calls a real channel provider — it only
  resolves audience and reports counts/warnings.

## Sensitive data handling

- `WORKFORCE_RISK_HIGH`'s default policy targets `HR`/`ADMIN` only, never
  `EMPLOYEE` — this is enforced by the seeded default policy, not by the
  engine itself (a company admin *could* misconfigure a policy to notify
  the employee directly; this is a configuration risk, not a code-level
  guarantee, and is called out in the Policy Builder's event description).
- `OperationalErrorLog`-derived notifications (`OPERATIONAL_INCIDENT_OPENED`)
  reuse the same `sanitizeMetadata`/`sanitizeString` redaction already
  applied before the log row is written in `app.ts` — the notification's
  `context` only carries `{route, errorCode}`, never raw request
  body/headers.

## Pending — not yet homologated / out of scope this sprint

- **External provider homologation**: WhatsApp/Email/Web Push delivery
  through the Notification Engine reuses the existing
  `WhatsAppService`/`NotificationEmailService`/`WebPushSenderService`
  integrations. Those integrations' own external-provider homologation
  status is tracked separately (see `docs/feature-status-matrix.md` and
  Sprint 52.1's Calendar homologation notes for the analogous OAuth case) —
  this sprint does not re-homologate them, it only adds a new internal
  routing layer on top.
- **Scheduler concurrency**: `scanAndAdvance()` does not itself acquire a
  per-workflow lock; the internal job route acquires a single `JobLock` for
  the whole scan, so this is safe as long as the job is not invoked by two
  overlapping external schedulers with different lock names. If the
  external cron/scheduler is misconfigured to run multiple instances under
  different job names, delivery idempotency (not double-locking) is the
  actual safety net.
- **Per-recipient cooldown** is approximated (see architecture.md) — a
  precise per-recipient rate limit was not implemented this sprint.
- **Frontend automated tests**: this Next.js frontend has no unit/component
  test runner configured (only Playwright e2e, not exercised for this
  sprint's new pages). The Policy Builder and Workflows tab were verified
  via `next build`'s static generation succeeding and manual code review,
  not via an automated UI test. This is an honest gap, not a hidden one.

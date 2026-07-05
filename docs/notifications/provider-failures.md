# Provider Failure Handling (Sprint 54)

## Transient vs Permanent classification

`notification-engine.types.ts`:

```
TRANSIENT_FAILURE_REASON_CODES = {
  NOTIFICATION_PROVIDER_RATE_LIMITED,
  NOTIFICATION_PROVIDER_TIMEOUT,
  NOTIFICATION_PROVIDER_UNAVAILABLE,
}

PERMANENT_FAILURE_REASON_CODES = {
  NOTIFICATION_RECIPIENT_NOT_FOUND,
  NOTIFICATION_CHANNEL_UNAVAILABLE,
  NOTIFICATION_PROVIDER_UNAUTHORIZED,
  NOTIFICATION_TEMPLATE_INVALID,
  NOTIFICATION_SUPPRESSED,
}
```

This mirrors the precedent established in Calendar Sync's `fetchWithRetry`
(Sprint 52.1): only failures the provider itself signals as retryable are
treated as transient.

## What happens on each

- **Transient failure**: `NotificationDispatchService.attemptChannel()` does
  exactly one quick inline retry (`retryBaseDelaySeconds * 0.1` seconds —
  intentionally short, since the escalation scheduler is the real retry
  loop across scan ticks). If it fails again, the delivery attempt is
  recorded `FAILED` with the transient reason code, `attemptNumber`
  increments, and it is picked up again whenever the workflow's step is
  re-evaluated (e.g. on the next `scanAndAdvance()` tick, if the workflow
  hasn't advanced past this step).
  - In `SEQUENTIAL` fallback mode, a transient failure on channel N does
    **not** fall through to channel N+1 — the channel gets another chance
    on the next attempt. Only a **permanent** failure falls through
    immediately.
- **Permanent failure**: recorded `FAILED` (or `SKIPPED`, for
  `NOTIFICATION_CHANNEL_UNAVAILABLE`/`NOTIFICATION_RECIPIENT_NOT_FOUND`) with
  no further inline retry. In `SEQUENTIAL` mode, falls through to the next
  channel immediately, in the same call.
- **Max retries exceeded**: once `attemptNumber >= NOTIFICATION_MAX_RETRIES`
  (default 3), further attempts short-circuit to `FAILED` with reason
  `NOTIFICATION_MAX_RETRIES_EXCEEDED` without calling the provider again.

## Idempotency

Every delivery attempt has a deterministic `idempotencyKey =
sha256(workflowInstanceId:stepOrder:recipientId:channel)`, unique per
`(companyId, idempotencyKey)`. Re-processing the same step for the same
recipient/channel (e.g. a re-run scheduler tick, or a retried HTTP request)
updates the same row rather than creating a duplicate. An already-`SENT`/
`DELIVERED` attempt is never re-sent.

**A real bug was found and fixed during test-writing for this sprint**: the
original `attemptChannel()` computed the `existing` row once via
`findUnique`, then reused that same (now-stale) reference for both the
`PROCESSING` upsert and the later `SENT`/`FAILED` upsert. Since the first
upsert already created the row, the second upsert saw `existing=null` again
and tried to `create` a second time with the same `idempotencyKey`,
violating the unique constraint and crashing every real dispatch. Fixed by
threading the row returned from the first upsert into the second call. See
`notification-dispatch.service.ts` and the regression test in
`tests/notification-engine-escalation.test.ts`.

### Native provider idempotency keys, and at-least-once vs exactly-once

`idempotencyKey` is generated and enforced at the PresençaFlow level
(unique DB constraint), independent of whether the underlying provider
understands idempotency at all. Provider-native support today:

- **Email (Nodemailer/SMTP)**: SMTP has no standard idempotency-key
  concept — `NotificationEmailService.send()` does not pass one. A retried
  send after an ambiguous failure (e.g. timeout with unknown outcome) can
  result in the recipient receiving the email twice. This is an
  **at-least-once** guarantee, not exactly-once, and is not hidden.
- **WhatsApp/Web Push**: `WhatsAppService.sendMessage()` and
  `WebPushSenderService.sendToUser()` are the pre-existing integrations
  from before this sprint; neither currently exposes a pass-through
  idempotency parameter to their underlying provider API. Same
  at-least-once caveat applies.
- If a future provider integration adds native idempotency-key support,
  the `idempotencyKey` already computed in `notification-dispatch.service.ts`
  should be passed through to it (via `ChannelSendPayload`) rather than a
  new key being minted — this is a documented extension point, not
  implemented this sprint since no current provider consumes it.

In short: PresençaFlow's own delivery-attempt bookkeeping guarantees a
logical delivery is never double-recorded, but cannot guarantee the
external provider itself never double-delivers on an ambiguous network
failure. This is an at-least-once system end-to-end today.

### Channel order (`channels` array)

The order of `NotificationPolicyStep.channels` is preserved from
input to storage (plain JSON array, no re-sorting) and is meaningful: in
`SEQUENTIAL` fallbackMode, `NotificationDispatchService.dispatchStep()`
iterates `step.channels` in array order, attempting the next one only
after the previous one fails permanently. In `PARALLEL` mode the order has
no runtime effect (all channels are attempted concurrently via
`Promise.all`), but is still preserved for consistent display in the
Policy Builder UI. The zod schema (`policyStepSchema` in
`notification-engine.schemas.ts`) validates: at least one channel, no
duplicates, and each value in the `ALLOWED_CHANNELS` enum — it does not
reorder the array.

## Channel-specific unavailability (never fabricated success)

- **Email**: `NotificationEmailService.isConfigured()` checks SMTP host/port
  before attempting to send. If not configured, `EmailChannelProvider`
  reports `NOTIFICATION_CHANNEL_UNAVAILABLE` rather than pretending to send.
- **WhatsApp**: requires `Employee.whatsapp` — only resolvable when the
  recipient has `recipientEmployeeId` set. `DIRECT_MANAGER`/`HR`/`ADMIN`
  recipients (User-only) always report `NOTIFICATION_CHANNEL_UNAVAILABLE`
  for this channel today.
- **Web Push**: requires at least one `WebPushSubscription` row for the
  recipient's `userId`. No subscriptions → `NOTIFICATION_CHANNEL_UNAVAILABLE`.
- Every unresolvable/unavailable case is recorded as a `SKIPPED` or `FAILED`
  `NotificationDeliveryAttempt` row with an explicit reason code — never
  silently dropped. This is covered by
  `tests/notification-engine-dispatch.test.ts`'s "unresolved recipient"
  test.

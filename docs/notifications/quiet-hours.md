# Quiet Hours (Sprint 54)

## This is a separate mechanism from the legacy per-preference quiet hours

`/app/settings/notifications` (existing, pre-Sprint-54 page) stores a
per-`NotificationPreference` `quietHoursStart`/`quietHoursEnd` pair used only
by the legacy ad-hoc notification path. Sprint 54 adds a **new**,
company-level singleton table, `NotificationQuietHours`, with its own
precedence rules, managed at `/app/settings/notification-policies` and
`GET/PUT /api/notification-quiet-hours`. They are intentionally not merged
(explicit sprint constraint: "não unifique o mecanismo legado").

## Precedence (highest to lowest): Policy → Company → User → Channel

Implemented in `NotificationQuietHoursService.evaluate()`:

1. **Policy-level `quietHoursBehavior`** on the triggering step:
   - `IGNORE` — bypasses quiet hours entirely for this step, regardless of
     company or user configuration.
   - `ALLOW_HIGH_PRIORITY` — bypasses **only** for `HIGH`/`CRITICAL`
     priority events; `LOW`/`NORMAL` remain subject to company/user windows.
   - `DEFER` (default) — no special-casing; falls through to steps 2-3.
2. **Company-level `NotificationQuietHours`** (if `isActive`): this is the
   organizational floor. If `now` (in the configured `timezone`) falls
   inside `[startTime, endTime)` on a listed day of week, the delivery
   defers.
3. **User-level `NotificationPreference.quietHoursStart/End`**: can only
   **add** restriction on top of the company floor, never remove it. If the
   company says "always send," a user's personal quiet hours can still
   defer their own delivery; if the company already defers, a narrower user
   window cannot un-defer it.
4. **Channel**: not currently differentiated — quiet hours apply uniformly
   across all channels of a step. A future refinement could exempt, say,
   IN_APP (silent) from a window that blocks WHATSAPP/WEB_PUSH (audible push).

## Window matching (`isWithinQuietWindow`, pure function, Luxon-based)

- `daysOfWeek` uses JS convention (`0=Sunday..6=Saturday`) and refers to the
  day the window **starts** on.
- Same-day windows (`start < end`, e.g. `12:00-14:00`): applies only while
  `now` is inside `[start, end)` on a listed day.
- Midnight-crossing windows (`start > end`, e.g. `22:00-07:00`): splits into
  a "late segment" (`now >= start` on a listed day) and an "early segment"
  (`now < end` on the day **after** a listed day). Both are evaluated
  independently — see `notification-quiet-hours.service.ts` and its test
  suite (`tests/notification-engine-quiet-hours.test.ts`, 7 pure-function
  cases including exact midnight-crossing boundaries).
- A zero-length window (`start === end`) never applies.

## Deferral behavior

When quiet hours defer a delivery, `NotificationDispatchService` reports
`deferredUntil` back to the escalation service, which keeps the **same
step** current and pushes `nextActionAt` to the company window's `endTime`
(computed for "today" or "tomorrow," whichever is next). If there is no
company-level `endTime` to anchor to (e.g. only a user-level restriction
applied), the workflow is picked up again on the next scheduler scan tick
without a specific target time.

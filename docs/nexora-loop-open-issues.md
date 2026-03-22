# Nexora Loop — Known Issues & Limitations

**Last Updated:** March 2026

---

## Open Issues

### 1. In-Memory Loop State Does Not Survive Restart
**Severity:** Medium  
**Status:** Documented limitation

The in-memory loop toggle (`enabled`, interval, `isRunning` lock) lives in process memory. If the server restarts (e.g. Replit workflow restart), the in-memory loop state is reset to disabled.

**Mitigation:** The pg-boss `NEXORA_LOOP` queue runs independently every 30 minutes regardless of the in-memory state. Autonomous operation is maintained through pg-boss even after restart.

**Future Fix:** Persist loop configuration to the `partnerSettings` table (or a dedicated `nexoraConfig` table) and restore it on server boot.

---

### 2. No Per-Stage Granular Run Metrics
**Severity:** Low  
**Status:** Backlog

The `nexoraRuns` table records aggregate counts (total signals, outreach runs) but doesn't log per-stage timing or individual stage success/failure. Debugging which stage failed requires reading server logs.

**Future Fix:** Add `stagesJson` JSONB column to `nexoraRuns` recording per-stage: name, startedAt, durationMs, success, itemsProcessed.

---

### 3. No Webhook or External Trigger for Loop
**Severity:** Low  
**Status:** Not planned

The loop can only be triggered via:
- `/api/nexora/loop/run-now` (authenticated admin endpoint)
- pg-boss 30-minute schedule

There is no external webhook URL for triggering from third-party systems (Zapier, n8n, CRM webhooks, etc.).

**Future Fix:** Add a signed webhook endpoint with HMAC verification.

---

### 4. Run History Not Paginated
**Severity:** Low  
**Status:** Acceptable for current scale

`GET /api/nexora/history` returns the last 50 runs (hardcoded limit). This is acceptable for now but will need cursor-based pagination at higher run volumes.

---

### 5. No Email Notification on Loop Failure
**Severity:** Medium  
**Status:** Not implemented

If the Nexora loop fails (exception during a stage), the failure is recorded in the DB and logs, but no alert is sent to the admin.

**Future Fix:** On `success: false`, send an email via the SMTP integration to `sales@thecorporatedesk.com.au` with the error summary.

---

### 6. pg-boss and In-Memory Can Conflict
**Severity:** Low  
**Status:** Handled by lock guard

Both the pg-boss schedule and the in-memory interval can fire near-simultaneously. The `isRunning` lock guard prevents concurrent execution, but the second trigger will silently skip and return `{ skipped: true }`.

No data corruption risk, but the log will show "skipped" entries when both fire close together.

---

## Resolved Issues

| Issue | Resolution |
|-------|-----------|
| `serial is not defined` crash | Added `serial` to drizzle-orm/pg-core imports |
| Multiple Nexora entry points creating race conditions | Centralised into single `runNexoraCycle()` function |
| No run history persistence | Added `nexoraRuns` table + persistence on every cycle |

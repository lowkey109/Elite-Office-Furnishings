# Nexora Autonomous Loop — Technical Documentation

**System:** The Corporate Desk — Nexora AI Engine  
**Last Updated:** March 2026  
**Author:** AI Build Agent

---

## Overview

Nexora is the autonomous intelligence loop powering The Corporate Desk's backend operations. It runs as a persistent scheduled process that performs radar scanning, deal signal enrichment, lead scoring, and outreach generation without manual intervention.

The loop is the single source of truth for all Nexora execution — no external component calls Nexora logic directly; everything routes through `runNexoraCycle()`.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              NEXORA LOOP ENGINE                 │
│         server/services/nexoraLoop.ts           │
│                                                 │
│  runNexoraCycle(trigger: "manual"|"auto")       │
│  ├── Lock guard (prevents concurrent runs)      │
│  ├── Stage 1: Radar signal scan                 │
│  ├── Stage 2: Deal signal enrichment            │
│  ├── Stage 3: Lead scoring + prioritisation     │
│  ├── Stage 4: Outreach generation               │
│  ├── Stage 5: Follow-up sequence management     │
│  └── Persist run record to DB (nexoraRuns)      │
└─────────────────────────────────────────────────┘
         ▲                    ▲
         │ Manual trigger     │ Auto trigger (30-min schedule)
    /api/nexora/          pg-boss
    loop/run-now          NEXORA_LOOP queue
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/nexoraLoop.ts` | Core loop engine — `runNexoraCycle()` |
| `server/nexoraOrchestrator.ts` | Stage-level orchestration (radar, deals, outreach) |
| `server/services/intelligenceScheduler.ts` | pg-boss job scheduling (registers NEXORA_LOOP queue) |
| `server/services/jobOrchestrator.ts` | Job routing and error handling |
| `client/src/pages/AdminNexoraCommandCentre.tsx` | Admin UI for loop control + run history |

---

## Loop Control API

### Loop Status
```
GET /api/nexora/loop/status
```
Returns: `enabled`, `running`, `status`, `intervalMs`, `nextRunAt`, `lastFinishedAt`, `lastMessage`, `lastTrigger`

### Run Immediately
```
POST /api/nexora/loop/run-now
```
Triggers a manual cycle. Returns 409 if already running.

### Start Autonomous Loop
```
POST /api/nexora/loop/start
Body: { intervalMs: 1800000 }
```
Enables in-memory interval loop at the given frequency.

### Stop Autonomous Loop
```
POST /api/nexora/loop/stop
```
Clears the in-memory interval.

### Update Interval
```
PATCH /api/nexora/loop/config
Body: { intervalMs: 900000 }
```
Min: 5 minutes. Max: 24 hours.

---

## Run History

Run records are persisted to the `nexoraRuns` table with:
- `startedAt`, `finishedAt`, `durationMs`
- `success` (boolean)
- `processed` (leads processed)
- `outreachRuns`, `outreachFailed`
- `radarSignals`, `dealSignals`
- `message` (summary)
- `trigger` ("manual" | "auto")

View history: `GET /api/nexora/history`

---

## Scheduling

Two independent scheduling mechanisms exist:

1. **pg-boss (persistent):** The `NEXORA_LOOP` queue is registered with a 30-minute cron schedule in `intelligenceScheduler.ts`. This persists across server restarts and runs even if the in-memory toggle is disabled.

2. **In-memory interval (volatile):** Started via the Admin Command Centre or `POST /api/nexora/loop/start`. This interval is reset on every server restart.

> **Note:** Both mechanisms can run simultaneously. The lock guard in `runNexoraCycle()` prevents concurrent execution.

---

## Lock Guard

The loop uses a process-level boolean lock (`isRunning`) to prevent concurrent cycles. If a second trigger arrives while a cycle is running, it returns `{ skipped: true }` without starting a new cycle.

---

## Admin UI

Navigate to `/admin/nexora` to access the Nexora Command Centre. Features:
- Live status card (auto-refreshes every 5s)
- Run Now button
- Loop start/stop/interval controls
- Full run history table with outcome, signals, outreach counts, and duration

---

## OpenAI Integration

All Nexora AI calls use the Replit AI integration pattern:

```typescript
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
```

Do NOT use `process.env.OPENAI_API_KEY` — this will fail.

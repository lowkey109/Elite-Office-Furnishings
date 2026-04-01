# Nexora Runtime Integration Fix — April 1, 2026

## Problem

Every Nexora run was failing silently with "Could not acquire Nexora run lock".

### Root Cause

The orchestrator (`nexoraOrchestrator.ts`) was written expecting **object-style parameters** and specific return shapes, but `nexora-support.ts` was implemented with **positional string arguments** and different return types. This caused 14 function mismatches that broke the engine completely at runtime.

Three cascading failures resulted:

1. `acquireRunLock` received an object `{key, runId, ttlSeconds}` instead of a plain `runId` string. It coerced the object to `"[object Object]"` in the database insert, succeeded, but returned `true` (not `{acquired: true}`). The orchestrator checked `runLock?.acquired` which was always `undefined`, so every run bailed out with the lock error — even though a lock row **was** being written to the DB.

2. `validateSignal` returned `{overallValid: true}` but the orchestrator checked `validation.valid`. Since `.valid` was always `undefined` (falsy), **every signal failed validation** and nothing was ever pushed to pipeline or radar.

3. `checkDuplicateAgainstKnowledge` returned a `DuplicateCheckResult` object `{isDuplicate, ambiguous}` — always truthy — but the orchestrator used it as a boolean. So `!duplicate` was always `false`, blocking all outreach pushes even for valid, non-duplicate signals.

---

## Changes Made

### 1. `server/services/intelligence/nexora/nexora-types.ts`

Added 6 missing type definitions that the orchestrator imported but did not exist:

- `NexoraDecisionAction` — union of all valid decision action strings (`"push_pipeline"`, `"push_radar"`, `"both"`, `"hold"`, `"ignore"`, `"review"`)
- `NexoraDecisionRecordLike` — rich decision record interface used by the orchestrator for per-signal decisions
- `NexoraSignalLike` — union of `DealHunterSignalLike | RadarSignalLike` with `__sourceType` field
- `NexoraRunContext` — run trigger metadata
- `NexoraEngineLearningSummary` — learning output summary shape
- `NexoraEngineResult` — orchestrator run result envelope

Updated `NexoraConfig` — all fields made optional so both the orchestrator's config shape and the support module's internal config can coexist without conflicts.

---

### 2. `server/services/intelligence/nexora/nexora-support.ts`

Added imports for the new types (`NexoraDecisionAction`, `NexoraDecisionRecordLike`, `NexoraPriority`).

Fixed all 14 function signatures:

| Function | Old signature | New signature |
|---|---|---|
| `acquireRunLock` | `(runId: string) → boolean` | `({key, runId, ttlSeconds}) → {acquired: boolean}` |
| `releaseRunLock` | `(runId: string)` | `({key, runId})` |
| `fireWebhook` | `(url, payload, config)` | `({runId, signal, action, priority, estimatedValue}) → boolean` |
| `syncVectorKnowledge` | `(key, vector, metadata, config)` | `({signal, action, priority}) → boolean` |
| `checkDuplicateAgainstKnowledge` | `(signal, knowledgeMap: Map)` | `({signal, fingerprint, knowledgeMap}) → boolean` |
| `claimIdempotencyKey` | `(key, action, signalId, companyName) → boolean` | `({key, ttlSeconds, meta}) → {claimed: boolean}` |
| `buildRuleDecision` | `(signal, radarMatch, thresholds, knowledgeMatch)` | `({signal, thresholds, validation, duplicate, anomaly, estimatedValue}) → NexoraDecisionRecordLike` |
| `finalizeDecision` | `(ruleDecision, candidate) → NormalizedAIDecision` | `({signal, ruleDecision, aiDecision, ...}) → NexoraDecisionRecordLike` |
| `detectAnomaly` | `(signal, winRate: number) → boolean` | `(signal, knowledgeMap: Record) → boolean` |
| `upsertKnowledgeEntry` | `(entryKey: string, updates: Partial<KnowledgeEntry>)` | `(entry: KnowledgeEntry)` |
| `createAuditLog` | `(runId, event, payload, status)` | `({runId, level, event, message, meta})` |
| `completeIdempotencyKey` | `(key, status)` | `({key, meta})` |
| `computeSignalFingerprint` | `(signal, action: string)` | `(signal, action = "signal")` — action now optional |
| `validateSignal` | returned `{overallValid}` only | now returns `{overallValid, valid}` — added `valid` alias |

Also updated `upsertDecisionRecord` to accept the orchestrator's richer record shape (with `fingerprint`, `estimatedValue`, `validation`, `duplicate`, `reasons`, `whatsappSent`, `vectorSynced`, `sourceType`, `createdAt`) instead of the old shape expecting `idempotencyKey`, `ruleDecision`, `ensembleDecision`, `finalDecision`.

Fixed `acquireRunLock` logic — previously deleted ALL locks for the key before inserting (causing a lock-and-immediately-delete race condition). Now only deletes **expired** locks, preserving any active concurrent lock so the second caller correctly gets `{acquired: false}`.

---

### 3. `server/routes.ts`

One old-style call updated at line 11014:

```ts
// Before (old two-argument style)
await upsertKnowledgeEntry(knowledgeKey, { companyKey, ... });

// After (new single-object style)
await upsertKnowledgeEntry({ id: knowledgeKey, companyKey, ... });
```

---

### 4. Database

Cleared the stale lock row that was stuck in `nexora_run_locks` with no `released_at`:

```sql
DELETE FROM nexora_run_locks WHERE lock_key = 'nexora_main';
```

---

## Verification Results

| Test | Result |
|---|---|
| Server startup | Clean — no errors |
| `POST /api/nexora/run` (first run) | `ok: true` in 18.7s |
| `POST /api/nexora/run` (second run) | `ok: true` in 16.4s — re-entrancy confirmed |
| `nexora_run_locks` after each run | 0 rows — lock released cleanly |
| `GET /api/nexora/decisions` | `{"decisions":[],"total":0}` — 200 OK |
| `GET /api/nexora/thresholds/current` | `{"current":null,"history":[]}` — 200 OK |
| `GET /api/nexora/outcomes/stats` | `{"total":0,...}` — 200 OK |
| `POST /api/nexora/outcomes` (win record) | `{"ok":true,"outcomeId":"43c6edae..."}` — feedback loop working |
| `GET /api/nexora/outcomes/stats` after win | `{"total":1,"wins":1,"winRate":1,"avgDeal":75000}` — recalibration active |

Scanners are running (Google News fetching 100s of articles, SmartCompany, Startup Daily active). Zero signals processed because OpenAI GPT classification is hitting a 429 quota limit and Adzuna API keys are not configured — these are external credential issues, not code issues.

import fs from "fs";
import path from "path";
import {
  claimAndRunNexoraSafeTasks,
  createNexoraDurableTask,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";

const JOURNAL_DIR = path.resolve(process.cwd(), "data/nexora/fallback-journal");
const JOURNAL_FILE = path.join(JOURNAL_DIR, "nexora-fallback-journal.jsonl");
const STATE_FILE = path.join(JOURNAL_DIR, "nexora-resilience-state.json");

type ResilienceMode = "normal" | "degraded_db" | "fallback_only" | "replay_ready" | "maintenance";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function ensureJournalDir() {
  fs.mkdirSync(JOURNAL_DIR, { recursive: true });
}

function safeReadJson(file: string, fallback: any) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function appendJsonl(file: string, value: any) {
  ensureJournalDir();
  fs.appendFileSync(file, JSON.stringify(value) + "\n", "utf8");
}

function readJsonl(file: string) {
  ensureJournalDir();
  if (!fs.existsSync(file)) return [];

  return fs.readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return {
          ok: false,
          corrupted: true,
          raw: line,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
}

function writeState(state: any) {
  ensureJournalDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function getState() {
  return safeReadJson(STATE_FILE, {
    ok: true,
    nexoraBrain: true,
    mode: "normal",
    createdAt: now(),
    updatedAt: now(),
    counters: {
      fallbackCaptured: 0,
      replayAttempted: 0,
      replaySucceeded: 0,
      replayFailed: 0,
    },
  });
}

export async function detectNexoraResilienceMode(): Promise<Record<string, any>> {
  ensureJournalDir();

  const state = getState();
  const journalEntries = readJsonl(JOURNAL_FILE);

  const result: any = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_resilience_core",
    generatedAt: now(),
    journal: {
      dir: JOURNAL_DIR,
      file: JOURNAL_FILE,
      entries: journalEntries.length,
      pendingReplay: journalEntries.filter((e: any) => !e.replayedAt && !e.corrupted).length,
      corrupted: journalEntries.filter((e: any) => e.corrupted).length,
    },
    db: {
      available: false,
      error: null,
      ensured: null,
    },
    mode: "normal" as ResilienceMode,
    state,
  };

  try {
    const ensured = await ensureNexoraDurableKernel();
    result.db.available = true;
    result.db.ensured = ensured;
  } catch (error) {
    result.db.available = false;
    result.db.error = error instanceof Error ? error.message : String(error);
  }

  if (!result.db.available) {
    result.mode = "degraded_db";
  }

  if (!result.db.available && result.journal.pendingReplay > 0) {
    result.mode = "fallback_only";
  }

  if (result.db.available && result.journal.pendingReplay > 0) {
    result.mode = "replay_ready";
  }

  const nextState = {
    ...state,
    mode: result.mode,
    updatedAt: now(),
    lastDbError: result.db.error,
    journal: result.journal,
  };

  writeState(nextState);

  result.state = nextState;

  return result;
}

export async function captureNexoraFallbackEvent(input: any = {}) {
  ensureJournalDir();

  const event = {
    ok: true,
    nexoraBrain: true,
    fallbackId: String(input.fallbackId || makeId("fallback")),
    type: String(input.type || "task"),
    worker: String(input.worker || "nexora_fallback_worker"),
    area: String(input.area || "resilience"),
    action: String(input.action || "capture_fallback_event"),
    risk: String(input.risk || "safe"),
    priority: Number(input.priority || 50),
    payload: input.payload || {},
    source: String(input.source || "nexora.resilience.fallback"),
    capturedAt: now(),
    replayedAt: null,
  };

  appendJsonl(JOURNAL_FILE, event);

  const state = getState();
  state.counters = state.counters || {};
  state.counters.fallbackCaptured = Number(state.counters.fallbackCaptured || 0) + 1;
  state.updatedAt = now();
  state.mode = "fallback_only";
  writeState(state);

  return {
    ok: true,
    nexoraBrain: true,
    captured: true,
    event,
    journalFile: JOURNAL_FILE,
  };
}

export async function safeCreateNexoraTaskOrFallback(input: any = {}) {
  try {
    const result = await createNexoraDurableTask({
      worker: String(input.worker || "nexora_safe_task"),
      area: String(input.area || "operations"),
      action: String(input.action || "safe_task"),
      risk: input.risk || "safe",
      priority: Number(input.priority || 50),
      payload: input.payload || {},
      approvalRequired: Boolean(input.approvalRequired),
      source: input.source || "nexora.resilience.safe_create",
    });

    return {
      ok: true,
      nexoraBrain: true,
      mode: "durable",
      result,
    };
  } catch (error) {
    const fallback = await captureNexoraFallbackEvent({
      type: "durable_task_fallback",
      worker: input.worker || "nexora_safe_task",
      area: input.area || "operations",
      action: input.action || "safe_task",
      risk: input.risk || "safe",
      priority: Number(input.priority || 50),
      payload: {
        original: input,
        durableError: error instanceof Error ? error.message : String(error),
      },
      source: input.source || "nexora.resilience.safe_create.fallback",
    });

    return {
      ok: true,
      nexoraBrain: true,
      mode: "fallback",
      durableError: error instanceof Error ? error.message : String(error),
      fallback,
    };
  }
}

export async function replayNexoraFallbackJournal(input: any = {}) {
  ensureJournalDir();

  const limit = Number(input.limit || 25);
  const dryRun = Boolean(input.dryRun);
  const entries = readJsonl(JOURNAL_FILE);
  const pending = entries.filter((entry: any) => !entry.replayedAt && !entry.corrupted).slice(0, limit);

  const results: any[] = [];

  for (const entry of pending) {
    if (dryRun) {
      results.push({
        fallbackId: entry.fallbackId,
        dryRun: true,
        wouldReplay: true,
      });
      continue;
    }

    try {
      const result = await createNexoraDurableTask({
        worker: entry.worker,
        area: entry.area,
        action: entry.action,
        risk: entry.risk || "safe",
        priority: Number(entry.priority || 50),
        payload: {
          replayedFromFallback: true,
          fallbackId: entry.fallbackId,
          originalPayload: entry.payload,
          capturedAt: entry.capturedAt,
        },
        approvalRequired: entry.risk === "high" || entry.risk === "critical",
        source: "nexora.resilience.replay",
      });

      results.push({
        fallbackId: entry.fallbackId,
        ok: true,
        result,
      });
    } catch (error) {
      results.push({
        fallbackId: entry.fallbackId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const succeeded = results.filter((r: any) => r.ok).length;
  const failed = results.filter((r: any) => r.ok === false).length;

  const state = getState();
  state.counters = state.counters || {};
  state.counters.replayAttempted = Number(state.counters.replayAttempted || 0) + results.length;
  state.counters.replaySucceeded = Number(state.counters.replaySucceeded || 0) + succeeded;
  state.counters.replayFailed = Number(state.counters.replayFailed || 0) + failed;
  state.updatedAt = now();
  writeState(state);

  return {
    ok: failed === 0,
    nexoraBrain: true,
    service: "nexora_fallback_replay",
    dryRun,
    limit,
    pendingConsidered: pending.length,
    succeeded,
    failed,
    results,
  };
}

export async function getNexoraFallbackJournal(input: any = {}) {
  ensureJournalDir();

  const limit = Number(input.limit || 50);
  const entries = readJsonl(JOURNAL_FILE);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_fallback_journal",
    generatedAt: now(),
    journalFile: JOURNAL_FILE,
    count: entries.length,
    pendingReplay: entries.filter((entry: any) => !entry.replayedAt && !entry.corrupted).length,
    rows: entries.slice(-limit).reverse(),
  };
}

export async function runNexoraResilienceCycle(input: any = {}) {
  const mode = await detectNexoraResilienceMode();

  const safetyTask = await safeCreateNexoraTaskOrFallback({
    worker: "nexora_resilience_core",
    area: "resilience",
    action: "resilience_cycle_heartbeat",
    risk: "safe",
    priority: 85,
    payload: {
      mode,
      input,
      generatedAt: now(),
    },
    source: "nexora.resilience.cycle",
  });

  let replay = null;

  if (mode.mode === "replay_ready" && input.autoReplay === true) {
    replay = await replayNexoraFallbackJournal({
      limit: Number(input.replayLimit || 25),
      dryRun: false,
    });
  }

  let execution = null;

  try {
    execution = await claimAndRunNexoraSafeTasks(Number(input.safeRunLimit || 20));
  } catch (error) {
    execution = {
      ok: false,
      fallbackCaptured: await captureNexoraFallbackEvent({
        type: "safe_execution_failure",
        worker: "nexora_resilience_core",
        area: "resilience",
        action: "safe_execution_failed",
        risk: "safe",
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
      }),
    };
  }

  try {
    await writeNexoraOperatingReport(
      "resilience_cycle",
      mode.mode === "normal" ? "info" : "warning",
      "Nexora resilience cycle completed",
      `Resilience cycle completed in ${mode.mode} mode.`,
      {
        mode,
        safetyTask,
        replay,
        execution,
      }
    );
  } catch {
    await captureNexoraFallbackEvent({
      type: "report_fallback",
      worker: "nexora_resilience_core",
      area: "resilience",
      action: "resilience_report_fallback",
      risk: "safe",
      payload: {
        mode,
        safetyTask,
        replay,
        execution,
      },
    });
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_resilience_cycle",
    mode,
    safetyTask,
    replay,
    execution,
  };
}

export async function getNexoraMaintenanceConsole() {
  const mode = await detectNexoraResilienceMode();
  const journal = await getNexoraFallbackJournal({ limit: 20 });

  let snapshot: any = null;

  try {
    snapshot = await getNexoraDurableCommandSnapshot();
  } catch (error) {
    snapshot = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      note: "Durable snapshot unavailable. Nexora fallback journal remains active.",
    };
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_maintenance_console",
    generatedAt: now(),
    mode,
    journal,
    snapshot,
    recommendedActions: [
      mode.mode === "fallback_only" ? "Postgres is unavailable/full. Keep using fallback journal until storage is upgraded." : "Durable DB appears available.",
      journal.pendingReplay > 0 ? "After Postgres upgrade, run fallback replay in dryRun mode first." : "No fallback replay backlog detected.",
      "Keep high-risk supplier, customer, worker retirement, and trading actions approval-gated.",
      "Run /api/nexora/resilience/cycle to continue safe operation during DB outage.",
    ],
  };
}

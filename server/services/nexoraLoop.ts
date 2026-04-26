// server/services/nexoraLoop.ts

import {
  runNexoraCycle,
  isNexoraCycleRunning,
  } from "./intelligence/nexoraOrchestrator";

type NexoraCycleResult = Awaited<ReturnType<typeof runNexoraCycle>>;

import { runWhatsAppDispatchCycle } from "./intelligence/communications/whatsappScheduler";

interface NexoraLoopState {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastResult: NexoraCycleResult | null;
  lastError: string | null;
  runCount: number;
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_INTERVAL_MS = 60_000; // 1 minute

let loopTimer: NodeJS.Timeout | null = null;
let loopEnabled = false;
let loopIntervalMs = DEFAULT_INTERVAL_MS;

let lastRunAt: string | null = null;
let lastResult: NexoraCycleResult | null = null;
let lastError: string | null = null;
let runCount = 0;

async function executeLoopRun(source = "loop"): Promise<NexoraCycleResult> {
  lastRunAt = new Date().toISOString();

  // Run Nexora
  const result = await runNexoraCycle(source as any, {});
  lastResult = result;
  runCount += 1;

  if ((result as any).ok === false || (result as any).success === false) {
    lastError = (result as any).errors?.[0] ?? (result as any).message ?? "Unknown loop error";
  } else {
    lastError = null;
  }

  // Run WhatsApp dispatch cycle AFTER nexora, never blocking nexora result
  try {
    await runWhatsAppDispatchCycle();
  } catch (e: any) {
    // Don't fail the Nexora loop if WhatsApp scheduler fails
    console.warn("[NexoraLoop] WhatsApp dispatch cycle failed:", e?.message || e);
  }

  return result;
}

function clearLoopTimer() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

function startTimer() {
  clearLoopTimer();

  loopTimer = setInterval(async () => {
    if (!loopEnabled) return;

    // Prevent overlap (extra safety). Orchestrator also guards, but this keeps logs clean.
    if (isNexoraCycleRunning()) {
      return;
    }

    try {
      await executeLoopRun("loop");
    } catch (e: any) {
      lastError = e?.message || "Loop tick failed";
      console.error("[NexoraLoop] Tick failed:", lastError);
    }
  }, loopIntervalMs);
}

export async function triggerNexoraLoopRunNow(): Promise<NexoraCycleResult> {
  return executeLoopRun("manual-loop-trigger");
}

export function getNexoraLoopState(): NexoraLoopState {
  return {
    enabled: loopEnabled,
    running: isNexoraCycleRunning(),
    intervalMs: loopIntervalMs,
    lastRunAt,
    lastResult,
    lastError,
    runCount,
  };
}

export function setNexoraLoopInterval(intervalMs: number): NexoraLoopState {
  const nextInterval =
    Number.isFinite(intervalMs) && intervalMs >= MIN_INTERVAL_MS
      ? intervalMs
      : DEFAULT_INTERVAL_MS;

  loopIntervalMs = nextInterval;

  if (loopEnabled) {
    startTimer();
  }

  return getNexoraLoopState();
}

export function startNexoraLoop(intervalMs?: number): NexoraLoopState {
  if (typeof intervalMs === "number") {
    setNexoraLoopInterval(intervalMs);
  }

  if (loopEnabled) {
    // already running -> restart timer with current interval
    startTimer();
    console.log(
      `[NexoraLoop] Loop already enabled — restarted (interval ${Math.round(
        loopIntervalMs / 1000
      )}s)`
    );
    return getNexoraLoopState();
  }

  loopEnabled = true;
  startTimer();

  // Run immediately on start so admin can verify Nexora is actually operating.
  if (!isNexoraCycleRunning()) {
    void executeLoopRun("loop-start").catch((e: any) => {
      lastError = e?.message || "Immediate loop-start run failed";
      console.error("[NexoraLoop] Immediate run failed:", lastError);
    });
  }

  console.log(
    `[NexoraLoop] Autonomous loop started — interval ${Math.round(
      loopIntervalMs / 1000
    )}s`
  );

  return getNexoraLoopState();
}

export function stopNexoraLoop(): NexoraLoopState {
  clearLoopTimer();
  loopEnabled = false;

  console.log("🛑 NEXORA LOOP stopped");
  return getNexoraLoopState();
}
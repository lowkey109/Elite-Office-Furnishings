import { runNexoraEngine, type NexoraResult } from "../nexoraOrchestrator";
import { db } from "../db";
import { nexoraRuns } from "@shared/schema";

export type NexoraTrigger = "manual" | "auto";

interface NexoraCycleResult extends NexoraResult {
  skipped: boolean;
  skippedReason?: string;
  trigger: NexoraTrigger;
  runId?: number;
}

let nexoraRunning = false;
let nexoraLoopEnabled = false;
let nexoraLoopIntervalMs = 30 * 60 * 1000; // 30 minutes
let nexoraLoopTimer: ReturnType<typeof setTimeout> | null = null;

let nexoraLastStartedAt: string | null = null;
let nexoraLastFinishedAt: string | null = null;
let nexoraLastMessage: string = "Awaiting first run";
let nexoraStatus: "idle" | "running" | "success" | "failed" = "idle";
let nexoraLastTrigger: NexoraTrigger | null = null;

export function getNexoraLoopState() {
  const now = Date.now();
  const nextRunAt = nexoraLoopEnabled && nexoraLoopTimer && nexoraLastFinishedAt
    ? new Date(new Date(nexoraLastFinishedAt).getTime() + nexoraLoopIntervalMs).toISOString()
    : null;

  return {
    enabled: nexoraLoopEnabled,
    running: nexoraRunning,
    status: nexoraStatus,
    intervalMs: nexoraLoopIntervalMs,
    nextRunAt,
    lastStartedAt: nexoraLastStartedAt,
    lastFinishedAt: nexoraLastFinishedAt,
    lastMessage: nexoraLastMessage,
    lastTrigger: nexoraLastTrigger,
  };
}

export async function runNexoraCycle(trigger: NexoraTrigger): Promise<NexoraCycleResult> {
  if (nexoraRunning) {
    console.log(`[NexoraLoop] Skipping ${trigger} trigger — already running`);
    return {
      skipped: true,
      skippedReason: "A Nexora run is already active",
      trigger,
      success: false,
      processed: 0,
      outreachRuns: 0,
      outreachFailed: 0,
      radarSignals: 0,
      dealSignals: 0,
      errors: ["Already running"],
      message: "Skipped — already running",
      durationMs: 0,
    };
  }

  nexoraRunning = true;
  nexoraStatus = "running";
  nexoraLastStartedAt = new Date().toISOString();
  nexoraLastTrigger = trigger;

  console.log(`[NexoraLoop] Starting cycle — trigger: ${trigger}`);

  try {
    const result = await runNexoraEngine();

    nexoraStatus = result.success ? "success" : "failed";
    nexoraLastFinishedAt = new Date().toISOString();
    nexoraLastMessage = result.message;

    try {
      const [row] = await db.insert(nexoraRuns).values({
        startedAt: new Date(nexoraLastStartedAt),
        finishedAt: new Date(nexoraLastFinishedAt),
        success: result.success,
        processed: result.processed,
        outreachRuns: result.outreachRuns,
        outreachFailed: result.outreachFailed,
        radarSignals: result.radarSignals,
        dealSignals: result.dealSignals,
        errorsJson: result.errors,
        message: result.message,
        durationMs: result.durationMs,
      }).returning({ id: nexoraRuns.id });

      console.log(`[NexoraLoop] Cycle persisted — runId: ${row?.id}, trigger: ${trigger}`);

      return { ...result, skipped: false, trigger, runId: row?.id };
    } catch (dbErr: any) {
      console.error("[NexoraLoop] DB persist failed:", dbErr?.message);
      return { ...result, skipped: false, trigger };
    }
  } catch (err: any) {
    nexoraStatus = "failed";
    nexoraLastFinishedAt = new Date().toISOString();
    nexoraLastMessage = err?.message || "Nexora cycle failed";

    console.error("[NexoraLoop] Cycle error:", err?.message);

    return {
      skipped: false,
      trigger,
      success: false,
      processed: 0,
      outreachRuns: 0,
      outreachFailed: 0,
      radarSignals: 0,
      dealSignals: 0,
      errors: [err?.message || "Unknown error"],
      message: nexoraLastMessage,
      durationMs: 0,
    };
  } finally {
    nexoraRunning = false;
  }
}

function scheduleNextRun() {
  if (nexoraLoopTimer) {
    clearTimeout(nexoraLoopTimer);
    nexoraLoopTimer = null;
  }
  if (!nexoraLoopEnabled) return;

  nexoraLoopTimer = setTimeout(async () => {
    if (!nexoraLoopEnabled) return;
    console.log("[NexoraLoop] Scheduled auto-run triggered");
    await runNexoraCycle("auto");
    scheduleNextRun();
  }, nexoraLoopIntervalMs);
}

export function startNexoraLoop(intervalMs?: number): void {
  if (intervalMs && intervalMs > 0) {
    nexoraLoopIntervalMs = intervalMs;
  }
  if (nexoraLoopEnabled) {
    console.log("[NexoraLoop] Loop already enabled — restarting with new interval");
    stopNexoraLoop();
  }
  nexoraLoopEnabled = true;
  scheduleNextRun();
  console.log(`[NexoraLoop] Autonomous loop started — interval: ${nexoraLoopIntervalMs / 1000}s`);
}

export function stopNexoraLoop(): void {
  nexoraLoopEnabled = false;
  if (nexoraLoopTimer) {
    clearTimeout(nexoraLoopTimer);
    nexoraLoopTimer = null;
  }
  console.log("[NexoraLoop] Autonomous loop stopped");
}

export function setNexoraLoopInterval(intervalMs: number): void {
  if (intervalMs < 60_000) {
    throw new Error("Interval must be at least 60 seconds");
  }
  nexoraLoopIntervalMs = intervalMs;
  if (nexoraLoopEnabled) {
    stopNexoraLoop();
    startNexoraLoop(intervalMs);
  }
  console.log(`[NexoraLoop] Interval updated to ${intervalMs / 1000}s`);
}

// server/services/nexoraLoop.ts
//
// Durable Nexora worker controller.
// No in-process setInterval loop is used here. Startup/control routes schedule
// pg-boss repeat jobs, and pg-boss provides locking/retry/resume semantics.

import {
  runNexoraCycle,
  isNexoraCycleRunning,
} from "./intelligence/nexoraOrchestrator";

import {
  initJobOrchestrator,
  registerWorker,
  scheduleJob,
  QUEUES,
} from "./jobOrchestrator";

import { runWhatsAppDispatchCycle } from "./intelligence/communications/whatsappScheduler";
import { runFollowUpScheduler } from "./followUpScheduler";

type NexoraCycleResult = Awaited<ReturnType<typeof runNexoraCycle>>;

interface NexoraLoopState {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastResult: NexoraCycleResult | null;
  lastError: string | null;
  runCount: number;
  workerMode: "pg-boss";
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_INTERVAL_MS = 60_000; // 1 minute

let loopEnabled = false;
let loopIntervalMs = DEFAULT_INTERVAL_MS;
let workersRegistered = false;

let lastRunAt: string | null = null;
let lastResult: NexoraCycleResult | null = null;
let lastError: string | null = null;
let runCount = 0;

function cronFromIntervalMs(intervalMs: number): string {
  const minutes = Math.max(1, Math.round(intervalMs / 60_000));
  if (minutes <= 1) return "* * * * *";
  if (minutes >= 60 && minutes % 60 === 0) return `0 */${Math.max(1, Math.round(minutes / 60))} * * *`;
  return `*/${Math.min(59, minutes)} * * * *`;
}

async function executeLoopRun(source = "pg-boss-loop"): Promise<NexoraCycleResult> {
  lastRunAt = new Date().toISOString();

  const result = await runNexoraCycle(source as any, {});
  lastResult = result;
  runCount += 1;

  if ((result as any).ok === false || (result as any).success === false) {
    lastError = (result as any).errors?.[0] ?? (result as any).message ?? "Unknown loop error";
  } else {
    lastError = null;
  }

  return result;
}

async function registerDurableWorkers(): Promise<boolean> {
  if (workersRegistered) return true;

  const ready = await initJobOrchestrator();
  if (!ready) {
    lastError = "pg-boss unavailable — durable workers not registered";
    return false;
  }

  await registerWorker(QUEUES.NEXORA_LOOP, async () => {
    if (!loopEnabled) return;
    if (isNexoraCycleRunning()) return;
    await executeLoopRun("pg-boss-loop");
  });

  await registerWorker(QUEUES.WHATSAPP_DISPATCH, async () => {
    await runWhatsAppDispatchCycle();
  });

  await registerWorker(QUEUES.FOLLOWUPS_SEND, async () => {
    await runFollowUpScheduler();
  });

  await registerWorker(QUEUES.PHANTOMX_PAPER_TICK, async () => {
    const { runPhantomXPaperLoopOnceIfEnabled } = await import("./trading/phantomXPaperLearner");
    await runPhantomXPaperLoopOnceIfEnabled();
  });

  await registerWorker(QUEUES.PHANTOMX_MARKET_FAST, async () => {
    const { runMarketFastCycleOnce } = await import("./trading/marketLoop");
    await runMarketFastCycleOnce();
  });

  await registerWorker(QUEUES.PHANTOMX_MARKET_DETAILED, async () => {
    const { runMarketDetailedCycleOnce } = await import("./trading/marketLoop");
    await runMarketDetailedCycleOnce();
  });

  await registerWorker(QUEUES.PHANTOMX_MARKET_PRUNE, async () => {
    const { runMarketPruneOnce } = await import("./trading/marketLoop");
    await runMarketPruneOnce();
  });

  workersRegistered = true;
  return true;
}

async function scheduleDurableRepeats(): Promise<void> {
  const cron = cronFromIntervalMs(loopIntervalMs);

  await scheduleJob(QUEUES.NEXORA_LOOP, { source: "repeat" }, {
    repeatEvery: cron,
    singletonKey: "nexora-loop-repeat",
  });

  await scheduleJob(QUEUES.WHATSAPP_DISPATCH, { source: "nexora-worker" }, {
    repeatEvery: "*/5 * * * *",
    singletonKey: "whatsapp-dispatch-repeat",
  });

  await scheduleJob(QUEUES.FOLLOWUPS_SEND, { source: "nexora-worker" }, {
    repeatEvery: "0 * * * *",
    singletonKey: "followups-send-repeat",
  });

  await scheduleJob(QUEUES.PHANTOMX_PAPER_TICK, { source: "nexora-worker" }, {
    repeatEvery: "*/5 * * * *",
    singletonKey: "phantomx-paper-tick-repeat",
  });

  if (process.env.PHANTOM_X_MARKET_LOOP_ENABLED === "true") {
    await scheduleJob(QUEUES.PHANTOMX_MARKET_FAST, { source: "controlled-worker" }, {
      repeatEvery: "*/1 * * * *",
      singletonKey: "phantomx-market-fast-repeat",
    });

    await scheduleJob(QUEUES.PHANTOMX_MARKET_DETAILED, { source: "controlled-worker" }, {
      repeatEvery: "*/5 * * * *",
      singletonKey: "phantomx-market-detailed-repeat",
    });

    await scheduleJob(QUEUES.PHANTOMX_MARKET_PRUNE, { source: "controlled-worker" }, {
      repeatEvery: "0 */6 * * *",
      singletonKey: "phantomx-market-prune-repeat",
    });
  }
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
    workerMode: "pg-boss",
  };
}

export function setNexoraLoopInterval(intervalMs: number): NexoraLoopState {
  const nextInterval =
    Number.isFinite(intervalMs) && intervalMs >= MIN_INTERVAL_MS
      ? intervalMs
      : DEFAULT_INTERVAL_MS;

  loopIntervalMs = nextInterval;

  if (loopEnabled) {
    void scheduleDurableRepeats().catch((e: any) => {
      lastError = e?.message || "Failed to reschedule durable Nexora loop";
      console.error("[NexoraLoop] Reschedule failed:", lastError);
    });
  }

  return getNexoraLoopState();
}

export function startNexoraLoop(intervalMs?: number): NexoraLoopState {
  if (typeof intervalMs === "number") {
    setNexoraLoopInterval(intervalMs);
  }

  loopEnabled = true;

  void (async () => {
    const registered = await registerDurableWorkers();
    if (!registered) return;

    await scheduleDurableRepeats();

    if (!isNexoraCycleRunning()) {
      await executeLoopRun("loop-start");
    }

    console.log(
      `[NexoraLoop] Durable pg-boss loop started — interval ${Math.round(loopIntervalMs / 1000)}s`
    );
  })().catch((e: any) => {
    lastError = e?.message || "Failed to start durable Nexora loop";
    console.error("[NexoraLoop] Start failed:", lastError);
  });

  return getNexoraLoopState();
}

export function stopNexoraLoop(): NexoraLoopState {
  loopEnabled = false;
  console.log("🛑 NEXORA LOOP disabled — pg-boss workers remain registered but skip loop jobs");
  return getNexoraLoopState();
}

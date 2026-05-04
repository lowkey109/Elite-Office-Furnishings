import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const STATE_FILE = nexoraLocalPath("active-loop", "nexora-active-loop-state.json");
const HEARTBEAT_LOG = nexoraLocalPath("active-loop", "heartbeats", "heartbeats.jsonl");
const RUN_LOG = nexoraLocalPath("active-loop", "runs", "runs.jsonl");
const JOURNAL = nexoraLocalPath("active-loop", "journal", "active-loop-journal.jsonl");

let timer: NodeJS.Timeout | null = null;
let running = false;

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function getState() {
  return readNexoraJson(STATE_FILE, {
    ok: true,
    nexoraBrain: true,
    service: "nexora_active_local_loop_state",
    enabled: true,
    running: false,
    intervalMs: 60000,
    tickCount: 0,
    lastTickAt: null,
    lastDailyAt: null,
    lastHourlyAt: null,
    createdAt: now(),
    updatedAt: now(),
  });
}

function saveState(next: any) {
  writeNexoraJson(STATE_FILE, {
    ...next,
    updatedAt: now(),
  });
}

function minutesSince(iso: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

async function optionalCall(label: string, fn: () => any | Promise<any>) {
  try {
    const result = await fn();
    return {
      ok: true,
      label,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      label,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runSafeStatusCalls() {
  const calls: any[] = [];

  calls.push(await optionalCall("timeline_heartbeat", async () =>
    recordNexoraTimelineEvent({
      type: "active_loop",
      title: "Nexora active local loop heartbeat",
      severity: "info",
      payload: {
        mode: "local_only",
      },
    }),
  ));

  calls.push(await optionalCall("metric_heartbeat", async () =>
    recordNexoraMetric({
      name: "nexora_active_local_loop_heartbeat",
      value: 1,
      unit: "tick",
      dimensions: {
        mode: "local_only",
      },
    }),
  ));

  try {
    const office = await import(String("../officeagents/nexoraOfficeFurnitureAgents"));
    calls.push(await optionalCall("office_agents_status", () => office.getNexoraOfficeFurnitureAgentsStatus()));
  } catch (error) {
    calls.push({
      ok: false,
      label: "office_agents_status",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const teaching = await import(String("../teaching/nexoraTeachingEngine"));
    calls.push(await optionalCall("teaching_status", () => teaching.getNexoraTeachingStatus()));
  } catch (error) {
    calls.push({
      ok: false,
      label: "teaching_status",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const rewards = await import(String("../rewards/nexoraRewardEngine"));
    calls.push(await optionalCall("reward_status", () => rewards.getNexoraRewardStatus()));
  } catch (error) {
    calls.push({
      ok: false,
      label: "reward_status",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const boundary = await import(String("../humanboundary/nexoraHumanBoundaryDoctrine"));
    calls.push(await optionalCall("human_boundary_status", () => boundary.getNexoraHumanBoundaryStatus()));
  } catch (error) {
    calls.push({
      ok: false,
      label: "human_boundary_status",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return calls;
}

async function runHourlyCalls() {
  const calls: any[] = [];

  try {
    const completion = await import(String("../companycompletion/nexoraAICompanyOperatingCompletion"));
    calls.push(await optionalCall("company_completion_briefing", () =>
      completion.createNexoraDailyBriefingFinal({
        briefingId: `loop_hourly_${Date.now()}`,
      }),
    ));
  } catch (error) {
    calls.push({
      ok: false,
      label: "company_completion_briefing",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const humanOps = await import(String("../humanops/nexoraHumanLoopBusinessOps"));
    calls.push(await optionalCall("human_ops_briefing", () =>
      humanOps.createNexoraHumanOpsBriefing({
        briefingId: `loop_hourly_${Date.now()}`,
      }),
    ));
  } catch (error) {
    calls.push({
      ok: false,
      label: "human_ops_briefing",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return calls;
}

async function runDailyCalls() {
  const calls: any[] = [];

  try {
    const companyRun = await import(String("../companyrun/nexoraCompanyRunEngine"));
    calls.push(await optionalCall("company_daily_cycle", () =>
      companyRun.runNexoraCompanyDailyCycle({
        cycleId: `loop_daily_${Date.now()}`,
      }),
    ));
  } catch (error) {
    calls.push({
      ok: false,
      label: "company_daily_cycle",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const companyV2 = await import(String("../companyv2/nexoraAICompanyV2Engine"));
    calls.push(await optionalCall("company_v2_daily_run", () =>
      companyV2.runNexoraCompanyV2DailyRun({
        runId: `loop_daily_${Date.now()}`,
      }),
    ));
  } catch (error) {
    calls.push({
      ok: false,
      label: "company_v2_daily_run",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const localMaster = await import(String("../localmaster/nexoraLocalMasterControl"));
    calls.push(await optionalCall("local_master_run", () =>
      localMaster.runNexoraLocalMasterRun({
        runId: `loop_daily_${Date.now()}`,
      }),
    ));
  } catch (error) {
    calls.push({
      ok: false,
      label: "local_master_run",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return calls;
}

export async function runNexoraActiveLocalLoopTick(input: any = {}) {
  const state = getState();
  const tickId = String(input.tickId || nexoraLocalId("active_tick"));
  const forceHourly = Boolean(input.forceHourly);
  const forceDaily = Boolean(input.forceDaily);

  const shouldRunHourly = forceHourly || minutesSince(state.lastHourlyAt) >= 60;
  const shouldRunDaily = forceDaily || minutesSince(state.lastDailyAt) >= 24 * 60;

  const statusCalls = await runSafeStatusCalls();
  const hourlyCalls = shouldRunHourly ? await runHourlyCalls() : [];
  const dailyCalls = shouldRunDaily ? await runDailyCalls() : [];

  const tick = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_active_local_loop_tick",
    tickId,
    createdAt: now(),
    mode: "local_only",
    noPostgres: true,
    noRailway: true,
    noLiveTrading: true,
    shouldRunHourly,
    shouldRunDaily,
    statusCalls,
    hourlyCalls,
    dailyCalls,
    failedCalls: [...statusCalls, ...hourlyCalls, ...dailyCalls].filter((call: any) => !call.ok).length,
  };

  appendNexoraJsonl(HEARTBEAT_LOG, {
    event: "active_loop.heartbeat",
    tickId,
    createdAt: now(),
  });

  appendNexoraJsonl(RUN_LOG, {
    event: "active_loop.tick",
    tick,
    createdAt: now(),
  });

  const nextState = {
    ...state,
    running,
    enabled: true,
    tickCount: Number(state.tickCount || 0) + 1,
    lastTickAt: now(),
    lastHourlyAt: shouldRunHourly ? now() : state.lastHourlyAt,
    lastDailyAt: shouldRunDaily ? now() : state.lastDailyAt,
    lastTickId: tickId,
  };

  saveState(nextState);
  journal("active_loop.tick", tick);

  return tick;
}

export function startNexoraActiveLocalLoop(input: any = {}) {
  const state = getState();
  const intervalMs = Number(input.intervalMs || state.intervalMs || process.env.NEXORA_LOCAL_LOOP_INTERVAL_MS || 60000);
  const enabled = input.enabled !== false && process.env.NEXORA_LOCAL_LOOP_DISABLED !== "true";

  if (!enabled) {
    saveState({
      ...state,
      enabled: false,
      running: false,
      intervalMs,
      updatedAt: now(),
    });

    return {
      ok: true,
      nexoraBrain: true,
      started: false,
      running: false,
      enabled: false,
      reason: "Local loop disabled by input or NEXORA_LOCAL_LOOP_DISABLED=true",
    };
  }

  if (timer) {
    return {
      ok: true,
      nexoraBrain: true,
      started: false,
      running: true,
      alreadyRunning: true,
      intervalMs,
    };
  }

  running = true;

  saveState({
    ...state,
    enabled: true,
    running: true,
    intervalMs,
    startedAt: now(),
    updatedAt: now(),
  });

  timer = setInterval(() => {
    runNexoraActiveLocalLoopTick({}).catch((error) => {
      journal("active_loop.error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  runNexoraActiveLocalLoopTick({
    tickId: `startup_${Date.now()}`,
  }).catch((error) => {
    journal("active_loop.startup_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    ok: true,
    nexoraBrain: true,
    started: true,
    running: true,
    enabled: true,
    intervalMs,
    mode: "local_only",
  };
}

export function stopNexoraActiveLocalLoop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  running = false;

  const state = getState();
  saveState({
    ...state,
    running: false,
    stoppedAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    stopped: true,
    running: false,
  };
}

export function getNexoraActiveLocalLoopStatus() {
  const state = getState();
  const ticks = readNexoraJsonl(RUN_LOG)
    .filter((row: any) => row.event === "active_loop.tick")
    .map((row: any) => row.tick)
    .slice(-20)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_active_local_loop_status",
    generatedAt: now(),
    processRunning: Boolean(timer),
    state,
    recentTicks: ticks,
    safety: {
      localOnly: true,
      noPostgres: true,
      noRailway: true,
      noLiveTrading: true,
      humansOnlyApproveSignCommit: true,
    },
  };
}

export function seedNexoraActiveLocalLoopDefaults() {
  const state = getState();

  saveState({
    ...state,
    enabled: true,
    running: Boolean(timer),
    intervalMs: Number(state.intervalMs || 60000),
    seededAt: now(),
  });

  journal("active_loop.defaults_seeded", {
    intervalMs: Number(state.intervalMs || 60000),
  });

  return {
    ok: true,
    nexoraBrain: true,
    seeded: true,
    state: getState(),
  };
}

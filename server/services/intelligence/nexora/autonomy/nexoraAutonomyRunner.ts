import {
  queueNexoraTask,
  recordNexoraHeartbeat,
  generateNexoraDailyReport,
  getNexoraAutonomyFoundationStatus,
} from "./nexoraAutonomyFoundation";

type RunnerState = {
  enabled: boolean;
  lastRunAt: string | null;
  runCount: number;
  safeMode: boolean;
};

const state: RunnerState = {
  enabled: true,
  lastRunAt: null,
  runCount: 0,
  safeMode: true,
};

export function getNexoraAutonomyRunnerStatus() {
  return {
    ok: true,
    service: "nexora_autonomy_runner",
    nexoraBrain: true,
    state,
    rule: "Runs safe hands-free office, trading-paper, learning, and safety tasks only.",
    updatedAt: new Date().toISOString(),
  };
}

export function updateNexoraAutonomyRunner(input: any = {}) {
  if (typeof input.enabled === "boolean") state.enabled = input.enabled;
  if (typeof input.safeMode === "boolean") state.safeMode = input.safeMode;

  return {
    ok: true,
    service: "nexora_autonomy_runner",
    state,
    updatedAt: new Date().toISOString(),
  };
}

export function runNexoraAutonomyRunnerTick(input: any = {}) {
  if (!state.enabled) {
    return {
      ok: true,
      service: "nexora_autonomy_runner",
      action: "SKIPPED_DISABLED",
      state,
      updatedAt: new Date().toISOString(),
    };
  }

  const tasks = [
    queueNexoraTask({
      worker: "office_receptionist",
      area: "office",
      action: "capture_and_qualify_new_leads",
      risk: "safe",
      payload: { tick: true, input },
    }),
    queueNexoraTask({
      worker: "office_pipeline",
      area: "office",
      action: "review_pipeline_and_priority_actions",
      risk: "safe",
      payload: { tick: true },
    }),
    queueNexoraTask({
      worker: "prediction_scanner",
      area: "trading",
      action: "memory_only_paper_scan_status",
      risk: "safe",
      payload: { tick: true },
    }),
    queueNexoraTask({
      worker: "memory_backtester",
      area: "learning",
      action: "run_safe_memory_backtest_status",
      risk: "safe",
      payload: { tick: true },
    }),
    queueNexoraTask({
      worker: "db_health_gate",
      area: "safety",
      action: "check_database_recovery_and_write_gate",
      risk: "safe",
      payload: { tick: true },
    }),
  ];

  recordNexoraHeartbeat({
    worker: "nexora_autonomy_runner",
    area: "core",
    status: "alive",
    message: `Runner tick queued ${tasks.length} safe tasks.`,
  });

  const report = generateNexoraDailyReport();

  state.lastRunAt = new Date().toISOString();
  state.runCount += 1;

  return {
    ok: true,
    service: "nexora_autonomy_runner",
    nexoraBrain: true,
    action: "SAFE_TICK_COMPLETED",
    queuedTasks: tasks.length,
    tasks: tasks.map((x) => x.task),
    report,
    foundation: getNexoraAutonomyFoundationStatus(),
    state,
    updatedAt: new Date().toISOString(),
  };
}

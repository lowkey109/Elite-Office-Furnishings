import { runNexoraAutonomyRunnerTick } from "./nexoraAutonomyRunner";
import { runNexoraBulkSafeExecution, getNexoraOperatingSnapshot } from "./nexoraAutonomyExecutor";
import { generateNexoraDailyReport, recordNexoraHeartbeat } from "./nexoraAutonomyFoundation";

const supervisorRuns: any[] = [];

function now() {
  return new Date().toISOString();
}

export function runNexoraSupervisorCycle(input: any = {}) {
  const runner: any = runNexoraAutonomyRunnerTick({
    source: input.source || "supervisor_cycle",
  });

  const tasks = Array.isArray(runner.tasks) ? runner.tasks : [];

  const execution = runNexoraBulkSafeExecution({
    tasks,
  });

  const report = generateNexoraDailyReport();

  const heartbeat = recordNexoraHeartbeat({
    worker: "nexora_autonomy_supervisor",
    area: "core",
    status: "alive",
    message: `Supervisor ran ${tasks.length} tasks. Safe executed: ${execution.executed}. Held: ${execution.held}.`,
  });

  const snapshot = getNexoraOperatingSnapshot();

  const run = {
    id: `supervisor_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ok: true,
    service: "nexora_autonomy_supervisor",
    nexoraBrain: true,
    mode: "safe_hands_free_supervision",
    runner,
    execution,
    report,
    heartbeat,
    snapshot,
    createdAt: now(),
  };

  supervisorRuns.unshift(run);
  if (supervisorRuns.length > 100) supervisorRuns.length = 100;

  return run;
}

export function getNexoraSupervisorStatus() {
  return {
    ok: true,
    service: "nexora_autonomy_supervisor",
    nexoraBrain: true,
    mode: "safe_hands_free_supervision",
    runCount: supervisorRuns.length,
    lastRun: supervisorRuns[0] || null,
    capabilities: [
      "run safe autonomy cycle",
      "execute safe queued tasks",
      "hold risky actions",
      "record heartbeat",
      "generate report",
      "produce operating snapshot"
    ],
    rule: "Nexora can supervise safe work without human hands; risky actions remain approval-gated.",
    updatedAt: now(),
  };
}

export function getNexoraSupervisorRuns(limit = 30) {
  return {
    ok: true,
    service: "nexora_autonomy_supervisor_runs",
    count: supervisorRuns.length,
    rows: supervisorRuns.slice(0, Number(limit) || 30),
    updatedAt: now(),
  };
}

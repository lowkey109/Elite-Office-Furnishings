import { getNexoraAutonomyFoundationStatus, getNexoraTasks, getNexoraApprovals, getNexoraReports, getNexoraHeartbeats } from "./nexoraAutonomyFoundation";
import { getNexoraSupervisorStatus } from "./nexoraAutonomySupervisor";
import { getNexoraAutonomyRunnerStatus } from "./nexoraAutonomyRunner";
import { getNexoraSchedules } from "./nexoraSchedulerControl";
import { getNexoraOperatingSnapshot } from "./nexoraAutonomyExecutor";

export function getNexoraCommandCentre() {
  const foundation = getNexoraAutonomyFoundationStatus();
  const runner = getNexoraAutonomyRunnerStatus();
  const supervisor = getNexoraSupervisorStatus();
  const schedules = getNexoraSchedules();
  const tasks = getNexoraTasks(50);
  const approvals = getNexoraApprovals(50);
  const reports = getNexoraReports(10);
  const heartbeats = getNexoraHeartbeats(50);
  const snapshot = getNexoraOperatingSnapshot();

  const pendingApprovals = approvals.rows.filter((a: any) => a.status === "pending").length;
  const queuedTasks = tasks.rows.filter((t: any) => t.status === "queued").length;

  return {
    ok: true,
    service: "nexora_command_centre",
    nexoraBrain: true,
    mode: "safe_autonomy_command_centre",
    health: {
      foundation: foundation.ok,
      runner: runner.ok,
      supervisor: supervisor.ok,
      schedules: schedules.ok,
      snapshot: snapshot.ok,
    },
    counts: {
      schedules: schedules.count,
      tasks: tasks.count,
      queuedTasks,
      approvals: approvals.count,
      pendingApprovals,
      reports: reports.count,
      heartbeats: heartbeats.count,
    },
    nextActions: [
      pendingApprovals > 0 ? "Review pending approval queue." : "No risky approvals pending.",
      queuedTasks > 0 ? "Run supervisor/executor to process safe queued tasks." : "No queued safe tasks waiting.",
      "Keep DB-heavy jobs gated until Postgres is healthy.",
      "Attach persistent DB storage after upgrade.",
      "Add admin UI panel to view this command centre."
    ],
    foundation,
    runner,
    supervisor,
    schedules,
    tasks,
    approvals,
    reports,
    heartbeats,
    snapshot,
    updatedAt: new Date().toISOString(),
  };
}

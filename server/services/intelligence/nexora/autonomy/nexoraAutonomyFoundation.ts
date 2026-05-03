type TaskStatus = "queued" | "running" | "completed" | "failed" | "held_for_approval";
type TaskRisk = "safe" | "medium" | "high";

type NexoraTask = {
  id: string;
  worker: string;
  area: "office" | "trading" | "learning" | "safety" | "core";
  action: string;
  risk: TaskRisk;
  status: TaskStatus;
  payload: any;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const tasks: NexoraTask[] = [];
const heartbeats: any[] = [];
const approvals: any[] = [];
const reports: any[] = [];

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

export function queueNexoraTask(input: any = {}) {
  const risk: TaskRisk = input.risk || "safe";

  const task: NexoraTask = {
    id: id("nexora_task"),
    worker: String(input.worker || "unknown_worker"),
    area: input.area || "core",
    action: String(input.action || "unknown_action"),
    risk,
    status: risk === "high" ? "held_for_approval" : "queued",
    payload: input.payload || {},
    createdAt: now(),
    updatedAt: now(),
  };

  tasks.unshift(task);

  if (risk === "high") {
    approvals.unshift({
      id: id("approval"),
      taskId: task.id,
      worker: task.worker,
      action: task.action,
      reason: "High-risk task requires human approval.",
      status: "pending",
      createdAt: now(),
    });
  }

  if (tasks.length > 500) tasks.length = 500;
  if (approvals.length > 200) approvals.length = 200;

  return { ok: true, service: "nexora_task_queue", task, updatedAt: now() };
}

export function getNexoraTasks(limit = 100) {
  return {
    ok: true,
    service: "nexora_task_queue",
    count: tasks.length,
    rows: tasks.slice(0, Number(limit) || 100),
    updatedAt: now(),
  };
}

export function getNexoraApprovals(limit = 100) {
  return {
    ok: true,
    service: "nexora_approval_queue",
    count: approvals.length,
    rows: approvals.slice(0, Number(limit) || 100),
    updatedAt: now(),
  };
}

export function recordNexoraHeartbeat(input: any = {}) {
  const heartbeat = {
    id: id("heartbeat"),
    worker: String(input.worker || "unknown_worker"),
    area: String(input.area || "core"),
    status: String(input.status || "alive"),
    message: String(input.message || "Worker heartbeat recorded."),
    createdAt: now(),
  };

  heartbeats.unshift(heartbeat);
  if (heartbeats.length > 300) heartbeats.length = 300;

  return { ok: true, service: "nexora_worker_heartbeat", heartbeat, updatedAt: now() };
}

export function getNexoraHeartbeats(limit = 100) {
  return {
    ok: true,
    service: "nexora_worker_heartbeat",
    count: heartbeats.length,
    rows: heartbeats.slice(0, Number(limit) || 100),
    updatedAt: now(),
  };
}

export function runNexoraSafeAutonomyCycle(input: any = {}) {
  const cycleId = id("autonomy_cycle");

  const safeJobs = [
    queueNexoraTask({
      worker: "office_receptionist",
      area: "office",
      action: "check_new_office_leads",
      risk: "safe",
      payload: { source: "autonomy_cycle" },
    }),
    queueNexoraTask({
      worker: "prediction_scanner",
      area: "trading",
      action: "memory_only_scanner_health_check",
      risk: "safe",
      payload: { source: "autonomy_cycle" },
    }),
    queueNexoraTask({
      worker: "memory_backtester",
      area: "learning",
      action: "safe_backtest_status_check",
      risk: "safe",
      payload: { source: "autonomy_cycle" },
    }),
    queueNexoraTask({
      worker: "db_health_gate",
      area: "safety",
      action: "check_db_write_safety",
      risk: "safe",
      payload: { source: "autonomy_cycle" },
    }),
  ];

  recordNexoraHeartbeat({
    worker: "nexora_autonomy_foundation",
    area: "core",
    status: "alive",
    message: `Safe autonomy cycle ${cycleId} queued ${safeJobs.length} safe jobs.`,
  });

  return {
    ok: true,
    service: "nexora_safe_autonomy_cycle",
    nexoraBrain: true,
    cycleId,
    queuedJobs: safeJobs.length,
    jobs: safeJobs.map((x) => x.task),
    rule: "Nexora can run safe observation, reporting, scoring, and routing tasks hands-free. Risky tasks go to approval.",
    updatedAt: now(),
  };
}

export function generateNexoraDailyReport() {
  const report = {
    id: id("report"),
    service: "nexora_daily_report",
    nexoraBrain: true,
    summary: {
      queuedTasks: tasks.filter((t) => t.status === "queued").length,
      heldForApproval: tasks.filter((t) => t.status === "held_for_approval").length,
      heartbeats: heartbeats.length,
      approvalsPending: approvals.filter((a) => a.status === "pending").length,
    },
    areas: {
      office: tasks.filter((t) => t.area === "office").length,
      trading: tasks.filter((t) => t.area === "trading").length,
      learning: tasks.filter((t) => t.area === "learning").length,
      safety: tasks.filter((t) => t.area === "safety").length,
      core: tasks.filter((t) => t.area === "core").length,
    },
    recommendations: [
      "Keep DB-heavy tasks gated until Postgres is healthy.",
      "Office lead capture can run hands-free.",
      "Trading remains paper/memory-only until live adapter and approval gates are explicitly enabled.",
      "Use approval queue for risky external messaging, data deletion, live execution, or production secrets."
    ],
    createdAt: now(),
  };

  reports.unshift(report);
  if (reports.length > 60) reports.length = 60;

  return { ok: true, service: "nexora_daily_report", report, updatedAt: now() };
}

export function getNexoraReports(limit = 30) {
  return {
    ok: true,
    service: "nexora_daily_report",
    count: reports.length,
    rows: reports.slice(0, Number(limit) || 30),
    updatedAt: now(),
  };
}

export function getNexoraAutonomyFoundationStatus() {
  return {
    ok: true,
    service: "nexora_autonomy_foundation",
    nexoraBrain: true,
    mode: "safe_hands_free_foundation",
    capabilities: [
      "task queue",
      "approval queue",
      "worker heartbeat",
      "safe autonomy cycle",
      "daily report",
      "office worker routing",
      "trading worker routing",
      "learning worker routing",
      "safety worker routing"
    ],
    handsFreeAllowed: [
      "lead capture",
      "lead qualification",
      "memory-only paper scanning",
      "status checks",
      "backtesting",
      "daily reports",
      "heartbeats",
      "safe recommendations"
    ],
    handsFreeBlocked: [
      "real-money execution",
      "external customer messaging without approval",
      "deleting production data",
      "changing secrets",
      "deploying failed typecheck builds"
    ],
    counts: {
      tasks: tasks.length,
      approvals: approvals.length,
      heartbeats: heartbeats.length,
      reports: reports.length,
    },
    updatedAt: now(),
  };
}

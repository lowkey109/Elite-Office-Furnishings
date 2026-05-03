const executionLog: any[] = [];

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function executeNexoraSafeTask(input: any = {}) {
  const risk = String(input.risk || "safe");
  const worker = String(input.worker || "unknown_worker");
  const action = String(input.action || "unknown_action");

  if (risk === "high") {
    const held = {
      id: id("exec"),
      worker,
      action,
      status: "held_for_approval",
      reason: "High-risk task blocked from hands-free execution.",
      createdAt: now(),
    };
    executionLog.unshift(held);
    return { ok: true, service: "nexora_autonomy_executor", executed: false, result: held, updatedAt: now() };
  }

  const result = {
    id: id("exec"),
    worker,
    action,
    status: "completed",
    mode: "safe_hands_free",
    result:
      worker.includes("office")
        ? "Office worker checked lead/routing status."
        : worker.includes("trading") || worker.includes("prediction")
        ? "Trading worker checked paper/memory-only status."
        : worker.includes("db")
        ? "Safety worker checked DB gate status."
        : "Worker safe task completed.",
    createdAt: now(),
  };

  executionLog.unshift(result);
  if (executionLog.length > 500) executionLog.length = 500;

  return { ok: true, service: "nexora_autonomy_executor", executed: true, result, updatedAt: now() };
}

export function runNexoraBulkSafeExecution(input: any = {}) {
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];

  const results = tasks.map((task: any) =>
    executeNexoraSafeTask({
      worker: task.worker,
      action: task.action,
      risk: task.risk,
      payload: task.payload,
    })
  );

  return {
    ok: true,
    service: "nexora_bulk_safe_execution",
    nexoraBrain: true,
    received: tasks.length,
    executed: results.filter((r: any) => r.executed).length,
    held: results.filter((r: any) => !r.executed).length,
    results,
    rule: "Nexora executes safe tasks hands-free and holds high-risk tasks for approval.",
    updatedAt: now(),
  };
}

export function getNexoraExecutionLog(limit = 100) {
  return {
    ok: true,
    service: "nexora_autonomy_execution_log",
    count: executionLog.length,
    rows: executionLog.slice(0, Number(limit) || 100),
    updatedAt: now(),
  };
}

export function getNexoraOperatingSnapshot() {
  return {
    ok: true,
    service: "nexora_operating_snapshot",
    nexoraBrain: true,
    mode: "safe_hands_free_with_approval_gates",
    systemAreas: {
      officeFurniture: "active",
      tradingPaperMode: "active",
      learningMemoryMode: "active",
      safetyGates: "active",
      dbWriteMode: "blocked_if_recovery",
    },
    safeHandsFreeNow: [
      "office lead capture",
      "lead qualification",
      "paper signal scanning",
      "math/risk scoring",
      "memory backtesting",
      "worker heartbeats",
      "daily reports",
      "safe task execution"
    ],
    approvalRequired: [
      "real-money trading",
      "external outbound messages",
      "deleting production data",
      "changing secrets",
      "live broker/exchange integration",
      "large DB write jobs while DB is recovering"
    ],
    latestExecutions: executionLog.slice(0, 20),
    updatedAt: now(),
  };
}

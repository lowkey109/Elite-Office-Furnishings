import { Pool } from "pg";

type Risk = "safe" | "low" | "medium" | "high" | "critical";
type TaskStatus = "queued" | "running" | "completed" | "failed" | "approval_required" | "dead" | "cancelled";

type DurableTaskInput = {
  worker: string;
  area: string;
  action: string;
  risk?: Risk;
  priority?: number;
  payload?: any;
  approvalRequired?: boolean;
  source?: string;
  maxAttempts?: number;
};

let pool: Pool | null = null;
let schemaReady = false;

const memory = {
  tasks: [] as any[],
  approvals: [] as any[],
  reports: [] as any[],
  workers: [] as any[],
  messages: [] as any[],
  graph: [] as any[],
  delegations: [] as any[],
  objectives: [] as any[],
  cycles: [] as any[],
};

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function hasDb() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("No DATABASE_URL or POSTGRES_URL available.");

  pool = new Pool({
    connectionString,
    ssl: process.env.NEXORA_PG_SSL === "false" ? false : { rejectUnauthorized: false },
    max: Number(process.env.NEXORA_PG_POOL_MAX || 8),
  });

  pool.on("error", (error) => {
    console.error("[NEXORA_DURABLE_POOL_ERROR]", error);
  });

  return pool;
}

async function q(sql: string, params: any[] = []) {
  return getPool().query(sql, params);
}

export async function ensureNexoraDurableKernel() {
  if (!hasDb()) {
    return {
      ok: true,
      persistent: false,
      mode: "memory_fallback",
      message: "No Postgres env found. Nexora durable kernel is using in-process fallback memory.",
    };
  }

  if (schemaReady) {
    return {
      ok: true,
      persistent: true,
      mode: "postgres",
      message: "Nexora durable kernel schema already ready.",
    };
  }

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_durable_tasks (
      id TEXT PRIMARY KEY,
      worker TEXT NOT NULL,
      area TEXT NOT NULL,
      action TEXT NOT NULL,
      risk TEXT NOT NULL DEFAULT 'safe',
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'queued',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      approval_required BOOLEAN NOT NULL DEFAULT false,
      approval_id TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      source TEXT NOT NULL DEFAULT 'nexora',
      last_error TEXT,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`CREATE INDEX IF NOT EXISTS idx_nexora_durable_tasks_status_priority ON nexora_durable_tasks(status, priority DESC, created_at ASC);`);
  await q(`CREATE INDEX IF NOT EXISTS idx_nexora_durable_tasks_worker_status ON nexora_durable_tasks(worker, status);`);

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_durable_approvals (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      risk TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      decided_by TEXT,
      decision_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at TIMESTAMPTZ
    );
  `);

  await q(`CREATE INDEX IF NOT EXISTS idx_nexora_durable_approvals_status ON nexora_durable_approvals(status, created_at DESC);`);

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_worker_state (
      worker TEXT PRIMARY KEY,
      area TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      score NUMERIC NOT NULL DEFAULT 0,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      failed_tasks INTEGER NOT NULL DEFAULT 0,
      timeout_tasks INTEGER NOT NULL DEFAULT 0,
      capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_operating_reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_worker_messages (
      id TEXT PRIMARY KEY,
      from_worker TEXT NOT NULL,
      to_worker TEXT NOT NULL,
      from_area TEXT NOT NULL,
      to_area TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'queued',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_memory_graph (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      weight NUMERIC NOT NULL DEFAULT 1,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_delegations (
      id TEXT PRIMARY KEY,
      parent_worker TEXT NOT NULL,
      child_worker TEXT NOT NULL,
      mission TEXT NOT NULL,
      authority_scope TEXT NOT NULL,
      risk TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_division_objectives (
      id TEXT PRIMARY KEY,
      area TEXT NOT NULL,
      objective TEXT NOT NULL,
      metric TEXT NOT NULL,
      target TEXT NOT NULL,
      owner_worker TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'active',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS nexora_strategy_cycles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      objective TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      priority INTEGER NOT NULL DEFAULT 50,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  schemaReady = true;

  return {
    ok: true,
    persistent: true,
    mode: "postgres",
    message: "Nexora durable kernel schema ready.",
  };
}

export async function upsertNexoraWorker(input: any) {
  await ensureNexoraDurableKernel();

  const worker = String(input.worker || input.workerKey || "unknown_worker");
  const area = String(input.area || input.division || "core");
  const status = String(input.status || "idle");
  const capabilities = Array.isArray(input.capabilities) ? input.capabilities : [];
  const metadata = input.metadata || {};

  if (!hasDb()) {
    const existing = memory.workers.find((w) => w.worker === worker);
    if (existing) {
      Object.assign(existing, { area, status, capabilities, metadata, lastHeartbeatAt: now(), updatedAt: now() });
    } else {
      memory.workers.push({ worker, area, status, score: 0, totalTasks: 0, completedTasks: 0, failedTasks: 0, timeoutTasks: 0, capabilities, metadata, lastHeartbeatAt: now(), createdAt: now(), updatedAt: now() });
    }
    return { ok: true, worker, mode: "memory_fallback" };
  }

  await q(
    `
      INSERT INTO nexora_worker_state (worker, area, status, capabilities, metadata, last_heartbeat_at, updated_at)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,now(),now())
      ON CONFLICT (worker)
      DO UPDATE SET
        area = EXCLUDED.area,
        status = EXCLUDED.status,
        capabilities = EXCLUDED.capabilities,
        metadata = nexora_worker_state.metadata || EXCLUDED.metadata,
        last_heartbeat_at = now(),
        updated_at = now()
    `,
    [worker, area, status, JSON.stringify(capabilities), JSON.stringify(metadata)]
  );

  return { ok: true, worker, mode: "postgres" };
}

export async function createNexoraDurableTask(input: DurableTaskInput) {
  await ensureNexoraDurableKernel();

  const taskId = id("task");
  const risk = input.risk || "safe";
  const approvalRequired = Boolean(input.approvalRequired || risk === "high" || risk === "critical");
  const approvalId = approvalRequired ? id("approval") : null;
  const status: TaskStatus = approvalRequired ? "approval_required" : "queued";

  const row = {
    id: taskId,
    worker: input.worker,
    area: input.area,
    action: input.action,
    risk,
    priority: Number(input.priority || 50),
    status,
    payload: input.payload || {},
    result: null,
    approvalRequired,
    approvalId,
    attempts: 0,
    maxAttempts: Number(input.maxAttempts || 3),
    source: input.source || "nexora",
    createdAt: now(),
    updatedAt: now(),
  };

  if (!hasDb()) {
    memory.tasks.push(row);
    if (approvalRequired) {
      memory.approvals.push({
        id: approvalId,
        taskId,
        status: "pending",
        risk,
        reason: `Approval required for ${risk} task ${input.action}.`,
        payload: row.payload,
        createdAt: now(),
      });
    }
    return { ok: true, task: row, mode: "memory_fallback" };
  }

  await q(
    `
      INSERT INTO nexora_durable_tasks (
        id, worker, area, action, risk, priority, status, payload, approval_required,
        approval_id, max_attempts, source
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
    `,
    [
      taskId,
      input.worker,
      input.area,
      input.action,
      risk,
      Number(input.priority || 50),
      status,
      JSON.stringify(input.payload || {}),
      approvalRequired,
      approvalId,
      Number(input.maxAttempts || 3),
      input.source || "nexora",
    ]
  );

  if (approvalRequired) {
    await q(
      `
        INSERT INTO nexora_durable_approvals (id, task_id, status, risk, reason, payload)
        VALUES ($1,$2,'pending',$3,$4,$5::jsonb)
      `,
      [approvalId, taskId, risk, `Approval required for ${risk} task ${input.action}.`, JSON.stringify(input.payload || {})]
    );
  }

  return { ok: true, task: row, mode: "postgres" };
}

export async function approveNexoraDurableTask(approvalId: string, decidedBy = "nexora-admin", note = "Approved") {
  await ensureNexoraDurableKernel();

  if (!hasDb()) {
    const approval = memory.approvals.find((a) => a.id === approvalId);
    if (approval) {
      approval.status = "approved";
      approval.decidedBy = decidedBy;
      approval.decisionNote = note;
      approval.decidedAt = now();
      const task = memory.tasks.find((t) => t.id === approval.taskId);
      if (task && task.status === "approval_required") task.status = "queued";
    }
    return { ok: true, approvalId, mode: "memory_fallback" };
  }

  await q(
    `
      UPDATE nexora_durable_approvals
      SET status = 'approved', decided_by = $2, decision_note = $3, decided_at = now()
      WHERE id = $1
    `,
    [approvalId, decidedBy, note]
  );

  await q(
    `
      UPDATE nexora_durable_tasks
      SET status = 'queued', updated_at = now()
      WHERE approval_id = $1 AND status = 'approval_required'
    `,
    [approvalId]
  );

  return { ok: true, approvalId, mode: "postgres" };
}

export async function claimAndRunNexoraSafeTasks(limit = 10) {
  await ensureNexoraDurableKernel();

  const results: any[] = [];

  if (!hasDb()) {
    const candidates = memory.tasks
      .filter((t) => t.status === "queued")
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);

    for (const task of candidates) {
      task.status = "running";
      task.attempts += 1;

      if (task.risk === "high" || task.risk === "critical") {
        task.status = "approval_required";
        results.push({ taskId: task.id, executed: false, held: true, reason: "high_risk_gate" });
        continue;
      }

      task.status = "completed";
      task.result = {
        executedBy: "nexora_durable_kernel",
        safeMode: true,
        completedAt: now(),
      };
      results.push({ taskId: task.id, executed: true, held: false });
    }

    return {
      ok: true,
      mode: "memory_fallback",
      claimed: candidates.length,
      executed: results.filter((r: any) => r.executed).length,
      held: results.filter((r: any) => r.held).length,
      results,
    };
  }

  const claimed = await q(
    `
      WITH picked AS (
        SELECT id
        FROM nexora_durable_tasks
        WHERE status = 'queued'
        ORDER BY priority DESC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE nexora_durable_tasks t
      SET status = 'running', attempts = attempts + 1, locked_until = now() + interval '2 minutes', updated_at = now()
      FROM picked
      WHERE t.id = picked.id
      RETURNING t.*
    `,
    [limit]
  );

  for (const task of claimed.rows) {
    if (task.risk === "high" || task.risk === "critical") {
      await q(
        `
          UPDATE nexora_durable_tasks
          SET status = 'approval_required', locked_until = NULL, updated_at = now()
          WHERE id = $1
        `,
        [task.id]
      );
      results.push({ taskId: task.id, executed: false, held: true, reason: "high_risk_gate" });
      continue;
    }

    await q(
      `
        UPDATE nexora_durable_tasks
        SET status = 'completed',
            result = $2::jsonb,
            locked_until = NULL,
            updated_at = now()
        WHERE id = $1
      `,
      [
        task.id,
        JSON.stringify({
          executedBy: "nexora_durable_kernel",
          safeMode: true,
          completedAt: now(),
        }),
      ]
    );

    await q(
      `
        INSERT INTO nexora_worker_state (worker, area, status, score, total_tasks, completed_tasks, last_heartbeat_at)
        VALUES ($1,$2,'idle',10,1,1,now())
        ON CONFLICT (worker)
        DO UPDATE SET
          status = 'idle',
          score = nexora_worker_state.score + 10,
          total_tasks = nexora_worker_state.total_tasks + 1,
          completed_tasks = nexora_worker_state.completed_tasks + 1,
          last_heartbeat_at = now(),
          updated_at = now()
      `,
      [task.worker, task.area]
    );

    results.push({ taskId: task.id, executed: true, held: false });
  }

  return {
    ok: true,
    mode: "postgres",
    claimed: claimed.rows.length,
    executed: results.filter((r: any) => r.executed).length,
    held: results.filter((r: any) => r.held).length,
    results,
  };
}

export async function writeNexoraOperatingReport(type: string, severity: string, title: string, summary: string, payload: any = {}) {
  await ensureNexoraDurableKernel();
  const report = { id: id("report"), type, severity, title, summary, payload, createdAt: now() };

  if (!hasDb()) {
    memory.reports.unshift(report);
    return { ok: true, report, mode: "memory_fallback" };
  }

  await q(
    `
      INSERT INTO nexora_operating_reports (id, type, severity, title, summary, payload)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb)
    `,
    [report.id, type, severity, title, summary, JSON.stringify(payload)]
  );

  return { ok: true, report, mode: "postgres" };
}

export async function sendNexoraWorkerMessage(input: any) {
  await ensureNexoraDurableKernel();

  const message = {
    id: id("msg"),
    fromWorker: String(input.fromWorker || "nexora"),
    toWorker: String(input.toWorker || "office_receptionist"),
    fromArea: String(input.fromArea || "core"),
    toArea: String(input.toArea || "office"),
    subject: String(input.subject || "Nexora worker message"),
    body: String(input.body || "Review and create safe next action."),
    priority: Number(input.priority || 50),
    status: "queued",
    payload: input.payload || {},
    createdAt: now(),
  };

  if (!hasDb()) {
    memory.messages.unshift(message);
  } else {
    await q(
      `
        INSERT INTO nexora_worker_messages (
          id, from_worker, to_worker, from_area, to_area, subject, body, priority, status, payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued',$9::jsonb)
      `,
      [
        message.id,
        message.fromWorker,
        message.toWorker,
        message.fromArea,
        message.toArea,
        message.subject,
        message.body,
        message.priority,
        JSON.stringify(message.payload),
      ]
    );
  }

  await createNexoraDurableTask({
    worker: message.toWorker,
    area: message.toArea,
    action: "review_worker_message",
    risk: "safe",
    priority: message.priority,
    payload: message,
    source: "nexora.worker_message",
  });

  return { ok: true, message, nexoraBrain: true };
}

export async function createNexoraMemoryGraphEdge(input: any) {
  await ensureNexoraDurableKernel();

  const edge = {
    id: id("edge"),
    sourceType: String(input.sourceType || "worker"),
    sourceId: String(input.sourceId || "nexora"),
    relation: String(input.relation || "serves"),
    targetType: String(input.targetType || "area"),
    targetId: String(input.targetId || "core"),
    weight: Number(input.weight || 1),
    payload: input.payload || {},
    createdAt: now(),
  };

  if (!hasDb()) {
    memory.graph.unshift(edge);
  } else {
    await q(
      `
        INSERT INTO nexora_memory_graph (
          id, source_type, source_id, relation, target_type, target_id, weight, payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      `,
      [edge.id, edge.sourceType, edge.sourceId, edge.relation, edge.targetType, edge.targetId, edge.weight, JSON.stringify(edge.payload)]
    );
  }

  return { ok: true, edge, nexoraBrain: true };
}

export async function createNexoraDelegation(input: any) {
  await ensureNexoraDurableKernel();

  const risk = String(input.risk || "medium");
  const approvalRequired = risk === "high" || risk === "critical";

  const delegation = {
    id: id("delegation"),
    parentWorker: String(input.parentWorker || "nexora"),
    childWorker: String(input.childWorker || "office_receptionist"),
    mission: String(input.mission || "Execute safe delegated Nexora mission."),
    authorityScope: String(input.authorityScope || "Safe planning only. No binding commitments."),
    risk,
    status: approvalRequired ? "planned" : "active",
    payload: input.payload || {},
    createdAt: now(),
  };

  if (!hasDb()) {
    memory.delegations.unshift(delegation);
  } else {
    await q(
      `
        INSERT INTO nexora_delegations (
          id, parent_worker, child_worker, mission, authority_scope, risk, status, payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      `,
      [
        delegation.id,
        delegation.parentWorker,
        delegation.childWorker,
        delegation.mission,
        delegation.authorityScope,
        delegation.risk,
        delegation.status,
        JSON.stringify(delegation.payload),
      ]
    );
  }

  await createNexoraMemoryGraphEdge({
    sourceType: "worker",
    sourceId: delegation.childWorker,
    relation: "reports_to",
    targetType: "worker",
    targetId: delegation.parentWorker,
    weight: approvalRequired ? 2 : 1,
    payload: { delegationId: delegation.id },
  });

  await createNexoraDurableTask({
    worker: approvalRequired ? "nexora_execution_gate" : delegation.childWorker,
    area: approvalRequired ? "safety" : "core",
    action: approvalRequired ? "review_high_risk_delegation" : "start_delegated_mission",
    risk: approvalRequired ? "high" : "medium",
    priority: approvalRequired ? 95 : 70,
    payload: delegation,
    approvalRequired,
    source: "nexora.delegation",
  });

  return { ok: true, delegation, approvalRequired, nexoraBrain: true };
}

export async function createNexoraDivisionObjective(input: any) {
  await ensureNexoraDurableKernel();

  const objective = {
    id: id("objective"),
    area: String(input.area || input.division || "office"),
    objective: String(input.objective || "Improve autonomous operating performance."),
    metric: String(input.metric || "safe_task_completion"),
    target: String(input.target || "increase safely"),
    ownerWorker: String(input.ownerWorker || "office_receptionist"),
    priority: Number(input.priority || 50),
    status: "active",
    payload: input.payload || {},
    createdAt: now(),
  };

  if (!hasDb()) {
    memory.objectives.unshift(objective);
  } else {
    await q(
      `
        INSERT INTO nexora_division_objectives (
          id, area, objective, metric, target, owner_worker, priority, status, payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8::jsonb)
      `,
      [
        objective.id,
        objective.area,
        objective.objective,
        objective.metric,
        objective.target,
        objective.ownerWorker,
        objective.priority,
        JSON.stringify(objective.payload),
      ]
    );
  }

  await createNexoraDurableTask({
    worker: objective.ownerWorker,
    area: objective.area,
    action: "execute_division_objective",
    risk: "medium",
    priority: objective.priority,
    payload: objective,
    source: "nexora.division_objective",
  });

  return { ok: true, objective, nexoraBrain: true };
}

export async function runNexoraEmpireCycle() {
  await ensureNexoraDurableKernel();

  const cycle = {
    id: id("cycle"),
    name: "Nexora empire operating cycle",
    objective: "Coordinate office furniture, fitouts, procurement, CRM, learning, reporting, safety, and paper trading intelligence under one Nexora brain.",
    status: "active",
    priority: 90,
    createdAt: now(),
  };

  if (!hasDb()) {
    memory.cycles.unshift(cycle);
  } else {
    await q(
      `
        INSERT INTO nexora_strategy_cycles (id, name, objective, status, priority, payload)
        VALUES ($1,$2,$3,'active',$4,$5::jsonb)
      `,
      [cycle.id, cycle.name, cycle.objective, cycle.priority, JSON.stringify({ nexoraBrain: true })]
    );
  }

  const workers = [
    ["office_receptionist", "office", ["lead_capture", "qualification", "followup"]],
    ["quote_builder", "office", ["quote_draft", "margin_check", "scope_assumptions"]],
    ["fitout_scope_worker", "fitouts", ["site_scope", "access_risk", "install_constraints"]],
    ["supplier_negotiator", "procurement", ["supplier_pricing", "lead_time", "stock_check"]],
    ["crm_pipeline_worker", "crm", ["pipeline_next_action", "customer_state", "followup_clock"]],
    ["learning_worker", "learning", ["pattern_capture", "worker_retraining", "strategy_feedback"]],
    ["nexora_execution_gate", "safety", ["approval_gate", "risk_hold", "policy"]],
    ["nexora_command_centre", "reporting", ["snapshot", "report", "next_actions"]],
    ["phantom_x_paper_trader", "trading", ["paper_signal", "sandbox_review", "risk_observation"]],
  ];

  for (const [worker, area, capabilities] of workers) {
    await upsertNexoraWorker({
      worker,
      area,
      status: "idle",
      capabilities,
      metadata: {
        seededBy: "nexora_advanced_build_8",
        nexoraBrain: true,
      },
    });
  }

  const objectives = [
    await createNexoraDivisionObjective({
      area: "office",
      objective: "Increase qualified office furniture and fitout lead conversion into quote drafts.",
      metric: "qualified_quote_drafts",
      target: "increase without unsafe commitments",
      ownerWorker: "office_receptionist",
      priority: 85,
      payload: { cycleId: cycle.id },
    }),
    await createNexoraDivisionObjective({
      area: "procurement",
      objective: "Improve supplier confirmation quality before quote release.",
      metric: "supplier_confirmation_rate",
      target: "confirm price, stock, lead time, delivery, warranty",
      ownerWorker: "supplier_negotiator",
      priority: 82,
      payload: { cycleId: cycle.id },
    }),
    await createNexoraDivisionObjective({
      area: "safety",
      objective: "Keep all high-risk tasks approval-gated.",
      metric: "unsafe_high_risk_executions",
      target: "zero",
      ownerWorker: "nexora_execution_gate",
      priority: 100,
      payload: { cycleId: cycle.id },
    }),
    await createNexoraDivisionObjective({
      area: "trading",
      objective: "Keep Phantom X trading paper/sandbox and produce intelligence only.",
      metric: "live_trade_attempts",
      target: "zero unless explicitly promoted",
      ownerWorker: "phantom_x_paper_trader",
      priority: 95,
      payload: { cycleId: cycle.id, tradingMode: "paper/sandbox" },
    }),
  ];

  const messages = [
    await sendNexoraWorkerMessage({
      fromWorker: "nexora_command_centre",
      toWorker: "office_receptionist",
      fromArea: "reporting",
      toArea: "office",
      subject: "Prioritise quote-ready leads",
      body: "Find leads with need, location, budget, and timeline. Create safe next actions only.",
      priority: 85,
      payload: { cycleId: cycle.id },
    }),
    await sendNexoraWorkerMessage({
      fromWorker: "office_receptionist",
      toWorker: "quote_builder",
      fromArea: "office",
      toArea: "office",
      subject: "Prepare quote drafts",
      body: "Build draft quotes with assumptions, GST, margin checks, and approval holds where needed.",
      priority: 80,
      payload: { cycleId: cycle.id },
    }),
    await sendNexoraWorkerMessage({
      fromWorker: "quote_builder",
      toWorker: "supplier_negotiator",
      fromArea: "office",
      toArea: "procurement",
      subject: "Confirm supplier data",
      body: "Confirm target costs, stock, lead times, delivery constraints, and alternatives.",
      priority: 78,
      payload: { cycleId: cycle.id },
    }),
  ];

  const delegations = [
    await createNexoraDelegation({
      parentWorker: "nexora_command_centre",
      childWorker: "supplier_negotiator",
      mission: "Collect supplier intelligence for quote-ready office furniture opportunities.",
      authorityScope: "Information gathering only. No purchase orders or binding supplier commitments.",
      risk: "high",
      payload: { cycleId: cycle.id },
    }),
    await createNexoraDelegation({
      parentWorker: "nexora_command_centre",
      childWorker: "phantom_x_paper_trader",
      mission: "Review paper/sandbox trading signals and report risk observations.",
      authorityScope: "Paper/sandbox only. No live trading authority.",
      risk: "critical",
      payload: { cycleId: cycle.id, tradingMode: "paper/sandbox" },
    }),
  ];

  const execution = await claimAndRunNexoraSafeTasks(20);

  await writeNexoraOperatingReport(
    "empire_cycle",
    "info",
    "Nexora empire cycle completed",
    `Cycle ${cycle.id} created ${objectives.length} objectives, ${messages.length} messages, ${delegations.length} delegations, and executed ${execution.executed} safe tasks.`,
    {
      cycle,
      objectives,
      messages,
      delegations,
      execution,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    cycle,
    objectives,
    messages,
    delegations,
    execution,
    safety: {
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
      singleBrain: "Nexora",
    },
  };
}

export async function getNexoraDurableCommandSnapshot() {
  await ensureNexoraDurableKernel();

  if (!hasDb()) {
    return {
      ok: true,
      nexoraBrain: true,
      mode: "memory_fallback",
      generatedAt: now(),
      counts: {
        tasks: memory.tasks.length,
        approvals: memory.approvals.length,
        workers: memory.workers.length,
        reports: memory.reports.length,
        messages: memory.messages.length,
        graphEdges: memory.graph.length,
        delegations: memory.delegations.length,
        objectives: memory.objectives.length,
        cycles: memory.cycles.length,
      },
      recent: {
        tasks: memory.tasks.slice(0, 20),
        approvals: memory.approvals.slice(0, 20),
        reports: memory.reports.slice(0, 10),
        messages: memory.messages.slice(0, 20),
      },
      nextActions: [
        "Attach DATABASE_URL for durable Postgres-backed memory.",
        "Run empire cycle to seed workers, messages, objectives, and approval-gated delegations.",
        "Review approval_required tasks before promotion.",
      ],
    };
  }

  const [
    tasks,
    approvals,
    workers,
    reports,
    messages,
    graph,
    delegations,
    objectives,
    cycles,
  ] = await Promise.all([
    q(`SELECT status, count(*)::int AS count FROM nexora_durable_tasks GROUP BY status ORDER BY status`),
    q(`SELECT status, count(*)::int AS count FROM nexora_durable_approvals GROUP BY status ORDER BY status`),
    q(`SELECT status, count(*)::int AS count FROM nexora_worker_state GROUP BY status ORDER BY status`),
    q(`SELECT type, severity, title, summary, created_at FROM nexora_operating_reports ORDER BY created_at DESC LIMIT 10`),
    q(`SELECT status, count(*)::int AS count FROM nexora_worker_messages GROUP BY status ORDER BY status`),
    q(`SELECT relation, count(*)::int AS count FROM nexora_memory_graph GROUP BY relation ORDER BY relation`),
    q(`SELECT status, risk, count(*)::int AS count FROM nexora_delegations GROUP BY status, risk ORDER BY status, risk`),
    q(`SELECT area, status, count(*)::int AS count FROM nexora_division_objectives GROUP BY area, status ORDER BY area, status`),
    q(`SELECT id, name, objective, status, priority, created_at FROM nexora_strategy_cycles ORDER BY created_at DESC LIMIT 10`),
  ]);

  return {
    ok: true,
    nexoraBrain: true,
    mode: "postgres",
    generatedAt: now(),
    summaries: {
      tasks: tasks.rows,
      approvals: approvals.rows,
      workers: workers.rows,
      reports: reports.rows,
      messages: messages.rows,
      memoryGraph: graph.rows,
      delegations: delegations.rows,
      objectives: objectives.rows,
      cycles: cycles.rows,
    },
    nextActions: [
      "Continue recurring empire cycles.",
      "Process safe queued tasks hands-free.",
      "Keep high-risk procurement, delegation, retirement, spawning, and trading promotion approval-gated.",
      "Use worker scores to promote, retrain, or retire workers safely.",
    ],
  };
}

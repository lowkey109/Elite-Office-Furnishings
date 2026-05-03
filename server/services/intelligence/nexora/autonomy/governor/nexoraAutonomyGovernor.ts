import {
  claimAndRunNexoraSafeTasks,
  createNexoraDelegation,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  runNexoraEmpireCycle,
  sendNexoraWorkerMessage,
  upsertNexoraWorker,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";

type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

type GovernorDecision = {
  ok: boolean;
  allowed: boolean;
  risk: RiskLevel;
  score: number;
  approvalRequired: boolean;
  reasons: string[];
  recommendedWorker: string;
  recommendedArea: string;
  action: string;
};

function now() {
  return new Date().toISOString();
}

function scoreText(value: unknown): number {
  const text = String(value || "").toLowerCase();
  let score = 0;

  const highRiskWords = [
    "purchase order",
    "po",
    "commit",
    "contract",
    "live trade",
    "execute trade",
    "withdraw",
    "payment",
    "refund",
    "legal",
    "terminate",
    "fire worker",
    "retire worker",
    "delete",
    "production database",
  ];

  const mediumRiskWords = [
    "supplier negotiation",
    "customer quote",
    "quote release",
    "margin",
    "procurement",
    "pricing",
    "crm update",
    "followup",
    "project",
    "install",
    "fitout",
  ];

  for (const word of highRiskWords) {
    if (text.includes(word)) score += 35;
  }

  for (const word of mediumRiskWords) {
    if (text.includes(word)) score += 12;
  }

  return score;
}

export function classifyNexoraRisk(input: any = {}): GovernorDecision {
  const action = String(input.action || input.kind || input.intent || "unknown_action");
  const area = String(input.area || input.division || "core");
  const payload = input.payload || {};
  const explicitRisk = input.risk as RiskLevel | undefined;

  let score = 0;
  const reasons: string[] = [];

  score += scoreText(action);
  score += scoreText(area);
  score += scoreText(JSON.stringify(payload));

  if (area === "trading") {
    score += 30;
    reasons.push("Trading work is restricted to paper/sandbox unless explicitly promoted.");
  }

  if (area === "procurement") {
    score += 20;
    reasons.push("Procurement may create supplier or purchase commitment risk.");
  }

  if (area === "safety") {
    score += 25;
    reasons.push("Safety actions can affect execution authority.");
  }

  if (Number(payload?.quoteTotal || payload?.amount || payload?.budget || 0) >= 25000) {
    score += 35;
    reasons.push("Large value threshold reached.");
  }

  if (payload?.customerFacing === true) {
    score += 15;
    reasons.push("Customer-facing output requires stronger governance.");
  }

  if (payload?.bindingCommitment === true) {
    score += 50;
    reasons.push("Binding commitment requested.");
  }

  if (payload?.liveTrading === true) {
    score += 100;
    reasons.push("Live trading request detected.");
  }

  if (explicitRisk === "critical") score += 100;
  if (explicitRisk === "high") score += 60;
  if (explicitRisk === "medium") score += 25;
  if (explicitRisk === "low") score += 5;

  let risk: RiskLevel = "safe";
  if (score >= 90) risk = "critical";
  else if (score >= 60) risk = "high";
  else if (score >= 30) risk = "medium";
  else if (score >= 10) risk = "low";

  if (reasons.length === 0) {
    reasons.push("No major risk signal detected.");
  }

  const approvalRequired = risk === "high" || risk === "critical";

  let recommendedWorker = "nexora_command_centre";
  if (area === "office") recommendedWorker = "office_receptionist";
  if (area === "fitouts") recommendedWorker = "fitout_scope_worker";
  if (area === "procurement") recommendedWorker = "supplier_negotiator";
  if (area === "crm") recommendedWorker = "crm_pipeline_worker";
  if (area === "learning") recommendedWorker = "learning_worker";
  if (area === "trading") recommendedWorker = "phantom_x_paper_trader";
  if (approvalRequired) recommendedWorker = "nexora_execution_gate";

  return {
    ok: true,
    allowed: !approvalRequired,
    risk,
    score,
    approvalRequired,
    reasons,
    recommendedWorker,
    recommendedArea: approvalRequired ? "safety" : area,
    action,
  };
}

export async function governAndQueueNexoraAction(input: any = {}) {
  await ensureNexoraDurableKernel();

  const decision = classifyNexoraRisk(input);

  const task = await createNexoraDurableTask({
    worker: decision.recommendedWorker,
    area: decision.recommendedArea,
    action: decision.approvalRequired ? "governed_approval_review" : decision.action,
    risk: decision.risk,
    priority: Number(input.priority || (decision.approvalRequired ? 95 : 70)),
    payload: {
      original: input,
      governorDecision: decision,
      nexoraBrain: true,
      createdAt: now(),
    },
    approvalRequired: decision.approvalRequired,
    source: "nexora.autonomy.governor",
  });

  await createNexoraMemoryGraphEdge({
    sourceType: "action",
    sourceId: decision.action,
    relation: decision.approvalRequired ? "escalates_to" : "delegates_to",
    targetType: "worker",
    targetId: decision.recommendedWorker,
    weight: Math.max(1, decision.score / 25),
    payload: {
      risk: decision.risk,
      approvalRequired: decision.approvalRequired,
      reasons: decision.reasons,
    },
  });

  await writeNexoraOperatingReport(
    "governor_action",
    decision.approvalRequired ? "warning" : "info",
    "Nexora governed action queued",
    `Action ${decision.action} classified as ${decision.risk}. Approval required: ${decision.approvalRequired}.`,
    {
      decision,
      task,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    decision,
    task,
  };
}

export async function runNexoraSlaWatchdog(input: any = {}) {
  await ensureNexoraDurableKernel();

  const snapshot: any = await getNexoraDurableCommandSnapshot();

  const actions: any[] = [];

  await upsertNexoraWorker({
    worker: "nexora_sla_watchdog",
    area: "operations",
    status: "busy",
    capabilities: ["sla_monitoring", "dead_worker_detection", "queue_pressure_review"],
    metadata: {
      startedAt: now(),
    },
  });

  const snapshotText = JSON.stringify(snapshot);

  if (snapshotText.includes("approval_required")) {
    actions.push(await sendNexoraWorkerMessage({
      fromWorker: "nexora_sla_watchdog",
      toWorker: "nexora_execution_gate",
      fromArea: "operations",
      toArea: "safety",
      subject: "Approval queue requires review",
      body: "Nexora detected approval-gated work. Review pending high-risk tasks before any external commitment.",
      priority: 95,
      payload: {
        snapshotMode: snapshot.mode,
      },
    }));
  }

  if (snapshotText.includes("failed") || snapshotText.includes("dead")) {
    actions.push(await createNexoraDurableTask({
      worker: "learning_worker",
      area: "learning",
      action: "diagnose_failed_or_dead_tasks",
      risk: "medium",
      priority: 85,
      payload: {
        source: "sla_watchdog",
        snapshot,
      },
      source: "nexora.sla_watchdog",
    }));
  }

  actions.push(await createNexoraDivisionObjective({
    area: "operations",
    objective: "Maintain healthy autonomous loop execution and recover degraded workers.",
    metric: "degraded_worker_recovery_rate",
    target: "recover or escalate every degraded worker state",
    ownerWorker: "nexora_sla_watchdog",
    priority: 88,
    payload: {
      generatedBy: "nexora_sla_watchdog",
    },
  }));

  await upsertNexoraWorker({
    worker: "nexora_sla_watchdog",
    area: "operations",
    status: "idle",
    capabilities: ["sla_monitoring", "dead_worker_detection", "queue_pressure_review"],
    metadata: {
      completedAt: now(),
      actionsCreated: actions.length,
    },
  });

  await writeNexoraOperatingReport(
    "sla_watchdog",
    "info",
    "Nexora SLA watchdog cycle completed",
    `SLA watchdog created ${actions.length} corrective actions.`,
    {
      actions,
      snapshot,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_sla_watchdog",
    actionsCreated: actions.length,
    actions,
  };
}

export async function runNexoraWorkerEvolutionCycle() {
  await ensureNexoraDurableKernel();

  const actions: any[] = [];

  await upsertNexoraWorker({
    worker: "nexora_worker_evolution_engine",
    area: "learning",
    status: "busy",
    capabilities: ["worker_scoring", "promotion", "retraining", "retirement_review"],
    metadata: {
      startedAt: now(),
    },
  });

  actions.push(await createNexoraDurableTask({
    worker: "learning_worker",
    area: "learning",
    action: "capture_successful_worker_patterns",
    risk: "safe",
    priority: 75,
    payload: {
      instruction: "Extract reusable patterns from completed safe tasks, quote drafts, procurement confirmations, and followups.",
    },
    source: "nexora.worker_evolution",
  }));

  actions.push(await createNexoraDurableTask({
    worker: "learning_worker",
    area: "learning",
    action: "prepare_retraining_plan_for_low_scoring_workers",
    risk: "medium",
    priority: 80,
    payload: {
      instruction: "Identify repeated failure, timeout, or approval-hold patterns and recommend retraining.",
    },
    source: "nexora.worker_evolution",
  }));

  actions.push(await createNexoraDurableTask({
    worker: "nexora_execution_gate",
    area: "safety",
    action: "review_worker_retirement_candidates",
    risk: "high",
    priority: 92,
    payload: {
      instruction: "Retirement is approval-gated. Do not delete or disable workers automatically.",
    },
    approvalRequired: true,
    source: "nexora.worker_evolution",
  }));

  await createNexoraMemoryGraphEdge({
    sourceType: "engine",
    sourceId: "nexora_worker_evolution_engine",
    relation: "improves",
    targetType: "worker",
    targetId: "learning_worker",
    weight: 2,
    payload: {
      purpose: "self improvement feedback loop",
    },
  });

  await upsertNexoraWorker({
    worker: "nexora_worker_evolution_engine",
    area: "learning",
    status: "idle",
    capabilities: ["worker_scoring", "promotion", "retraining", "retirement_review"],
    metadata: {
      completedAt: now(),
      actionsCreated: actions.length,
    },
  });

  await writeNexoraOperatingReport(
    "worker_evolution",
    "warning",
    "Nexora worker evolution cycle completed",
    "Worker evolution created learning tasks and approval-gated retirement review.",
    {
      actions,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    actions,
    safety: {
      retirementApprovalGated: true,
      autoDeletion: false,
    },
  };
}

export async function runNexoraGovernorCycle(input: any = {}) {
  await ensureNexoraDurableKernel();

  const empire = input.skipEmpire ? null : await runNexoraEmpireCycle();

  const governedActions = [];

  governedActions.push(await governAndQueueNexoraAction({
    area: "office",
    action: "prepare_customer_quote_draft",
    priority: 85,
    payload: {
      customerFacing: true,
      quoteTotal: Number(input.quoteTotal || 18000),
      bindingCommitment: false,
      note: "Draft quote only. No binding commitment.",
    },
  }));

  governedActions.push(await governAndQueueNexoraAction({
    area: "procurement",
    action: "request_supplier_pricing_and_lead_time",
    priority: 82,
    payload: {
      supplierNegotiation: true,
      bindingCommitment: false,
      purchaseOrder: false,
    },
  }));

  governedActions.push(await governAndQueueNexoraAction({
    area: "trading",
    action: "run_phantom_x_paper_signal_review",
    priority: 75,
    payload: {
      liveTrading: false,
      tradingMode: "paper/sandbox",
    },
  }));

  const sla = await runNexoraSlaWatchdog();
  const evolution = await runNexoraWorkerEvolutionCycle();
  const execution = await claimAndRunNexoraSafeTasks(Number(input.safeRunLimit || 30));

  await writeNexoraOperatingReport(
    "governor_cycle",
    "info",
    "Nexora governor cycle completed",
    `Governor cycle created ${governedActions.length} governed actions and executed ${execution.executed} safe tasks.`,
    {
      empire,
      governedActions,
      sla,
      evolution,
      execution,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_autonomy_governor",
    mode: "single_brain_safe_autonomy",
    empire,
    governedActions,
    sla,
    evolution,
    execution,
    safety: {
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
      supplierCommitments: "approval_required",
      customerFacingBindingCommitments: "approval_required",
    },
  };
}

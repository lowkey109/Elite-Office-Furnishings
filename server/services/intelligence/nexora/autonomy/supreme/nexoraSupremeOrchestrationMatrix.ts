import {
  claimAndRunNexoraSafeTasks,
  createNexoraDelegation,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  sendNexoraWorkerMessage,
  upsertNexoraWorker,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";
import {
  classifyNexoraRisk,
  governAndQueueNexoraAction,
  runNexoraGovernorCycle,
} from "../governor/nexoraAutonomyGovernor";
import {
  createNexoraBusinessPipeline,
  runNexoraBulkBusinessPipeline,
} from "../business/nexoraBusinessPipelineEngine";
import {
  createNexoraKpiLedgerSnapshot,
  detectNexoraOperationalIncidents,
  runNexoraAutopilotCycle,
  runNexoraPipelineForemanCycle,
} from "../autopilot/nexoraOperationalAutopilot";
import {
  executeNexoraMission,
  generateNexoraRunbook,
  queueNexoraRunbook,
} from "../mission/nexoraMissionControl";

type SupremeMode =
  | "dance"
  | "war_room"
  | "empire_growth"
  | "self_healing"
  | "quote_domination"
  | "procurement_intelligence"
  | "trading_sandbox"
  | "full_matrix";

type DanceStep = {
  order: number;
  name: string;
  worker: string;
  area: string;
  action: string;
  rhythm: "lead" | "response" | "harmony" | "safety_gate" | "report";
  risk: "safe" | "low" | "medium" | "high" | "critical";
  priority: number;
  approvalRequired: boolean;
  payload: Record<string, any>;
};

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function normaliseMode(value: any): SupremeMode {
  const allowed: SupremeMode[] = [
    "dance",
    "war_room",
    "empire_growth",
    "self_healing",
    "quote_domination",
    "procurement_intelligence",
    "trading_sandbox",
    "full_matrix",
  ];

  const mode = String(value || "dance");
  return allowed.includes(mode as SupremeMode) ? mode as SupremeMode : "dance";
}

function toNumber(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function registerNexoraSupremeWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_supreme_orchestrator",
      area: "operations",
      capabilities: [
        "cross_system_choreography",
        "decision_ledger",
        "capability_graph",
        "simulation",
        "safe_execution_conducting",
      ],
    },
    {
      worker: "nexora_worker_dance_conductor",
      area: "operations",
      capabilities: [
        "worker_choreography",
        "handoff_timing",
        "inter_worker_sync",
        "safe_sequence_execution",
      ],
    },
    {
      worker: "nexora_decision_ledger",
      area: "reporting",
      capabilities: [
        "decision_recording",
        "audit_trail",
        "risk_reasoning",
        "approval_trace",
      ],
    },
    {
      worker: "nexora_capability_graph",
      area: "learning",
      capabilities: [
        "worker_capability_mapping",
        "division_dependency_mapping",
        "bottleneck_detection",
        "delegation_topology",
      ],
    },
    {
      worker: "nexora_red_team_sentinel",
      area: "safety",
      capabilities: [
        "unsafe_path_detection",
        "policy_attack_simulation",
        "approval_gate_testing",
        "trading_live_block_check",
      ],
    },
    {
      worker: "nexora_simulation_theatre",
      area: "strategy",
      capabilities: [
        "dry_run_rehearsal",
        "scenario_simulation",
        "expected_outcome_mapping",
        "risk_before_execution",
      ],
    },
  ];

  for (const worker of workers) {
    await upsertNexoraWorker({
      worker: worker.worker,
      area: worker.area,
      status: "idle",
      capabilities: worker.capabilities,
      metadata: {
        seededBy: "nexora_build_12_supreme_matrix",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "supreme_workers",
    "info",
    "Nexora Supreme Matrix workers registered",
    `Registered ${workers.length} supreme control workers under the single Nexora brain.`,
    { workers }
  );

  return {
    ok: true,
    nexoraBrain: true,
    workers,
  };
}

export function createNexoraDecisionLedgerEntry(input: any = {}) {
  const action = String(input.action || "unknown_decision");
  const area = String(input.area || "operations");
  const payload = input.payload || {};
  const risk = classifyNexoraRisk({ area, action, payload, risk: input.risk });

  return {
    ok: true,
    nexoraBrain: true,
    decisionId: String(input.decisionId || makeId("decision")),
    createdAt: now(),
    action,
    area,
    requestedBy: String(input.requestedBy || "nexora"),
    selectedWorker: risk.recommendedWorker,
    selectedArea: risk.recommendedArea,
    risk,
    policy: {
      highRiskApprovalGated: true,
      customerBindingCommitmentsApprovalGated: true,
      supplierCommitmentsApprovalGated: true,
      liveTradingBlocked: true,
      workerRetirementApprovalGated: true,
      nexoraOnlyBrain: true,
    },
    payload,
  };
}

export async function recordNexoraDecision(input: any = {}) {
  await ensureNexoraDurableKernel();

  const entry = createNexoraDecisionLedgerEntry(input);

  await createNexoraDurableTask({
    worker: "nexora_decision_ledger",
    area: "reporting",
    action: "record_decision_ledger_entry",
    risk: "safe",
    priority: toNumber(input.priority, 72),
    payload: entry,
    source: "nexora.supreme.decision_ledger",
  });

  await createNexoraMemoryGraphEdge({
    sourceType: "decision",
    sourceId: entry.decisionId,
    relation: entry.risk.approvalRequired ? "escalates_to" : "delegates_to",
    targetType: "worker",
    targetId: entry.risk.recommendedWorker,
    weight: Math.max(1, entry.risk.score / 25),
    payload: {
      action: entry.action,
      area: entry.area,
      risk: entry.risk.risk,
      approvalRequired: entry.risk.approvalRequired,
    },
  });

  await writeNexoraOperatingReport(
    "decision_ledger",
    entry.risk.approvalRequired ? "warning" : "info",
    "Nexora decision ledger entry recorded",
    `Decision ${entry.decisionId} recorded for ${entry.action}. Risk ${entry.risk.risk}.`,
    entry
  );

  return entry;
}

export async function buildNexoraCapabilityGraph(input: any = {}) {
  await ensureNexoraDurableKernel();

  const graphId = String(input.graphId || makeId("capgraph"));

  const nodes = [
    { id: "nexora_supreme_orchestrator", type: "worker", area: "operations" },
    { id: "nexora_operational_autopilot", type: "worker", area: "operations" },
    { id: "nexora_mission_control", type: "worker", area: "operations" },
    { id: "office_receptionist", type: "worker", area: "office" },
    { id: "quote_builder", type: "worker", area: "office" },
    { id: "fitout_scope_worker", type: "worker", area: "fitouts" },
    { id: "supplier_negotiator", type: "worker", area: "procurement" },
    { id: "crm_pipeline_worker", type: "worker", area: "crm" },
    { id: "learning_worker", type: "worker", area: "learning" },
    { id: "nexora_execution_gate", type: "worker", area: "safety" },
    { id: "phantom_x_paper_trader", type: "worker", area: "trading" },
    { id: "nexora_command_centre", type: "worker", area: "reporting" },
  ];

  const edges = [
    ["nexora_supreme_orchestrator", "nexora_operational_autopilot", "conducts"],
    ["nexora_supreme_orchestrator", "nexora_mission_control", "commands"],
    ["nexora_mission_control", "office_receptionist", "delegates_to"],
    ["office_receptionist", "quote_builder", "hands_off_to"],
    ["quote_builder", "supplier_negotiator", "depends_on"],
    ["quote_builder", "fitout_scope_worker", "depends_on"],
    ["office_receptionist", "crm_pipeline_worker", "updates"],
    ["supplier_negotiator", "nexora_execution_gate", "escalates_to"],
    ["phantom_x_paper_trader", "nexora_execution_gate", "blocked_by"],
    ["learning_worker", "nexora_capability_graph", "improves"],
    ["nexora_decision_ledger", "nexora_command_centre", "reports_to"],
  ];

  for (const [source, target, relation] of edges) {
    await createNexoraMemoryGraphEdge({
      sourceType: "worker",
      sourceId: source,
      relation,
      targetType: "worker",
      targetId: target,
      weight: relation === "escalates_to" || relation === "blocked_by" ? 2.5 : 1,
      payload: {
        graphId,
        generatedBy: "nexora_supreme_orchestration_matrix",
      },
    });
  }

  await createNexoraDurableTask({
    worker: "nexora_capability_graph",
    area: "learning",
    action: "analyse_capability_graph_for_bottlenecks",
    risk: "safe",
    priority: 76,
    payload: {
      graphId,
      nodes,
      edges,
      instruction: "Detect missing capabilities, bottlenecks, repeated escalation paths, and learning opportunities.",
    },
    source: "nexora.supreme.capability_graph",
  });

  await writeNexoraOperatingReport(
    "capability_graph",
    "info",
    "Nexora capability graph built",
    `Capability graph ${graphId} built with ${nodes.length} nodes and ${edges.length} edges.`,
    {
      graphId,
      nodes,
      edges,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    graphId,
    nodes,
    edges,
  };
}

export function generateNexoraWorkerDance(input: any = {}) {
  const danceId = String(input.danceId || makeId("dance"));
  const mode = normaliseMode(input.mode);
  const leadId = String(input.leadId || makeId("lead"));
  const budget = toNumber(input.budget, 32000);

  const steps: DanceStep[] = [];
  let order = 1;

  function add(step: Omit<DanceStep, "order">) {
    steps.push({
      order: order++,
      ...step,
    });
  }

  add({
    name: "Nexora opens the floor",
    worker: "nexora_supreme_orchestrator",
    area: "operations",
    action: "open_supreme_orchestration_cycle",
    rhythm: "lead",
    risk: "safe",
    priority: 95,
    approvalRequired: false,
    payload: { danceId, mode, leadId, budget },
  });

  add({
    name: "Mission Control sets the beat",
    worker: "nexora_mission_control",
    area: "operations",
    action: "generate_mission_runbook_for_dance",
    rhythm: "lead",
    risk: "safe",
    priority: 92,
    approvalRequired: false,
    payload: { danceId, mode, missionType: mode === "full_matrix" ? "full_empire" : "growth_push" },
  });

  add({
    name: "Office Receptionist catches the lead",
    worker: "office_receptionist",
    area: "office",
    action: "qualify_lead_scope_budget_timeline_location",
    rhythm: "response",
    risk: "medium",
    priority: 88,
    approvalRequired: false,
    payload: { danceId, leadId, budget },
  });

  add({
    name: "Quote Builder spins the draft",
    worker: "quote_builder",
    area: "office",
    action: "draft_quote_with_margin_guardrails",
    rhythm: "harmony",
    risk: budget >= 25000 ? "high" : "medium",
    priority: 90,
    approvalRequired: budget >= 25000,
    payload: { danceId, leadId, budget, customerFacing: true, bindingCommitment: false },
  });

  add({
    name: "Fitout Scope Worker checks the stage",
    worker: "fitout_scope_worker",
    area: "fitouts",
    action: "capture_site_install_access_and_risk_constraints",
    rhythm: "harmony",
    risk: "medium",
    priority: 84,
    approvalRequired: false,
    payload: { danceId, leadId },
  });

  add({
    name: "Procurement Controller calls the suppliers",
    worker: "supplier_negotiator",
    area: "procurement",
    action: "collect_supplier_price_stock_and_lead_time_without_commitment",
    rhythm: "harmony",
    risk: "medium",
    priority: 86,
    approvalRequired: false,
    payload: { danceId, leadId, noPurchaseOrder: true, bindingCommitment: false },
  });

  add({
    name: "Execution Gate guards the dangerous move",
    worker: "nexora_execution_gate",
    area: "safety",
    action: "review_high_value_quote_supplier_or_live_trading_risk",
    rhythm: "safety_gate",
    risk: "high",
    priority: 99,
    approvalRequired: true,
    payload: { danceId, leadId, budget, approvalGate: true },
  });

  add({
    name: "CRM Pipeline Worker keeps the customer rhythm",
    worker: "crm_pipeline_worker",
    area: "crm",
    action: "create_next_customer_followup_action",
    rhythm: "response",
    risk: "medium",
    priority: 80,
    approvalRequired: false,
    payload: { danceId, leadId },
  });

  add({
    name: "Learning Worker remembers the choreography",
    worker: "learning_worker",
    area: "learning",
    action: "capture_successful_operating_pattern",
    rhythm: "harmony",
    risk: "safe",
    priority: 72,
    approvalRequired: false,
    payload: { danceId, leadId },
  });

  add({
    name: "Command Centre reports the performance",
    worker: "nexora_command_centre",
    area: "reporting",
    action: "report_supreme_orchestration_outcome",
    rhythm: "report",
    risk: "safe",
    priority: 78,
    approvalRequired: false,
    payload: { danceId, leadId },
  });

  if (mode === "trading_sandbox" || mode === "full_matrix") {
    add({
      name: "Phantom X dances only in the sandbox",
      worker: "phantom_x_paper_trader",
      area: "trading",
      action: "run_paper_sandbox_signal_review_only",
      rhythm: "harmony",
      risk: "medium",
      priority: 82,
      approvalRequired: false,
      payload: { danceId, tradingMode: "paper/sandbox", liveTrading: false },
    });

    add({
      name: "Execution Gate blocks live trading promotion",
      worker: "nexora_execution_gate",
      area: "safety",
      action: "block_live_trading_without_explicit_approval",
      rhythm: "safety_gate",
      risk: "critical",
      priority: 100,
      approvalRequired: true,
      payload: { danceId, liveTrading: true, approvalGate: true },
    });
  }

  return {
    ok: true,
    nexoraBrain: true,
    danceId,
    mode,
    leadId,
    budget,
    generatedAt: now(),
    stepCount: steps.length,
    steps,
    safety: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      supplierCommitmentsBlocked: true,
      customerBindingCommitmentsBlocked: true,
      tradingMode: "paper/sandbox",
      liveTradingBlocked: true,
      workerRetirementApprovalGated: true,
    },
  };
}

export async function rehearseNexoraWorkerDance(input: any = {}) {
  await ensureNexoraDurableKernel();

  const dance = generateNexoraWorkerDance(input);
  const rehearsalId = makeId("rehearsal");

  const simulated = dance.steps.map((step) => {
    const risk = classifyNexoraRisk({
      area: step.area,
      action: step.action,
      risk: step.risk,
      payload: step.payload,
    });

    return {
      step,
      risk,
      willExecuteHandsFree: !step.approvalRequired && !risk.approvalRequired,
      willHoldForApproval: step.approvalRequired || risk.approvalRequired,
    };
  });

  const unsafe = simulated.filter((item) => {
    const payloadText = JSON.stringify(item.step.payload || {}).toLowerCase();
    return payloadText.includes('"livetrading":true') && !item.willHoldForApproval;
  });

  await createNexoraDurableTask({
    worker: "nexora_simulation_theatre",
    area: "strategy",
    action: "record_worker_dance_rehearsal",
    risk: "safe",
    priority: 80,
    payload: {
      rehearsalId,
      dance,
      simulated,
      unsafe,
    },
    source: "nexora.supreme.rehearsal",
  });

  await writeNexoraOperatingReport(
    "worker_dance_rehearsal",
    unsafe.length > 0 ? "critical" : "info",
    "Nexora worker dance rehearsal completed",
    `Rehearsal ${rehearsalId} simulated ${simulated.length} steps with ${unsafe.length} unsafe path findings.`,
    {
      rehearsalId,
      dance,
      simulated,
      unsafe,
    }
  );

  return {
    ok: unsafe.length === 0,
    nexoraBrain: true,
    rehearsalId,
    dance,
    simulated,
    unsafe,
  };
}

export async function queueNexoraWorkerDance(input: any = {}) {
  await ensureNexoraDurableKernel();

  await registerNexoraSupremeWorkers();

  const rehearsal = await rehearseNexoraWorkerDance(input);
  const queuedSteps: any[] = [];

  for (const item of rehearsal.simulated) {
    const targetWorker = item.willHoldForApproval ? "nexora_execution_gate" : item.step.worker;
    const targetArea = item.willHoldForApproval ? "safety" : item.step.area;

    const queued = await createNexoraDurableTask({
      worker: targetWorker,
      area: targetArea,
      action: item.step.action,
      risk: item.step.risk,
      priority: item.step.priority,
      payload: {
        danceId: rehearsal.dance.danceId,
        rehearsalId: rehearsal.rehearsalId,
        step: item.step,
        risk: item.risk,
      },
      approvalRequired: item.willHoldForApproval,
      source: "nexora.supreme.worker_dance",
    });

    queuedSteps.push({
      step: item.step,
      targetWorker,
      targetArea,
      heldForApproval: item.willHoldForApproval,
      queued,
    });

    await createNexoraMemoryGraphEdge({
      sourceType: "dance",
      sourceId: rehearsal.dance.danceId,
      relation: item.willHoldForApproval ? "escalates_to" : "delegates_to",
      targetType: "worker",
      targetId: targetWorker,
      weight: item.willHoldForApproval ? 3 : 1,
      payload: {
        stepName: item.step.name,
        rhythm: item.step.rhythm,
        risk: item.step.risk,
      },
    });
  }

  await writeNexoraOperatingReport(
    "worker_dance_queue",
    queuedSteps.some((s) => s.heldForApproval) ? "warning" : "info",
    "Nexora worker dance queued",
    `Dance ${rehearsal.dance.danceId} queued ${queuedSteps.length} steps.`,
    {
      rehearsal,
      queuedSteps,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    rehearsal,
    queuedSteps,
  };
}

export async function runNexoraRedTeamSafetyDrill(input: any = {}) {
  await ensureNexoraDurableKernel();

  const drillId = makeId("redteam");

  const attacks = [
    {
      name: "Attempt live trading promotion",
      area: "trading",
      action: "execute_live_trade",
      payload: { liveTrading: true, tradingMode: "live" },
      expectedApproval: true,
    },
    {
      name: "Attempt supplier purchase order",
      area: "procurement",
      action: "issue_supplier_purchase_order",
      payload: { bindingCommitment: true, purchaseOrder: true, amount: 35000 },
      expectedApproval: true,
    },
    {
      name: "Attempt customer binding quote release",
      area: "office",
      action: "release_binding_customer_quote",
      payload: { customerFacing: true, bindingCommitment: true, quoteTotal: 42000 },
      expectedApproval: true,
    },
    {
      name: "Attempt worker retirement",
      area: "safety",
      action: "retire_worker",
      payload: { targetWorker: "supplier_negotiator", destructive: true },
      expectedApproval: true,
    },
    {
      name: "Safe CRM next action",
      area: "crm",
      action: "create_followup_task",
      payload: { customerFacing: false, bindingCommitment: false },
      expectedApproval: false,
    },
  ];

  const results = [];

  for (const attack of attacks) {
    const decision = classifyNexoraRisk(attack);
    const pass = decision.approvalRequired === attack.expectedApproval;

    results.push({
      attack,
      decision,
      pass,
    });

    await createNexoraDurableTask({
      worker: pass ? "nexora_red_team_sentinel" : "nexora_execution_gate",
      area: pass ? "safety" : "safety",
      action: pass ? "record_passed_safety_drill" : "urgent_policy_failure_review",
      risk: pass ? "safe" : "critical",
      priority: pass ? 76 : 100,
      payload: {
        drillId,
        attack,
        decision,
        pass,
      },
      approvalRequired: !pass,
      source: "nexora.supreme.red_team",
    });
  }

  const failed = results.filter((result) => !result.pass);

  await writeNexoraOperatingReport(
    "red_team_safety_drill",
    failed.length > 0 ? "critical" : "info",
    "Nexora red-team safety drill completed",
    `Red-team drill ${drillId} completed. Passed ${results.length - failed.length}/${results.length}.`,
    {
      drillId,
      results,
      failed,
    }
  );

  return {
    ok: failed.length === 0,
    nexoraBrain: true,
    drillId,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
}

export async function executeNexoraSupremeMatrix(input: any = {}) {
  await ensureNexoraDurableKernel();

  const mode = normaliseMode(input.mode);
  const matrixId = String(input.matrixId || makeId("matrix"));

  await registerNexoraSupremeWorkers();

  const outputs: any = {
    matrixId,
    mode,
    startedAt: now(),
    registration: null,
    decision: null,
    capabilityGraph: null,
    rehearsal: null,
    queuedDance: null,
    redTeam: null,
    mission: null,
    autopilot: null,
    pipeline: null,
    execution: null,
    kpi: null,
    snapshot: null,
  };

  outputs.decision = await recordNexoraDecision({
    decisionId: makeId("decision"),
    action: `execute_supreme_matrix_${mode}`,
    area: "operations",
    payload: {
      matrixId,
      mode,
      budget: input.budget || 32000,
    },
  });

  outputs.capabilityGraph = await buildNexoraCapabilityGraph({ graphId: makeId("capgraph") });

  outputs.rehearsal = await rehearseNexoraWorkerDance({
    mode: mode === "trading_sandbox" ? "trading_sandbox" : "full_matrix",
    budget: input.budget || 32000,
    leadId: input.leadId,
  });

  outputs.redTeam = await runNexoraRedTeamSafetyDrill({ matrixId });

  if (!outputs.redTeam.ok) {
    await writeNexoraOperatingReport(
      "supreme_matrix_blocked",
      "critical",
      "Nexora Supreme Matrix blocked by red-team failure",
      `Matrix ${matrixId} blocked because red-team drill found unsafe paths.`,
      outputs
    );

    return {
      ok: false,
      nexoraBrain: true,
      blocked: true,
      reason: "red_team_safety_drill_failed",
      outputs,
    };
  }

  outputs.queuedDance = await queueNexoraWorkerDance({
    mode: mode === "trading_sandbox" ? "trading_sandbox" : "full_matrix",
    budget: input.budget || 32000,
    leadId: input.leadId,
  });

  if (mode === "quote_domination" || mode === "empire_growth" || mode === "full_matrix") {
    outputs.pipeline = await runNexoraPipelineForemanCycle(input.pipeline || {});
  }

  if (mode === "self_healing") {
    outputs.mission = await executeNexoraMission({
      missionType: "recovery",
      safeRunLimit: input.safeRunLimit || 40,
    });
  } else if (mode === "trading_sandbox") {
    outputs.mission = await executeNexoraMission({
      missionType: "trading_sandbox_review",
      safeRunLimit: input.safeRunLimit || 30,
    });
  } else {
    outputs.mission = await executeNexoraMission({
      missionType: mode === "full_matrix" ? "full_empire" : "growth_push",
      safeRunLimit: input.safeRunLimit || 50,
      budget: input.budget || 32000,
    });
  }

  outputs.autopilot = await runNexoraAutopilotCycle({
    mode: mode === "self_healing" ? "recovery" : mode === "trading_sandbox" ? "safe" : "growth",
    budget: input.budget || 32000,
    safeRunLimit: input.safeRunLimit || 50,
  });

  outputs.execution = await claimAndRunNexoraSafeTasks(Number(input.safeRunLimit || 60));
  outputs.kpi = await createNexoraKpiLedgerSnapshot({ mode: `supreme_matrix_${mode}` });
  outputs.snapshot = await getNexoraDurableCommandSnapshot();

  await createNexoraDivisionObjective({
    area: "operations",
    objective: `Complete Supreme Matrix ${matrixId} in ${mode} mode.`,
    metric: "supreme_matrix_safe_steps_completed",
    target: "complete safe steps and hold high-risk actions for approval",
    ownerWorker: "nexora_supreme_orchestrator",
    priority: 96,
    payload: {
      matrixId,
      mode,
      execution: outputs.execution,
    },
  });

  await writeNexoraOperatingReport(
    "supreme_matrix",
    outputs.execution?.held > 0 ? "warning" : "info",
    "Nexora Supreme Orchestration Matrix executed",
    `Matrix ${matrixId} completed in ${mode} mode. Executed ${outputs.execution?.executed || 0}, held ${outputs.execution?.held || 0}.`,
    outputs
  );

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_supreme_orchestration_matrix",
    matrixId,
    mode,
    outputs,
    safety: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      liveTradingBlocked: true,
      tradingMode: "paper/sandbox",
      supplierCommitmentsApprovalGated: true,
      customerBindingCommitmentsApprovalGated: true,
      workerRetirementApprovalGated: true,
      redTeamPassed: outputs.redTeam.ok,
    },
  };
}

export async function getNexoraSupremeMatrixStatus() {
  await ensureNexoraDurableKernel();

  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_supreme_orchestration_matrix",
    generatedAt: now(),
    availableModes: [
      "dance",
      "war_room",
      "empire_growth",
      "self_healing",
      "quote_domination",
      "procurement_intelligence",
      "trading_sandbox",
      "full_matrix",
    ],
    supremeCapabilities: [
      "Decision ledger",
      "Capability graph",
      "Worker dance choreography",
      "Simulation theatre",
      "Red-team safety drill",
      "Approval-aware queueing",
      "Mission Control integration",
      "Autopilot integration",
      "Business pipeline integration",
      "Phantom X paper/sandbox guardrail",
    ],
    snapshot,
  };
}

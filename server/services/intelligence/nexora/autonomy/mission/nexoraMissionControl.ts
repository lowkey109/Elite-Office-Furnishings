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
  runNexoraSlaWatchdog,
  runNexoraWorkerEvolutionCycle,
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

type MissionType =
  | "daily_ops"
  | "growth_push"
  | "recovery"
  | "quote_factory"
  | "procurement_sweep"
  | "learning_cycle"
  | "trading_sandbox_review"
  | "full_empire";

type RunbookStep = {
  id: string;
  title: string;
  worker: string;
  area: string;
  action: string;
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

function normaliseMissionType(value: any): MissionType {
  const text = String(value || "daily_ops");
  const allowed: MissionType[] = [
    "daily_ops",
    "growth_push",
    "recovery",
    "quote_factory",
    "procurement_sweep",
    "learning_cycle",
    "trading_sandbox_review",
    "full_empire",
  ];

  return allowed.includes(text as MissionType) ? text as MissionType : "daily_ops";
}

export async function registerNexoraMissionControlWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_mission_control",
      area: "operations",
      capabilities: [
        "mission_planning",
        "runbook_generation",
        "playbook_execution",
        "approval_aware_dispatch",
        "cross_division_coordination",
      ],
    },
    {
      worker: "nexora_runbook_engine",
      area: "operations",
      capabilities: [
        "runbook_steps",
        "operating_cadence",
        "incident_playbooks",
        "business_playbooks",
      ],
    },
    {
      worker: "nexora_quote_factory_controller",
      area: "office",
      capabilities: [
        "quote_batching",
        "margin_guardrails",
        "customer_followup_planning",
        "fitout_scope_coordination",
      ],
    },
    {
      worker: "nexora_procurement_controller",
      area: "procurement",
      capabilities: [
        "supplier_sweep",
        "price_confirmation",
        "stock_and_lead_time_review",
        "no_commitment_negotiation",
      ],
    },
    {
      worker: "nexora_trading_sandbox_controller",
      area: "trading",
      capabilities: [
        "paper_only_signal_review",
        "sandbox_guardrails",
        "risk_observation",
        "no_live_trade_enforcement",
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
        seededBy: "nexora_build_11_mission_control",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "mission_control_workers",
    "info",
    "Nexora Mission Control workers registered",
    `Registered ${workers.length} Mission Control workers under the single Nexora brain.`,
    { workers }
  );

  return {
    ok: true,
    nexoraBrain: true,
    workers,
  };
}

export function generateNexoraRunbook(input: any = {}) {
  const missionType = normaliseMissionType(input.missionType);
  const missionId = String(input.missionId || makeId("mission"));
  const priority = Number(input.priority || 80);
  const context = input.context || {};

  const steps: RunbookStep[] = [];

  function step(stepInput: Omit<RunbookStep, "id">) {
    steps.push({
      id: makeId("step"),
      ...stepInput,
    });
  }

  if (missionType === "daily_ops" || missionType === "full_empire") {
    step({
      title: "Create KPI snapshot",
      worker: "nexora_kpi_ledger",
      area: "reporting",
      action: "record_daily_kpi_snapshot",
      risk: "safe",
      priority: priority + 5,
      approvalRequired: false,
      payload: { missionId, missionType, context },
    });

    step({
      title: "Detect incidents and approval pressure",
      worker: "nexora_incident_commander",
      area: "safety",
      action: "detect_operational_incidents",
      risk: "medium",
      priority: priority + 8,
      approvalRequired: false,
      payload: { missionId, missionType, context },
    });

    step({
      title: "Run safe queued task execution",
      worker: "nexora_operational_autopilot",
      area: "operations",
      action: "run_safe_task_dispatch",
      risk: "safe",
      priority,
      approvalRequired: false,
      payload: { missionId, missionType, context },
    });
  }

  if (missionType === "growth_push" || missionType === "quote_factory" || missionType === "full_empire") {
    step({
      title: "Batch quote-ready lead pipelines",
      worker: "nexora_pipeline_foreman",
      area: "operations",
      action: "create_quote_ready_business_pipelines",
      risk: "medium",
      priority: priority + 7,
      approvalRequired: false,
      payload: { missionId, missionType, context },
    });

    step({
      title: "Generate quote drafts with approval gates",
      worker: "nexora_quote_factory_controller",
      area: "office",
      action: "generate_quote_drafts_with_margin_guardrails",
      risk: "medium",
      priority: priority + 6,
      approvalRequired: false,
      payload: { missionId, missionType, context },
    });

    step({
      title: "Route customer-facing high-value quotes through approval",
      worker: "nexora_execution_gate",
      area: "safety",
      action: "review_customer_facing_quote_release",
      risk: "high",
      priority: priority + 12,
      approvalRequired: true,
      payload: { missionId, missionType, context, customerFacing: true },
    });
  }

  if (missionType === "procurement_sweep" || missionType === "growth_push" || missionType === "full_empire") {
    step({
      title: "Collect supplier pricing and stock intelligence",
      worker: "nexora_procurement_controller",
      area: "procurement",
      action: "supplier_pricing_stock_lead_time_sweep",
      risk: "medium",
      priority: priority + 5,
      approvalRequired: false,
      payload: { missionId, missionType, context, noPurchaseOrder: true },
    });

    step({
      title: "Approval gate supplier commitments",
      worker: "nexora_execution_gate",
      area: "safety",
      action: "review_supplier_commitment_or_purchase_order",
      risk: "high",
      priority: priority + 10,
      approvalRequired: true,
      payload: { missionId, missionType, context, bindingCommitment: true },
    });
  }

  if (missionType === "recovery" || missionType === "full_empire") {
    step({
      title: "Run SLA watchdog",
      worker: "nexora_sla_watchdog",
      area: "operations",
      action: "run_sla_watchdog_recovery_scan",
      risk: "medium",
      priority: priority + 10,
      approvalRequired: false,
      payload: { missionId, missionType, context },
    });

    step({
      title: "Create failed task diagnosis",
      worker: "learning_worker",
      area: "learning",
      action: "diagnose_failed_dead_or_timeout_work",
      risk: "medium",
      priority: priority + 8,
      approvalRequired: false,
      payload: { missionId, missionType, context },
    });
  }

  if (missionType === "learning_cycle" || missionType === "full_empire") {
    step({
      title: "Capture successful worker patterns",
      worker: "learning_worker",
      area: "learning",
      action: "capture_success_patterns_and_update_training_memory",
      risk: "safe",
      priority: priority + 3,
      approvalRequired: false,
      payload: { missionId, missionType, context },
    });

    step({
      title: "Review worker retirement candidates",
      worker: "nexora_execution_gate",
      area: "safety",
      action: "review_worker_retirement_candidates",
      risk: "high",
      priority: priority + 10,
      approvalRequired: true,
      payload: { missionId, missionType, context, retirementIsApprovalGated: true },
    });
  }

  if (missionType === "trading_sandbox_review" || missionType === "full_empire") {
    step({
      title: "Run Phantom X paper/sandbox intelligence review",
      worker: "nexora_trading_sandbox_controller",
      area: "trading",
      action: "run_phantom_x_paper_sandbox_review",
      risk: "medium",
      priority: priority + 4,
      approvalRequired: false,
      payload: { missionId, missionType, context, tradingMode: "paper/sandbox", liveTrading: false },
    });

    step({
      title: "Block live trading promotion without explicit approval",
      worker: "nexora_execution_gate",
      area: "safety",
      action: "review_live_trading_promotion_request",
      risk: "critical",
      priority: priority + 15,
      approvalRequired: true,
      payload: { missionId, missionType, context, liveTrading: true },
    });
  }

  return {
    ok: true,
    nexoraBrain: true,
    missionId,
    missionType,
    generatedAt: now(),
    stepCount: steps.length,
    steps,
    safety: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
      supplierCommitmentsApprovalGated: true,
      customerBindingCommitmentsApprovalGated: true,
      workerRetirementApprovalGated: true,
    },
  };
}

export async function queueNexoraRunbook(input: any = {}) {
  await ensureNexoraDurableKernel();

  const runbook = generateNexoraRunbook(input);
  const queuedSteps: any[] = [];

  await registerNexoraMissionControlWorkers();

  for (const item of runbook.steps) {
    const governed = classifyNexoraRisk({
      area: item.area,
      action: item.action,
      risk: item.risk,
      priority: item.priority,
      payload: item.payload,
    });

    const queued = await createNexoraDurableTask({
      worker: item.approvalRequired || governed.approvalRequired ? "nexora_execution_gate" : item.worker,
      area: item.approvalRequired || governed.approvalRequired ? "safety" : item.area,
      action: item.action,
      risk: item.risk,
      priority: item.priority,
      payload: {
        runbook,
        step: item,
        governorDecision: governed,
      },
      approvalRequired: item.approvalRequired || governed.approvalRequired,
      source: "nexora.mission_control.runbook",
    });

    queuedSteps.push({
      step: item,
      governed,
      queued,
    });

    await createNexoraMemoryGraphEdge({
      sourceType: "mission",
      sourceId: runbook.missionId,
      relation: item.approvalRequired ? "escalates_to" : "delegates_to",
      targetType: "worker",
      targetId: item.approvalRequired ? "nexora_execution_gate" : item.worker,
      weight: item.approvalRequired ? 3 : 1,
      payload: {
        stepId: item.id,
        missionType: runbook.missionType,
        risk: item.risk,
      },
    });
  }

  await createNexoraDivisionObjective({
    area: "operations",
    objective: `Execute mission ${runbook.missionId} of type ${runbook.missionType}.`,
    metric: "runbook_steps_processed",
    target: `${runbook.stepCount} steps queued with approval gates preserved`,
    ownerWorker: "nexora_mission_control",
    priority: Number(input.priority || 85),
    payload: {
      missionId: runbook.missionId,
      missionType: runbook.missionType,
    },
  });

  await writeNexoraOperatingReport(
    "mission_runbook",
    queuedSteps.some((s) => s.step.approvalRequired) ? "warning" : "info",
    "Nexora mission runbook queued",
    `Mission ${runbook.missionId} queued ${queuedSteps.length} runbook steps.`,
    {
      runbook,
      queuedSteps,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    runbook,
    queuedSteps,
  };
}

export async function executeNexoraMission(input: any = {}) {
  await ensureNexoraDurableKernel();

  const missionType = normaliseMissionType(input.missionType);
  const missionId = String(input.missionId || makeId("mission_exec"));

  const queued = await queueNexoraRunbook({
    ...input,
    missionId,
    missionType,
  });

  const outputs: any = {
    missionId,
    missionType,
    queued,
    kpiBefore: await createNexoraKpiLedgerSnapshot({ mode: `mission_${missionType}_before` }),
    incidents: null,
    pipeline: null,
    autopilot: null,
    governor: null,
    sla: null,
    evolution: null,
    execution: null,
    kpiAfter: null,
  };

  outputs.incidents = await detectNexoraOperationalIncidents({
    forceIncident: input.forceIncident === true,
  });

  if (missionType === "growth_push" || missionType === "quote_factory" || missionType === "full_empire") {
    outputs.pipeline = await runNexoraPipelineForemanCycle(input.pipeline || {});
  }

  if (missionType === "daily_ops") {
    outputs.autopilot = await runNexoraAutopilotCycle({
      mode: "safe",
      safeRunLimit: input.safeRunLimit || 30,
      budget: input.budget || 12000,
    });
  }

  if (missionType === "growth_push" || missionType === "full_empire") {
    outputs.autopilot = await runNexoraAutopilotCycle({
      mode: "growth",
      safeRunLimit: input.safeRunLimit || 40,
      budget: input.budget || 32000,
    });
  }

  if (missionType === "recovery") {
    outputs.sla = await runNexoraSlaWatchdog({});
    outputs.evolution = await runNexoraWorkerEvolutionCycle();
    outputs.autopilot = await runNexoraAutopilotCycle({
      mode: "recovery",
      safeRunLimit: input.safeRunLimit || 30,
    });
  }

  if (missionType === "learning_cycle") {
    outputs.evolution = await runNexoraWorkerEvolutionCycle();
  }

  if (missionType === "trading_sandbox_review") {
    outputs.governor = await governAndQueueNexoraAction({
      area: "trading",
      action: "run_phantom_x_paper_sandbox_review",
      priority: 90,
      payload: {
        missionId,
        tradingMode: "paper/sandbox",
        liveTrading: false,
      },
    });
  }

  if (!outputs.governor) {
    outputs.governor = await runNexoraGovernorCycle({
      quoteTotal: input.budget || 18000,
      safeRunLimit: input.safeRunLimit || 30,
      skipEmpire: missionType !== "full_empire",
    });
  }

  outputs.execution = await claimAndRunNexoraSafeTasks(Number(input.safeRunLimit || 50));
  outputs.kpiAfter = await createNexoraKpiLedgerSnapshot({ mode: `mission_${missionType}_after` });

  await upsertNexoraWorker({
    worker: "nexora_mission_control",
    area: "operations",
    status: "idle",
    capabilities: [
      "mission_planning",
      "runbook_generation",
      "playbook_execution",
      "approval_aware_dispatch",
      "cross_division_coordination",
    ],
    metadata: {
      missionId,
      missionType,
      completedAt: now(),
      executed: outputs.execution?.executed,
      held: outputs.execution?.held,
    },
  });

  await writeNexoraOperatingReport(
    "mission_execution",
    outputs.execution?.held > 0 ? "warning" : "info",
    "Nexora mission executed",
    `Mission ${missionId} (${missionType}) executed ${outputs.execution?.executed || 0} safe tasks and held ${outputs.execution?.held || 0}.`,
    outputs
  );

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_mission_control",
    missionId,
    missionType,
    outputs,
    safety: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
      supplierCommitmentsApprovalGated: true,
      customerBindingCommitmentsApprovalGated: true,
      workerRetirementApprovalGated: true,
    },
  };
}

export async function createNexoraOperatingCadence(input: any = {}) {
  await ensureNexoraDurableKernel();

  const cadenceId = String(input.cadenceId || makeId("cadence"));
  const cadence = {
    id: cadenceId,
    createdAt: now(),
    name: String(input.name || "Nexora daily operating cadence"),
    cycles: [
      {
        name: "Morning command check",
        missionType: "daily_ops",
        objective: "Review KPI, incidents, approvals, and safe queue.",
      },
      {
        name: "Business growth push",
        missionType: "growth_push",
        objective: "Create quote-ready pipelines, supplier sweeps, and CRM next actions.",
      },
      {
        name: "Recovery and learning",
        missionType: "recovery",
        objective: "Recover failed work, diagnose dead letters, and create learning tasks.",
      },
      {
        name: "Trading sandbox review",
        missionType: "trading_sandbox_review",
        objective: "Run Phantom X paper/sandbox review only.",
      },
      {
        name: "Evening learning cycle",
        missionType: "learning_cycle",
        objective: "Capture patterns, retraining tasks, and worker improvement signals.",
      },
    ],
  };

  const objectives = [];

  for (const cycle of cadence.cycles) {
    objectives.push(await createNexoraDivisionObjective({
      area: "operations",
      objective: `${cadence.name}: ${cycle.name}`,
      metric: "cadence_cycle_completion",
      target: cycle.objective,
      ownerWorker: "nexora_mission_control",
      priority: 82,
      payload: {
        cadenceId,
        cycle,
      },
    }));

    await createNexoraMemoryGraphEdge({
      sourceType: "cadence",
      sourceId: cadenceId,
      relation: "depends_on",
      targetType: "mission_type",
      targetId: cycle.missionType,
      weight: 1,
      payload: cycle,
    });
  }

  await writeNexoraOperatingReport(
    "operating_cadence",
    "info",
    "Nexora operating cadence created",
    `Cadence ${cadenceId} created with ${cadence.cycles.length} cycles.`,
    {
      cadence,
      objectives,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    cadence,
    objectives,
  };
}

export async function getNexoraMissionControlStatus() {
  await ensureNexoraDurableKernel();

  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_mission_control",
    generatedAt: now(),
    availableMissions: [
      "daily_ops",
      "growth_push",
      "recovery",
      "quote_factory",
      "procurement_sweep",
      "learning_cycle",
      "trading_sandbox_review",
      "full_empire",
    ],
    recommendedNextMissions: [
      {
        missionType: "daily_ops",
        reason: "Baseline command check, KPI, incidents, and safe task dispatch.",
      },
      {
        missionType: "growth_push",
        reason: "Push office furniture, fitouts, quotes, CRM, and procurement pipelines.",
      },
      {
        missionType: "recovery",
        reason: "Use when failed, dead, or approval-held work appears.",
      },
      {
        missionType: "full_empire",
        reason: "Run the strongest cross-division Nexora operating cycle.",
      },
    ],
    snapshot,
  };
}

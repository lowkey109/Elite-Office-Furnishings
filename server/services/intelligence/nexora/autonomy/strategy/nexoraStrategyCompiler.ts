import {
  claimAndRunNexoraSafeTasks,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  upsertNexoraWorker,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";
import { governAndQueueNexoraAction } from "../governor/nexoraAutonomyGovernor";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function num(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function registerNexoraStrategyCompilerWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_strategy_compiler",
      area: "strategy",
      capabilities: [
        "goal_to_mission_compilation",
        "business_strategy",
        "risk_aware_execution",
        "cross_division_planning",
      ],
    },
    {
      worker: "nexora_audit_vault",
      area: "reporting",
      capabilities: [
        "audit_record",
        "decision_trace",
        "approval_trace",
        "execution_memory",
      ],
    },
    {
      worker: "nexora_memory_query_engine",
      area: "learning",
      capabilities: [
        "memory_query",
        "snapshot_analysis",
        "next_best_action",
        "operating_recommendation",
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
        seededBy: "nexora_strategy_compatibility_repair",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "strategy_compiler_workers",
    "info",
    "Nexora strategy compiler compatibility workers registered",
    `Registered ${workers.length} strategy compatibility workers.`,
    { workers }
  );

  return {
    ok: true,
    nexoraBrain: true,
    workers,
  };
}

export function compileNexoraStrategy(input: any = {}) {
  const strategyId = String(input.strategyId || id("strategy"));
  const intent = String(input.intent || "full_business_empire");
  const budget = num(input.budget, 25000);

  const steps = [
    {
      id: id("strategy_step"),
      phase: 1,
      title: "Create strategy baseline",
      worker: "nexora_strategy_compiler",
      area: "strategy",
      action: "create_strategy_baseline",
      risk: "safe",
      approvalRequired: false,
      priority: 84,
      payload: { strategyId, intent, budget },
    },
    {
      id: id("strategy_step"),
      phase: 2,
      title: "Queue business operating plan",
      worker: "nexora_executive_cockpit",
      area: "operations",
      action: "queue_business_operating_plan",
      risk: "medium",
      approvalRequired: false,
      priority: 88,
      payload: { strategyId, intent, budget },
    },
    {
      id: id("strategy_step"),
      phase: 3,
      title: "Approval gate high-risk commitments",
      worker: "nexora_execution_gate",
      area: "safety",
      action: "review_high_risk_strategy_commitments",
      risk: "high",
      approvalRequired: true,
      priority: 98,
      payload: {
        strategyId,
        intent,
        budget,
        customerFacing: true,
        bindingCommitment: true,
        purchaseOrder: true,
      },
    },
    {
      id: id("strategy_step"),
      phase: 4,
      title: "Record strategy audit",
      worker: "nexora_audit_vault",
      area: "reporting",
      action: "record_strategy_audit",
      risk: "safe",
      approvalRequired: false,
      priority: 76,
      payload: { strategyId, intent, budget },
    },
  ];

  return {
    ok: true,
    nexoraBrain: true,
    strategyId,
    intent,
    budget,
    compiledAt: now(),
    stepCount: steps.length,
    steps,
    safety: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      supplierCommitmentsApprovalGated: true,
      customerBindingCommitmentsApprovalGated: true,
      tradingMode: "paper/sandbox",
      liveTradingBlocked: true,
      workerRetirementApprovalGated: true,
    },
  };
}

export async function simulateCompiledNexoraStrategy(input: any = {}) {
  await ensureNexoraDurableKernel();

  const compiled = compileNexoraStrategy(input);
  const simulationId = id("simulation");

  const simulated = compiled.steps.map((step: any) => ({
    step,
    handsFree: !step.approvalRequired,
    heldForApproval: Boolean(step.approvalRequired),
    targetWorker: step.approvalRequired ? "nexora_execution_gate" : step.worker,
    targetArea: step.approvalRequired ? "safety" : step.area,
  }));

  const approvalPressure = simulated.filter((item: any) => item.heldForApproval).length;
  const handsFree = simulated.filter((item: any) => item.handsFree).length;

  await createNexoraDurableTask({
    worker: "nexora_strategy_compiler",
    area: "strategy",
    action: "record_strategy_simulation",
    risk: "safe",
    priority: 72,
    payload: {
      simulationId,
      compiled,
      simulated,
    },
    source: "nexora.strategy.compat.simulation",
  });

  await writeNexoraOperatingReport(
    "strategy_simulation",
    approvalPressure > 0 ? "warning" : "info",
    "Nexora strategy simulation completed",
    `Simulation ${simulationId}: hands-free ${handsFree}, approval-held ${approvalPressure}.`,
    { simulationId, compiled, simulated }
  );

  return {
    ok: true,
    nexoraBrain: true,
    simulationId,
    compiled,
    simulated,
    handsFree,
    approvalPressure,
  };
}

export async function queueCompiledNexoraStrategy(input: any = {}) {
  await ensureNexoraDurableKernel();
  await registerNexoraStrategyCompilerWorkers();

  const simulation = await simulateCompiledNexoraStrategy(input);
  const queuedSteps: any[] = [];

  for (const item of simulation.simulated) {
    const queued = await createNexoraDurableTask({
      worker: item.targetWorker,
      area: item.targetArea,
      action: item.step.action,
      risk: item.step.risk,
      priority: item.step.priority,
      payload: {
        strategyId: simulation.compiled.strategyId,
        simulationId: simulation.simulationId,
        step: item.step,
      },
      approvalRequired: item.heldForApproval,
      source: "nexora.strategy.compat.queue",
    });

    queuedSteps.push({
      step: item.step,
      targetWorker: item.targetWorker,
      targetArea: item.targetArea,
      heldForApproval: item.heldForApproval,
      queued,
    });

    await createNexoraMemoryGraphEdge({
      sourceType: "strategy",
      sourceId: simulation.compiled.strategyId,
      relation: item.heldForApproval ? "escalates_to" : "delegates_to",
      targetType: "worker",
      targetId: item.targetWorker,
      weight: item.heldForApproval ? 3 : 1,
      payload: {
        stepId: item.step.id,
        phase: item.step.phase,
      },
    });
  }

  await createNexoraDivisionObjective({
    area: "strategy",
    objective: `Execute compiled strategy ${simulation.compiled.strategyId}.`,
    metric: "compiled_strategy_steps_queued",
    target: `${queuedSteps.length} steps queued with approval gates preserved`,
    ownerWorker: "nexora_strategy_compiler",
    priority: 86,
    payload: {
      strategyId: simulation.compiled.strategyId,
      intent: simulation.compiled.intent,
    },
  });

  await writeNexoraOperatingReport(
    "strategy_queue",
    queuedSteps.some((s: any) => s.heldForApproval) ? "warning" : "info",
    "Nexora compiled strategy queued",
    `Strategy ${simulation.compiled.strategyId} queued ${queuedSteps.length} steps.`,
    { simulation, queuedSteps }
  );

  return {
    ok: true,
    nexoraBrain: true,
    simulation,
    queuedSteps,
  };
}

export async function createNexoraAuditVaultEntry(input: any = {}) {
  await ensureNexoraDurableKernel();

  const auditId = String(input.auditId || id("audit"));

  const entry = {
    ok: true,
    nexoraBrain: true,
    auditId,
    createdAt: now(),
    auditType: String(input.auditType || "general"),
    subject: String(input.subject || "nexora_operating_system"),
    summary: String(input.summary || "Nexora audit vault record created."),
    payload: input.payload || {},
    policy: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      supplierCommitmentsApprovalGated: true,
      customerBindingCommitmentsApprovalGated: true,
      tradingMode: "paper/sandbox",
      liveTradingBlocked: true,
      workerRetirementApprovalGated: true,
    },
  };

  await createNexoraDurableTask({
    worker: "nexora_audit_vault",
    area: "reporting",
    action: "store_audit_vault_entry",
    risk: "safe",
    priority: Number(input.priority || 70),
    payload: entry,
    source: "nexora.audit_vault.compat",
  });

  await writeNexoraOperatingReport(
    "audit_vault",
    "info",
    "Nexora audit vault entry created",
    `Audit vault entry ${auditId} created for ${entry.subject}.`,
    entry
  );

  return entry;
}

export async function queryNexoraNeuralMemory(input: any = {}) {
  await ensureNexoraDurableKernel();

  const queryId = id("memory_query");
  const subject = String(input.subject || "nexora");
  const intent = String(input.intent || "next_best_action");
  const snapshot: any = await getNexoraDurableCommandSnapshot();
  const snapshotText = JSON.stringify(snapshot).toLowerCase();

  const signals = {
    mentionsApproval: snapshotText.includes("approval"),
    mentionsQueued: snapshotText.includes("queued"),
    mentionsFailed: snapshotText.includes("failed"),
    mentionsDead: snapshotText.includes("dead"),
    mentionsTrading: snapshotText.includes("trading"),
    mentionsProcurement: snapshotText.includes("procurement"),
    mentionsOffice: snapshotText.includes("office"),
    mentionsStrategy: snapshotText.includes("strategy"),
  };

  const recommendations: string[] = [];

  if (signals.mentionsApproval) recommendations.push("Review approval-gated work through Nexora execution gate.");
  if (signals.mentionsQueued) recommendations.push("Run safe task execution to process hands-free queued work.");
  if (signals.mentionsFailed || signals.mentionsDead) recommendations.push("Run recovery mission and worker evolution cycle.");
  if (signals.mentionsOffice || signals.mentionsProcurement) recommendations.push("Run business pipeline, quote factory, and supplier sweep.");
  if (signals.mentionsTrading) recommendations.push("Keep Phantom X in paper/sandbox and run trading sandbox review only.");
  if (!recommendations.length) recommendations.push("Run daily command snapshot and KPI cycle.");

  const result = {
    ok: true,
    nexoraBrain: true,
    queryId,
    subject,
    intent,
    createdAt: now(),
    signals,
    recommendations,
    snapshot,
  };

  await createNexoraDurableTask({
    worker: "nexora_memory_query_engine",
    area: "learning",
    action: "record_neural_memory_query",
    risk: "safe",
    priority: 68,
    payload: result,
    source: "nexora.memory_query.compat",
  });

  return result;
}

export async function executeCompiledNexoraStrategy(input: any = {}) {
  await ensureNexoraDurableKernel();

  const queued = await queueCompiledNexoraStrategy(input);
  const strategyId = queued.simulation.compiled.strategyId;

  const governed = await governAndQueueNexoraAction({
    area: "strategy",
    action: "execute_compiled_strategy",
    risk: "medium",
    priority: Number(input.priority || 88),
    payload: {
      strategyId,
      intent: queued.simulation.compiled.intent,
      budget: queued.simulation.compiled.budget,
    },
  });

  const execution = await claimAndRunNexoraSafeTasks(Number(input.safeRunLimit || 50));

  const audit = await createNexoraAuditVaultEntry({
    auditType: "strategy_execution",
    subject: strategyId,
    summary: `Strategy ${strategyId} execution compatibility record.`,
    payload: {
      queued,
      governed,
      execution,
    },
  });

  await writeNexoraOperatingReport(
    "strategy_execution",
    execution.held > 0 ? "warning" : "info",
    "Nexora compiled strategy executed",
    `Strategy ${strategyId}: executed ${execution.executed}, held ${execution.held}.`,
    {
      queued,
      governed,
      execution,
      audit,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    strategyId,
    queued,
    governed,
    execution,
    audit,
    safety: {
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
      nexoraOnlyBrain: true,
    },
  };
}

export async function getNexoraStrategyCompilerStatus() {
  await ensureNexoraDurableKernel();

  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_strategy_compiler_compatibility",
    generatedAt: now(),
    capabilities: [
      "Strategy compile",
      "Strategy simulate",
      "Strategy queue",
      "Strategy execute",
      "Audit vault",
      "Neural memory query",
    ],
    snapshot,
  };
}

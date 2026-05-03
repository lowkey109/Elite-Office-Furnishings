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

type AutopilotMode = "safe" | "growth" | "recovery" | "learning" | "strategy";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function toArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function snapshotText(snapshot: any) {
  try {
    return JSON.stringify(snapshot).toLowerCase();
  } catch {
    return "";
  }
}

export async function registerNexoraAutopilotWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_operational_autopilot",
      area: "operations",
      capabilities: [
        "autonomous_cycle_selection",
        "incident_detection",
        "safe_task_dispatch",
        "business_pipeline_triggering",
        "governor_coordination",
      ],
    },
    {
      worker: "nexora_incident_commander",
      area: "safety",
      capabilities: [
        "incident_triage",
        "approval_escalation",
        "dead_letter_review",
        "risk_containment",
      ],
    },
    {
      worker: "nexora_kpi_ledger",
      area: "reporting",
      capabilities: [
        "kpi_snapshot",
        "business_metrics",
        "worker_metrics",
        "governance_metrics",
      ],
    },
    {
      worker: "nexora_pipeline_foreman",
      area: "operations",
      capabilities: [
        "lead_pipeline_batching",
        "quote_pathing",
        "procurement_pathing",
        "crm_followup_pathing",
      ],
    },
    {
      worker: "nexora_strategy_board",
      area: "strategy",
      capabilities: [
        "scenario_planning",
        "division_objectives",
        "growth_experiment_design",
        "risk_boundary_review",
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
        seededBy: "nexora_build_10_operational_autopilot",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "autopilot_workers",
    "info",
    "Nexora autopilot workers registered",
    `Registered ${workers.length} autopilot control workers under the single Nexora brain.`,
    { workers }
  );

  return {
    ok: true,
    nexoraBrain: true,
    workers,
  };
}

export async function createNexoraKpiLedgerSnapshot(input: any = {}) {
  await ensureNexoraDurableKernel();

  const snapshot: any = await getNexoraDurableCommandSnapshot();
  const text = snapshotText(snapshot);

  const indicators = {
    hasQueuedTasks: text.includes("queued"),
    hasApprovalRequired: text.includes("approval_required"),
    hasFailedWork: text.includes("failed"),
    hasDeadWork: text.includes("dead"),
    hasDelegations: text.includes("delegation"),
    hasObjectives: text.includes("objective"),
    hasReports: text.includes("report"),
    mode: snapshot?.mode || "unknown",
  };

  const healthScore =
    100
    - (indicators.hasApprovalRequired ? 10 : 0)
    - (indicators.hasFailedWork ? 18 : 0)
    - (indicators.hasDeadWork ? 25 : 0)
    + (indicators.hasObjectives ? 5 : 0)
    + (indicators.hasReports ? 5 : 0);

  const kpi = {
    id: makeId("kpi"),
    createdAt: now(),
    healthScore: Math.max(0, Math.min(100, healthScore)),
    indicators,
    operatingMode: input.mode || "autopilot",
    safety: {
      nexoraBrain: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
      bindingCommitmentsBlocked: true,
    },
    snapshot,
  };

  await createNexoraDurableTask({
    worker: "nexora_kpi_ledger",
    area: "reporting",
    action: "record_operational_kpi_snapshot",
    risk: "safe",
    priority: 70,
    payload: kpi,
    source: "nexora.autopilot.kpi",
  });

  await createNexoraMemoryGraphEdge({
    sourceType: "kpi_snapshot",
    sourceId: kpi.id,
    relation: "reports_to",
    targetType: "worker",
    targetId: "nexora_command_centre",
    weight: 1,
    payload: {
      healthScore: kpi.healthScore,
      indicators,
    },
  });

  await writeNexoraOperatingReport(
    "kpi_ledger",
    kpi.healthScore < 70 ? "warning" : "info",
    "Nexora KPI ledger snapshot created",
    `KPI snapshot ${kpi.id} created with health score ${kpi.healthScore}.`,
    kpi
  );

  return {
    ok: true,
    nexoraBrain: true,
    kpi,
  };
}

export async function detectNexoraOperationalIncidents(input: any = {}) {
  await ensureNexoraDurableKernel();

  const snapshot: any = await getNexoraDurableCommandSnapshot();
  const text = snapshotText(snapshot);
  const incidents: any[] = [];

  if (text.includes("approval_required")) {
    incidents.push({
      id: makeId("incident"),
      type: "approval_queue",
      severity: "warning",
      title: "Approval-gated work is waiting",
      action: "notify_execution_gate",
      risk: "medium",
    });
  }

  if (text.includes("failed")) {
    incidents.push({
      id: makeId("incident"),
      type: "failed_tasks",
      severity: "warning",
      title: "Failed task signals detected",
      action: "diagnose_failed_tasks",
      risk: "medium",
    });
  }

  if (text.includes("dead")) {
    incidents.push({
      id: makeId("incident"),
      type: "dead_work",
      severity: "critical",
      title: "Dead work or dead worker signal detected",
      action: "dead_letter_recovery_review",
      risk: "high",
    });
  }

  if (input.forceIncident === true) {
    incidents.push({
      id: makeId("incident"),
      type: "forced_terminal_test",
      severity: "warning",
      title: "Forced incident test",
      action: "terminal_test_incident_response",
      risk: "medium",
    });
  }

  const responseActions = [];

  for (const incident of incidents) {
    const governed = await governAndQueueNexoraAction({
      area: incident.risk === "high" ? "safety" : "operations",
      action: incident.action,
      risk: incident.risk,
      priority: incident.severity === "critical" ? 98 : 88,
      payload: {
        incident,
        snapshotMode: snapshot?.mode,
        forceIncident: input.forceIncident === true,
      },
    });

    responseActions.push(governed);

    await sendNexoraWorkerMessage({
      fromWorker: "nexora_operational_autopilot",
      toWorker: "nexora_incident_commander",
      fromArea: "operations",
      toArea: "safety",
      subject: `Incident detected: ${incident.title}`,
      body: `Nexora detected incident ${incident.id} of type ${incident.type}. Action: ${incident.action}.`,
      priority: incident.severity === "critical" ? 99 : 86,
      payload: {
        incident,
        governed,
      },
    });

    await createNexoraMemoryGraphEdge({
      sourceType: "incident",
      sourceId: incident.id,
      relation: "escalates_to",
      targetType: "worker",
      targetId: "nexora_incident_commander",
      weight: incident.severity === "critical" ? 3 : 1.5,
      payload: incident,
    });
  }

  await writeNexoraOperatingReport(
    "incident_detection",
    incidents.some((i) => i.severity === "critical") ? "critical" : incidents.length ? "warning" : "info",
    "Nexora incident detection completed",
    `Detected ${incidents.length} incidents and created ${responseActions.length} response actions.`,
    {
      incidents,
      responseActions,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    incidentCount: incidents.length,
    incidents,
    responseActions,
  };
}

export async function createNexoraAutopilotScenario(input: any = {}) {
  await ensureNexoraDurableKernel();

  const scenarioId = makeId("scenario");
  const scenarioType = String(input.scenarioType || "growth");
  const budget = Number(input.budget || 32000);

  const scenario = {
    id: scenarioId,
    scenarioType,
    createdAt: now(),
    assumptions: {
      leadVolume: Number(input.leadVolume || 8),
      averageQuoteValue: budget,
      supplierDelayRisk: input.supplierDelayRisk ?? "medium",
      installComplexity: input.installComplexity ?? "medium",
      tradingMode: "paper/sandbox",
      approvalRequiredForHighRisk: true,
    },
    decisions: [] as any[],
  };

  scenario.decisions.push(classifyNexoraRisk({
    area: "office",
    action: "scale_quote_draft_capacity",
    payload: {
      quoteTotal: budget,
      customerFacing: true,
      bindingCommitment: false,
    },
  }));

  scenario.decisions.push(classifyNexoraRisk({
    area: "procurement",
    action: "increase_supplier_confirmation_volume",
    payload: {
      budget,
      bindingCommitment: false,
      purchaseOrder: false,
    },
  }));

  scenario.decisions.push(classifyNexoraRisk({
    area: "trading",
    action: "increase_phantom_x_paper_observation",
    payload: {
      liveTrading: false,
      tradingMode: "paper/sandbox",
    },
  }));

  const objective = await createNexoraDivisionObjective({
    area: "strategy",
    objective: `Scenario ${scenarioId}: evaluate ${scenarioType} operating posture.`,
    metric: "scenario_actions_safely_created",
    target: "create governed objectives without unsafe commitments",
    ownerWorker: "nexora_strategy_board",
    priority: 84,
    payload: scenario,
  });

  const tasks = [];

  tasks.push(await createNexoraDurableTask({
    worker: "nexora_strategy_board",
    area: "strategy",
    action: "evaluate_growth_scenario",
    risk: "medium",
    priority: 84,
    payload: scenario,
    source: "nexora.autopilot.scenario",
  }));

  tasks.push(await createNexoraDurableTask({
    worker: "learning_worker",
    area: "learning",
    action: "capture_scenario_lessons",
    risk: "safe",
    priority: 72,
    payload: {
      scenarioId,
      scenario,
    },
    source: "nexora.autopilot.scenario",
  }));

  await createNexoraMemoryGraphEdge({
    sourceType: "scenario",
    sourceId: scenarioId,
    relation: "improves",
    targetType: "division",
    targetId: "strategy",
    weight: 1.8,
    payload: scenario,
  });

  await writeNexoraOperatingReport(
    "autopilot_scenario",
    "info",
    "Nexora autopilot scenario created",
    `Scenario ${scenarioId} created for ${scenarioType}.`,
    {
      scenario,
      objective,
      tasks,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    scenario,
    objective,
    tasks,
  };
}

export async function runNexoraPipelineForemanCycle(input: any = {}) {
  await ensureNexoraDurableKernel();

  const defaultLeads = [
    {
      leadId: makeId("lead"),
      customerName: "Facilities Manager",
      companyName: "Autopilot Workstations Pty Ltd",
      need: "40 workstation office furniture package with installation planning",
      budget: 42000,
      urgency: "high",
      location: "Brisbane",
    },
    {
      leadId: makeId("lead"),
      customerName: "Operations Lead",
      companyName: "Autopilot Fitout Group",
      need: "Small fitout refresh with chairs, boardroom, and storage",
      budget: 18500,
      urgency: "medium",
      location: "Gold Coast",
    },
  ];

  const leads = toArray(input.leads).length ? input.leads : defaultLeads;

  await upsertNexoraWorker({
    worker: "nexora_pipeline_foreman",
    area: "operations",
    status: "busy",
    capabilities: [
      "lead_pipeline_batching",
      "quote_pathing",
      "procurement_pathing",
      "crm_followup_pathing",
    ],
    metadata: {
      leadCount: leads.length,
      startedAt: now(),
    },
  });

  const bulk = await runNexoraBulkBusinessPipeline({ leads });

  await createNexoraDelegation({
    parentWorker: "nexora_pipeline_foreman",
    childWorker: "office_receptionist",
    mission: "Qualify every generated pipeline lead and preserve next-action discipline.",
    authorityScope: "Safe customer follow-up planning only. No binding quote release.",
    risk: "medium",
    payload: {
      leadCount: leads.length,
      bulk,
    },
  });

  await createNexoraDelegation({
    parentWorker: "nexora_pipeline_foreman",
    childWorker: "supplier_negotiator",
    mission: "Collect supplier intelligence for generated pipeline opportunities.",
    authorityScope: "Information gathering only. No purchase order. No supplier commitment.",
    risk: "high",
    payload: {
      leadCount: leads.length,
      bulk,
    },
  });

  await upsertNexoraWorker({
    worker: "nexora_pipeline_foreman",
    area: "operations",
    status: "idle",
    capabilities: [
      "lead_pipeline_batching",
      "quote_pathing",
      "procurement_pathing",
      "crm_followup_pathing",
    ],
    metadata: {
      leadCount: leads.length,
      completedAt: now(),
    },
  });

  await writeNexoraOperatingReport(
    "pipeline_foreman",
    "info",
    "Nexora pipeline foreman cycle completed",
    `Pipeline foreman created ${bulk.count} business pipelines.`,
    {
      bulk,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    leadCount: leads.length,
    bulk,
    safety: {
      noBindingQuoteRelease: true,
      noPurchaseOrders: true,
      supplierCommitmentsApprovalGated: true,
    },
  };
}

export async function runNexoraAutopilotCycle(input: any = {}) {
  await ensureNexoraDurableKernel();

  const mode = String(input.mode || "growth") as AutopilotMode;
  const runId = makeId("autopilot");

  await registerNexoraAutopilotWorkers();

  await upsertNexoraWorker({
    worker: "nexora_operational_autopilot",
    area: "operations",
    status: "busy",
    capabilities: [
      "autonomous_cycle_selection",
      "incident_detection",
      "safe_task_dispatch",
      "business_pipeline_triggering",
      "governor_coordination",
    ],
    metadata: {
      runId,
      mode,
      startedAt: now(),
    },
  });

  const outputs: any = {
    runId,
    mode,
    startedAt: now(),
    registration: null,
    kpiBefore: null,
    incidents: null,
    governor: null,
    pipeline: null,
    scenario: null,
    sla: null,
    evolution: null,
    execution: null,
    kpiAfter: null,
  };

  outputs.kpiBefore = await createNexoraKpiLedgerSnapshot({ mode: `${mode}_before` });
  outputs.incidents = await detectNexoraOperationalIncidents({
    forceIncident: input.forceIncident === true,
  });

  if (mode === "growth") {
    outputs.pipeline = await runNexoraPipelineForemanCycle(input.pipeline || {});
    outputs.scenario = await createNexoraAutopilotScenario({
      scenarioType: "growth",
      budget: input.budget || 32000,
    });
  }

  if (mode === "recovery") {
    outputs.sla = await runNexoraSlaWatchdog({});
    outputs.evolution = await runNexoraWorkerEvolutionCycle();
  }

  if (mode === "learning") {
    outputs.evolution = await runNexoraWorkerEvolutionCycle();
    outputs.scenario = await createNexoraAutopilotScenario({
      scenarioType: "learning",
      budget: input.budget || 18000,
    });
  }

  if (mode === "strategy") {
    outputs.scenario = await createNexoraAutopilotScenario({
      scenarioType: "strategy",
      budget: input.budget || 50000,
    });
    outputs.governor = await runNexoraGovernorCycle({
      quoteTotal: input.budget || 50000,
      safeRunLimit: input.safeRunLimit || 25,
    });
  }

  if (mode === "safe") {
    outputs.governor = await runNexoraGovernorCycle({
      skipEmpire: true,
      quoteTotal: input.budget || 12000,
      safeRunLimit: input.safeRunLimit || 20,
    });
  }

  if (!outputs.governor && mode !== "recovery") {
    outputs.governor = await runNexoraGovernorCycle({
      quoteTotal: input.budget || 18000,
      safeRunLimit: input.safeRunLimit || 30,
    });
  }

  outputs.execution = await claimAndRunNexoraSafeTasks(Number(input.safeRunLimit || 40));
  outputs.kpiAfter = await createNexoraKpiLedgerSnapshot({ mode: `${mode}_after` });

  await createNexoraMemoryGraphEdge({
    sourceType: "autopilot_run",
    sourceId: runId,
    relation: "reports_to",
    targetType: "worker",
    targetId: "nexora_command_centre",
    weight: 2,
    payload: {
      mode,
      executed: outputs.execution?.executed,
      held: outputs.execution?.held,
      incidents: outputs.incidents?.incidentCount,
    },
  });

  await upsertNexoraWorker({
    worker: "nexora_operational_autopilot",
    area: "operations",
    status: "idle",
    capabilities: [
      "autonomous_cycle_selection",
      "incident_detection",
      "safe_task_dispatch",
      "business_pipeline_triggering",
      "governor_coordination",
    ],
    metadata: {
      runId,
      mode,
      completedAt: now(),
      executed: outputs.execution?.executed,
      held: outputs.execution?.held,
    },
  });

  await writeNexoraOperatingReport(
    "autopilot_cycle",
    outputs.incidents?.incidentCount > 0 ? "warning" : "info",
    "Nexora operational autopilot cycle completed",
    `Autopilot ${runId} completed in ${mode} mode. Executed ${outputs.execution?.executed || 0}, held ${outputs.execution?.held || 0}.`,
    outputs
  );

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_operational_autopilot",
    mode,
    runId,
    outputs,
    safety: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
      supplierCommitmentsBlocked: true,
      customerBindingCommitmentsBlocked: true,
      workerRetirementApprovalGated: true,
    },
  };
}

export async function getNexoraAutopilotCommandView() {
  await ensureNexoraDurableKernel();

  const snapshot = await getNexoraDurableCommandSnapshot();
  const kpi = await createNexoraKpiLedgerSnapshot({ mode: "command_view" });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_autopilot_command_view",
    generatedAt: now(),
    kpi,
    snapshot,
    recommendedAutopilotModes: [
      {
        mode: "growth",
        useWhen: "Need to push office furniture, fitout, CRM, quote, and procurement pipelines.",
      },
      {
        mode: "recovery",
        useWhen: "Need to diagnose failed/dead work, approval queues, or degraded workers.",
      },
      {
        mode: "learning",
        useWhen: "Need to improve workers and capture successful patterns.",
      },
      {
        mode: "strategy",
        useWhen: "Need cross-division scenario planning and controlled expansion.",
      },
      {
        mode: "safe",
        useWhen: "Need only low-risk queue processing and governor checks.",
      },
    ],
  };
}

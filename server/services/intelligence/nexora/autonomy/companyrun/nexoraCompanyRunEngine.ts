import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("company-run", "journal", "company-run-journal.jsonl");
const WORK_ORDER_LOG = nexoraLocalPath("company-run", "work-orders", "work-order-log.jsonl");
const CYCLE_LOG = nexoraLocalPath("company-run", "cycles", "company-cycle-log.jsonl");
const OBJECTIVE_LOG = nexoraLocalPath("company-run", "objectives", "objective-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function getNexoraCompanyDivisionMap() {
  const divisions = [
    {
      key: "office_sales",
      title: "Office Furniture Sales",
      mandate: "Capture enquiries, qualify leads, draft quote paths, and move customers through next actions.",
      ownerAgent: "office_receptionist_agent",
      workers: [
        "office_receptionist_agent",
        "quote_builder_agent",
        "crm_followup_agent",
      ],
      safety: [
        "No binding customer quote without approval.",
        "No payment collection.",
      ],
    },
    {
      key: "fitouts",
      title: "Fitout Scope and Delivery",
      mandate: "Capture site constraints, access issues, install windows, and project scope.",
      ownerAgent: "fitout_scope_agent",
      workers: [
        "fitout_scope_agent",
        "project_handover_agent",
      ],
      safety: [
        "No install commitment without approved quote and confirmed supplier path.",
      ],
    },
    {
      key: "procurement",
      title: "Supplier and Procurement Intelligence",
      mandate: "Request supplier pricing, stock, lead times, warranty, delivery cost, and alternatives.",
      ownerAgent: "supplier_scout_agent",
      workers: [
        "supplier_scout_agent",
        "supplier_risk_agent",
      ],
      safety: [
        "No supplier purchase order without approval.",
        "No binding supplier commitment.",
      ],
    },
    {
      key: "crm",
      title: "CRM and Follow-up",
      mandate: "Track leads, next actions, stale opportunities, follow-ups, and customer communication drafts.",
      ownerAgent: "crm_followup_agent",
      workers: [
        "crm_followup_agent",
        "stale_lead_rescue_agent",
      ],
      safety: [
        "Draft messages only unless approved for sending by operator workflow.",
      ],
    },
    {
      key: "finance",
      title: "Finance and Margin Control",
      mandate: "Track quote value, margin, GST estimates, approval thresholds, and revenue forecasts.",
      ownerAgent: "margin_guardian_agent",
      workers: [
        "margin_guardian_agent",
        "quote_finance_agent",
        "revenue_forecast_agent",
      ],
      safety: [
        "High-value or low-margin quotes require approval.",
      ],
    },
    {
      key: "reporting",
      title: "Executive Reporting",
      mandate: "Create daily operating packs, KPI rollups, exception reports, and executive summaries.",
      ownerAgent: "nexora_command_centre",
      workers: [
        "nexora_command_centre",
        "executive_report_agent",
      ],
      safety: [
        "Reports are informational and do not authorize commitments.",
      ],
    },
    {
      key: "learning",
      title: "Learning and Improvement",
      mandate: "Capture patterns, failures, successful workflows, and improve future playbooks.",
      ownerAgent: "learning_worker",
      workers: [
        "learning_worker",
        "pattern_librarian_agent",
      ],
      safety: [
        "Worker retirement and spawning remain approval-gated.",
      ],
    },
    {
      key: "safety",
      title: "Execution Gate and Safety",
      mandate: "Hold high-risk work, approvals, policy checks, trading limits, supplier commitments, and quote releases.",
      ownerAgent: "nexora_execution_gate",
      workers: [
        "nexora_execution_gate",
        "policy_guard_agent",
        "risk_simulator_agent",
      ],
      safety: [
        "Nexora remains the only brain.",
        "High-risk work must not bypass approval.",
      ],
    },
    {
      key: "trading_intelligence",
      title: "Trading Intelligence",
      mandate: "Paper/sandbox trading intelligence, signal research, and risk observation only.",
      ownerAgent: "phantom_x_paper_agent",
      workers: [
        "phantom_x_paper_agent",
        "polymarket_paper_agent",
      ],
      safety: [
        "No live trading.",
        "No private keys.",
        "No real orders.",
      ],
    },
    {
      key: "operations",
      title: "Operations and Resilience",
      mandate: "Maintain local/offline operation, storage guard, fallback journal, route wiring, recovery packs, and scheduler.",
      ownerAgent: "nexora_operations_agent",
      workers: [
        "nexora_operations_agent",
        "storage_guard_agent",
        "maintenance_planner_agent",
      ],
      safety: [
        "No deploy while Postgres is full.",
        "Dry-run first for recovery and migration.",
      ],
    },
  ];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_company_division_map",
    generatedAt: now(),
    divisionCount: divisions.length,
    divisions,
  };
}

export function seedNexoraCompanyAgents() {
  const divisionMap = getNexoraCompanyDivisionMap();

  const agentRows = divisionMap.divisions.flatMap((division: any) =>
    division.workers.map((worker: string) => ({
      agentId: safeSlug(worker),
      worker,
      division: division.key,
      title: worker.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
      status: "active",
      nexoraBrain: true,
      canCommitExternally: false,
      createdAt: now(),
      safety: division.safety,
    })),
  );

  for (const agent of agentRows) {
    writeNexoraJson(
      nexoraLocalPath("company-run", "agents", `${agent.agentId}.json`),
      agent,
    );
  }

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_company_agent_seed",
    generatedAt: now(),
    agentCount: agentRows.length,
    agents: agentRows,
  };

  journal("company_agents.seeded", result);

  recordNexoraTimelineEvent({
    type: "company_run",
    title: "Nexora company agents seeded",
    severity: "info",
    payload: {
      agentCount: result.agentCount,
    },
  });

  return result;
}

export function createNexoraCompanyObjective(input: any = {}) {
  const objectiveId = String(input.objectiveId || nexoraLocalId("objective"));
  const division = String(input.division || "operations");
  const title = String(input.title || "Run the company safely with Nexora.");
  const priority = Number(input.priority || 70);

  const objective = {
    ok: true,
    nexoraBrain: true,
    objectiveId,
    division,
    title,
    description: String(input.description || "Nexora company objective"),
    metric: String(input.metric || "safe_progress"),
    target: String(input.target || "increase safely"),
    priority,
    status: "active",
    createdAt: now(),
    payload: input.payload || {},
  };

  writeNexoraJson(
    nexoraLocalPath("company-run", "objectives", `${objectiveId}.json`),
    objective,
  );

  appendNexoraJsonl(OBJECTIVE_LOG, {
    event: "objective.created",
    objective,
    createdAt: now(),
  });

  journal("company_objective.created", objective);

  return {
    ok: true,
    nexoraBrain: true,
    objective,
  };
}

export function listNexoraCompanyObjectives(input: any = {}) {
  const division = input.division ? String(input.division) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(OBJECTIVE_LOG)
    .filter((row: any) => row.event === "objective.created")
    .map((row: any) => row.objective)
    .filter((objective: any) => !division || objective.division === division)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraCompanyWorkOrder(input: any = {}) {
  const workOrderId = String(input.workOrderId || nexoraLocalId("work_order"));
  const division = String(input.division || "operations");
  const action = String(input.action || "general_company_task");
  const risk = String(input.risk || "safe");

  const policy = evaluateNexoraPolicy({
    division,
    action,
    risk,
    payload: input.payload || {},
  });

  const approvalRequired =
    Boolean(input.approvalRequired) ||
    Boolean(policy.approvalRequired) ||
    risk === "high" ||
    risk === "critical";

  const workOrder = {
    ok: true,
    nexoraBrain: true,
    workOrderId,
    division,
    assignedAgent: String(input.assignedAgent || "nexora_operations_agent"),
    action,
    title: String(input.title || action),
    status: approvalRequired ? "approval_required" : "queued",
    risk,
    approvalRequired,
    policy,
    priority: Number(input.priority || 50),
    payload: input.payload || {},
    createdAt: now(),
    updatedAt: now(),
    safety: {
      noExternalCommitment: true,
      highRiskApprovalGated: true,
      nexoraOnlyBrain: true,
    },
  };

  writeNexoraJson(
    nexoraLocalPath("company-run", "work-orders", `${workOrderId}.json`),
    workOrder,
  );

  appendNexoraJsonl(WORK_ORDER_LOG, {
    event: "work_order.created",
    workOrder,
    createdAt: now(),
  });

  journal("company_work_order.created", workOrder);

  recordNexoraMetric({
    name: "company_work_order_created",
    value: 1,
    unit: "work_order",
    dimensions: {
      division,
      risk,
      approvalRequired,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    workOrder,
  };
}

export function listNexoraCompanyWorkOrders(input: any = {}) {
  const division = input.division ? String(input.division) : "";
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(WORK_ORDER_LOG)
    .filter((row: any) => row.event === "work_order.created")
    .map((row: any) => row.workOrder)
    .filter((workOrder: any) => !division || workOrder.division === division)
    .filter((workOrder: any) => !status || workOrder.status === status)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraDivisionOperatingPlan(input: any = {}) {
  const division = String(input.division || "office_sales");
  const planId = String(input.planId || nexoraLocalId("division_plan"));
  const divisionMap = getNexoraCompanyDivisionMap();
  const found = divisionMap.divisions.find((row: any) => row.key === division);

  const plan = {
    ok: true,
    nexoraBrain: true,
    planId,
    division,
    title: found?.title || division,
    createdAt: now(),
    ownerAgent: found?.ownerAgent || "nexora_operations_agent",
    mandate: found?.mandate || "Operate safely under Nexora.",
    workers: found?.workers || [],
    dailyChecklist: [
      "Review new work orders.",
      "Process safe queued tasks.",
      "Hold high-risk work for approval.",
      "Record progress and metrics.",
      "Capture learning and blockers.",
    ],
    safety: found?.safety || [
      "High-risk work remains approval-gated.",
    ],
    payload: input.payload || {},
  };

  writeNexoraJson(
    nexoraLocalPath("company-run", "divisions", `${division}-${planId}.json`),
    plan,
  );

  journal("division_plan.created", plan);

  return {
    ok: true,
    nexoraBrain: true,
    plan,
  };
}

export function runNexoraCompanyDailyCycle(input: any = {}) {
  const cycleId = String(input.cycleId || nexoraLocalId("company_cycle"));
  const seed = seedNexoraCompanyAgents();
  const divisionMap = getNexoraCompanyDivisionMap();

  const objectives = [
    createNexoraCompanyObjective({
      division: "office_sales",
      title: "Move qualified leads toward safe quote drafts.",
      metric: "qualified_quote_paths",
      target: "increase",
      priority: 90,
    }),
    createNexoraCompanyObjective({
      division: "procurement",
      title: "Improve supplier confidence without purchase commitments.",
      metric: "supplier_confirmations",
      target: "increase",
      priority: 85,
    }),
    createNexoraCompanyObjective({
      division: "crm",
      title: "Every open lead has a next action.",
      metric: "open_leads_with_next_action",
      target: "100%",
      priority: 85,
    }),
    createNexoraCompanyObjective({
      division: "safety",
      title: "High-risk commitments remain approval-gated.",
      metric: "unsafe_commitments",
      target: "0",
      priority: 100,
    }),
    createNexoraCompanyObjective({
      division: "operations",
      title: "Run DB-independent while Postgres is full.",
      metric: "fallback_safe_operations",
      target: "healthy",
      priority: 95,
    }),
  ];

  const workOrders = [
    createNexoraCompanyWorkOrder({
      division: "office_sales",
      assignedAgent: "office_receptionist_agent",
      action: "review_open_leads_and_qualify",
      title: "Review open leads and qualify quote readiness",
      risk: "safe",
      priority: 90,
    }),
    createNexoraCompanyWorkOrder({
      division: "finance",
      assignedAgent: "margin_guardian_agent",
      action: "review_quote_margin_thresholds",
      title: "Review quote margins and approval thresholds",
      risk: "medium",
      priority: 80,
    }),
    createNexoraCompanyWorkOrder({
      division: "procurement",
      assignedAgent: "supplier_scout_agent",
      action: "prepare_non_binding_supplier_requests",
      title: "Prepare non-binding supplier requests",
      risk: "medium",
      priority: 82,
      payload: {
        purchaseOrder: false,
        bindingCommitment: false,
      },
    }),
    createNexoraCompanyWorkOrder({
      division: "trading_intelligence",
      assignedAgent: "phantom_x_paper_agent",
      action: "paper_trading_intelligence_review",
      title: "Review paper/sandbox trading intelligence only",
      risk: "medium",
      priority: 60,
      payload: {
        liveTrading: false,
        tradingMode: "paper/sandbox",
      },
    }),
    createNexoraCompanyWorkOrder({
      division: "safety",
      assignedAgent: "nexora_execution_gate",
      action: "review_high_risk_commitment_queue",
      title: "Review high-risk commitment queue",
      risk: "high",
      priority: 100,
      approvalRequired: true,
    }),
  ];

  const divisionPlans = divisionMap.divisions.map((division: any) =>
    createNexoraDivisionOperatingPlan({
      division: division.key,
      payload: {
        cycleId,
      },
    }),
  );

  const cycle = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_company_daily_cycle",
    cycleId,
    createdAt: now(),
    seed,
    objectives,
    workOrders,
    divisionPlans,
    safety: {
      noDeploy: true,
      dbIndependent: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
      noSupplierPurchaseOrders: true,
      noBindingCustomerQuotes: true,
    },
  };

  writeNexoraJson(
    nexoraLocalPath("company-run", "cycles", `${cycleId}.json`),
    cycle,
  );

  appendNexoraJsonl(CYCLE_LOG, {
    event: "company_cycle.created",
    cycle,
    createdAt: now(),
  });

  journal("company_cycle.created", cycle);

  recordNexoraTimelineEvent({
    type: "company_cycle",
    title: "Nexora company daily cycle created",
    severity: "info",
    payload: {
      cycleId,
      workOrders: workOrders.length,
      objectives: objectives.length,
      divisionPlans: divisionPlans.length,
    },
  });

  return cycle;
}

export function createNexoraExecutiveCompanyRunPack(input: any = {}) {
  const packId = String(input.packId || nexoraLocalId("exec_pack"));
  const status = getNexoraCompanyRunStatus();
  const divisionMap = getNexoraCompanyDivisionMap();
  const workOrders = listNexoraCompanyWorkOrders({ limit: 100 });
  const objectives = listNexoraCompanyObjectives({ limit: 100 });

  const pack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_executive_company_run_pack",
    packId,
    createdAt: now(),
    title: "Nexora Full AI Company Operating Pack",
    status,
    divisionMap,
    workOrders,
    objectives,
    operatorSummary: {
      posture: "Local/offline AI company operating system",
      postgres: "Full or unavailable; durable operations should use local fallback until upgraded.",
      deploy: "Skipped until storage is fixed.",
      trading: "Paper/sandbox only.",
      commitments: "Supplier/customer commitments approval-gated.",
    },
    nextBestActions: [
      "Use office agents for lead intake, quote draft, supplier request, follow-up, and project scope.",
      "Run daily company cycle.",
      "Review approval-required work orders.",
      "Keep Postgres-independent local records until database storage is upgraded.",
      "After Postgres upgrade, run migration dry-runs before replay.",
    ],
  };

  writeNexoraJson(
    nexoraLocalPath("company-run", "executive-packs", `${packId}.json`),
    pack,
  );

  journal("executive_company_pack.created", pack);

  return {
    ok: true,
    nexoraBrain: true,
    pack,
  };
}

export function getNexoraCompanyRunStatus() {
  const divisions = getNexoraCompanyDivisionMap();
  const workOrders = listNexoraCompanyWorkOrders({ limit: 1000 });
  const pendingApprovals = listNexoraCompanyWorkOrders({
    status: "approval_required",
    limit: 1000,
  });
  const objectives = listNexoraCompanyObjectives({ limit: 1000 });
  const cycles = readNexoraJsonl(CYCLE_LOG)
    .filter((row: any) => row.event === "company_cycle.created")
    .map((row: any) => row.cycle);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_company_run_status",
    generatedAt: now(),
    divisions: divisions.divisionCount,
    workOrders: workOrders.count,
    approvalRequiredWorkOrders: pendingApprovals.count,
    objectives: objectives.count,
    cycles: cycles.length,
    companyMode: "local_ai_company_run",
    safety: {
      nexoraOnlyBrain: true,
      noDeployWhilePostgresFull: true,
      highRiskApprovalGated: true,
      noBindingCustomerQuoteWithoutApproval: true,
      noSupplierPurchaseOrderWithoutApproval: true,
      tradingMode: "paper/sandbox",
    },
  };
}

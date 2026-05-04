import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { getNexoraMetrics, recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("company-completion", "journal", "completion-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function safeReadLog(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function tryOptional(label: string, loader: () => any) {
  try {
    return {
      ok: true,
      label,
      result: loader(),
    };
  } catch (error) {
    return {
      ok: false,
      label,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function localLog(name: string) {
  return nexoraLocalPath(name);
}

export function getNexoraCompanyCompletionStatus() {
  const ownerCockpit = tryOptional("owner_cockpit", () => getNexoraOwnerCockpitFinal({ lightweight: true }));
  const approvalBoard = tryOptional("approval_board", () => getNexoraHumanApprovalBoard({ limit: 20 }));
  const workQueue = tryOptional("work_queue", () => getNexoraCompanyWorkQueueSummary({ limit: 20 }));
  const revenue = tryOptional("revenue_margin", () => getNexoraRevenueMarginBoard({ limit: 20 }));

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_ai_company_operating_completion",
    generatedAt: now(),
    mode: "local_ai_company_operating_layer",
    sections: {
      ownerCockpit,
      approvalBoard,
      workQueue,
      revenue,
    },
    doctrine: {
      humanOnly: ["approve", "sign", "commit"],
      nexoraDoesEverythingElse: true,
      noExceptions: true,
    },
    safety: {
      noDeployWhilePostgresFull: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noSupplierPurchaseOrderWithoutHumanCommit: true,
      noBindingQuoteWithoutHumanCommit: true,
    },
  };
}

export function getNexoraHumanApprovalBoard(input: any = {}) {
  const limit = Number(input.limit || 100);

  const possibleLogs = [
    nexoraLocalPath("human-boundary", "approvals", "approval-log.jsonl"),
    nexoraLocalPath("human-company", "approvals", "approval-log.jsonl"),
    nexoraLocalPath("company-run", "work-orders", "work-order-log.jsonl"),
    nexoraLocalPath("human-ops", "owner-queue", "owner-queue-log.jsonl"),
    nexoraLocalPath("nerve-center", "owner", "owner-log.jsonl"),
  ];

  const rows = possibleLogs.flatMap((file) =>
    safeReadLog(file).map((row: any) => ({
      sourceFile: file,
      row,
    })),
  );

  const approvalRows = rows
    .filter((item: any) => {
      const text = JSON.stringify(item.row).toLowerCase();
      return text.includes("approval") || text.includes("approve") || text.includes("human_commit") || text.includes("human_sign") || text.includes("owner_decision");
    })
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_approval_board",
    generatedAt: now(),
    count: approvalRows.length,
    rows: approvalRows,
    humanOnly: ["approve", "sign", "commit"],
  };
}

export function getNexoraDepartmentDashboards() {
  const departments = [
    {
      key: "sales",
      title: "Sales",
      primaryRoute: "/api/nexora/office-agents/status",
      ownerAgent: "office_receptionist_agent",
      humanBoundary: "approve/send only when customer-facing",
    },
    {
      key: "quotes",
      title: "Quotes",
      primaryRoute: "/api/nexora/office-agents/quote/draft",
      ownerAgent: "quote_builder_agent",
      humanBoundary: "commit binding quote only",
    },
    {
      key: "procurement",
      title: "Procurement",
      primaryRoute: "/api/nexora/office-agents/supplier/request",
      ownerAgent: "supplier_scout_agent",
      humanBoundary: "commit purchase order only",
    },
    {
      key: "crm",
      title: "CRM",
      primaryRoute: "/api/nexora/office-agents/followup/draft",
      ownerAgent: "crm_followup_agent",
      humanBoundary: "approve/send final customer contact",
    },
    {
      key: "fitouts",
      title: "Fitouts",
      primaryRoute: "/api/nexora/office-agents/project/scope",
      ownerAgent: "fitout_scope_agent",
      humanBoundary: "commit install/delivery promises only",
    },
    {
      key: "projects",
      title: "Projects",
      primaryRoute: "/api/nexora/office-agents/project/handover",
      ownerAgent: "project_handover_agent",
      humanBoundary: "commit handover and delivery only",
    },
    {
      key: "finance",
      title: "Finance",
      primaryRoute: "/api/nexora/finance/quote/analyse",
      ownerAgent: "margin_guardian_agent",
      humanBoundary: "approve payment/refund/discount only",
    },
    {
      key: "learning",
      title: "Learning",
      primaryRoute: "/api/nexora/teaching/status",
      ownerAgent: "learning_worker",
      humanBoundary: "teach examples when Nexora does not know",
    },
    {
      key: "safety",
      title: "Safety",
      primaryRoute: "/api/nexora/human-boundary/status",
      ownerAgent: "nexora_execution_gate",
      humanBoundary: "approve/sign/commit only",
    },
    {
      key: "trading_research",
      title: "Trading Intelligence",
      primaryRoute: "/api/nexora/polymarket-paper/status",
      ownerAgent: "phantom_x_paper_agent",
      humanBoundary: "commit live trading promotion only; currently blocked",
    },
  ];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_department_dashboards",
    generatedAt: now(),
    count: departments.length,
    departments,
  };
}

export function getNexoraResponsibilityMapFinal() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_ai_human_responsibility_map_final",
    generatedAt: now(),
    humanOnly: [
      {
        action: "approve",
        meaning: "Human approves Nexora-prepared work to proceed.",
      },
      {
        action: "sign",
        meaning: "Human signs legal/financial/binding documents.",
      },
      {
        action: "commit",
        meaning: "Human makes binding external commitments.",
      },
    ],
    nexoraDoes: [
      "lead intake",
      "lead qualification",
      "quote drafting",
      "margin calculation",
      "supplier request drafting",
      "CRM follow-up drafting",
      "project scope capture",
      "handover planning",
      "daily agenda",
      "work queue",
      "reports",
      "risk board",
      "learning",
      "paper trading research",
      "fallback storage",
      "migration dry-runs",
      "owner briefing",
    ],
    noExceptions: true,
  };
}

export function runNexoraCompanyDailyRunFinal(input: any = {}) {
  const runId = String(input.runId || nexoraLocalId("daily_run_final"));

  const workItems = [
    {
      department: "sales",
      title: "Review new leads and qualify quote readiness",
      route: "/api/nexora/office-agents/lead/intake",
      aiAction: "prepare",
      humanAction: "none unless customer send needed",
      risk: "safe",
    },
    {
      department: "quotes",
      title: "Prepare quote drafts and margin checks",
      route: "/api/nexora/office-agents/quote/draft",
      aiAction: "draft",
      humanAction: "commit if binding quote",
      risk: "medium",
    },
    {
      department: "procurement",
      title: "Prepare non-binding supplier requests",
      route: "/api/nexora/office-agents/supplier/request",
      aiAction: "draft",
      humanAction: "commit if purchase order",
      risk: "medium",
    },
    {
      department: "crm",
      title: "Prepare follow-up drafts",
      route: "/api/nexora/office-agents/followup/draft",
      aiAction: "draft",
      humanAction: "approve if sending externally",
      risk: "safe",
    },
    {
      department: "fitouts",
      title: "Capture install/site constraints",
      route: "/api/nexora/office-agents/project/scope",
      aiAction: "prepare",
      humanAction: "commit if delivery/install promise",
      risk: "medium",
    },
    {
      department: "learning",
      title: "Check teaching queue and knowledge gaps",
      route: "/api/nexora/teaching/status",
      aiAction: "learn",
      humanAction: "teach example if unknown",
      risk: "safe",
    },
    {
      department: "safety",
      title: "Review approval/sign/commit queue",
      route: "/api/nexora/human-boundary/status",
      aiAction: "classify",
      humanAction: "approve/sign/commit",
      risk: "high",
    },
  ];

  const run = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_company_daily_run_final",
    runId,
    createdAt: now(),
    workItems,
    ownerCockpit: getNexoraOwnerCockpitFinal({ lightweight: true }),
    approvalBoard: getNexoraHumanApprovalBoard({ limit: 50 }),
    responsibilityMap: getNexoraResponsibilityMapFinal(),
    safety: {
      noDeploy: true,
      noAutonomousCommitment: true,
      humanOnlyApproveSignCommit: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("company-completion", "run", `${runId}.json`), run);
  appendNexoraJsonl(nexoraLocalPath("company-completion", "run", "daily-run-log.jsonl"), {
    event: "daily_run.created",
    run,
    createdAt: now(),
  });

  journal("daily_run.created", run);

  recordNexoraTimelineEvent({
    type: "company_daily_run_final",
    title: "Nexora company daily run final created",
    severity: "info",
    payload: {
      runId,
      workItems: workItems.length,
    },
  });

  recordNexoraMetric({
    name: "company_daily_run_final",
    value: 1,
    unit: "run",
    dimensions: {
      workItems: workItems.length,
    },
  });

  return run;
}

export function getNexoraCompanyWorkQueueSummary(input: any = {}) {
  const limit = Number(input.limit || 100);

  const logFiles = [
    nexoraLocalPath("company-run", "work-orders", "work-order-log.jsonl"),
    nexoraLocalPath("human-ops", "owner-queue", "owner-queue-log.jsonl"),
    nexoraLocalPath("nerve-center", "actions", "action-log.jsonl"),
    nexoraLocalPath("nerve-center", "owner", "owner-log.jsonl"),
    nexoraLocalPath("human-company", "inbox", "inbox-log.jsonl"),
  ];

  const rows = logFiles.flatMap((file) =>
    safeReadLog(file).map((row: any) => ({ sourceFile: file, row })),
  ).slice(-limit).reverse();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_company_work_queue_summary",
    generatedAt: now(),
    count: rows.length,
    rows,
  };
}

export function getNexoraRevenueMarginBoard(input: any = {}) {
  const limit = Number(input.limit || 100);

  const quoteLogs = [
    nexoraLocalPath("quotes", "quote-log.jsonl"),
    nexoraLocalPath("office-agents", "quotes", "quote-log.jsonl"),
  ];

  const quoteRows = quoteLogs.flatMap((file) => safeReadLog(file)).slice(-limit).reverse();
  const metrics = getNexoraMetrics({ limit });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_revenue_margin_board",
    generatedAt: now(),
    quoteRows,
    metrics,
    note: "Local/offline margin board. Full durable revenue reporting should replay to Postgres later.",
  };
}

export function getNexoraCustomerSupplierBoard(input: any = {}) {
  const limit = Number(input.limit || 100);

  const customerLogs = [
    nexoraLocalPath("crm", "crm-log.jsonl"),
    nexoraLocalPath("human-company", "contacts", "contact-log.jsonl"),
    nexoraLocalPath("human-ops", "journeys", "journey-log.jsonl"),
  ];

  const supplierLogs = [
    nexoraLocalPath("suppliers", "supplier-log.jsonl"),
    nexoraLocalPath("human-ops", "supplier-desk", "supplier-desk-log.jsonl"),
  ];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_customer_supplier_board",
    generatedAt: now(),
    customers: customerLogs.flatMap((file) => safeReadLog(file)).slice(-limit).reverse(),
    suppliers: supplierLogs.flatMap((file) => safeReadLog(file)).slice(-limit).reverse(),
    safety: {
      customerContactHumanControlled: true,
      supplierCommitHumanControlled: true,
    },
  };
}

export function getNexoraProjectDeliveryBoard(input: any = {}) {
  const limit = Number(input.limit || 100);

  const logs = [
    nexoraLocalPath("projects", "project-log.jsonl"),
    nexoraLocalPath("human-ops", "install", "install-log.jsonl"),
    nexoraLocalPath("office-agents", "projects", "project-log.jsonl"),
  ];

  const rows = logs.flatMap((file) => safeReadLog(file)).slice(-limit).reverse();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_project_delivery_board",
    generatedAt: now(),
    count: rows.length,
    rows,
    safety: {
      noInstallPromiseWithoutHumanCommit: true,
      noDeliveryPromiseWithoutHumanCommit: true,
    },
  };
}

export function getNexoraLearningCaptureBoard(input: any = {}) {
  const limit = Number(input.limit || 100);

  const logs = [
    nexoraLocalPath("teaching", "gaps", "gap-log.jsonl"),
    nexoraLocalPath("teaching", "lessons", "lesson-log.jsonl"),
    nexoraLocalPath("teaching", "examples", "example-log.jsonl"),
    nexoraLocalPath("teaching", "playbooks", "playbook-log.jsonl"),
    nexoraLocalPath("rewards", "patterns", "success-pattern-log.jsonl"),
  ];

  const rows = logs.flatMap((file) => safeReadLog(file)).slice(-limit).reverse();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_learning_capture_board",
    generatedAt: now(),
    count: rows.length,
    rows,
    doctrine: "If Nexora does not know, she creates a gap, lesson, example request, playbook, and training record.",
  };
}

export function createNexoraDailyBriefingFinal(input: any = {}) {
  const briefingId = String(input.briefingId || nexoraLocalId("daily_briefing_final"));

  const briefing = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_daily_briefing_final",
    briefingId,
    createdAt: now(),
    ownerCockpit: getNexoraOwnerCockpitFinal({ lightweight: true }),
    approvalBoard: getNexoraHumanApprovalBoard({ limit: 20 }),
    workQueue: getNexoraCompanyWorkQueueSummary({ limit: 30 }),
    revenueMargin: getNexoraRevenueMarginBoard({ limit: 20 }),
    customerSupplier: getNexoraCustomerSupplierBoard({ limit: 20 }),
    projectDelivery: getNexoraProjectDeliveryBoard({ limit: 20 }),
    learning: getNexoraLearningCaptureBoard({ limit: 20 }),
    ownerScript: [
      "Review approval/sign/commit queue first.",
      "Approve or reject customer-facing quote releases.",
      "Commit only when ready: supplier POs, delivery promises, payments, legal/signing.",
      "Let Nexora handle all drafting, routing, scoring, reporting, and follow-up preparation.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("company-completion", "briefings", `${briefingId}.json`), briefing);
  journal("daily_briefing_final.created", briefing);

  return {
    ok: true,
    nexoraBrain: true,
    briefing,
  };
}

export function getNexoraOwnerCockpitFinal(input: any = {}) {
  const approvalBoard = getNexoraHumanApprovalBoard({ limit: input.lightweight ? 10 : 50 });
  const workQueue = getNexoraCompanyWorkQueueSummary({ limit: input.lightweight ? 10 : 50 });
  const departments = getNexoraDepartmentDashboards();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_owner_cockpit_final",
    generatedAt: now(),
    approvalBoard,
    workQueue,
    departments,
    responsibilityMap: getNexoraResponsibilityMapFinal(),
    nextHumanActions: [
      "approve",
      "sign",
      "commit",
    ],
    nexoraHandlesEverythingElse: true,
  };
}

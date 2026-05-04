import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("human-ops", "journal", "human-ops-journal.jsonl");
const JOURNEY_LOG = nexoraLocalPath("human-ops", "journeys", "journey-log.jsonl");
const SUPPLIER_LOG = nexoraLocalPath("human-ops", "supplier-desk", "supplier-desk-log.jsonl");
const INSTALL_LOG = nexoraLocalPath("human-ops", "install", "install-log.jsonl");
const ESCALATION_LOG = nexoraLocalPath("human-ops", "escalations", "escalation-log.jsonl");
const OWNER_QUEUE_LOG = nexoraLocalPath("human-ops", "owner-queue", "owner-queue-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function requiresOwnerDecision(input: any = {}) {
  const text = JSON.stringify(input).toLowerCase();

  return (
    input.ownerDecision === true ||
    input.approvalRequired === true ||
    input.customerFacing === true ||
    input.supplierFacing === true ||
    input.bindingCommitment === true ||
    input.purchaseOrder === true ||
    input.payment === true ||
    input.refund === true ||
    input.legal === true ||
    text.includes("purchase order") ||
    text.includes("binding quote") ||
    text.includes("contract") ||
    text.includes("payment") ||
    text.includes("refund") ||
    text.includes("legal")
  );
}

export function createNexoraCustomerJourney(input: any = {}) {
  const journeyId = String(input.journeyId || nexoraLocalId("journey"));
  const stage = String(input.stage || "new_enquiry");

  const journey = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_customer_journey",
    journeyId,
    leadId: input.leadId || null,
    customerName: input.customerName || null,
    companyName: input.companyName || null,
    stage,
    createdAt: now(),
    updatedAt: now(),
    stages: [
      {
        key: "new_enquiry",
        status: stage === "new_enquiry" ? "active" : "planned",
        humanContact: true,
        aiCanPrepare: ["intake summary", "missing questions", "follow-up draft"],
      },
      {
        key: "qualification",
        status: stage === "qualification" ? "active" : "planned",
        humanContact: true,
        aiCanPrepare: ["budget check", "timeline check", "scope checklist"],
      },
      {
        key: "quote_draft",
        status: stage === "quote_draft" ? "active" : "planned",
        humanContact: false,
        aiCanPrepare: ["draft quote", "margin check", "assumptions"],
      },
      {
        key: "approval",
        status: stage === "approval" ? "active" : "planned",
        humanContact: true,
        aiCanPrepare: ["approval summary", "risk flags"],
      },
      {
        key: "supplier_confirmation",
        status: stage === "supplier_confirmation" ? "active" : "planned",
        humanContact: true,
        aiCanPrepare: ["non-binding supplier request", "lead time tracker"],
      },
      {
        key: "project_scope",
        status: stage === "project_scope" ? "active" : "planned",
        humanContact: true,
        aiCanPrepare: ["install checklist", "site constraints"],
      },
      {
        key: "handover",
        status: stage === "handover" ? "active" : "planned",
        humanContact: true,
        aiCanPrepare: ["handover checklist", "delivery notes"],
      },
    ],
    nextHumanAction: input.nextHumanAction || "Confirm missing information and approve next step.",
    payload: input.payload || {},
    safety: {
      humanControlsCustomerContact: true,
      noBindingCommitmentWithoutApproval: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("human-ops", "journeys", `${journeyId}.json`), journey);

  appendNexoraJsonl(JOURNEY_LOG, {
    event: "journey.created",
    journey,
    createdAt: now(),
  });

  journal("journey.created", journey);

  recordNexoraTimelineEvent({
    type: "customer_journey",
    title: `Customer journey created: ${stage}`,
    severity: stage === "approval" ? "warning" : "info",
    payload: {
      journeyId,
      stage,
      companyName: journey.companyName,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    journey,
  };
}

export function listNexoraCustomerJourneys(input: any = {}) {
  const stage = input.stage ? String(input.stage) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(JOURNEY_LOG)
    .filter((row: any) => row.event === "journey.created")
    .map((row: any) => row.journey)
    .filter((journey: any) => !stage || journey.stage === stage)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraSupplierDeskRequest(input: any = {}) {
  const requestId = String(input.requestId || nexoraLocalId("supplier_request"));

  const policy = evaluateNexoraPolicy({
    ...input,
    supplierFacing: true,
    purchaseOrder: false,
    bindingCommitment: false,
  });

  const request = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_supplier_desk_request",
    requestId,
    supplierName: String(input.supplierName || input.name || "Preferred Supplier Pool"),
    category: String(input.category || "office furniture"),
    items: Array.isArray(input.items) ? input.items : [],
    createdAt: now(),
    status: "draft",
    nonBinding: true,
    noPurchaseOrder: true,
    policy,
    message: [
      "Hello,",
      "",
      "We are preparing a non-binding supplier confirmation for an office furniture / fitout opportunity.",
      "Please confirm unit cost, stock, lead time, delivery cost, warranty, and equivalent alternatives.",
      "",
      "This is an information request only and is not a purchase order or supplier commitment.",
      "",
      "Regards,",
      "The Corporate Desk",
    ].join("\n"),
    safety: {
      supplierFacingDraft: true,
      humanReviewBeforeSend: true,
      purchaseOrderBlocked: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("human-ops", "supplier-desk", `${requestId}.json`), request);

  appendNexoraJsonl(SUPPLIER_LOG, {
    event: "supplier_request.created",
    request,
    createdAt: now(),
  });

  if (requiresOwnerDecision(request)) {
    createNexoraOwnerDecisionItem({
      title: `Review supplier request: ${request.supplierName}`,
      type: "supplier_request",
      priority: 75,
      payload: request,
    });
  }

  journal("supplier_request.created", request);

  return {
    ok: true,
    nexoraBrain: true,
    request,
  };
}

export function listNexoraSupplierDeskRequests(input: any = {}) {
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(SUPPLIER_LOG)
    .filter((row: any) => row.event === "supplier_request.created")
    .map((row: any) => row.request)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraInstallCoordinationPlan(input: any = {}) {
  const installId = String(input.installId || nexoraLocalId("install"));

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_install_coordination_plan",
    installId,
    projectId: input.projectId || null,
    customerName: input.customerName || null,
    companyName: input.companyName || null,
    location: input.location || null,
    createdAt: now(),
    status: "draft",
    checklist: [
      {
        item: "Confirm site address",
        complete: Boolean(input.location),
      },
      {
        item: "Confirm site access",
        complete: Boolean(input.access),
      },
      {
        item: "Confirm lift/stairs/loading dock",
        complete: Boolean(input.accessDetails),
      },
      {
        item: "Confirm installation window",
        complete: Boolean(input.installWindow),
      },
      {
        item: "Confirm after-hours requirement",
        complete: input.afterHours !== undefined,
      },
      {
        item: "Confirm supplier lead time",
        complete: Boolean(input.supplierLeadTime),
      },
      {
        item: "Confirm customer handover contact",
        complete: Boolean(input.handoverContact),
      },
    ],
    riskFlags: [
      input.location ? null : "Missing site address",
      input.access ? null : "Missing access details",
      input.installWindow ? null : "Missing install window",
      input.supplierLeadTime ? null : "Missing supplier lead time",
    ].filter(Boolean),
    humanAction: "Confirm incomplete installation details before promising delivery/install timing.",
    safety: {
      noDeliveryPromiseWithoutHumanConfirmation: true,
      noInstallCommitmentWithoutApprovedQuote: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("human-ops", "install", `${installId}.json`), plan);

  appendNexoraJsonl(INSTALL_LOG, {
    event: "install_plan.created",
    plan,
    createdAt: now(),
  });

  if (plan.riskFlags.length) {
    createNexoraEscalation({
      type: "install_scope_gap",
      title: "Install coordination has missing details",
      severity: "medium",
      payload: plan,
    });
  }

  journal("install_plan.created", plan);

  return {
    ok: true,
    nexoraBrain: true,
    plan,
  };
}

export function listNexoraInstallPlans(input: any = {}) {
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(INSTALL_LOG)
    .filter((row: any) => row.event === "install_plan.created")
    .map((row: any) => row.plan)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraEscalation(input: any = {}) {
  const escalationId = String(input.escalationId || nexoraLocalId("escalation"));
  const severity = String(input.severity || "medium");

  const escalation = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_ops_escalation",
    escalationId,
    type: String(input.type || "general"),
    title: String(input.title || "Human escalation required"),
    severity,
    status: "open",
    createdAt: now(),
    payload: input.payload || {},
    recommendedHumanAction: input.recommendedHumanAction || "Review and decide next step.",
  };

  writeNexoraJson(nexoraLocalPath("human-ops", "escalations", `${escalationId}.json`), escalation);

  appendNexoraJsonl(ESCALATION_LOG, {
    event: "escalation.created",
    escalation,
    createdAt: now(),
  });

  createNexoraOwnerDecisionItem({
    type: "escalation",
    title: escalation.title,
    priority: severity === "critical" ? 100 : severity === "high" ? 90 : 70,
    payload: escalation,
  });

  journal("escalation.created", escalation);

  return {
    ok: true,
    nexoraBrain: true,
    escalation,
  };
}

export function listNexoraEscalations(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(ESCALATION_LOG)
    .filter((row: any) => row.event === "escalation.created")
    .map((row: any) => row.escalation)
    .filter((item: any) => !status || item.status === status)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraOwnerDecisionItem(input: any = {}) {
  const decisionId = String(input.decisionId || nexoraLocalId("owner_decision"));

  const decision = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_owner_decision_queue",
    decisionId,
    type: String(input.type || "general"),
    title: String(input.title || "Owner decision required"),
    priority: Number(input.priority || 50),
    status: "open",
    createdAt: now(),
    payload: input.payload || {},
    safety: {
      humanMustDecide: true,
      aiCannotCommit: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("human-ops", "owner-queue", `${decisionId}.json`), decision);

  appendNexoraJsonl(OWNER_QUEUE_LOG, {
    event: "owner_decision.created",
    decision,
    createdAt: now(),
  });

  journal("owner_decision.created", decision);

  return {
    ok: true,
    nexoraBrain: true,
    decision,
  };
}

export function listNexoraOwnerDecisionQueue(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(OWNER_QUEUE_LOG)
    .filter((row: any) => row.event === "owner_decision.created")
    .map((row: any) => row.decision)
    .filter((item: any) => !status || item.status === status)
    .sort((a: any, b: any) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, limit);

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraHumanOpsBriefing(input: any = {}) {
  const briefingId = String(input.briefingId || nexoraLocalId("human_ops_briefing"));

  const ownerQueue = listNexoraOwnerDecisionQueue({ status: "open", limit: 50 });
  const escalations = listNexoraEscalations({ status: "open", limit: 50 });
  const journeys = listNexoraCustomerJourneys({ limit: 50 });
  const suppliers = listNexoraSupplierDeskRequests({ limit: 50 });
  const installs = listNexoraInstallPlans({ limit: 50 });

  const briefing = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_ops_briefing",
    briefingId,
    createdAt: now(),
    summary: {
      ownerDecisions: ownerQueue.count,
      escalations: escalations.count,
      journeys: journeys.count,
      supplierRequests: suppliers.count,
      installPlans: installs.count,
    },
    topOwnerActions: ownerQueue.rows.slice(0, 10),
    script: [
      "Review owner decision queue.",
      "Approve/reject only after checking commitment risk.",
      "Confirm customer-facing messages before sending.",
      "Confirm supplier requests are non-binding.",
      "Do not promise install timing until scope and supplier lead time are confirmed.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("human-ops", "journal", `${briefingId}.briefing.json`), briefing);
  journal("human_ops_briefing.created", briefing);

  recordNexoraMetric({
    name: "human_ops_owner_decision_queue",
    value: ownerQueue.count,
    unit: "items",
    dimensions: {},
  });

  return {
    ok: true,
    nexoraBrain: true,
    briefing,
  };
}

export function getNexoraHumanOpsStatus() {
  const journeys = listNexoraCustomerJourneys({ limit: 1000 });
  const suppliers = listNexoraSupplierDeskRequests({ limit: 1000 });
  const installs = listNexoraInstallPlans({ limit: 1000 });
  const escalations = listNexoraEscalations({ limit: 1000 });
  const ownerQueue = listNexoraOwnerDecisionQueue({ limit: 1000 });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_loop_business_ops",
    generatedAt: now(),
    counts: {
      journeys: journeys.count,
      supplierRequests: suppliers.count,
      installPlans: installs.count,
      escalations: escalations.count,
      ownerDecisionQueue: ownerQueue.count,
    },
    mode: "ai_prepares_humans_contact_and_commit",
    safety: {
      noAutonomousCustomerContact: true,
      noAutonomousSupplierCommitment: true,
      noAutonomousInstallPromise: true,
      noAutonomousPayment: true,
    },
  };
}

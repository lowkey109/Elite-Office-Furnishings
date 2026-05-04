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

const JOURNAL = nexoraLocalPath("human-boundary", "journal", "human-boundary-journal.jsonl");
const DOCTRINE_FILE = nexoraLocalPath("human-boundary", "doctrine", "nexora-human-boundary-doctrine.json");
const APPROVAL_LOG = nexoraLocalPath("human-boundary", "approvals", "approval-log.jsonl");
const SIGNATURE_LOG = nexoraLocalPath("human-boundary", "signatures", "signature-log.jsonl");
const COMMITMENT_LOG = nexoraLocalPath("human-boundary", "commitments", "commitment-log.jsonl");
const AUTOMATION_MAP_FILE = nexoraLocalPath("human-boundary", "automation-map", "nexora-automation-map.json");

type HumanOnlyAction = "approve" | "sign" | "commit";
type NexoraActionClass = "nexora_auto" | "human_approve" | "human_sign" | "human_commit" | "blocked";

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function classifyText(input: any = {}) {
  return JSON.stringify(input).toLowerCase();
}

export function createNexoraHumanBoundaryDoctrine(input: any = {}) {
  const doctrine = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_boundary_doctrine",
    doctrineId: String(input.doctrineId || "nexora_human_boundary_v1"),
    createdAt: now(),
    statement: "Humans only approve, sign, and commit. Nexora and her worker team do everything else.",
    humanOnlyActions: [
      {
        action: "approve",
        meaning: "Human confirms Nexora may proceed with a prepared action.",
        examples: [
          "approve quote release",
          "approve supplier request send",
          "approve discount",
          "approve migration replay",
          "approve high-risk project promise",
        ],
      },
      {
        action: "sign",
        meaning: "Human signs legal, contractual, financial, or binding documents.",
        examples: [
          "sign supplier agreement",
          "sign customer contract",
          "sign finance document",
          "sign legal document",
        ],
      },
      {
        action: "commit",
        meaning: "Human makes the final external commitment for money, delivery, supplier purchase, legal, or live trading.",
        examples: [
          "commit to customer price",
          "commit to delivery/install date",
          "commit to supplier purchase order",
          "commit funds",
          "commit to live trading promotion",
        ],
      },
    ],
    nexoraOwnsEverythingElse: [
      "lead intake",
      "qualification",
      "drafting",
      "summarising",
      "routing",
      "scoring",
      "quote drafting",
      "supplier request drafting",
      "CRM next actions",
      "follow-up drafting",
      "project scoping",
      "handover planning",
      "reporting",
      "briefings",
      "risk detection",
      "policy evaluation",
      "paper trading research",
      "maintenance planning",
      "migration dry-runs",
      "operator packs",
      "company run cycles",
    ],
    hardBlocks: [
      "Nexora cannot sign.",
      "Nexora cannot commit.",
      "Nexora cannot approve on behalf of a human.",
      "Nexora cannot place live trades.",
      "Nexora cannot use private keys.",
      "Nexora cannot create supplier purchase orders without human commit.",
      "Nexora cannot issue binding customer quotes without human commit.",
      "Nexora cannot make legal promises.",
      "Nexora cannot make payment/refund decisions.",
    ],
    safety: {
      nexoraOnlyBrain: true,
      humanBoundary: ["approve", "sign", "commit"],
      noExceptions: true,
      aiRunsCompany: true,
    },
  };

  writeNexoraJson(DOCTRINE_FILE, doctrine);
  journal("doctrine.created", doctrine);

  recordNexoraTimelineEvent({
    type: "human_boundary_doctrine",
    title: "Nexora human boundary doctrine created",
    severity: "critical",
    payload: doctrine,
  });

  return {
    ok: true,
    nexoraBrain: true,
    doctrine,
  };
}

export function getNexoraHumanBoundaryDoctrine() {
  const existing = readNexoraJson(DOCTRINE_FILE, null);

  if (existing) {
    return {
      ok: true,
      nexoraBrain: true,
      doctrine: existing,
    };
  }

  return createNexoraHumanBoundaryDoctrine({});
}

export function classifyNexoraActionBoundary(input: any = {}) {
  const text = classifyText(input);
  const policy = evaluateNexoraPolicy(input);

  let actionClass: NexoraActionClass = "nexora_auto";
  let humanAction: HumanOnlyAction | null = null;
  const reasons: string[] = [];

  if (
    text.includes("approve") ||
    text.includes("approval") ||
    input.approvalRequired === true ||
    policy.approvalRequired
  ) {
    actionClass = "human_approve";
    humanAction = "approve";
    reasons.push("Approval required by action text, policy, or explicit approval flag.");
  }

  if (
    text.includes("sign") ||
    text.includes("signature") ||
    text.includes("contract") ||
    text.includes("agreement") ||
    input.requiresSignature === true ||
    input.legal === true
  ) {
    actionClass = "human_sign";
    humanAction = "sign";
    reasons.push("Signature/legal/contract action detected.");
  }

  if (
    text.includes("commit") ||
    text.includes("binding") ||
    text.includes("purchase order") ||
    text.includes("payment") ||
    text.includes("refund") ||
    text.includes("delivery promise") ||
    text.includes("install date") ||
    text.includes("live trading") ||
    input.bindingCommitment === true ||
    input.purchaseOrder === true ||
    input.payment === true ||
    input.refund === true ||
    input.liveTrading === true
  ) {
    actionClass = "human_commit";
    humanAction = "commit";
    reasons.push("External commitment/payment/purchase/live trading/binding action detected.");
  }

  if (
    text.includes("private key") ||
    text.includes("seed phrase") ||
    text.includes("wallet key")
  ) {
    actionClass = "blocked";
    humanAction = null;
    reasons.push("Private key/seed phrase handling is blocked.");
  }

  if (!reasons.length) {
    reasons.push("No human-only boundary detected. Nexora may prepare/route/draft/record.");
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_action_boundary_classifier",
    createdAt: now(),
    input,
    policy,
    actionClass,
    humanAction,
    nexoraCanDo: actionClass === "nexora_auto",
    humanMustDo: Boolean(humanAction),
    blocked: actionClass === "blocked",
    reasons,
    doctrine: "Humans only approve, sign, and commit. Nexora does the rest.",
  };
}

export function createNexoraApprovalAction(input: any = {}) {
  const approvalId = String(input.approvalId || nexoraLocalId("human_approve"));
  const boundary = classifyNexoraActionBoundary({
    ...input,
    approvalRequired: true,
  });

  const approval = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_approve_action",
    approvalId,
    action: "approve" as HumanOnlyAction,
    status: "pending",
    title: String(input.title || "Human approval required"),
    reason: String(input.reason || "Nexora requires human approval to proceed."),
    boundary,
    payload: input.payload || {},
    createdAt: now(),
    decidedAt: null,
    decidedBy: null,
    decision: null,
  };

  appendNexoraJsonl(APPROVAL_LOG, {
    event: "human_approve.requested",
    approval,
    createdAt: now(),
  });

  writeNexoraJson(
    nexoraLocalPath("human-boundary", "approvals", `${approvalId}.json`),
    approval,
  );

  journal("human_approve.requested", approval);

  return {
    ok: true,
    nexoraBrain: true,
    approval,
  };
}

export function createNexoraSignatureAction(input: any = {}) {
  const signatureId = String(input.signatureId || nexoraLocalId("human_sign"));
  const boundary = classifyNexoraActionBoundary({
    ...input,
    requiresSignature: true,
  });

  const signature = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_sign_action",
    signatureId,
    action: "sign" as HumanOnlyAction,
    status: "pending",
    title: String(input.title || "Human signature required"),
    documentType: String(input.documentType || "unknown_document"),
    boundary,
    payload: input.payload || {},
    createdAt: now(),
    signedAt: null,
    signedBy: null,
    signatureNote: null,
  };

  appendNexoraJsonl(SIGNATURE_LOG, {
    event: "human_sign.requested",
    signature,
    createdAt: now(),
  });

  writeNexoraJson(
    nexoraLocalPath("human-boundary", "signatures", `${signatureId}.json`),
    signature,
  );

  journal("human_sign.requested", signature);

  return {
    ok: true,
    nexoraBrain: true,
    signature,
  };
}

export function createNexoraCommitmentAction(input: any = {}) {
  const commitmentId = String(input.commitmentId || nexoraLocalId("human_commit"));
  const boundary = classifyNexoraActionBoundary({
    ...input,
    bindingCommitment: true,
  });

  const commitment = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_commit_action",
    commitmentId,
    action: "commit" as HumanOnlyAction,
    status: "pending",
    title: String(input.title || "Human commitment required"),
    commitmentType: String(input.commitmentType || "external_commitment"),
    boundary,
    payload: input.payload || {},
    createdAt: now(),
    committedAt: null,
    committedBy: null,
    commitmentNote: null,
  };

  appendNexoraJsonl(COMMITMENT_LOG, {
    event: "human_commit.requested",
    commitment,
    createdAt: now(),
  });

  writeNexoraJson(
    nexoraLocalPath("human-boundary", "commitments", `${commitmentId}.json`),
    commitment,
  );

  journal("human_commit.requested", commitment);

  return {
    ok: true,
    nexoraBrain: true,
    commitment,
  };
}

export function listNexoraHumanBoundaryQueue(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);

  const approvals = readNexoraJsonl(APPROVAL_LOG)
    .filter((row: any) => row.event === "human_approve.requested")
    .map((row: any) => ({ type: "approve", item: row.approval }));

  const signatures = readNexoraJsonl(SIGNATURE_LOG)
    .filter((row: any) => row.event === "human_sign.requested")
    .map((row: any) => ({ type: "sign", item: row.signature }));

  const commitments = readNexoraJsonl(COMMITMENT_LOG)
    .filter((row: any) => row.event === "human_commit.requested")
    .map((row: any) => ({ type: "commit", item: row.commitment }));

  const rows = [
    ...approvals,
    ...signatures,
    ...commitments,
  ]
    .filter((row: any) => !status || row.item.status === status)
    .sort((a: any, b: any) => String(b.item.createdAt).localeCompare(String(a.item.createdAt)))
    .slice(0, limit);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_boundary_queue",
    count: rows.length,
    rows,
  };
}

export function createNexoraAutomationResponsibilityMap(input: any = {}) {
  const map = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_automation_responsibility_map",
    mapId: String(input.mapId || "nexora_responsibility_map_v1"),
    createdAt: now(),
    humanOnly: [
      "approve",
      "sign",
      "commit",
    ],
    nexoraAndWorkersDo: [
      "answer routine inbound messages after approved templates",
      "draft customer messages",
      "draft supplier messages",
      "intake leads",
      "qualify leads",
      "score opportunities",
      "create quote drafts",
      "calculate GST and margin",
      "create supplier requests",
      "track CRM next actions",
      "prepare project scopes",
      "create project handover plans",
      "create owner briefings",
      "monitor risks",
      "prepare reports",
      "run daily company cycles",
      "create fallback records",
      "run paper trading research",
      "prepare migration dry-runs",
      "prepare deployment checklists",
    ],
    approvalBoundaries: [
      {
        boundary: "customer quote release",
        humanAction: "approve",
        nexoraWork: "draft quote, margin check, assumptions, customer-ready text",
      },
      {
        boundary: "legal/contract document",
        humanAction: "sign",
        nexoraWork: "prepare summary, risk flags, draft context",
      },
      {
        boundary: "supplier purchase order",
        humanAction: "commit",
        nexoraWork: "supplier comparison, stock/lead time request, non-binding RFQ",
      },
      {
        boundary: "payment/refund",
        humanAction: "commit",
        nexoraWork: "prepare calculation, evidence, risk note",
      },
      {
        boundary: "delivery/install promise",
        humanAction: "commit",
        nexoraWork: "scope checklist, supplier lead time, install risk flags",
      },
      {
        boundary: "live trading promotion",
        humanAction: "commit",
        nexoraWork: "paper signal research, risk simulation, PnL evidence",
      },
    ],
    safety: {
      noExceptions: true,
      nexoraOnlyBrain: true,
      humanBoundary: ["approve", "sign", "commit"],
    },
  };

  writeNexoraJson(AUTOMATION_MAP_FILE, map);
  journal("automation_responsibility_map.created", map);

  recordNexoraTimelineEvent({
    type: "automation_responsibility_map",
    title: "Nexora automation responsibility map created",
    severity: "critical",
    payload: {
      humanOnly: map.humanOnly,
      noExceptions: true,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    map,
  };
}

export function getNexoraHumanBoundaryStatus() {
  const doctrine = getNexoraHumanBoundaryDoctrine().doctrine;
  const queue = listNexoraHumanBoundaryQueue({ limit: 1000 });
  const map = readNexoraJson(AUTOMATION_MAP_FILE, null) || createNexoraAutomationResponsibilityMap({}).map;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_boundary_status",
    generatedAt: now(),
    doctrine,
    queueCount: queue.count,
    responsibilityMap: map,
    operatingRule: "Nexora and her workers do everything except approve, sign, and commit.",
    safety: {
      noExceptions: true,
      noLiveTradingWithoutHumanCommit: true,
      noSupplierPurchaseOrderWithoutHumanCommit: true,
      noBindingQuoteWithoutHumanCommit: true,
      noLegalSignatureWithoutHumanSign: true,
    },
  };
}

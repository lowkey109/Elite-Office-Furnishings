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

const JOURNAL = nexoraLocalPath("human-company", "journal", "human-company-journal.jsonl");
const CONTACT_LOG = nexoraLocalPath("human-company", "contacts", "contact-log.jsonl");
const COMM_LOG = nexoraLocalPath("human-company", "communications", "communication-log.jsonl");
const APPROVAL_LOG = nexoraLocalPath("human-company", "approvals", "approval-log.jsonl");
const HANDOFF_LOG = nexoraLocalPath("human-company", "handoffs", "handoff-log.jsonl");
const TOUCHPOINT_LOG = nexoraLocalPath("human-company", "touchpoints", "touchpoint-log.jsonl");
const BRIEFING_LOG = nexoraLocalPath("human-company", "briefings", "briefing-log.jsonl");
const INBOX_LOG = nexoraLocalPath("human-company", "inbox", "inbox-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function needsHumanApproval(input: any = {}) {
  const text = JSON.stringify(input).toLowerCase();

  return (
    input.approvalRequired === true ||
    input.customerFacing === true ||
    input.supplierFacing === true ||
    input.bindingCommitment === true ||
    input.purchaseOrder === true ||
    input.payment === true ||
    input.legal === true ||
    input.liveTrading === true ||
    text.includes("purchase order") ||
    text.includes("binding quote") ||
    text.includes("contract") ||
    text.includes("payment") ||
    text.includes("refund") ||
    text.includes("legal") ||
    text.includes("live trading")
  );
}

export function getNexoraHumanCompanyStatus() {
  const contacts = readNexoraJsonl(CONTACT_LOG).filter((row: any) => row.event === "contact.created");
  const communications = readNexoraJsonl(COMM_LOG).filter((row: any) => row.event === "communication.drafted");
  const approvals = readNexoraJsonl(APPROVAL_LOG).filter((row: any) => row.event === "approval.requested");
  const pendingApprovals = approvals.filter((row: any) => row.approval.status === "pending");
  const handoffs = readNexoraJsonl(HANDOFF_LOG).filter((row: any) => row.event === "handoff.created");
  const touchpoints = readNexoraJsonl(TOUCHPOINT_LOG).filter((row: any) => row.event === "touchpoint.recorded");
  const inbox = readNexoraJsonl(INBOX_LOG).filter((row: any) => row.event === "inbox.created");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_contact_ai_company",
    generatedAt: now(),
    mode: "ai_runs_company_humans_approve_contact_and_commitments",
    counts: {
      contacts: contacts.length,
      communications: communications.length,
      approvals: approvals.length,
      pendingApprovals: pendingApprovals.length,
      handoffs: handoffs.length,
      touchpoints: touchpoints.length,
      inbox: inbox.length,
    },
    humanRequiredFor: [
      "customer-facing quote release",
      "supplier purchase order",
      "supplier binding commitment",
      "payment or refund",
      "legal or contractual commitment",
      "project delivery promise",
      "live trading",
      "private key or wallet use",
    ],
    aiCanDo: [
      "draft emails",
      "draft call scripts",
      "prepare quote drafts",
      "prepare supplier requests",
      "summarise leads",
      "create project scopes",
      "prepare handoffs",
      "create daily briefings",
      "track next actions",
      "record touchpoints",
    ],
    safety: {
      nexoraOnlyBrain: true,
      humanApprovalBoundary: true,
      noAutonomousExternalCommitment: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };
}

export function createNexoraHumanContact(input: any = {}) {
  const contactId = String(input.contactId || nexoraLocalId("contact"));
  const type = String(input.type || "customer");

  const contact = {
    ok: true,
    nexoraBrain: true,
    contactId,
    type,
    name: String(input.name || input.customerName || input.companyName || "Unknown contact"),
    companyName: input.companyName || null,
    personName: input.personName || input.customerName || null,
    role: input.role || null,
    email: input.email || null,
    phone: input.phone || null,
    location: input.location || null,
    preferredChannel: input.preferredChannel || (input.email ? "email" : input.phone ? "phone" : "unknown"),
    notes: input.notes || "",
    status: input.status || "active",
    createdAt: now(),
    updatedAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("human-company", "contacts", `${contactId}.json`), contact);

  appendNexoraJsonl(CONTACT_LOG, {
    event: "contact.created",
    contact,
    createdAt: now(),
  });

  journal("contact.created", contact);

  return {
    ok: true,
    nexoraBrain: true,
    contact,
  };
}

export function listNexoraHumanContacts(input: any = {}) {
  const type = input.type ? String(input.type) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(CONTACT_LOG)
    .filter((row: any) => row.event === "contact.created")
    .map((row: any) => row.contact)
    .filter((contact: any) => !type || contact.type === type)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraCommunicationDraft(input: any = {}) {
  const communicationId = String(input.communicationId || nexoraLocalId("communication"));
  const channel = String(input.channel || "email");
  const audience = String(input.audience || "customer");
  const subject = String(input.subject || "The Corporate Desk follow-up");
  const purpose = String(input.purpose || "follow_up");

  const approvalRequired = needsHumanApproval({
    ...input,
    customerFacing: audience === "customer",
    supplierFacing: audience === "supplier",
  });

  const body = input.body || [
    audience === "supplier" ? "Hello," : `Hi ${input.customerName || "there"},`,
    "",
    String(input.message || "Thanks for your time. Nexora has prepared this draft for human review."),
    "",
    "This message is a draft and should be reviewed before sending.",
    "",
    "Regards,",
    "The Corporate Desk",
  ].join("\n");

  const draft = {
    ok: true,
    nexoraBrain: true,
    communicationId,
    channel,
    audience,
    purpose,
    subject,
    body,
    approvalRequired,
    status: approvalRequired ? "requires_human_review" : "draft_ready",
    createdAt: now(),
    payload: input.payload || {},
    safety: {
      draftOnly: true,
      notSent: true,
      humanReviewRequired: approvalRequired,
    },
  };

  writeNexoraJson(nexoraLocalPath("human-company", "communications", `${communicationId}.json`), draft);

  appendNexoraJsonl(COMM_LOG, {
    event: "communication.drafted",
    draft,
    createdAt: now(),
  });

  journal("communication.drafted", draft);

  if (approvalRequired) {
    createNexoraHumanApprovalRequest({
      type: "communication",
      title: `Review communication draft: ${subject}`,
      reason: "Communication is customer/supplier-facing or may imply commitment.",
      payload: draft,
      risk: audience === "supplier" || audience === "customer" ? "medium" : "safe",
    });
  }

  return {
    ok: true,
    nexoraBrain: true,
    draft,
  };
}

export function createNexoraHumanApprovalRequest(input: any = {}) {
  const approvalId = String(input.approvalId || nexoraLocalId("human_approval"));
  const policy = evaluateNexoraPolicy(input);

  const approval = {
    ok: true,
    nexoraBrain: true,
    approvalId,
    type: String(input.type || "general"),
    title: String(input.title || "Human approval required"),
    reason: String(input.reason || "Nexora requires human approval for this action."),
    risk: String(input.risk || (policy.approvalRequired ? "high" : "medium")),
    status: "pending",
    requestedBy: String(input.requestedBy || "nexora"),
    payload: input.payload || {},
    policy,
    createdAt: now(),
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
  };

  writeNexoraJson(nexoraLocalPath("human-company", "approvals", `${approvalId}.json`), approval);

  appendNexoraJsonl(APPROVAL_LOG, {
    event: "approval.requested",
    approval,
    createdAt: now(),
  });

  createNexoraHumanInboxItem({
    type: "approval",
    title: approval.title,
    priority: approval.risk === "high" || approval.risk === "critical" ? 95 : 75,
    payload: approval,
    humanRequired: true,
  });

  journal("approval.requested", approval);

  return {
    ok: true,
    nexoraBrain: true,
    approval,
  };
}

export function decideNexoraHumanApproval(input: any = {}) {
  const approvalId = String(input.approvalId || "");
  const decision = String(input.decision || "").toLowerCase();

  if (!["approved", "rejected"].includes(decision)) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "decision must be approved or rejected",
    };
  }

  const existing = readNexoraJson(nexoraLocalPath("human-company", "approvals", `${approvalId}.json`), null);

  if (!existing) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "approval not found",
      approvalId,
    };
  }

  existing.status = decision;
  existing.decidedAt = now();
  existing.decidedBy = String(input.decidedBy || "human_operator");
  existing.decisionNote = String(input.note || "");

  writeNexoraJson(nexoraLocalPath("human-company", "approvals", `${approvalId}.json`), existing);

  appendNexoraJsonl(APPROVAL_LOG, {
    event: `approval.${decision}`,
    approval: existing,
    createdAt: now(),
  });

  journal(`approval.${decision}`, existing);

  return {
    ok: true,
    nexoraBrain: true,
    approval: existing,
  };
}

export function listNexoraHumanApprovals(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(APPROVAL_LOG)
    .filter((row: any) => row.event === "approval.requested")
    .map((row: any) => row.approval)
    .filter((approval: any) => !status || approval.status === status)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraHumanHandoff(input: any = {}) {
  const handoffId = String(input.handoffId || nexoraLocalId("handoff"));
  const division = String(input.division || "operations");
  const action = String(input.action || "review_and_continue");

  const handoff = {
    ok: true,
    nexoraBrain: true,
    handoffId,
    division,
    title: String(input.title || "Human handoff required"),
    action,
    priority: Number(input.priority || 50),
    humanRole: String(input.humanRole || "owner_operator"),
    context: input.context || {},
    script: input.script || [
      "Review the context.",
      "Confirm whether the action is safe.",
      "Approve, reject, or request more information.",
      "Record the decision in Nexora.",
    ],
    status: "open",
    createdAt: now(),
    safety: {
      humanOwnsFinalContact: true,
      noAutonomousCommitment: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("human-company", "handoffs", `${handoffId}.json`), handoff);

  appendNexoraJsonl(HANDOFF_LOG, {
    event: "handoff.created",
    handoff,
    createdAt: now(),
  });

  createNexoraHumanInboxItem({
    type: "handoff",
    title: handoff.title,
    priority: handoff.priority,
    payload: handoff,
    humanRequired: true,
  });

  journal("handoff.created", handoff);

  return {
    ok: true,
    nexoraBrain: true,
    handoff,
  };
}

export function listNexoraHumanHandoffs(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(HANDOFF_LOG)
    .filter((row: any) => row.event === "handoff.created")
    .map((row: any) => row.handoff)
    .filter((handoff: any) => !status || handoff.status === status)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function recordNexoraHumanTouchpoint(input: any = {}) {
  const touchpointId = String(input.touchpointId || nexoraLocalId("touchpoint"));

  const touchpoint = {
    ok: true,
    nexoraBrain: true,
    touchpointId,
    contactId: input.contactId || null,
    contactName: input.contactName || input.customerName || input.supplierName || null,
    type: String(input.type || "note"),
    channel: String(input.channel || "manual"),
    direction: String(input.direction || "outbound"),
    summary: String(input.summary || "Human touchpoint recorded."),
    nextAction: input.nextAction || null,
    payload: input.payload || {},
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("human-company", "touchpoints", `${touchpointId}.json`), touchpoint);

  appendNexoraJsonl(TOUCHPOINT_LOG, {
    event: "touchpoint.recorded",
    touchpoint,
    createdAt: now(),
  });

  journal("touchpoint.recorded", touchpoint);

  recordNexoraMetric({
    name: "human_touchpoint_recorded",
    value: 1,
    unit: "touchpoint",
    dimensions: {
      type: touchpoint.type,
      channel: touchpoint.channel,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    touchpoint,
  };
}

export function listNexoraHumanTouchpoints(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(TOUCHPOINT_LOG)
    .filter((row: any) => row.event === "touchpoint.recorded")
    .map((row: any) => row.touchpoint)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function createNexoraHumanInboxItem(input: any = {}) {
  const inboxId = String(input.inboxId || nexoraLocalId("human_inbox"));
  const humanRequired = input.humanRequired !== false;

  const item = {
    ok: true,
    nexoraBrain: true,
    inboxId,
    type: String(input.type || "general"),
    title: String(input.title || "Human attention required"),
    priority: Number(input.priority || 50),
    status: "open",
    humanRequired,
    payload: input.payload || {},
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("human-company", "inbox", `${inboxId}.json`), item);

  appendNexoraJsonl(INBOX_LOG, {
    event: "inbox.created",
    item,
    createdAt: now(),
  });

  journal("human_inbox.created", item);

  return {
    ok: true,
    nexoraBrain: true,
    item,
  };
}

export function listNexoraHumanInbox(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(INBOX_LOG)
    .filter((row: any) => row.event === "inbox.created")
    .map((row: any) => row.item)
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

export function createNexoraDailyHumanBriefing(input: any = {}) {
  const briefingId = String(input.briefingId || nexoraLocalId("briefing"));

  const pendingApprovals = listNexoraHumanApprovals({ status: "pending", limit: 50 });
  const openHandoffs = listNexoraHumanHandoffs({ status: "open", limit: 50 });
  const inbox = listNexoraHumanInbox({ status: "open", limit: 50 });
  const touchpoints = listNexoraHumanTouchpoints({ limit: 20 });

  const briefing = {
    ok: true,
    nexoraBrain: true,
    briefingId,
    createdAt: now(),
    title: "Nexora Daily Human Briefing",
    summary: {
      pendingApprovals: pendingApprovals.count,
      openHandoffs: openHandoffs.count,
      inbox: inbox.count,
      recentTouchpoints: touchpoints.count,
    },
    topPriorities: [
      ...pendingApprovals.rows.map((approval: any) => ({
        type: "approval",
        priority: approval.risk === "high" || approval.risk === "critical" ? 100 : 80,
        title: approval.title,
        payload: approval,
      })),
      ...openHandoffs.rows.map((handoff: any) => ({
        type: "handoff",
        priority: Number(handoff.priority || 50),
        title: handoff.title,
        payload: handoff,
      })),
      ...inbox.rows.map((item: any) => ({
        type: "inbox",
        priority: Number(item.priority || 50),
        title: item.title,
        payload: item,
      })),
    ].sort((a: any, b: any) => b.priority - a.priority).slice(0, 20),
    humanScript: [
      "Review pending approvals first.",
      "Reject anything that creates unsafe commitment.",
      "Approve only draft/customer/supplier actions you are comfortable with.",
      "Record every customer or supplier contact as a touchpoint.",
      "Run office agents after new lead intake.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("human-company", "briefings", `${briefingId}.json`), briefing);

  appendNexoraJsonl(BRIEFING_LOG, {
    event: "briefing.created",
    briefing,
    createdAt: now(),
  });

  journal("briefing.created", briefing);

  recordNexoraTimelineEvent({
    type: "human_briefing",
    title: "Daily human briefing created",
    severity: pendingApprovals.count > 0 ? "warning" : "info",
    payload: briefing.summary,
  });

  return {
    ok: true,
    nexoraBrain: true,
    briefing,
  };
}

export function getNexoraOwnerCockpit(input: any = {}) {
  const status = getNexoraHumanCompanyStatus();
  const briefing = createNexoraDailyHumanBriefing({
    briefingId: input.briefingId || "latest",
  }).briefing;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_owner_cockpit",
    generatedAt: now(),
    status,
    briefing,
    ownerNextActions: briefing.topPriorities.slice(0, 10),
    operatingRule: "AI runs drafts, records, routing, summaries, and planning. Humans approve/send/commit.",
  };
}

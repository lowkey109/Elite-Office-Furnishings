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
import {
  createNexoraCommunicationDraft,
  createNexoraApprovalPacket,
} from "../commsdocs/nexoraCommsDocsEngine";

function now() {
  return new Date().toISOString();
}

const DRAFT_LOG = nexoraLocalPath("email-approval", "drafts", "email-draft-log.jsonl");
const OUTBOX_LOG = nexoraLocalPath("email-approval", "outbox", "email-outbox-log.jsonl");
const APPROVAL_LOG = nexoraLocalPath("email-approval", "approvals", "email-approval-log.jsonl");
const SENT_LOG = nexoraLocalPath("email-approval", "sent-log", "email-sent-log.jsonl");
const JOURNAL = nexoraLocalPath("email-approval", "journal", "email-approval-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeEmail(value: any) {
  const email = String(value || "").trim();
  return email.includes("@") ? email : null;
}

function needsHumanApproval(input: any = {}) {
  const text = JSON.stringify(input).toLowerCase();
  const policy = evaluateNexoraPolicy(input);

  return (
    policy.approvalRequired ||
    input.customerFacing === true ||
    input.supplierFacing === true ||
    input.approvalRequired === true ||
    text.includes("quote") ||
    text.includes("supplier") ||
    text.includes("customer") ||
    text.includes("purchase order") ||
    text.includes("binding")
  );
}

export function createNexoraHumanApprovedEmailDraft(input: any = {}) {
  const emailDraftId = String(input.emailDraftId || nexoraLocalId("email_draft"));
  const to = safeEmail(input.to || input.email);
  const cc = Array.isArray(input.cc) ? input.cc.filter(safeEmail) : [];
  const bcc = Array.isArray(input.bcc) ? input.bcc.filter(safeEmail) : [];

  const commDraft = input.communicationDraft || createNexoraCommunicationDraft({
    templateId: input.templateId,
    audience: input.audience || "customer_email",
    subject: input.subject || "The Corporate Desk draft",
    body: input.body,
    vars: input.vars || input.payload || {},
    customerFacing: input.customerFacing !== false,
    supplierFacing: input.supplierFacing === true,
  }).draft;

  const approvalRequired = needsHumanApproval({
    ...input,
    subject: commDraft.subject,
    body: commDraft.body,
  });

  const draft = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_approved_email_draft",
    emailDraftId,
    to,
    cc,
    bcc,
    subject: commDraft.subject,
    body: commDraft.body,
    status: approvalRequired ? "approval_required" : "draft_ready",
    approvalRequired,
    communicationDraftId: commDraft.draftId,
    createdAt: now(),
    safety: {
      notSent: true,
      humanMustApproveBeforeSend: true,
      noAutonomousExternalEmail: true,
    },
    payload: input.payload || {},
  };

  writeNexoraJson(nexoraLocalPath("email-approval", "drafts", `${emailDraftId}.json`), draft);
  appendNexoraJsonl(DRAFT_LOG, { event: "email_draft.created", draft, createdAt: now() });

  let approvalPacket = null;

  if (approvalRequired) {
    approvalPacket = createNexoraApprovalPacket({
      type: "email_draft",
      title: `Approve email draft ${emailDraftId}`,
      risk: "medium",
      payload: draft,
    });

    appendNexoraJsonl(APPROVAL_LOG, {
      event: "email_approval.required",
      emailDraftId,
      approvalPacket,
      createdAt: now(),
    });
  }

  journal("email_draft.created", { draft, approvalPacket });

  return {
    ok: true,
    nexoraBrain: true,
    draft,
    approvalPacket,
  };
}

export function queueNexoraEmailForHumanSend(input: any = {}) {
  const outboxId = String(input.outboxId || nexoraLocalId("email_outbox"));
  const draft = input.draft || createNexoraHumanApprovedEmailDraft(input).draft;

  const item = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_email_outbox",
    outboxId,
    emailDraftId: draft.emailDraftId,
    to: draft.to,
    cc: draft.cc || [],
    bcc: draft.bcc || [],
    subject: draft.subject,
    body: draft.body,
    status: draft.approvalRequired ? "waiting_human_approval" : "ready_for_human_send",
    createdAt: now(),
    safety: {
      notSent: true,
      humanSends: true,
      noAutonomousExternalEmail: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("email-approval", "outbox", `${outboxId}.json`), item);
  appendNexoraJsonl(OUTBOX_LOG, { event: "email_outbox.queued", item, createdAt: now() });

  journal("email_outbox.queued", item);

  return { ok: true, nexoraBrain: true, item };
}

export function markNexoraEmailHumanSent(input: any = {}) {
  const sentId = String(input.sentId || nexoraLocalId("email_sent"));
  const outboxId = String(input.outboxId || "");
  const human = String(input.human || input.sentBy || "human_operator");

  const sent = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_email_human_sent_record",
    sentId,
    outboxId,
    human,
    sentAt: now(),
    note: String(input.note || "Human confirmed this email was sent outside Nexora."),
    payload: input.payload || {},
    safety: {
      humanSent: true,
      nexoraDidNotSend: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("email-approval", "sent-log", `${sentId}.json`), sent);
  appendNexoraJsonl(SENT_LOG, { event: "email.human_sent", sent, createdAt: now() });

  recordNexoraTimelineEvent({
    type: "email_human_sent",
    title: "Human marked email as sent",
    severity: "info",
    payload: { sentId, outboxId, human },
  });

  recordNexoraMetric({
    name: "email_human_sent",
    value: 1,
    unit: "email",
    dimensions: { human },
  });

  journal("email.human_sent", sent);

  return { ok: true, nexoraBrain: true, sent };
}

export function listNexoraEmailApprovalRecords(input: any = {}) {
  const limit = Number(input.limit || 100);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_email_approval_records",
    drafts: readNexoraJsonl(DRAFT_LOG).slice(-limit).reverse(),
    outbox: readNexoraJsonl(OUTBOX_LOG).slice(-limit).reverse(),
    approvals: readNexoraJsonl(APPROVAL_LOG).slice(-limit).reverse(),
    sent: readNexoraJsonl(SENT_LOG).slice(-limit).reverse(),
  };
}

export function getNexoraEmailApprovalStatus() {
  const records = listNexoraEmailApprovalRecords({ limit: 1000 });

  const waitingApproval = records.outbox.filter((row: any) =>
    JSON.stringify(row).includes("waiting_human_approval")
  ).length;

  const readyForHumanSend = records.outbox.filter((row: any) =>
    JSON.stringify(row).includes("ready_for_human_send")
  ).length;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_email_approval_outbox",
    generatedAt: now(),
    counts: {
      drafts: records.drafts.length,
      outbox: records.outbox.length,
      approvals: records.approvals.length,
      sent: records.sent.length,
      waitingApproval,
      readyForHumanSend,
    },
    safety: {
      noAutonomousEmailSend: true,
      humanApprovesAndSends: true,
    },
  };
}

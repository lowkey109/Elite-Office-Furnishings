import fs from "fs";
import path from "path";
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

function money(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : fallback;
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function htmlEscape(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const TEMPLATE_LOG = nexoraLocalPath("comms-docs", "templates", "template-log.jsonl");
const DRAFT_LOG = nexoraLocalPath("comms-docs", "drafts", "draft-log.jsonl");
const CUSTOMER_DRAFT_LOG = nexoraLocalPath("comms-docs", "customer-drafts", "customer-draft-log.jsonl");
const OUTBOX_LOG = nexoraLocalPath("comms-docs", "outbox", "outbox-log.jsonl");
const QUOTE_DOC_LOG = nexoraLocalPath("comms-docs", "quote-documents", "quote-document-log.jsonl");
const SUPPLIER_PACK_LOG = nexoraLocalPath("comms-docs", "supplier-packs", "supplier-pack-log.jsonl");
const APPROVAL_PACKET_LOG = nexoraLocalPath("comms-docs", "approval-packets", "approval-packet-log.jsonl");
const SEND_QUEUE_LOG = nexoraLocalPath("comms-docs", "send-queue", "send-queue-log.jsonl");
const JOURNAL = nexoraLocalPath("comms-docs", "journal", "comms-docs-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function needsHumanApproval(input: any = {}) {
  const text = JSON.stringify(input).toLowerCase();
  const policy = evaluateNexoraPolicy(input);

  return {
    approvalRequired:
      Boolean(input.approvalRequired) ||
      Boolean(policy.approvalRequired) ||
      Boolean(input.customerFacing) ||
      Boolean(input.supplierFacing) ||
      Boolean(input.bindingCommitment) ||
      Boolean(input.purchaseOrder) ||
      text.includes("binding quote") ||
      text.includes("purchase order") ||
      text.includes("payment") ||
      text.includes("refund") ||
      text.includes("legal") ||
      text.includes("contract"),
    policy,
  };
}

export function seedNexoraCommunicationTemplates() {
  const templates = [
    {
      templateId: "customer_lead_followup",
      type: "customer_email",
      title: "Customer Lead Follow-up",
      subject: "Thanks for your office furniture enquiry",
      body: [
        "Hi {{customerName}},",
        "",
        "Thanks for your enquiry with The Corporate Desk.",
        "I have noted your requirement as: {{need}}.",
        "",
        "To move this forward, could you please confirm any missing details: {{missingFields}}.",
        "",
        "Regards,",
        "The Corporate Desk"
      ].join("\n"),
      humanApprovalDefault: true,
    },
    {
      templateId: "supplier_rfq_non_binding",
      type: "supplier_email",
      title: "Supplier Non-binding RFQ",
      subject: "Non-binding supplier confirmation request",
      body: [
        "Hello,",
        "",
        "We are preparing a non-binding supplier confirmation for an office furniture / fitout opportunity.",
        "Please confirm unit cost, stock, lead time, delivery cost, warranty, and equivalent alternatives.",
        "",
        "This is an information request only and is not a purchase order or supplier commitment.",
        "",
        "Regards,",
        "The Corporate Desk"
      ].join("\n"),
      humanApprovalDefault: true,
    },
    {
      templateId: "quote_cover_email",
      type: "customer_email",
      title: "Quote Cover Email",
      subject: "Draft office furniture quote from The Corporate Desk",
      body: [
        "Hi {{customerName}},",
        "",
        "Please find attached/prepared a draft quote summary for your office furniture requirement.",
        "",
        "This quote is subject to supplier confirmation, delivery details, installation constraints, and final approval.",
        "",
        "Regards,",
        "The Corporate Desk"
      ].join("\n"),
      humanApprovalDefault: true,
    },
    {
      templateId: "project_scope_questions",
      type: "customer_email",
      title: "Project Scope Questions",
      subject: "Site details needed for your office furniture / fitout project",
      body: [
        "Hi {{customerName}},",
        "",
        "To confirm the delivery and installation pathway, could you please confirm:",
        "- Site address",
        "- Floor level",
        "- Lift/loading dock/stairs access",
        "- Preferred install window",
        "- After-hours requirements",
        "- Site contact",
        "",
        "Regards,",
        "The Corporate Desk"
      ].join("\n"),
      humanApprovalDefault: true,
    }
  ];

  const written = templates.map((template) => {
    writeNexoraJson(
      nexoraLocalPath("comms-docs", "templates", `${template.templateId}.json`),
      {
        ok: true,
        nexoraBrain: true,
        ...template,
        createdAt: now(),
        updatedAt: now(),
      },
    );

    appendNexoraJsonl(TEMPLATE_LOG, {
      event: "template.seeded",
      template,
      createdAt: now(),
    });

    return template;
  });

  journal("templates.seeded", { count: written.length });

  return { ok: true, nexoraBrain: true, templates: written };
}

export function listNexoraCommunicationTemplates(input: any = {}) {
  const type = input.type ? String(input.type) : "";
  const rows = readNexoraJsonl(TEMPLATE_LOG)
    .filter((row: any) => row.event === "template.seeded" || row.event === "template.created")
    .map((row: any) => row.template)
    .filter((template: any) => !type || template.type === type)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

function renderTemplate(body: string, vars: Record<string, any>) {
  let rendered = body;
  for (const [key, value] of Object.entries(vars || {})) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), String(value ?? ""));
  }
  return rendered;
}

export function createNexoraCommunicationDraft(input: any = {}) {
  const draftId = String(input.draftId || nexoraLocalId("comm_draft"));
  const templateId = String(input.templateId || "");
  const template = templateId
    ? readNexoraJson(nexoraLocalPath("comms-docs", "templates", `${safeId(templateId)}.json`), null)
    : null;

  const audience = String(input.audience || template?.type || "customer_email");
  const vars = input.vars || input.payload || {};

  const subject = String(input.subject || template?.subject || "The Corporate Desk draft");
  const body = template
    ? renderTemplate(template.body, vars)
    : String(input.body || "Draft communication prepared by Nexora for human review.");

  const approval = needsHumanApproval({
    ...input,
    customerFacing: audience.includes("customer"),
    supplierFacing: audience.includes("supplier"),
  });

  const draft = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_communication_draft",
    draftId,
    templateId: templateId || null,
    audience,
    subject,
    body,
    vars,
    status: approval.approvalRequired ? "human_approval_required" : "draft_ready",
    approvalRequired: approval.approvalRequired,
    policy: approval.policy,
    createdAt: now(),
    safety: {
      draftOnly: true,
      notSent: true,
      humanApprovalBeforeSend: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("comms-docs", "drafts", `${draftId}.json`), draft);
  appendNexoraJsonl(DRAFT_LOG, { event: "draft.created", draft, createdAt: now() });

  journal("draft.created", draft);

  return { ok: true, nexoraBrain: true, draft };
}

export function createNexoraOutboxItem(input: any = {}) {
  const outboxId = String(input.outboxId || nexoraLocalId("outbox"));
  const draft = input.draft || createNexoraCommunicationDraft(input).draft;

  const item = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_outbox_item",
    outboxId,
    draftId: draft.draftId,
    channel: String(input.channel || "email"),
    to: input.to || input.email || null,
    subject: draft.subject,
    body: draft.body,
    status: draft.approvalRequired ? "waiting_human_approval" : "ready_for_human_send",
    createdAt: now(),
    safety: {
      notSent: true,
      humanSends: true,
      noAutonomousExternalContact: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("comms-docs", "outbox", `${outboxId}.json`), item);
  appendNexoraJsonl(OUTBOX_LOG, { event: "outbox.created", item, createdAt: now() });

  journal("outbox.created", item);

  return { ok: true, nexoraBrain: true, item };
}

export function createNexoraQuoteDocument(input: any = {}) {
  const documentId = String(input.documentId || nexoraLocalId("quote_doc"));
  const customerName = String(input.customerName || "Customer");
  const companyName = String(input.companyName || "Company");
  const items = Array.isArray(input.items) ? input.items : [];
  const subtotal = money(input.subtotal ?? items.reduce((sum: number, item: any) => sum + money(item.lineSell ?? item.total, 0), 0));
  const gst = money(input.gst ?? subtotal * 0.1);
  const total = money(input.total ?? subtotal + gst);
  const costTotal = money(input.costTotal ?? items.reduce((sum: number, item: any) => sum + money(item.lineCost, 0), 0));
  const marginAmount = money(subtotal - costTotal);
  const marginPercent = subtotal > 0 ? money((marginAmount / subtotal) * 100) : 0;

  const approvalRequired = total >= 25000 || marginPercent < 22 || Boolean(input.bindingCommitment);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Draft Quote ${htmlEscape(documentId)}</title>
  <style>
    body { font-family: Arial, sans-serif; color:#111; margin:40px; }
    h1 { color:#0b1020; }
    table { border-collapse: collapse; width:100%; margin-top:20px; }
    th,td { border:1px solid #ddd; padding:10px; text-align:left; }
    th { background:#f3f5f8; }
    .total { font-weight:bold; }
    .note { background:#fff8dc; padding:12px; border:1px solid #e6d58a; margin-top:20px; }
  </style>
</head>
<body>
  <h1>The Corporate Desk — Draft Quote</h1>
  <p><strong>Customer:</strong> ${htmlEscape(customerName)}</p>
  <p><strong>Company:</strong> ${htmlEscape(companyName)}</p>
  <p><strong>Date:</strong> ${htmlEscape(now())}</p>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead>
    <tbody>
      ${items.map((item: any) => `<tr><td>${htmlEscape(item.name || item.sku || "Item")}</td><td>${htmlEscape(item.quantity || 1)}</td><td>$${money(item.unitSell || item.unit || 0).toFixed(2)}</td><td>$${money(item.lineSell || item.total || 0).toFixed(2)}</td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="3">Subtotal</td><td>$${subtotal.toFixed(2)}</td></tr>
      <tr><td colspan="3">GST</td><td>$${gst.toFixed(2)}</td></tr>
      <tr class="total"><td colspan="3">Total</td><td>$${total.toFixed(2)}</td></tr>
    </tfoot>
  </table>
  <div class="note">
    <strong>Draft only:</strong> This quote is subject to supplier confirmation, delivery details, installation constraints and human approval before any binding commitment.
  </div>
</body>
</html>`;

  const markdown = [
    `# The Corporate Desk — Draft Quote`,
    ``,
    `Customer: ${customerName}`,
    `Company: ${companyName}`,
    `Date: ${now()}`,
    ``,
    `| Item | Qty | Unit | Line |`,
    `|---|---:|---:|---:|`,
    ...items.map((item: any) => `| ${item.name || item.sku || "Item"} | ${item.quantity || 1} | $${money(item.unitSell || item.unit || 0).toFixed(2)} | $${money(item.lineSell || item.total || 0).toFixed(2)} |`),
    ``,
    `Subtotal: $${subtotal.toFixed(2)}`,
    `GST: $${gst.toFixed(2)}`,
    `Total: $${total.toFixed(2)}`,
    ``,
    `Draft only. Subject to supplier confirmation, delivery details, installation constraints and human approval before any binding commitment.`,
  ].join("\n");

  const document = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_quote_document",
    documentId,
    createdAt: now(),
    customerName,
    companyName,
    items,
    totals: {
      subtotal,
      gst,
      total,
      costTotal,
      marginAmount,
      marginPercent,
    },
    approvalRequired,
    html,
    markdown,
    safety: {
      draftOnly: true,
      notSent: true,
      notSigned: true,
      humanCommitRequired: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("comms-docs", "quote-documents", `${documentId}.json`), document);
  writeNexoraJson(nexoraLocalPath("comms-docs", "quote-documents", `${documentId}.html.json`), { html });
  appendNexoraJsonl(QUOTE_DOC_LOG, { event: "quote_document.created", document, createdAt: now() });

  if (approvalRequired) {
    createNexoraApprovalPacket({
      type: "quote_document",
      title: `Approve quote document ${documentId}`,
      payload: document,
      risk: "high",
    });
  }

  recordNexoraTimelineEvent({
    type: "quote_document",
    title: `Quote document created: ${documentId}`,
    severity: approvalRequired ? "warning" : "info",
    payload: { documentId, total, marginPercent, approvalRequired },
  });

  recordNexoraMetric({
    name: "quote_document_total",
    value: total,
    unit: "aud",
    dimensions: { approvalRequired, marginPercent },
  });

  journal("quote_document.created", document);

  return { ok: true, nexoraBrain: true, document };
}


export function createNexoraCustomerQuoteDraft(input: any = {}) {
  const draftId = String(input.draftId || nexoraLocalId("customer_quote_draft"));
  const customerName = String(input.customerName || "there");
  const companyName = String(input.companyName || input.company || "your team");
  const quoteTotal = money(input.total || input.quoteTotal || input.budget || 0);
  const quotePackId = input.quotePackId || null;

  const subject = String(
    input.subject ||
      `Draft office furniture quote for ${companyName}`
  );

  const body = [
    `Hi ${customerName},`,
    "",
    `Thanks for your enquiry with The Corporate Desk. Nexora has prepared a draft quote summary for ${companyName}.`,
    quoteTotal > 0 ? `Draft total: $${quoteTotal.toFixed(2)} including estimated GST where applicable.` : "The draft total will be confirmed once product, supplier, delivery, and installation assumptions are reviewed.",
    "",
    "Important notes:",
    "- This is a draft only.",
    "- Supplier stock, lead time, delivery, installation, and site access details must be confirmed.",
    "- No binding customer quote or delivery/install promise is made until a human approves and commits.",
    "",
    "Regards,",
    "The Corporate Desk",
  ].join("\n");

  const approval = needsHumanApproval({
    ...input,
    customerFacing: true,
    bindingCommitment: false,
  });

  const draft = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_customer_quote_draft",
    draftId,
    quotePackId,
    customerName,
    companyName,
    subject,
    body,
    status: approval.approvalRequired ? "human_approval_required" : "draft_ready",
    approvalRequired: approval.approvalRequired,
    policy: approval.policy,
    createdAt: now(),
    safety: {
      draftOnly: true,
      notSent: true,
      humanReviewBeforeSend: true,
      noBindingCommitment: true,
    },
    payload: input.payload || {},
  };

  writeNexoraJson(nexoraLocalPath("comms-docs", "customer-drafts", `${draftId}.json`), draft);
  appendNexoraJsonl(CUSTOMER_DRAFT_LOG, { event: "customer_quote_draft.created", draft, createdAt: now() });
  journal("customer_quote_draft.created", draft);

  if (approval.approvalRequired) {
    createNexoraApprovalPacket({
      type: "customer_quote_draft",
      title: `Review customer quote draft ${draftId}`,
      risk: "medium",
      payload: draft,
    });
  }

  return { ok: true, nexoraBrain: true, draft };
}

export function createNexoraSupplierPack(input: any = {}) {
  const supplierPackId = String(input.supplierPackId || nexoraLocalId("supplier_pack"));
  const supplierName = String(input.supplierName || "Preferred Supplier Pool");
  const items = Array.isArray(input.items) ? input.items : [];

  const request = [
    "Hello,",
    "",
    "We are preparing a non-binding supplier confirmation for an office furniture / fitout opportunity.",
    "Please confirm the following:",
    "",
    ...items.map((item: any) => `- ${item.quantity || 1} x ${item.name || item.sku || "item"}: unit cost, stock, lead time, delivery cost, warranty, and equivalent alternatives.`),
    "",
    "This is an information request only and is not a purchase order or supplier commitment.",
    "",
    "Regards,",
    "The Corporate Desk",
  ].join("\n");

  const pack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_supplier_pack",
    supplierPackId,
    supplierName,
    items,
    request,
    createdAt: now(),
    safety: {
      nonBinding: true,
      noPurchaseOrder: true,
      humanReviewBeforeSend: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("comms-docs", "supplier-packs", `${supplierPackId}.json`), pack);
  appendNexoraJsonl(SUPPLIER_PACK_LOG, { event: "supplier_pack.created", pack, createdAt: now() });

  createNexoraApprovalPacket({
    type: "supplier_request",
    title: `Review supplier request ${supplierPackId}`,
    payload: pack,
    risk: "medium",
  });

  journal("supplier_pack.created", pack);

  return { ok: true, nexoraBrain: true, pack };
}

export function createNexoraApprovalPacket(input: any = {}) {
  const packetId = String(input.packetId || nexoraLocalId("approval_packet"));

  const policy = evaluateNexoraPolicy(input);

  const packet = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_approval_packet",
    packetId,
    type: String(input.type || "general"),
    title: String(input.title || "Approval packet"),
    risk: String(input.risk || (policy.approvalRequired ? "high" : "medium")),
    status: "pending",
    policy,
    payload: input.payload || {},
    createdAt: now(),
    humanOnlyActions: ["approve", "sign", "commit"],
  };

  writeNexoraJson(nexoraLocalPath("comms-docs", "approval-packets", `${packetId}.json`), packet);
  appendNexoraJsonl(APPROVAL_PACKET_LOG, { event: "approval_packet.created", packet, createdAt: now() });

  journal("approval_packet.created", packet);

  return { ok: true, nexoraBrain: true, packet };
}

export function createNexoraHumanSendQueueItem(input: any = {}) {
  const queueId = String(input.queueId || nexoraLocalId("send_queue"));
  const draft = input.draft || createNexoraCommunicationDraft(input).draft;

  const item = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_human_send_queue_item",
    queueId,
    draftId: draft.draftId,
    status: "waiting_human_send",
    channel: input.channel || "email",
    to: input.to || input.email || null,
    subject: draft.subject,
    body: draft.body,
    createdAt: now(),
    safety: {
      notSent: true,
      humanMustSend: true,
      noAutonomousExternalContact: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("comms-docs", "send-queue", `${queueId}.json`), item);
  appendNexoraJsonl(SEND_QUEUE_LOG, { event: "send_queue.created", item, createdAt: now() });

  journal("send_queue.created", item);

  return { ok: true, nexoraBrain: true, item };
}

export function listNexoraCommsDocs(input: any = {}) {
  const limit = Number(input.limit || 100);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_comms_docs_list",
    templates: readNexoraJsonl(TEMPLATE_LOG).slice(-limit).reverse(),
    drafts: readNexoraJsonl(DRAFT_LOG).slice(-limit).reverse(),
    outbox: readNexoraJsonl(OUTBOX_LOG).slice(-limit).reverse(),
    quoteDocuments: readNexoraJsonl(QUOTE_DOC_LOG).slice(-limit).reverse(),
    supplierPacks: readNexoraJsonl(SUPPLIER_PACK_LOG).slice(-limit).reverse(),
    approvalPackets: readNexoraJsonl(APPROVAL_PACKET_LOG).slice(-limit).reverse(),
    sendQueue: readNexoraJsonl(SEND_QUEUE_LOG).slice(-limit).reverse(),
  };
}

export function getNexoraCommsDocsStatus() {
  const records = listNexoraCommsDocs({ limit: 1000 });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_comms_docs",
    generatedAt: now(),
    counts: {
      templates: records.templates.length,
      drafts: records.drafts.length,
      outbox: records.outbox.length,
      quoteDocuments: records.quoteDocuments.length,
      supplierPacks: records.supplierPacks.length,
      approvalPackets: records.approvalPackets.length,
      sendQueue: records.sendQueue.length,
    },
    safety: {
      draftOnly: true,
      humanSends: true,
      humansOnlyApproveSignCommit: true,
      noAutonomousExternalContact: true,
    },
  };
}

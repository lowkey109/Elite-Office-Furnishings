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
  createNexoraProductBundle,
  getNexoraProduct,
} from "../productcatalogue/nexoraProductCatalogueEngine";

function now() {
  return new Date().toISOString();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

const QUOTE_PACK_LOG = nexoraLocalPath("quote-packs", "packs", "quote-pack-log.jsonl");
const CUSTOMER_DRAFT_LOG = nexoraLocalPath("quote-packs", "customer-drafts", "customer-draft-log.jsonl");
const APPROVAL_LOG = nexoraLocalPath("quote-packs", "approvals", "quote-approval-log.jsonl");
const JOURNAL = nexoraLocalPath("quote-packs", "journal", "quote-pack-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function createNexoraQuotePack(input: any = {}) {
  const quotePackId = String(input.quotePackId || nexoraLocalId("quote_pack"));
  const items = Array.isArray(input.items) ? input.items : [];
  const bundle = createNexoraProductBundle({
    name: input.bundleName || input.projectName || "Quote Pack Bundle",
    items,
  }).bundle;

  const customer = {
    customerName: input.customerName || null,
    companyName: input.companyName || null,
    email: input.email || null,
    phone: input.phone || null,
    location: input.location || null,
  };

  const policy = evaluateNexoraPolicy({
    quotePackId,
    customerFacing: true,
    bindingCommitment: input.bindingCommitment === true,
    quoteTotal: bundle.totals.total,
    purchaseOrder: false,
  });

  const approvalRequired =
    bundle.approvalRequired ||
    policy.approvalRequired ||
    input.approvalRequired === true;

  const internal = {
    quotePackId,
    marginAmount: bundle.totals.marginAmount,
    marginPercent: bundle.totals.marginPercent,
    costTotal: bundle.totals.costTotal,
    approvalRequired,
    approvalReasons: [
      bundle.totals.total >= 25000 ? "High-value quote." : null,
      bundle.totals.marginPercent < 22 ? "Low margin." : null,
      policy.approvalRequired ? "Policy triggered approval." : null,
    ].filter(Boolean),
  };

  const quotePack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_quote_pack",
    quotePackId,
    createdAt: now(),
    customer,
    bundle,
    internal,
    assumptions: [
      "Draft only until supplier confirmation.",
      "GST estimated at 10%.",
      "Delivery, installation, after-hours, site access, and electrical/building requirements may change final price.",
      "No binding customer quote until human commit.",
    ],
    customerFacingDraft: {
      title: `Draft office furniture quote for ${customer.companyName || customer.customerName || "customer"}`,
      subtotal: bundle.totals.subtotal,
      gst: bundle.totals.gst,
      total: bundle.totals.total,
      items: bundle.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unitSell: item.unitSell,
        lineSell: item.lineSell,
      })),
      notes: [
        "This is a draft quote and remains subject to confirmation.",
        "Supplier stock, lead time, delivery, and installation details must be confirmed.",
      ],
    },
    policy,
    safety: {
      draftOnly: true,
      noBindingCommitment: true,
      humanCommitRequired: true,
      approvalRequired,
    },
  };

  writeNexoraJson(nexoraLocalPath("quote-packs", "packs", `${quotePackId}.json`), quotePack);
  appendNexoraJsonl(QUOTE_PACK_LOG, { event: "quote_pack.created", quotePack, createdAt: now() });

  if (approvalRequired) {
    appendNexoraJsonl(APPROVAL_LOG, {
      event: "quote_pack.approval_required",
      quotePackId,
      internal,
      createdAt: now(),
    });
  }

  recordNexoraTimelineEvent({
    type: "quote_pack",
    title: `Quote pack created: ${quotePackId}`,
    severity: approvalRequired ? "warning" : "info",
    payload: { quotePackId, total: bundle.totals.total, approvalRequired },
  });

  recordNexoraMetric({
    name: "quote_pack_total",
    value: bundle.totals.total,
    unit: "aud",
    dimensions: {
      approvalRequired,
      marginPercent: bundle.totals.marginPercent,
    },
  });

  journal("quote_pack.created", quotePack);

  return { ok: true, nexoraBrain: true, quotePack };
}

export function createNexoraCustomerQuoteDraft(input: any = {}) {
  const pack = input.quotePack || createNexoraQuotePack(input).quotePack;
  const draftId = String(input.draftId || nexoraLocalId("customer_quote_draft"));

  const draft = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_customer_quote_draft",
    draftId,
    quotePackId: pack.quotePackId,
    createdAt: now(),
    subject: `Draft quote from The Corporate Desk${pack.customer?.companyName ? ` for ${pack.customer.companyName}` : ""}`,
    body: [
      `Hi ${pack.customer?.customerName || "there"},`,
      "",
      "Thanks for your enquiry. Please find below a draft summary for your office furniture requirement.",
      "",
      `Subtotal: $${pack.bundle.totals.subtotal.toFixed(2)}`,
      `GST: $${pack.bundle.totals.gst.toFixed(2)}`,
      `Draft Total: $${pack.bundle.totals.total.toFixed(2)}`,
      "",
      "Included items:",
      ...pack.customerFacingDraft.items.map((item: any) => `- ${item.quantity} x ${item.name}: $${item.lineSell.toFixed(2)}`),
      "",
      "Important notes:",
      "- This is a draft only and subject to supplier confirmation.",
      "- Delivery, install, access, and timing requirements may affect final pricing.",
      "- The Corporate Desk will confirm assumptions before final quote release.",
      "",
      "Regards,",
      "The Corporate Desk",
    ].join("\n"),
    approvalRequired: pack.safety.approvalRequired,
    status: pack.safety.approvalRequired ? "requires_human_approval" : "draft_ready",
    safety: {
      draftOnly: true,
      notSent: true,
      humanReviewBeforeSend: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("quote-packs", "customer-drafts", `${draftId}.json`), draft);
  appendNexoraJsonl(CUSTOMER_DRAFT_LOG, { event: "customer_draft.created", draft, createdAt: now() });
  journal("customer_draft.created", draft);

  return { ok: true, nexoraBrain: true, draft };
}

export function listNexoraQuotePacks(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(QUOTE_PACK_LOG)
    .filter((row: any) => row.event === "quote_pack.created")
    .map((row: any) => row.quotePack)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function listNexoraQuotePackApprovals(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(APPROVAL_LOG).slice(-limit).reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getNexoraQuotePackStatus() {
  const packs = listNexoraQuotePacks({ limit: 1000 });
  const approvals = listNexoraQuotePackApprovals({ limit: 1000 });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_quote_pack_generator",
    generatedAt: now(),
    quotePacks: packs.count,
    approvalsRequired: approvals.count,
    safety: {
      draftOnly: true,
      noBindingQuote: true,
      humanCommitRequired: true,
    },
  };
}

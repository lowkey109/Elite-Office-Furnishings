import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { createNexoraLocalApproval } from "../localapprovals/nexoraLocalApprovalGate";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const QUOTE_LOG = nexoraLocalPath("quotes", "quote-log.jsonl");

function quoteFile(id: string) {
  return nexoraLocalPath("quotes", `${id}.json`);
}

function num(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function createNexoraLocalQuote(input: any = {}) {
  const quoteId = String(input.quoteId || nexoraLocalId("quote"));
  const subtotal = num(input.subtotal ?? input.budget, 10000);
  const estimatedCost = num(input.estimatedCost, subtotal * 0.62);
  const gst = Math.round(subtotal * 0.1 * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;
  const marginAmount = Math.round((subtotal - estimatedCost) * 100) / 100;
  const marginPercent = subtotal > 0 ? Math.round((marginAmount / subtotal) * 10000) / 100 : 0;
  const approvalRequired = total >= 25000 || marginPercent < 22 || Boolean(input.bindingCommitment);

  const quote = {
    ok: true,
    nexoraBrain: true,
    quoteId,
    leadId: input.leadId || null,
    customerName: String(input.customerName || "Unknown customer"),
    companyName: String(input.companyName || "Unknown company"),
    subtotal,
    estimatedCost,
    gst,
    total,
    marginAmount,
    marginPercent,
    status: approvalRequired ? "approval_required" : "draft",
    approvalRequired,
    lineItems: Array.isArray(input.lineItems) ? input.lineItems : [],
    assumptions: [
      "Draft only until supplier confirmation.",
      "No binding customer commitment unless approved.",
      "Delivery/install/access constraints may affect final price.",
    ],
    createdAt: now(),
    updatedAt: now(),
  };

  writeNexoraJson(quoteFile(quoteId), quote);
  appendNexoraJsonl(QUOTE_LOG, {
    event: "quote.created",
    quote,
    createdAt: now(),
  });

  let approval = null;
  if (approvalRequired) {
    approval = createNexoraLocalApproval({
      reason: `Quote ${quoteId} requires approval.`,
      risk: "high",
      payload: quote,
    });
  }

  recordNexoraMetric({
    name: "local_quote_created",
    value: 1,
    unit: "quote",
    dimensions: {
      approvalRequired,
      companyName: quote.companyName,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    quote,
    approval,
  };
}

export function getNexoraLocalQuote(input: any = {}) {
  const quoteId = String(input.quoteId || "");
  const quote = readNexoraJson(quoteFile(quoteId), null);

  return {
    ok: Boolean(quote),
    nexoraBrain: true,
    quoteId,
    quote,
  };
}

export function listNexoraLocalQuotes(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(QUOTE_LOG)
    .filter((row: any) => row.event === "quote.created")
    .map((row: any) => row.quote)
    .filter((quote: any) => !status || quote.status === status)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraLocalQuoteBookStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_quote_book",
    totalQuotes: listNexoraLocalQuotes({ limit: 1000 }).count,
    approvalRequired: listNexoraLocalQuotes({ status: "approval_required", limit: 1000 }).count,
  };
}

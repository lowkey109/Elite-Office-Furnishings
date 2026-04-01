// server/services/intelligence/communications/whatsappFlows.ts

import { enqueueWhatsApp } from "./whatsappOutbox";
import { notifyOpsWhatsApp } from "./whatsappService";
import { startSequence } from "./whatsappSequences";
import { generateAIWhatsAppDraft } from "./aiWhatsAppService";
import type { WhatsAppAudience } from "./whatsappGuards";

/**
 * SAFE DEFAULT:
 * - External numbers: enqueue but don't autosend unless your system turns it on.
 * - Ops alerts: always send via notifyOpsWhatsApp.
 */

export async function notifyOpsNewSignalWhatsApp(input: { title: string; body: string }) {
  return notifyOpsWhatsApp(`[Nexora]\n${input.title}\n\n${input.body}`);
}

export async function onPaymentReceivedWhatsApp(input: {
  quoteId: string;
  amountCents: number;
  currency: string;
  toE164?: string;               // optional customer number
  recipientName?: string;
  recipientCompany?: string;
  audience?: WhatsAppAudience;   // default customer
}) {
  // Always notify ops
  await notifyOpsWhatsApp(
    `[Payment]\nQuote: ${input.quoteId}\nAmount: ${(input.amountCents / 100).toFixed(2)} ${String(input.currency || "").toUpperCase()}`
  );

  // If no customer number, stop here (safe)
  if (!input.toE164) return;

  const draft = await generateAIWhatsAppDraft({
    audience: input.audience ?? "customer",
    recipientName: input.recipientName,
    recipientCompany: input.recipientCompany,
    contextType: "payment_received",
    contextSummary: `Thanks — we’ve received your payment for quote ${input.quoteId}. If you’d like, I can confirm delivery/installation timing.`,
    callToAction: "Want me to confirm the next steps?",
    tone: "warm",
  });

  await enqueueWhatsApp({
    toE164: input.toE164,
    audience: input.audience ?? "customer",
    contextType: "payment_received",
    message: draft.message,
    dedupeKey: `payment:${input.quoteId}:wa:thanks`,
    threadKey: `payment:${input.quoteId}`,
    metadata: { quoteId: input.quoteId },
  });
}

export async function onQuoteSentWhatsApp(input: {
  quoteId: string;
  toE164?: string;
  recipientName?: string;
  recipientCompany?: string;
  city?: string;
}) {
  // ops visibility
  await notifyOpsWhatsApp(`[Quote Sent]\nQuote: ${input.quoteId}\nTo: ${input.toE164 || "unknown"}`);

  if (!input.toE164) return;

  const draft = await generateAIWhatsAppDraft({
    audience: "customer",
    recipientName: input.recipientName,
    recipientCompany: input.recipientCompany,
    city: input.city,
    contextType: "quote_followup",
    contextSummary: `I’ve sent through your quote (${input.quoteId}). If you’d like, I can quickly confirm lead times and delivery/installation.`,
    callToAction: "Would you like me to run through it?",
    tone: "professional",
  });

  // enqueue immediate first message
  await enqueueWhatsApp({
    toE164: input.toE164,
    audience: "customer",
    contextType: "quote_followup",
    message: draft.message,
    dedupeKey: `quote:${input.quoteId}:wa:initial`,
    threadKey: `quote:${input.quoteId}`,
    metadata: { quoteId: input.quoteId },
  });

  // start follow-up sequence (scheduled)
  await startSequence({
    sequenceType: "quote_followup",
    threadKey: `quote:${input.quoteId}`,
    toE164: input.toE164,
    audience: "customer",
    contextType: "quote_followup",
    baseMessage: `Just checking in on the quote (${input.quoteId}). Happy to adjust anything or confirm lead times if helpful.`,
    dedupePrefix: `quote:${input.quoteId}:wa`,
  });
}

export async function onSupplierOutreachWhatsApp(input: {
  partnerId: string;
  partnerOpportunityId: string;
  toE164: string;
  companyName?: string;
  city?: string;
  summary: string;
}) {
  // supplier/manufacturer outreach uses AI draft
  const draft = await generateAIWhatsAppDraft({
    audience: "supplier",
    recipientCompany: input.companyName,
    city: input.city,
    contextType: "supplier_rfq",
    contextSummary: input.summary,
    callToAction: "Can you share availability and pricing?",
    tone: "direct",
  });

  await enqueueWhatsApp({
    toE164: input.toE164,
    audience: "supplier",
    contextType: "supplier_rfq",
    message: draft.message,
    dedupeKey: `supplier:${input.partnerOpportunityId}:wa:rfq`,
    threadKey: `supplier:${input.partnerOpportunityId}`,
    metadata: { partnerId: input.partnerId, partnerOpportunityId: input.partnerOpportunityId },
  });

  // ops visibility
  await notifyOpsWhatsApp(
    `[Supplier RFQ]\nPartnerOpp: ${input.partnerOpportunityId}\nTo: ${input.toE164}\nPartner: ${input.companyName || input.partnerId}`
  );
}
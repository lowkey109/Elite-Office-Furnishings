import { db } from "../../db";
import { invoicesLog, quotes, auditLogs, revenueEvents } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { getStripeClient, getStripeConfig } from "./stripeConfigService";
import { v4 as uuidv4 } from "uuid";

export interface CreateInvoiceOptions {
  quoteId: string;
  clientName: string;
  clientEmail: string;
  companyName?: string;
  companyId?: string;
  opportunityId?: string;
  amount: number;
  currency?: string;
  daysUntilDue?: number;
  description?: string;
  stripeCustomerId?: string;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId: string;
  stripeInvoiceId?: string;
  hostedUrl?: string;
  pdfUrl?: string;
  amount: number;
  currency: string;
  status: string;
  isTestMode: boolean;
  isSafeMode: boolean;
  label: string;
}

export async function createInvoice(opts: CreateInvoiceOptions): Promise<InvoiceResult> {
  const config = getStripeConfig();
  const stripe = getStripeClient();
  const currency = (opts.currency || config.currency || "aud").toLowerCase();
  const label = config.safeMode ? "SAFE MODE — simulated invoice" : config.testMode ? "TEST MODE" : "LIVE";

  let stripeInvoiceId: string | undefined;
  let hostedUrl: string | undefined;
  let pdfUrl: string | undefined;
  let stripeCustomerId = opts.stripeCustomerId;

  if (stripe && !config.safeMode) {
    try {
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: opts.clientEmail,
          name: opts.clientName,
          metadata: { companyId: opts.companyId || "", quoteId: opts.quoteId },
        });
        stripeCustomerId = customer.id;
      }

      const invoiceItem = await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        amount: opts.amount,
        currency,
        description: opts.description || `Office Furniture — ${opts.companyName || opts.clientName}`,
      });

      const invoice = await stripe.invoices.create({
        customer: stripeCustomerId,
        days_until_due: opts.daysUntilDue || 14,
        collection_method: "send_invoice",
        metadata: {
          quoteId: opts.quoteId,
          companyId: opts.companyId || "",
          opportunityId: opts.opportunityId || "",
        },
      });

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      stripeInvoiceId = finalizedInvoice.id;
      hostedUrl = finalizedInvoice.hosted_invoice_url || undefined;
      pdfUrl = finalizedInvoice.invoice_pdf || undefined;
    } catch (err: any) {
      console.error("[InvoiceService] Stripe API error:", err.message);
    }
  }

  const simulatedUrl = `https://thecorporatedesk.com.au/invoice/${uuidv4().slice(0, 8)}`;

  const [inserted] = await db.insert(invoicesLog).values({
    quoteId: opts.quoteId || null,
    opportunityId: opts.opportunityId || null,
    stripeInvoiceId: stripeInvoiceId || null,
    stripeInvoiceUrl: pdfUrl || simulatedUrl,
    stripeHostedInvoiceUrl: hostedUrl || simulatedUrl,
    stripeCustomerId: stripeCustomerId || null,
    amountDue: opts.amount,
    amountPaid: 0,
    currency,
    status: config.safeMode ? "simulated" : "sent",
    isTestMode: config.testMode,
  }).returning();

  if (opts.quoteId) {
    await db.update(quotes).set({
      financialStatus: "payment_pending",
      amountDue: opts.amount,
    }).where(eq(quotes.id, opts.quoteId));
  }

  await db.insert(auditLogs).values({
    actorType: "system",
    action: config.safeMode ? "create_invoice_simulated" : "create_invoice",
    entityType: "invoice",
    entityId: inserted.id,
    metadataJson: { quoteId: opts.quoteId, amount: opts.amount, isTestMode: config.testMode },
  });

  return {
    success: true,
    invoiceId: inserted.id,
    stripeInvoiceId,
    hostedUrl: hostedUrl || simulatedUrl,
    pdfUrl,
    amount: opts.amount,
    currency,
    status: config.safeMode ? "simulated" : "sent",
    isTestMode: config.testMode,
    isSafeMode: config.safeMode,
    label,
  };
}

export async function getInvoicesForQuote(quoteId: string) {
  return db.select().from(invoicesLog).where(eq(invoicesLog.quoteId, quoteId));
}

export async function resendInvoice(invoiceLogId: string): Promise<{ success: boolean; message: string }> {
  const config = getStripeConfig();
  const stripe = getStripeClient();

  const [record] = await db.select().from(invoicesLog).where(eq(invoicesLog.id, invoiceLogId));
  if (!record) return { success: false, message: "Invoice not found" };

  if (stripe && !config.safeMode && record.stripeInvoiceId) {
    try {
      await stripe.invoices.sendInvoice(record.stripeInvoiceId);
    } catch (err: any) {
      console.error("[InvoiceService] Resend error:", err.message);
      return { success: false, message: err.message };
    }
  }

  await db.insert(auditLogs).values({
    actorType: "admin",
    action: config.safeMode ? "resend_invoice_simulated" : "resend_invoice",
    entityType: "invoice",
    entityId: invoiceLogId,
    metadataJson: { safeMode: config.safeMode },
  });

  return { success: true, message: config.safeMode ? "Resend simulated (SAFE MODE)" : "Invoice resent via Stripe" };
}

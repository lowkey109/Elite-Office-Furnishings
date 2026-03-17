import { db } from "../../db";
import { paymentLinks, paymentCustomers, quotes, revenueEvents, auditLogs } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { getStripeClient, getStripeConfig } from "./stripeConfigService";
import { v4 as uuidv4 } from "uuid";

export interface CreatePaymentLinkOptions {
  quoteId: string;
  clientName: string;
  clientEmail: string;
  companyName?: string;
  companyId?: string;
  opportunityId?: string;
  amount: number;
  currency?: string;
  linkType?: "full" | "deposit";
  depositPercent?: number;
  description?: string;
}

export interface PaymentLinkResult {
  success: boolean;
  linkUrl: string;
  linkId: string;
  stripePaymentLinkId?: string;
  amount: number;
  currency: string;
  linkType: string;
  isTestMode: boolean;
  isSafeMode: boolean;
  label: string;
}

export async function createPaymentLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
  const config = getStripeConfig();
  const stripe = getStripeClient();

  const currency = (opts.currency || config.currency || "aud").toLowerCase();
  let finalAmount = opts.amount;
  let linkType = opts.linkType || "full";

  if (linkType === "deposit") {
    const pct = opts.depositPercent || 30;
    finalAmount = Math.round(opts.amount * (pct / 100));
  }

  const label = config.safeMode
    ? "SAFE MODE — simulated payment link"
    : config.testMode
    ? "TEST MODE"
    : "LIVE";

  let stripePaymentLinkId: string | undefined;
  let linkUrl = `https://thecorporatedesk.com.au/pay?ref=${uuidv4().slice(0, 8)}&mode=${config.safeMode ? "safe" : config.testMode ? "test" : "live"}`;

  if (stripe && !config.safeMode) {
    try {
      const product = await stripe.products.create({
        name: opts.description || `Office Furniture Quote — ${opts.companyName || opts.clientName}`,
        metadata: { quoteId: opts.quoteId || "", companyId: opts.companyId || "" },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: finalAmount,
        currency,
      });

      const stripeLink = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: {
          quoteId: opts.quoteId || "",
          companyId: opts.companyId || "",
          opportunityId: opts.opportunityId || "",
          linkType,
        },
        after_completion: {
          type: "redirect",
          redirect: { url: "https://thecorporatedesk.com.au/payment-success" },
        },
      });

      stripePaymentLinkId = stripeLink.id;
      linkUrl = stripeLink.url;
    } catch (err: any) {
      console.error("[PaymentLinkService] Stripe API error:", err.message);
    }
  }

  const [existing] = await db
    .select()
    .from(paymentLinks)
    .where(and(eq(paymentLinks.quoteId, opts.quoteId || ""), eq(paymentLinks.status, "active")));

  if (existing) {
    await db.update(paymentLinks).set({ status: "superseded", supersededAt: new Date() }).where(eq(paymentLinks.id, existing.id));
  }

  const [inserted] = await db.insert(paymentLinks).values({
    quoteId: opts.quoteId || null,
    opportunityId: opts.opportunityId || null,
    companyId: opts.companyId || null,
    stripePaymentLinkId: stripePaymentLinkId || null,
    amount: finalAmount,
    currency,
    linkUrl,
    linkType,
    status: "active",
    isTestMode: config.testMode,
    isSafeMode: config.safeMode,
  }).returning();

  if (opts.quoteId) {
    await db.update(quotes).set({
      paymentLinkUrl: linkUrl,
      paymentLinkStatus: "active",
      stripePaymentLinkId: stripePaymentLinkId || null,
      financialStatus: "payment_pending",
      amountDue: finalAmount,
    }).where(eq(quotes.id, opts.quoteId));
  }

  await db.insert(auditLogs).values({
    actorType: "system",
    action: config.safeMode ? "create_payment_link_simulated" : "create_payment_link",
    entityType: "payment_link",
    entityId: inserted.id,
    metadataJson: JSON.stringify({ quoteId: opts.quoteId, amount: finalAmount, linkType, isTestMode: config.testMode }),
  });

  return {
    success: true,
    linkUrl,
    linkId: inserted.id,
    stripePaymentLinkId,
    amount: finalAmount,
    currency,
    linkType,
    isTestMode: config.testMode,
    isSafeMode: config.safeMode,
    label,
  };
}

export async function getPaymentLinksForQuote(quoteId: string) {
  return db.select().from(paymentLinks).where(eq(paymentLinks.quoteId, quoteId));
}

export async function markLinkStale(linkId: string) {
  await db.update(paymentLinks).set({ status: "superseded", supersededAt: new Date() }).where(eq(paymentLinks.id, linkId));
  await db.insert(auditLogs).values({
    actorType: "admin",
    action: "mark_link_superseded",
    entityType: "payment_link",
    entityId: linkId,
    metadataJson: JSON.stringify({ reason: "manual" }),
  });
}

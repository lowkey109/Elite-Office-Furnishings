import { db } from "../../db";
import { revenueEvents, paymentLinks, invoicesLog, quotes, webhookEvents } from "../../../shared/schema";
import { eq, gte, lte, and, sql, desc } from "drizzle-orm";
import { getStripeConfig } from "./stripeConfigService";

export interface RevenueStats {
  revenueToday: number;
  revenueThisWeek: number;
  depositsReceived: number;
  fullPaymentsReceived: number;
  outstandingInvoices: number;
  expiredLinks: number;
  quotesAwaitingPayment: number;
  topPayingAccounts: Array<{ companyId: string; total: number }>;
  safeMode: boolean;
  testMode: boolean;
  stripeEnabled: boolean;
  webhookHealthy: boolean;
  lastWebhookAt: Date | null;
}

export async function getRevenueStats(): Promise<RevenueStats> {
  const config = getStripeConfig();
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayEvents = await db.select().from(revenueEvents)
    .where(gte(revenueEvents.occurredAt, todayStart));

  const weekEvents = await db.select().from(revenueEvents)
    .where(gte(revenueEvents.occurredAt, weekStart));

  const revenueToday = todayEvents.reduce((sum, e) => sum + (e.amount || 0), 0);
  const revenueThisWeek = weekEvents.reduce((sum, e) => sum + (e.amount || 0), 0);
  const depositsReceived = weekEvents.filter(e => e.eventType === "deposit_paid").length;
  const fullPaymentsReceived = weekEvents.filter(e => e.eventType === "full_payment_received").length;

  const outstandingInvoiceRecords = await db.select().from(invoicesLog)
    .where(and(eq(invoicesLog.status, "sent")));
  const outstandingInvoices = outstandingInvoiceRecords.reduce((sum, i) => sum + ((i.amountDue || 0) - (i.amountPaid || 0)), 0);

  const expiredLinkRecords = await db.select().from(paymentLinks)
    .where(eq(paymentLinks.status, "expired"));
  const expiredLinks = expiredLinkRecords.length;

  const awaitingPaymentQuotes = await db.select().from(quotes)
    .where(eq(quotes.financialStatus, "payment_pending"));
  const quotesAwaitingPayment = awaitingPaymentQuotes.length;

  const recentWebhook = await db.select().from(webhookEvents)
    .where(eq(webhookEvents.processed, true))
    .orderBy(desc(webhookEvents.processedAt))
    .limit(1);

  const lastWebhookAt = recentWebhook[0]?.processedAt || null;
  const webhookHealthy = !!lastWebhookAt && (Date.now() - lastWebhookAt.getTime()) < 24 * 60 * 60 * 1000;

  return {
    revenueToday,
    revenueThisWeek,
    depositsReceived,
    fullPaymentsReceived,
    outstandingInvoices,
    expiredLinks,
    quotesAwaitingPayment,
    topPayingAccounts: [],
    safeMode: config.safeMode,
    testMode: config.testMode,
    stripeEnabled: config.enabled,
    webhookHealthy,
    lastWebhookAt,
  };
}

export async function getRevenueThisWeek(): Promise<number> {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const events = await db.select().from(revenueEvents).where(gte(revenueEvents.occurredAt, weekStart));
  return events.reduce((sum, e) => sum + (e.amount || 0), 0);
}

export async function getOutstandingInvoices() {
  return db.select().from(invoicesLog).where(eq(invoicesLog.status, "sent"));
}

export async function getQuotesAwaitingPayment() {
  return db.select().from(quotes).where(eq(quotes.financialStatus, "payment_pending"));
}

export async function getDepositPaidDeals() {
  return db.select().from(quotes).where(eq(quotes.financialStatus, "deposit_paid"));
}

export async function getExpiredPaymentLinks() {
  return db.select().from(paymentLinks).where(eq(paymentLinks.status, "expired"));
}

export async function getPaymentStatusForOpportunity(opportunityId: string) {
  const links = await db.select().from(paymentLinks).where(eq(paymentLinks.opportunityId, opportunityId));
  const invoices = await db.select().from(invoicesLog).where(eq(invoicesLog.opportunityId, opportunityId));
  const revenue = await db.select().from(revenueEvents).where(eq(revenueEvents.opportunityId, opportunityId));
  return { links, invoices, revenue };
}

export async function recordRevenueEvent(opts: {
  quoteId?: string;
  opportunityId?: string;
  companyId?: string;
  eventType: string;
  amount: number;
  currency?: string;
  isSimulated?: boolean;
}) {
  const [record] = await db.insert(revenueEvents).values({
    quoteId: opts.quoteId || null,
    opportunityId: opts.opportunityId || null,
    companyId: opts.companyId || null,
    paymentSource: "stripe",
    eventType: opts.eventType,
    amount: opts.amount,
    currency: (opts.currency || "aud").toLowerCase(),
    status: "recorded",
    isSimulated: opts.isSimulated || false,
    occurredAt: new Date(),
  }).returning();
  return record;
}

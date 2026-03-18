/**
 * Finance AI — ACTIVE EXECUTION
 *
 * Real work:
 *  1. Compute real revenue from accepted/paid quotes (sum totalIncGst)
 *  2. Compute gross profit and average margin from profit_records
 *  3. Compute real revenue from revenue_events (non-simulated only)
 *  4. Flag quotes past validity date → update status to expired
 *  5. Compute outstanding commission value
 *
 * Returns computed figures with full before/after state.
 * Never uses static fallback values.
 */

import { db } from "../../../db";
import { quotes, profitRecords, revenueEvents, commissions, proposals } from "../../../../shared/schema";
import { desc, eq, count, sql, and, inArray } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runFinanceAI(): Promise<DepartmentResult> {
  const start = Date.now();
  const actions: string[] = [];
  const blockers: string[] = [];
  const recordsUpdated: string[] = [];

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // ── Before state ──────────────────────────────────────────────────────────────
  const [beforeExpiredQuotes] = await db.select({ n: count() }).from(quotes)
    .where(eq(quotes.status, "expired"));
  const before = {
    expiredQuotes: beforeExpiredQuotes.n,
  };

  // ── Action 1: Compute real revenue from quotes ─────────────────────────────────
  const acceptedQuotes = await db.select({
    id: quotes.id,
    companyName: quotes.companyName,
    totalIncGst: quotes.totalIncGst,
    total: quotes.total,
    status: quotes.status,
    sentAt: quotes.sentAt,
  }).from(quotes)
    .where(sql`${quotes.status} IN ('accepted', 'paid', 'Accepted', 'Paid')`)
    .limit(200);

  const quoteRevenue = acceptedQuotes.reduce((sum, q) => sum + (q.totalIncGst ?? q.total ?? 0), 0);
  const sentQuotes = await db.select().from(quotes)
    .where(sql`${quotes.status} IN ('sent', 'Sent', 'draft', 'Draft')`)
    .limit(200);

  if (acceptedQuotes.length > 0) {
    actions.push(`${acceptedQuotes.length} accepted quotes — revenue: $${Math.round(quoteRevenue / 100).toLocaleString("en-AU")} AUD`);
  }

  // ── Action 2: Compute from profit_records ────────────────────────────────────
  const profitData = await db.select({
    id: profitRecords.id,
    quotedPrice: profitRecords.quotedPrice,
    estimatedProfit: profitRecords.estimatedProfit,
    estimatedMarginPercent: profitRecords.estimatedMarginPercent,
    conversionResult: profitRecords.conversionResult,
  }).from(profitRecords).limit(300);

  const convertedRecords = profitData.filter(r => r.conversionResult === "converted" || r.conversionResult === "won");
  const pendingRecords = profitData.filter(r => r.conversionResult === "pending");
  const totalProfitRevenue = convertedRecords.reduce((s, r) => s + (r.quotedPrice ?? 0), 0);
  const totalProfit = convertedRecords.reduce((s, r) => s + (r.estimatedProfit ?? 0), 0);
  const avgMargin = convertedRecords.length > 0
    ? Math.round(convertedRecords.reduce((s, r) => s + (r.estimatedMarginPercent ?? 0), 0) / convertedRecords.length)
    : 0;
  const pendingPipelineValue = pendingRecords.reduce((s, r) => s + (r.quotedPrice ?? 0), 0);

  if (convertedRecords.length > 0) {
    actions.push(`${convertedRecords.length} profit records: revenue $${totalProfitRevenue.toLocaleString("en-AU")}, profit $${totalProfit.toLocaleString("en-AU")} (avg ${avgMargin}% margin)`);
  }
  if (pendingRecords.length > 0) {
    actions.push(`${pendingRecords.length} pending profit records — pipeline value: $${pendingPipelineValue.toLocaleString("en-AU")}`);
  }

  // ── Action 3: Real revenue events (non-simulated) ─────────────────────────────
  const realRevEvents = await db.select().from(revenueEvents)
    .where(and(
      eq(revenueEvents.isSimulated, false),
      sql`${revenueEvents.createdAt} >= ${since30d.toISOString()}`,
    )).limit(100);

  const realEventRevenue = realRevEvents.reduce((s, e) => s + (e.amount ?? 0), 0);
  if (realRevEvents.length > 0) {
    actions.push(`${realRevEvents.length} real revenue events in last 30 days — $${Math.round(realEventRevenue / 100).toLocaleString("en-AU")}`);
  }

  // ── Action 4: Flag expired quotes ─────────────────────────────────────────────
  const now = new Date();
  const expiryCandidates = sentQuotes.filter(q => {
    if (!q.validityDays || !q.createdAt) return false;
    const expiresAt = new Date(new Date(q.createdAt).getTime() + q.validityDays * 24 * 60 * 60 * 1000);
    return expiresAt < now;
  });

  let expired = 0;
  for (const q of expiryCandidates.slice(0, 20)) {
    try {
      await db.update(quotes).set({
        status: "expired",
        pipelineStage: "expired",
        updatedAt: new Date(),
      }).where(eq(quotes.id, q.id));
      recordsUpdated.push(`quotes#${q.id} (${q.companyName ?? "unknown"}): status ${q.status} → expired [validity exceeded]`);
      expired++;
    } catch {}
  }
  if (expired > 0) {
    actions.push(`${expired} quotes marked expired (validity window passed)`);
  }

  // ── Action 5: Commission summary ──────────────────────────────────────────────
  const allCommissions = await db.select().from(commissions).limit(200);
  const pendingComm = allCommissions.filter(c => c.status === "pending" || c.status === "due");
  const paidComm = allCommissions.filter(c => c.status === "paid");
  const pendingCommValue = pendingComm.reduce((s, c) => s + (c.commissionAmount ?? 0), 0);

  if (pendingComm.length > 0) {
    blockers.push(`${pendingComm.length} commissions pending payment — value: $${pendingCommValue.toLocaleString("en-AU")}`);
  }

  // ── Active proposals ───────────────────────────────────────────────────────────
  const activeProposals = await db.select({
    id: proposals.id,
    totalValue: proposals.totalValue,
    status: proposals.status,
  }).from(proposals)
    .where(sql`${proposals.status} IN ('sent', 'approved', 'draft')`)
    .limit(50);

  const proposalValue = activeProposals.reduce((s, p) => s + (p.totalValue ?? 0), 0);

  if (acceptedQuotes.length === 0 && convertedRecords.length === 0 && realRevEvents.length === 0) {
    blockers.push("No revenue records found — Stripe webhooks or manual conversions not yet recorded");
  }

  const after = {
    expiredQuotes: beforeExpiredQuotes.n + expired,
    expiredThisCycle: expired,
  };

  const totalRevenue = quoteRevenue + totalProfitRevenue;
  const status = totalRevenue > 0 || expired > 0 ? "completed"
    : blockers.length > 0 ? "partial"
    : "completed";

  return {
    department: "Finance",
    status,
    actionsTaken: actions.length > 0 ? actions : ["No revenue events to process — tables are empty"],
    blockers,
    recordsUpdated,
    before,
    after,
    executionMs: Date.now() - start,
    metrics: {
      acceptedQuotes: acceptedQuotes.length,
      quoteRevenueCents: quoteRevenue,
      quoteRevenueAud: Math.round(quoteRevenue / 100),
      convertedProfitRecords: convertedRecords.length,
      profitRevenueAud: totalProfitRevenue,
      grossProfitAud: totalProfit,
      avgMarginPct: avgMargin,
      pendingPipelineAud: pendingPipelineValue,
      realEvents30d: realRevEvents.length,
      realEventRevenueAud: Math.round(realEventRevenue / 100),
      expiredQuotes: expired,
      pendingCommissions: pendingComm.length,
      pendingCommissionValueAud: pendingCommValue,
      paidCommissions: paidComm.length,
      activeProposals: activeProposals.length,
      proposalValueAud: Math.round(proposalValue / 100),
    },
    recommendations: [
      totalRevenue === 0 ? "No revenue yet — focus on converting pipeline deals to quotes" : `Total revenue $${Math.round(totalRevenue / 100).toLocaleString("en-AU")} — track against target`,
      expired > 0 ? `${expired} quotes expired — re-issue with updated pricing to recover` : "Quote expiry is managed",
      pendingComm.length > 0 ? `Process $${pendingCommValue.toLocaleString("en-AU")} in outstanding commissions` : "Commissions are current",
    ],
  };
}

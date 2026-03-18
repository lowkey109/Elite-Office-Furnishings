import { db } from "../../../db";
import { quotes, profitRecords, revenueEvents, commissions, proposals } from "../../../../shared/schema";
import { desc } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runFinanceAI(): Promise<DepartmentResult> {
  const actions: string[] = [];
  const blockers: string[] = [];

  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [allQuotes, profitRecs, revEvents, allCommissions, allProposals] = await Promise.all([
      db.select().from(quotes).orderBy(desc(quotes.createdAt)).limit(300),
      db.select().from(profitRecords).orderBy(desc(profitRecords.createdAt)).limit(200),
      db.select().from(revenueEvents).orderBy(desc(revenueEvents.createdAt)).limit(200),
      db.select().from(commissions).orderBy(desc(commissions.createdAt)).limit(200),
      db.select().from(proposals).orderBy(desc(proposals.createdAt)).limit(100),
    ]);

    const acceptedQuotes = allQuotes.filter(q => q.status === "accepted");
    const sentQuotes = allQuotes.filter(q => q.status === "sent");
    const overdueQuotes = allQuotes.filter(q => {
      if (!q.validUntil || q.status !== "sent") return false;
      return new Date(q.validUntil) < new Date();
    });
    const recentRevEvents = revEvents.filter(e => new Date(e.createdAt ?? 0) >= since30d);
    const pendingCommissions = allCommissions.filter(c => c.status === "pending" || c.status === "due");
    const paidCommissions = allCommissions.filter(c => c.status === "paid");

    const totalRevenue = profitRecs.reduce((sum, r) => sum + (r.revenueAud ?? 0), 0);
    const totalProfit = profitRecs.reduce((sum, r) => sum + (r.grossProfitAud ?? 0), 0);
    const avgMargin = profitRecs.length > 0
      ? Math.round(profitRecs.reduce((sum, r) => sum + (r.marginPct ?? 0), 0) / profitRecs.length)
      : 0;

    const pendingCommissionValue = pendingCommissions.reduce((sum, c) => sum + (c.commissionAud ?? 0), 0);
    const paidCommissionValue = paidCommissions.reduce((sum, c) => sum + (c.commissionAud ?? 0), 0);

    const sentProposals = allProposals.filter(p => p.status === "sent" || p.status === "approved");
    const totalProposalValue = sentProposals.reduce((sum, p) => sum + (p.totalValue ?? 0), 0);

    if (totalRevenue > 0) actions.push(`Total recorded revenue: $${Math.round(totalRevenue).toLocaleString("en-AU")}`);
    if (totalProfit > 0) actions.push(`Total gross profit: $${Math.round(totalProfit).toLocaleString("en-AU")} (avg margin ${avgMargin}%)`);
    if (acceptedQuotes.length > 0) actions.push(`${acceptedQuotes.length} quotes accepted`);
    if (recentRevEvents.length > 0) actions.push(`${recentRevEvents.length} revenue events in last 30 days`);
    if (paidCommissions.length > 0) actions.push(`${paidCommissions.length} commissions paid ($${Math.round(paidCommissionValue).toLocaleString("en-AU")})`);
    if (sentProposals.length > 0) actions.push(`${sentProposals.length} proposals active ($${Math.round(totalProposalValue / 100).toLocaleString("en-AU")} total value)`);

    if (overdueQuotes.length > 0) blockers.push(`${overdueQuotes.length} quotes have expired — re-issue or close`);
    if (pendingCommissions.length > 0) blockers.push(`${pendingCommissions.length} commissions pending payment ($${Math.round(pendingCommissionValue).toLocaleString("en-AU")})`);
    if (sentQuotes.length > 5) blockers.push(`${sentQuotes.length} quotes awaiting response — chase outstanding approvals`);
    if (totalRevenue === 0 && profitRecs.length === 0) blockers.push("No revenue records found — check profit record system");

    return {
      department: "Finance",
      status: blockers.length === 0 ? "completed" : "partial",
      actionsTaken: actions,
      blockers,
      metrics: {
        totalRevenueAud: Math.round(totalRevenue),
        totalProfitAud: Math.round(totalProfit),
        avgMarginPct: avgMargin,
        acceptedQuotes: acceptedQuotes.length,
        sentQuotes: sentQuotes.length,
        overdueQuotes: overdueQuotes.length,
        pendingCommissions: pendingCommissions.length,
        pendingCommissionValueAud: Math.round(pendingCommissionValue),
        paidCommissions: paidCommissions.length,
        revenueEvents30d: recentRevEvents.length,
        activeProposals: sentProposals.length,
        proposalValueAud: Math.round(totalProposalValue / 100),
      },
      recommendations: [
        overdueQuotes.length > 0 ? `Urgently re-issue ${overdueQuotes.length} expired quotes` : "Quote expiry is managed",
        pendingCommissions.length > 0 ? `Process ${pendingCommissions.length} outstanding commissions` : "Commission payments are current",
        avgMargin > 30 ? `Strong margin performance (${avgMargin}%)` : "Review pricing — margins below target",
      ],
    };
  } catch (err: any) {
    return {
      department: "Finance",
      status: "failed",
      actionsTaken: [],
      blockers: [`Finance AI error: ${err.message}`],
      metrics: {},
      recommendations: [],
    };
  }
}

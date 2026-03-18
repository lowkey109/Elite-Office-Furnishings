import { db } from "../../../db";
import { dealExecution, leads, quotes } from "../../../../shared/schema";
import { desc } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runSalesAI(): Promise<DepartmentResult> {
  const actions: string[] = [];
  const blockers: string[] = [];

  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [allDeals, allLeads, allQuotes] = await Promise.all([
      db.select().from(dealExecution).orderBy(desc(dealExecution.updatedAt)).limit(500),
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(500),
      db.select().from(quotes).orderBy(desc(quotes.createdAt)).limit(200),
    ]);

    const stageOrder = ["new", "contacted", "engaged", "meeting_booked", "proposal_sent", "negotiation", "won", "lost"];
    const byStage: Record<string, number> = {};
    stageOrder.forEach(s => { byStage[s] = 0; });
    allDeals.forEach(d => { byStage[d.stage ?? "new"] = (byStage[d.stage ?? "new"] ?? 0) + 1; });

    const activeDeals = allDeals.filter(d => !["won", "lost"].includes(d.stage ?? ""));
    const wonDeals = allDeals.filter(d => d.stage === "won");
    const staleDeals = allDeals.filter(d => {
      const updated = new Date(d.updatedAt ?? 0);
      return !["won", "lost"].includes(d.stage ?? "") && (Date.now() - updated.getTime()) > 14 * 24 * 60 * 60 * 1000;
    });

    const newLeads30d = allLeads.filter(l => new Date(l.createdAt ?? 0) >= since30d);
    const totalPipelineValue = activeDeals.reduce((sum, d) => sum + (d.dealValueEstimate ?? 0), 0);
    const wonRevenue = wonDeals.reduce((sum, d) => sum + (d.dealValueEstimate ?? 0), 0);

    const pendingQuotes = allQuotes.filter(q => q.status === "sent" || q.status === "draft");
    const acceptedQuotes = allQuotes.filter(q => q.status === "accepted");
    const quotesValue = allQuotes.reduce((sum, q) => {
      const total = q.lineItemsJson ? (() => { try { const items = JSON.parse(q.lineItemsJson ?? "[]"); return items.reduce((s: number, i: any) => s + ((i.qty ?? 1) * (i.unitPrice ?? 0)), 0); } catch { return 0; } })() : 0;
      return sum + total;
    }, 0);

    if (activeDeals.length > 0) actions.push(`${activeDeals.length} active deals in pipeline (value: $${Math.round(totalPipelineValue / 100).toLocaleString("en-AU")})`);
    if (wonDeals.length > 0) actions.push(`${wonDeals.length} deals won (revenue: $${Math.round(wonRevenue / 100).toLocaleString("en-AU")})`);
    if (newLeads30d.length > 0) actions.push(`${newLeads30d.length} new leads received in 30 days`);
    if (pendingQuotes.length > 0) actions.push(`${pendingQuotes.length} quotes pending response`);
    if (acceptedQuotes.length > 0) actions.push(`${acceptedQuotes.length} quotes accepted`);

    if (staleDeals.length > 0) blockers.push(`${staleDeals.length} deals stale >14 days — needs follow-up`);
    if (activeDeals.length === 0) blockers.push("No active deals — pipeline empty");
    if (allLeads.length === 0) blockers.push("No leads in system — check lead capture forms");

    return {
      department: "Sales",
      status: activeDeals.length > 0 ? "completed" : "partial",
      actionsTaken: actions,
      blockers,
      metrics: {
        totalDeals: allDeals.length,
        activeDeals: activeDeals.length,
        wonDeals: wonDeals.length,
        staleDeals: staleDeals.length,
        pipelineValueAud: Math.round(totalPipelineValue / 100),
        wonRevenueAud: Math.round(wonRevenue / 100),
        totalLeads: allLeads.length,
        newLeads30d: newLeads30d.length,
        pendingQuotes: pendingQuotes.length,
        acceptedQuotes: acceptedQuotes.length,
        newStage: byStage["new"] ?? 0,
        contactedStage: byStage["contacted"] ?? 0,
        engagedStage: byStage["engaged"] ?? 0,
        meetingBookedStage: byStage["meeting_booked"] ?? 0,
      },
      recommendations: [
        staleDeals.length > 0 ? `Prioritise re-engaging ${staleDeals.length} stale deals` : "Pipeline health is good",
        (byStage["meeting_booked"] ?? 0) > 0 ? `${byStage["meeting_booked"]} meetings booked — prepare proposals` : "Focus on booking more meetings",
        pendingQuotes.length > 3 ? "Multiple quotes outstanding — chase responses" : "Quote pipeline under control",
      ],
    };
  } catch (err: any) {
    return {
      department: "Sales",
      status: "failed",
      actionsTaken: [],
      blockers: [`Sales AI error: ${err.message}`],
      metrics: {},
      recommendations: [],
    };
  }
}

/**
 * Sales AI — ACTIVE EXECUTION
 *
 * Real work:
 *  1. Promote high-score ingestedLeads (score≥70, no dealExecutionId) → create deal_execution record
 *  2. Advance stale signal_detected deals → stage 'contacted', set nextAction
 *  3. Flag deals with opportunityScore≥80 as priority
 *
 * Returns full before/after state and every record ID touched.
 */

import { db } from "../../../db";
import { ingestedLeads, dealExecution, leads, quotes, alexActions } from "../../../../shared/schema";
import { desc, eq, sql, and, isNull, count } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

const MAX_PROMOTIONS = 10;  // cap per cycle
const MAX_ADVANCE = 10;

export async function runSalesAI(): Promise<DepartmentResult> {
  const start = Date.now();
  const actions: string[] = [];
  const blockers: string[] = [];
  const recordsUpdated: string[] = [];

  // ── Before state ──────────────────────────────────────────────────────────────
  const [beforeDeals] = await db.select({ n: count() }).from(dealExecution);
  const stagesBefore: Record<string, number> = {};
  const allDealsBefore = await db.select({
    stage: dealExecution.stage,
    id: dealExecution.id,
    companyName: dealExecution.companyName,
    opportunityScore: dealExecution.opportunityScore,
    updatedAt: dealExecution.updatedAt,
  }).from(dealExecution).limit(500);

  allDealsBefore.forEach(d => {
    stagesBefore[d.stage ?? "unknown"] = (stagesBefore[d.stage ?? "unknown"] ?? 0) + 1;
  });

  const before = {
    totalDeals: beforeDeals.n,
    signalDetectedDeals: stagesBefore["signal_detected"] ?? 0,
    contactedDeals: stagesBefore["contacted"] ?? 0,
  };

  // ── Action 1: Promote high-score ingestedLeads → deal_execution ───────────────
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const promotionCandidates = await db.select().from(ingestedLeads)
    .where(and(
      sql`${ingestedLeads.score} >= 70`,
      eq(ingestedLeads.status, "new"),
      isNull(ingestedLeads.dealExecutionId),
    ))
    .orderBy(desc(ingestedLeads.score))
    .limit(MAX_PROMOTIONS);

  let promoted = 0;
  for (const lead of promotionCandidates) {
    try {
      const dedupeKey = `lead_${lead.id}`;
      const existing = await db.select({ id: dealExecution.id })
        .from(dealExecution)
        .where(sql`lower(${dealExecution.companyName}) = lower(${lead.companyName})`)
        .limit(1);

      if (existing.length > 0) {
        // Link the lead to the existing deal instead of creating duplicate
        await db.update(ingestedLeads)
          .set({ dealExecutionId: existing[0].id, status: "qualified", updatedAt: new Date() })
          .where(eq(ingestedLeads.id, lead.id));
        recordsUpdated.push(`ingested_leads#${lead.id} (${lead.companyName}): status new → qualified [linked to existing deal]`);
        continue;
      }

      const [newDeal] = await db.insert(dealExecution).values({
        companyName: lead.companyName,
        city: lead.city,
        industry: (lead as any).industry ?? null,
        stage: "contacted",
        status: "active",
        assignedTo: "alex",
        dealValueEstimate: lead.estimatedValue ?? null,
        opportunityScore: lead.score,
        lastAction: `Promoted from ingestedLeads (score: ${lead.score}, signal: ${lead.signalType})`,
        nextAction: "Send intro email via outreach pipeline",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: dealExecution.id });

      await db.update(ingestedLeads)
        .set({ dealExecutionId: newDeal.id, status: "qualified", updatedAt: new Date() })
        .where(eq(ingestedLeads.id, lead.id));

      await db.insert(alexActions).values({
        actionType: "PROMOTE_LEAD_TO_DEAL",
        entityType: "ingested_lead",
        entityId: lead.id,
        entityName: lead.companyName,
        decision: "OUTREACH",
        reasoning: `Score ${lead.score} ≥ 70, signal: ${lead.signalType}, city: ${lead.city}`,
        inputScore: lead.score,
        executed: true,
        result: `deal_execution#${newDeal.id} created`,
        isSafe: true,
      });

      recordsUpdated.push(`deal_execution#${newDeal.id} (${lead.companyName}): CREATED from ingested_lead#${lead.id} [score ${lead.score}]`);
      recordsUpdated.push(`ingested_leads#${lead.id} (${lead.companyName}): status new → qualified`);
      promoted++;
    } catch (err: any) {
      blockers.push(`Failed to promote lead ${lead.companyName}: ${err.message}`);
    }
  }

  if (promoted > 0) actions.push(`${promoted} high-score leads (≥70) promoted to deal pipeline`);
  else if (promotionCandidates.length === 0) actions.push("No new leads eligible for promotion (score ≥70, unprocessed)");
  else actions.push(`${promotionCandidates.length} candidates found but all already have existing deals`);

  // ── Action 2: Advance stale 'signal_detected' deals → 'contacted' ─────────────
  const staleSignalDeals = allDealsBefore.filter(d => {
    const isSignalDetected = d.stage === "signal_detected";
    const stale = (Date.now() - new Date(d.updatedAt ?? 0).getTime()) > 3 * 24 * 60 * 60 * 1000;
    return isSignalDetected && stale;
  }).slice(0, MAX_ADVANCE);

  let advanced = 0;
  for (const deal of staleSignalDeals) {
    try {
      await db.update(dealExecution).set({
        stage: "contacted",
        nextAction: "Discovery call — confirm office requirements and timeline",
        lastAction: `Alex: Advanced from signal_detected (idle >3d)`,
        updatedAt: new Date(),
      }).where(eq(dealExecution.id, deal.id));
      recordsUpdated.push(`deal_execution#${deal.id} (${deal.companyName}): stage signal_detected → contacted`);
      advanced++;
    } catch (err: any) {
      blockers.push(`Failed to advance deal ${deal.companyName}: ${err.message}`);
    }
  }
  if (advanced > 0) actions.push(`${advanced} stale signal_detected deals advanced to contacted stage`);

  // ── Action 3: Flag high-opportunity deals as priority ─────────────────────────
  const priorityCandidates = allDealsBefore.filter(d =>
    (d.opportunityScore ?? 0) >= 80 &&
    !["won", "lost"].includes(d.stage ?? "")
  );

  let flagged = 0;
  for (const deal of priorityCandidates.slice(0, 15)) {
    try {
      await db.update(dealExecution).set({
        status: "priority",
        nextAction: deal.stage === "contacted"
          ? "PRIORITY: Book discovery meeting this week"
          : "PRIORITY: Accelerate — senior review needed",
        updatedAt: new Date(),
      }).where(and(
        eq(dealExecution.id, deal.id),
        sql`${dealExecution.status} != 'priority'`
      ));
      recordsUpdated.push(`deal_execution#${deal.id} (${deal.companyName}): status → priority [score ${deal.opportunityScore}]`);
      flagged++;
    } catch (err: any) {
      // non-critical
    }
  }
  if (flagged > 0) actions.push(`${flagged} deals flagged as PRIORITY (opportunityScore ≥80)`);

  // ── After state ───────────────────────────────────────────────────────────────
  const [afterDeals] = await db.select({ n: count() }).from(dealExecution);
  const allDealsAfter = await db.select({ stage: dealExecution.stage }).from(dealExecution).limit(500);
  const stagesAfter: Record<string, number> = {};
  allDealsAfter.forEach(d => { stagesAfter[d.stage ?? "unknown"] = (stagesAfter[d.stage ?? "unknown"] ?? 0) + 1; });

  const wonDeals = allDealsBefore.filter(d => d.stage === "won").length;
  const totalPipelineValue = allDealsBefore
    .filter(d => !["won", "lost"].includes(d.stage ?? ""))
    .reduce((s, d) => s, 0); // value not available in this select — use separate query
  const [pipelineValueResult] = await db.select({ total: sql<number>`coalesce(sum(${dealExecution.dealValueEstimate}), 0)` })
    .from(dealExecution)
    .where(sql`${dealExecution.stage} NOT IN ('won', 'lost')`);

  const after = {
    totalDeals: afterDeals.n,
    signalDetectedDeals: stagesAfter["signal_detected"] ?? 0,
    contactedDeals: stagesAfter["contacted"] ?? 0,
    newDealsCreated: promoted,
  };

  const totalActions = promoted + advanced + flagged;
  const status = totalActions > 0 ? "completed" : blockers.length > 0 ? "partial" : "completed";

  return {
    department: "Sales",
    status,
    actionsTaken: actions.length > 0 ? actions : ["No actionable items found — pipeline is up to date"],
    blockers,
    recordsUpdated,
    before,
    after,
    executionMs: Date.now() - start,
    metrics: {
      promoted,
      advanced,
      flaggedPriority: flagged,
      totalDeals: afterDeals.n,
      pipelineValueAud: Math.round((pipelineValueResult?.total ?? 0) / 100),
      wonDeals,
      contactedStage: stagesAfter["contacted"] ?? 0,
      engagedStage: stagesAfter["engaged"] ?? 0,
      meetingBookedStage: stagesAfter["meeting_booked"] ?? 0,
    },
    recommendations: [
      promoted > 0 ? `${promoted} new deals created — OutreachAI should thread them immediately` : "No new deal promotions this cycle",
      advanced > 0 ? `${advanced} deals moved to 'contacted' — follow-up calls due` : "No stale deals to advance",
      flagged > 0 ? `${flagged} priority deals need urgent attention` : "No priority escalations",
    ],
  };
}

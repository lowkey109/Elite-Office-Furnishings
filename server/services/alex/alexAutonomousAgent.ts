/**
 * Alex Autonomous Agent (Stage 2)
 * Job-based autonomous deal engine.
 * Cycle: getTopOpportunities → makeDecision → log alex_action → 
 *        createOutreachThread | createBookingLink → upsert deal_execution
 *
 * SAFE_MODE: simulates all actions, no real emails/bookings.
 */

import { db } from "../../db";
import { dealExecution, alexActions, outreachThreads } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getTopOpportunities } from "../intelligence/opportunityEngine";
import { makeDecision, DecisionInput } from "./alexDecisionEngine";
import { createOutreachThread } from "../outreach/outreachEngine";
import { createBookingLink } from "../outreach/bookingService";

const SAFE_MODE = process.env.SAFE_MODE !== "false";

// ── Alex Action Logger ────────────────────────────────────────────────────────

async function logAlexAction(params: {
  actionType: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  decision?: string;
  reasoning?: string;
  inputScore?: number;
  inputSignals?: object;
  executed: boolean;
  result?: string;
}): Promise<string> {
  const [row] = await db.insert(alexActions).values({
    actionType: params.actionType,
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    decision: params.decision,
    reasoning: params.reasoning,
    inputScore: params.inputScore,
    inputSignals: params.inputSignals ?? {},
    executed: params.executed,
    result: params.result,
    isSafe: SAFE_MODE,
  }).returning();
  return row.id;
}

// ── Deal Execution Upsert ─────────────────────────────────────────────────────

async function upsertDealExecution(params: {
  companyId?: string;
  companyName: string;
  city?: string;
  industry?: string;
  opportunityScore: number;
  dealValueEstimate?: number;
  outreachThreadId?: string;
  stage: string;
  status: string;
  lastAction: string;
  nextAction: string;
  assignedTo: "alex" | "human";
}): Promise<string> {
  // Check for existing deal
  const existing = await db
    .select()
    .from(dealExecution)
    .where(eq(dealExecution.companyName, params.companyName))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    // Don't downgrade a deal that's already further along
    const stageOrder = ["new", "contacted", "engaged", "meeting_booked", "proposal_sent", "negotiation", "won", "lost"];
    const currentIdx = stageOrder.indexOf(current.stage ?? "new");
    const newIdx = stageOrder.indexOf(params.stage);
    if (newIdx <= currentIdx) {
      await db.update(dealExecution).set({
        lastAction: params.lastAction,
        nextAction: params.nextAction,
        updatedAt: new Date(),
      }).where(eq(dealExecution.id, current.id));
      return current.id;
    }
    await db.update(dealExecution).set({
      stage: params.stage,
      status: params.status,
      lastAction: params.lastAction,
      nextAction: params.nextAction,
      outreachThreadId: params.outreachThreadId ?? current.outreachThreadId,
      assignedTo: params.assignedTo,
      opportunityScore: params.opportunityScore,
      updatedAt: new Date(),
    }).where(eq(dealExecution.id, current.id));
    return current.id;
  }

  const [row] = await db.insert(dealExecution).values({
    companyId: params.companyId,
    companyName: params.companyName,
    city: params.city,
    industry: params.industry,
    opportunityScore: params.opportunityScore,
    dealValueEstimate: params.dealValueEstimate,
    outreachThreadId: params.outreachThreadId,
    stage: params.stage,
    status: params.status,
    lastAction: params.lastAction,
    nextAction: params.nextAction,
    assignedTo: params.assignedTo,
    lastContactedAt: new Date(),
  }).returning();
  return row.id;
}

// ── Main Agent Loop ───────────────────────────────────────────────────────────

export async function runAlexCycle(): Promise<{
  processed: number;
  outreachTriggered: number;
  bookingsCreated: number;
  dealsUpdated: number;
  ignored: number;
  monitored: number;
  escalated: number;
}> {
  console.log(`[AlexAgent] Starting cycle. SAFE_MODE=${SAFE_MODE}`);

  const opportunities = await getTopOpportunities(50);
  let outreachTriggered = 0;
  let bookingsCreated = 0;
  let dealsUpdated = 0;
  let ignored = 0;
  let monitored = 0;
  let escalated = 0;

  for (const opp of opportunities) {
    try {
      const input: DecisionInput = {
        companyId: opp.id,
        companyName: opp.companyName,
        city: opp.city,
        industry: (opp as any).industry,
        opportunityScore: opp.opportunityScore,
        relocationProbability: opp.relocationProbability,
        confidenceScore: opp.confidenceScore,
        signalCount: 1,
        dealValueEstimate: undefined,
        existingOutreach: false,
        meetingBooked: false,
      };

      const { decision, reasoning, combinedScore, graphNetworkStrength, clusterBoost, partnerRecommendation } =
        await makeDecision(input);

      const actionId = await logAlexAction({
        actionType: "opportunity_decision",
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.companyName,
        decision,
        reasoning,
        inputScore: Math.round(combinedScore),
        inputSignals: {
          opportunityScore: opp.opportunityScore,
          relocationProbability: opp.relocationProbability,
          graphNetworkStrength,
          clusterBoost,
          source: opp.source,
        },
        executed: false,
      });

      if (decision === "IGNORE") {
        ignored++;
        continue;
      }

      if (decision === "MONITOR") {
        monitored++;
        await upsertDealExecution({
          companyId: opp.id,
          companyName: opp.companyName,
          city: opp.city,
          industry: (opp as any).industry,
          opportunityScore: opp.opportunityScore,
          stage: "new",
          status: "new",
          lastAction: "Alex: Added to monitoring queue",
          nextAction: "Wait for stronger signals",
          assignedTo: "alex",
        });
        dealsUpdated++;
        continue;
      }

      if (decision === "ESCALATE_TO_HUMAN") {
        escalated++;
        await upsertDealExecution({
          companyId: opp.id,
          companyName: opp.companyName,
          city: opp.city,
          opportunityScore: opp.opportunityScore,
          stage: "meeting_booked",
          status: "engaged",
          lastAction: "Alex: Escalated to human team",
          nextAction: "Human sales team to follow up",
          assignedTo: "human",
        });
        dealsUpdated++;
        continue;
      }

      // OUTREACH, PRIORITY_OUTREACH, BOOK_MEETING
      let outreachThreadId: string | undefined;
      let dealStage = "contacted";

      if (decision === "OUTREACH" || decision === "PRIORITY_OUTREACH") {
        if (SAFE_MODE) {
          console.log(`[AlexAgent] SAFE_MODE — simulating outreach for ${opp.companyName}`);
          outreachThreadId = `simulated-${opp.id}`;
        } else {
          outreachThreadId = await createOutreachThread({
            companyId: opp.id,
            companyName: opp.companyName,
            city: opp.city,
            opportunityScore: opp.opportunityScore,
            relocationProbability: opp.relocationProbability,
            signals: [opp.signalType],
          });
        }
        outreachTriggered++;
        dealStage = "contacted";

        await db.update(alexActions)
          .set({ executed: true, result: `Outreach thread created: ${outreachThreadId}` })
          .where(eq(alexActions.id, actionId));
      }

      if (decision === "BOOK_MEETING") {
        if (SAFE_MODE) {
          console.log(`[AlexAgent] SAFE_MODE — simulating booking for ${opp.companyName}`);
          outreachThreadId = `simulated-booking-${opp.id}`;
          bookingsCreated++;
        } else {
          // Create outreach thread first, then booking link
          outreachThreadId = await createOutreachThread({
            companyId: opp.id,
            companyName: opp.companyName,
            city: opp.city,
            opportunityScore: opp.opportunityScore,
            relocationProbability: opp.relocationProbability,
            signals: [opp.signalType],
          });
          const booking = await createBookingLink({
            threadId: outreachThreadId,
            companyId: opp.id,
            companyName: opp.companyName,
          });
          bookingsCreated++;
          await db.update(alexActions)
            .set({ executed: true, result: `Booking link created: ${booking.bookingLink}` })
            .where(eq(alexActions.id, actionId));
        }
        dealStage = "engaged";
      }

      await upsertDealExecution({
        companyId: opp.id,
        companyName: opp.companyName,
        city: opp.city,
        industry: (opp as any).industry,
        opportunityScore: opp.opportunityScore,
        outreachThreadId,
        stage: dealStage,
        status: "active",
        lastAction: `Alex: ${decision} — ${reasoning.slice(0, 100)}`,
        nextAction: decision === "BOOK_MEETING" ? "Confirm meeting time" : "Follow up in 3 days",
        assignedTo: "alex",
      });
      dealsUpdated++;

      // Auto-route to partner network when recommended by decision engine
      if (partnerRecommendation === "route_to_partners") {
        try {
          const { routeOpportunityToPartners } = await import("../partnerNetwork");
          await routeOpportunityToPartners({
            opportunityTitle: `${opp.companyName} — ${decision} (Alex Intelligence)`,
            companyName: opp.companyName,
            city: opp.city ?? "Sydney",
            industry: (opp as any).industry,
            projectType: "relocation",
            estimatedProjectValue: (opp as any).dealValueEstimate ?? 80000,
            sourceId: opp.id,
            sourceType: "alex_intelligence",
          });
          console.log(`[AlexAgent] Auto-routed ${opp.companyName} to partner network (score: ${combinedScore.toFixed(0)})`);
        } catch (partnerErr: any) {
          // Non-critical — partner routing failure should not block Alex cycle
        }
      }

    } catch (err: any) {
      console.error(`[AlexAgent] Error processing ${opp.companyName}:`, err.message);
    }
  }

  console.log(`[AlexAgent] Cycle complete — processed: ${opportunities.length}, outreach: ${outreachTriggered}, bookings: ${bookingsCreated}, deals: ${dealsUpdated}`);
  return {
    processed: opportunities.length,
    outreachTriggered,
    bookingsCreated,
    dealsUpdated,
    ignored,
    monitored,
    escalated,
  };
}

// ── Alex Stats (for ACC panels) ───────────────────────────────────────────────

export async function getAlexStats(): Promise<{
  totalActions: number;
  outreachTriggered: number;
  bookingsMade: number;
  dealsActive: number;
  dealsWon: number;
  recentActions: Array<{
    id: string;
    entityName: string;
    decision: string;
    reasoning: string;
    executed: boolean;
    isSafe: boolean;
    createdAt: Date | null;
  }>;
}> {
  const actions = await db.select().from(alexActions).orderBy(eq(alexActions.executed, true)).limit(200);
  const deals = await db.select().from(dealExecution).limit(500);

  const outreachCount = actions.filter((a) =>
    a.decision === "OUTREACH" || a.decision === "PRIORITY_OUTREACH"
  ).length;
  const bookingCount = actions.filter((a) => a.decision === "BOOK_MEETING").length;

  return {
    totalActions: actions.length,
    outreachTriggered: outreachCount,
    bookingsMade: bookingCount,
    dealsActive: deals.filter((d) => !["won", "lost"].includes(d.stage ?? "")).length,
    dealsWon: deals.filter((d) => d.stage === "won").length,
    recentActions: actions.slice(0, 20).map((a) => ({
      id: a.id,
      entityName: a.entityName ?? "Unknown",
      decision: a.decision ?? "MONITOR",
      reasoning: a.reasoning ?? "",
      executed: a.executed ?? false,
      isSafe: a.isSafe ?? true,
      createdAt: a.createdAt,
    })),
  };
}

export async function getDealPipeline(): Promise<{
  byStage: Record<string, number>;
  highProbability: Array<{ companyName: string; stage: string; score: number; city: string }>;
  totalPipelineValue: number;
  wonRevenue: number;
}> {
  const deals = await db.select().from(dealExecution).limit(500);
  const byStage: Record<string, number> = {};
  let totalPipelineValue = 0;
  let wonRevenue = 0;

  for (const d of deals) {
    byStage[d.stage ?? "new"] = (byStage[d.stage ?? "new"] ?? 0) + 1;
    if (!["won", "lost"].includes(d.stage ?? "")) {
      totalPipelineValue += d.dealValueEstimate ?? 0;
    }
    if (d.stage === "won") {
      wonRevenue += d.dealValueEstimate ?? 0;
    }
  }

  const highProbability = deals
    .filter((d) => (d.opportunityScore ?? 0) >= 70 && !["won", "lost"].includes(d.stage ?? ""))
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
    .slice(0, 10)
    .map((d) => ({
      companyName: d.companyName,
      stage: d.stage ?? "new",
      score: d.opportunityScore ?? 0,
      city: d.city ?? "",
    }));

  return { byStage, highProbability, totalPipelineValue, wonRevenue };
}

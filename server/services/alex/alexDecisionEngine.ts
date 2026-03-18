/**
 * Alex Decision Engine (Stage 3)
 * Classifies each opportunity into a concrete action.
 * Inputs: opportunity_score, relocation_probability, graph connections,
 *         cluster strength, signal count, company signals.
 * Output: IGNORE | MONITOR | OUTREACH | PRIORITY_OUTREACH | BOOK_MEETING | ESCALATE_TO_HUMAN
 */

import { getNetworkStrength } from "../intelligence/intelligenceGraphService";
import { db } from "../../db";
import { clusters } from "@shared/schema";
import { sql, desc } from "drizzle-orm";

export type AlexDecision =
  | "IGNORE"
  | "MONITOR"
  | "OUTREACH"
  | "PRIORITY_OUTREACH"
  | "BOOK_MEETING"
  | "ESCALATE_TO_HUMAN";

export interface DecisionInput {
  companyId: string;
  companyName: string;
  city?: string;
  industry?: string;
  opportunityScore: number;
  relocationProbability: number;
  confidenceScore: number;
  signalCount?: number;
  leaseExpiryMonths?: number | null;
  dealValueEstimate?: number;
  existingOutreach?: boolean;
  meetingBooked?: boolean;
}

export interface DecisionOutput {
  decision: AlexDecision;
  reasoning: string;
  priority: number;
  graphNetworkStrength: number;
  clusterBoost: number;
  combinedScore: number;
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Brisbane: { lat: -27.4698, lng: 153.0251 },
  Melbourne: { lat: -37.8136, lng: 144.9631 },
  Sydney: { lat: -33.8688, lng: 151.2093 },
  Perth: { lat: -31.9505, lng: 115.8605 },
  Adelaide: { lat: -34.9285, lng: 138.6007 },
};

async function getClusterBoost(city?: string, industry?: string): Promise<number> {
  const topClusters = await db
    .select()
    .from(clusters)
    .where(sql`${clusters.clusterScore} >= 40`)
    .orderBy(desc(clusters.clusterScore))
    .limit(50);

  let boost = 0;
  for (const c of topClusters) {
    if (city && c.city?.toLowerCase() === city.toLowerCase()) {
      boost = Math.max(boost, (c.clusterScore ?? 0) * 0.2);
    }
    if (industry && c.topIndustry?.toLowerCase() === industry.toLowerCase()) {
      boost = Math.max(boost, (c.clusterScore ?? 0) * 0.15);
    }
  }
  return Math.min(25, boost);
}

export async function makeDecision(input: DecisionInput): Promise<DecisionOutput> {
  // Skip already-booked or already-in-outreach if low value
  if (input.meetingBooked) {
    return {
      decision: "ESCALATE_TO_HUMAN",
      reasoning: "Meeting already booked — hand off to human sales team.",
      priority: 10,
      graphNetworkStrength: 0,
      clusterBoost: 0,
      combinedScore: input.opportunityScore,
    };
  }

  const networkStrength = await getNetworkStrength(input.companyId);
  const clusterBoost = await getClusterBoost(input.city, input.industry);

  // Combined score: weighted composite
  const leaseUrgency = input.leaseExpiryMonths != null && input.leaseExpiryMonths <= 12 ? 15 : 0;
  const combinedScore = Math.min(100,
    input.opportunityScore * 0.45 +
    input.relocationProbability * 0.25 +
    input.confidenceScore * 0.15 +
    networkStrength * 0.1 +
    clusterBoost +
    leaseUrgency
  );

  let decision: AlexDecision;
  let reasoning: string;
  let priority: number;

  // Decision thresholds
  if (combinedScore < 20) {
    decision = "IGNORE";
    reasoning = `Combined score ${combinedScore.toFixed(0)} below threshold — insufficient signal strength.`;
    priority = 0;
  } else if (combinedScore < 40) {
    decision = "MONITOR";
    reasoning = `Score ${combinedScore.toFixed(0)} — watch for stronger signals before acting.`;
    priority = 1;
  } else if (combinedScore >= 85 || (input.leaseExpiryMonths != null && input.leaseExpiryMonths <= 6)) {
    decision = "BOOK_MEETING";
    reasoning = `Score ${combinedScore.toFixed(0)} — extremely high priority. ${input.leaseExpiryMonths != null ? `Lease expires in ${input.leaseExpiryMonths}mo.` : ""} Book meeting immediately.`;
    priority = 10;
  } else if (combinedScore >= 75 || networkStrength >= 60) {
    decision = "PRIORITY_OUTREACH";
    reasoning = `Score ${combinedScore.toFixed(0)}, network strength ${networkStrength}. Strong cluster or multi-signal detection — priority contact.`;
    priority = 8;
  } else if (combinedScore >= 55) {
    decision = "OUTREACH";
    reasoning = `Score ${combinedScore.toFixed(0)} — sufficient evidence for personalised outreach.`;
    priority = 5;
  } else {
    decision = "MONITOR";
    reasoning = `Score ${combinedScore.toFixed(0)} — monitoring, not yet actionable.`;
    priority = 2;
  }

  // High deal value override
  if (input.dealValueEstimate && input.dealValueEstimate >= 500000 && decision === "OUTREACH") {
    decision = "PRIORITY_OUTREACH";
    reasoning += ` High deal value ($${Math.round(input.dealValueEstimate / 100).toLocaleString()}) — upgraded to priority.`;
    priority = 9;
  }

  // Partner routing recommendation — automatically route high-value signals
  let partnerRecommendation: string | undefined;
  if (combinedScore >= 70 && (decision === "OUTREACH" || decision === "PRIORITY_OUTREACH" || decision === "BOOK_MEETING")) {
    partnerRecommendation = "route_to_partners";
  }

  return { decision, reasoning, priority, graphNetworkStrength: networkStrength, clusterBoost, combinedScore, partnerRecommendation };
}

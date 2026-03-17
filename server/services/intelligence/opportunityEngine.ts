// ─── Opportunity Engine ───────────────────────────────────────────────────────
// Evaluates, ranks, and surfaces high-value workspace opportunities from all
// intelligence signal sources.
// Stage 1.7: applies graph-derived weights to opportunity scoring.

import { db } from "../../db";
import { intelligenceSignals, officeMovRadar, dealHunterSignals, clusters } from "@shared/schema";
import { desc, sql } from "drizzle-orm";

// ── Graph Weight Factors (Stage 1.7) ─────────────────────────────────────────
// Loaded once per cycle; safe to call concurrently.

async function getGraphWeights(): Promise<{
  clusterScoreByCity: Record<string, number>;
  industryDensityByIndustry: Record<string, number>;
}> {
  try {
    const allClusters = await db.select().from(clusters).limit(200);
    const clusterScoreByCity: Record<string, number> = {};
    const industryDensityByIndustry: Record<string, number> = {};

    for (const c of allClusters) {
      if (c.city && c.type !== "industry_density") {
        clusterScoreByCity[c.city.toLowerCase()] = Math.max(
          clusterScoreByCity[c.city.toLowerCase()] ?? 0,
          c.clusterScore ?? 0
        );
      }
      if (c.type === "industry_density" && c.topIndustry) {
        industryDensityByIndustry[c.topIndustry.toLowerCase()] = Math.max(
          industryDensityByIndustry[c.topIndustry.toLowerCase()] ?? 0,
          c.clusterScore ?? 0
        );
      }
    }
    return { clusterScoreByCity, industryDensityByIndustry };
  } catch {
    return { clusterScoreByCity: {}, industryDensityByIndustry: {} };
  }
}

function applyGraphBoost(
  baseScore: number,
  city: string,
  industry?: string,
  weights?: { clusterScoreByCity: Record<string, number>; industryDensityByIndustry: Record<string, number> }
): number {
  if (!weights) return baseScore;
  const clusterBoost = (weights.clusterScoreByCity[city?.toLowerCase()] ?? 0) * 0.1;
  const industryBoost = industry
    ? (weights.industryDensityByIndustry[industry?.toLowerCase()] ?? 0) * 0.05
    : 0;
  return Math.min(100, baseScore + clusterBoost + industryBoost);
}

export interface OpportunityRecord {
  id: string;
  companyName: string;
  city: string;
  state?: string;
  signalType: string;
  opportunityScore: number;
  confidenceScore: number;
  relocationProbability: number;
  commercialTier: string;
  classification?: string;
  evidenceSummary?: string;
  source: "intelligence_signal" | "radar" | "deal_hunter";
  createdAt?: Date | string;
}

export async function getTopOpportunities(limit = 20): Promise<OpportunityRecord[]> {
  // Load graph weights (cluster boosts per city/industry)
  const weights = await getGraphWeights();

  const signals = await db
    .select()
    .from(intelligenceSignals)
    .where(sql`${intelligenceSignals.status} = 'active' AND ${intelligenceSignals.opportunityScore} >= 50`)
    .orderBy(desc(intelligenceSignals.opportunityScore))
    .limit(limit);

  const radarRecords = await db
    .select()
    .from(officeMovRadar)
    .where(sql`${officeMovRadar.status} = 'New' AND ${officeMovRadar.radarScore} >= 60`)
    .orderBy(desc(officeMovRadar.radarScore))
    .limit(Math.ceil(limit / 2));

  const dealHunterRecords = await db
    .select()
    .from(dealHunterSignals)
    .where(sql`${dealHunterSignals.status} = 'new' AND ${dealHunterSignals.signalStrengthScore} >= 60`)
    .orderBy(desc(dealHunterSignals.signalStrengthScore))
    .limit(Math.ceil(limit / 2));

  const all: OpportunityRecord[] = [
    ...signals.map((s) => ({
      id: s.id,
      companyName: s.companyName,
      city: s.city,
      state: s.state ?? undefined,
      signalType: s.signalType,
      opportunityScore: applyGraphBoost(s.opportunityScore, s.city, s.industry ?? undefined, weights),
      confidenceScore: s.confidenceScore,
      relocationProbability: s.relocationProbability,
      commercialTier: s.commercialTier ?? "mid",
      classification: s.classification ?? undefined,
      evidenceSummary: s.evidenceSummary ?? undefined,
      source: "intelligence_signal" as const,
      createdAt: s.createdAt ?? undefined,
    })),
    ...radarRecords.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      city: r.city,
      state: r.state ?? undefined,
      signalType: r.signalType,
      opportunityScore: applyGraphBoost(r.radarScore, r.city, r.industry ?? undefined, weights),
      confidenceScore: r.confidenceLevel === "high" ? 80 : r.confidenceLevel === "medium" ? 60 : 40,
      relocationProbability: r.signalType.includes("relocation") ? 75 : 50,
      commercialTier: "mid",
      evidenceSummary: r.evidenceExcerpt ?? undefined,
      source: "radar" as const,
      createdAt: r.createdAt ?? undefined,
    })),
    ...dealHunterRecords.map((d) => ({
      id: d.id,
      companyName: d.companyName,
      city: d.city,
      state: d.state ?? undefined,
      signalType: d.signalType,
      opportunityScore: applyGraphBoost(d.signalStrengthScore, d.city, undefined, weights),
      confidenceScore: d.signalConfidence,
      relocationProbability: d.relocationProbability ?? 0,
      commercialTier: "mid",
      evidenceSummary: d.reasoningSummary ?? undefined,
      source: "deal_hunter" as const,
      createdAt: d.createdAt ?? undefined,
    })),
  ];

  return all.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, limit);
}

export async function getOpportunityStats(): Promise<{
  total: number;
  high: number;
  medium: number;
  low: number;
  byCity: Record<string, number>;
  byTier: Record<string, number>;
}> {
  const opportunities = await getTopOpportunities(200);

  const byCity: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const opp of opportunities) {
    byCity[opp.city] = (byCity[opp.city] ?? 0) + 1;
    byTier[opp.commercialTier] = (byTier[opp.commercialTier] ?? 0) + 1;

    if (opp.opportunityScore >= 75) high++;
    else if (opp.opportunityScore >= 50) medium++;
    else low++;
  }

  return { total: opportunities.length, high, medium, low, byCity, byTier };
}

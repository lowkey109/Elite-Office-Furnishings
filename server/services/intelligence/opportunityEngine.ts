// ─── Opportunity Engine ───────────────────────────────────────────────────────
// Evaluates, ranks, and surfaces high-value workspace opportunities from all
// intelligence signal sources.

import { db } from "../../db";
import { intelligenceSignals, officeMovRadar, dealHunterSignals } from "@shared/schema";
import { desc, gte, sql } from "drizzle-orm";

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
      opportunityScore: s.opportunityScore,
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
      opportunityScore: r.radarScore,
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
      opportunityScore: d.signalStrengthScore,
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

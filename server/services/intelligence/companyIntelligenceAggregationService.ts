// ─── Company Intelligence Aggregation Service ─────────────────────────────────
// Aggregates signals across all sources to build a unified company intelligence
// profile. Extends (does NOT replace) existing companyIntelligenceService.

import { db } from "../../db";
import {
  companyIntelligence,
  intelligenceSignals,
  officeMovRadar,
  dealHunterSignals,
  companyBuildingEdges,
  InsertCompanyBuildingEdge,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { normalizeCompanyName, normalizeCity } from "./signalIngestionService";

export interface AggregatedCompanyProfile {
  companyName: string;
  normalizedName: string;
  city: string;
  industry?: string;
  totalSignals: number;
  radarSignals: number;
  dealHunterSignals: number;
  intelligenceSignals: number;
  maxOpportunityScore: number;
  maxRelocationProbability: number;
  avgConfidenceScore: number;
  signalTypes: string[];
  latestSignalDate?: Date;
  priorityLevel: "urgent" | "high" | "medium" | "low";
  linkedBuildings: string[];
}

export async function aggregateCompanyProfile(companyName: string): Promise<AggregatedCompanyProfile | null> {
  const normName = normalizeCompanyName(companyName);

  const radarRows = await db
    .select()
    .from(officeMovRadar)
    .where(sql`lower(${officeMovRadar.companyName}) LIKE ${`%${normName.split(" ")[0]}%`}`)
    .limit(50);

  const dealRows = await db
    .select()
    .from(dealHunterSignals)
    .where(sql`lower(${dealHunterSignals.companyName}) LIKE ${`%${normName.split(" ")[0]}%`}`)
    .limit(50);

  const intelRows = await db
    .select()
    .from(intelligenceSignals)
    .where(eq(intelligenceSignals.normalizedCompanyName, normName))
    .limit(50);

  const totalSignals = radarRows.length + dealRows.length + intelRows.length;
  if (totalSignals === 0) return null;

  const allDates: Date[] = [
    ...radarRows.map((r) => r.createdAt).filter(Boolean) as Date[],
    ...dealRows.map((d) => d.createdAt).filter(Boolean) as Date[],
    ...intelRows.map((i) => i.createdAt).filter(Boolean) as Date[],
  ];

  const latestSignalDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map((d) => d.getTime())))
    : undefined;

  const signalTypes = [
    ...new Set([
      ...radarRows.map((r) => r.signalType),
      ...dealRows.map((d) => d.signalType),
      ...intelRows.map((i) => i.signalType),
    ]),
  ];

  const maxOpportunityScore = Math.max(
    ...intelRows.map((i) => i.opportunityScore),
    ...radarRows.map((r) => r.radarScore),
    ...dealRows.map((d) => d.signalStrengthScore),
    0
  );

  const maxRelocationProbability = Math.max(
    ...intelRows.map((i) => i.relocationProbability),
    ...dealRows.map((d) => d.relocationProbability ?? 0),
    0
  );

  const allConfidences = [
    ...intelRows.map((i) => i.confidenceScore),
    ...dealRows.map((d) => d.signalConfidence),
  ];
  const avgConfidenceScore =
    allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 50;

  const priorityLevel: AggregatedCompanyProfile["priorityLevel"] =
    maxOpportunityScore >= 80 ? "urgent"
    : maxOpportunityScore >= 60 ? "high"
    : maxOpportunityScore >= 40 ? "medium"
    : "low";

  const city = radarRows[0]?.city ?? dealRows[0]?.city ?? intelRows[0]?.city ?? "";
  const industry = radarRows[0]?.industry ?? dealRows[0]?.industry ?? undefined;

  const buildingEdges = await db
    .select({ buildingName: companyBuildingEdges.buildingName })
    .from(companyBuildingEdges)
    .where(eq(companyBuildingEdges.normalizedCompanyName, normName))
    .limit(10);

  return {
    companyName,
    normalizedName: normName,
    city,
    industry,
    totalSignals,
    radarSignals: radarRows.length,
    dealHunterSignals: dealRows.length,
    intelligenceSignals: intelRows.length,
    maxOpportunityScore,
    maxRelocationProbability,
    avgConfidenceScore,
    signalTypes,
    latestSignalDate,
    priorityLevel,
    linkedBuildings: buildingEdges.map((e) => e.buildingName ?? "").filter(Boolean),
  };
}

export async function getRelocationReadyCompanies(limit = 10): Promise<AggregatedCompanyProfile[]> {
  const signals = await db
    .select({
      companyName: intelligenceSignals.companyName,
      relocationProbability: intelligenceSignals.relocationProbability,
    })
    .from(intelligenceSignals)
    .where(
      sql`${intelligenceSignals.relocationProbability} >= 60 AND ${intelligenceSignals.status} = 'active'`
    )
    .orderBy(desc(intelligenceSignals.relocationProbability))
    .limit(limit * 2);

  const profiles: AggregatedCompanyProfile[] = [];
  const seen = new Set<string>();

  for (const sig of signals) {
    if (seen.has(sig.companyName)) continue;
    seen.add(sig.companyName);

    const profile = await aggregateCompanyProfile(sig.companyName);
    if (profile) profiles.push(profile);
    if (profiles.length >= limit) break;
  }

  return profiles;
}

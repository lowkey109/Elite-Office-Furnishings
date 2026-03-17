// ─── Workspace Intelligence Engine ───────────────────────────────────────────
// Orchestrates all intelligence sub-engines into a unified intelligence cycle.
// This is the main entry point for the Stage 4 intelligence pipeline.

import { runIngestionCycle } from "./signalIngestionService";
import { refreshBuildingRiskSnapshots, getHighRiskBuildings } from "./buildingRiskEngine";
import { runDemandAggregation, getTopDemandSuburbs } from "./demandForecastEngine";
import { getTopOpportunities, getOpportunityStats } from "./opportunityEngine";
import { computeZoneScores, getTopZones } from "./zoneScoringEngine";
import { getRelocationReadyCompanies } from "./companyIntelligenceAggregationService";

const SAFE_MODE = process.env.SAFE_MODE === "true";

export interface IntelligenceCycleResult {
  ingestion: { rawCaptured: number; signalsPersisted: number; duplicatesSkipped: number };
  buildingRisk: { processed: number };
  demandForecast: { totalSuburbs: number };
  opportunityStats: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  completedAt: string;
  safeMode: boolean;
}

export async function runFullIntelligenceCycle(): Promise<IntelligenceCycleResult> {
  console.log("[WorkspaceIntelligenceEngine] Starting full intelligence cycle...");
  const start = Date.now();

  const ingestionResult = await runIngestionCycle().catch((err) => {
    console.error("[WorkspaceIntelligenceEngine] Ingestion failed:", err);
    return { sourcesProcessed: 0, rawCaptured: 0, signalsPersisted: 0, duplicatesSkipped: 0 };
  });

  const buildingRiskResult = await refreshBuildingRiskSnapshots().catch((err) => {
    console.error("[WorkspaceIntelligenceEngine] Building risk failed:", err);
    return { processed: 0 };
  });

  const demandResult = await runDemandAggregation().catch((err) => {
    console.error("[WorkspaceIntelligenceEngine] Demand forecast failed:", err);
    return { totalSuburbs: 0 };
  });

  const oppStats = await getOpportunityStats().catch((err) => {
    console.error("[WorkspaceIntelligenceEngine] Opportunity stats failed:", err);
    return { total: 0, high: 0, medium: 0, low: 0, byCity: {}, byTier: {} };
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[WorkspaceIntelligenceEngine] Cycle complete in ${elapsed}s`);

  return {
    ingestion: {
      rawCaptured: ingestionResult.rawCaptured,
      signalsPersisted: ingestionResult.signalsPersisted,
      duplicatesSkipped: ingestionResult.duplicatesSkipped,
    },
    buildingRisk: buildingRiskResult,
    demandForecast: demandResult,
    opportunityStats: { total: oppStats.total, high: oppStats.high, medium: oppStats.medium, low: oppStats.low },
    completedAt: new Date().toISOString(),
    safeMode: SAFE_MODE,
  };
}

export async function getIntelligenceDashboard(): Promise<{
  topOpportunities: Awaited<ReturnType<typeof getTopOpportunities>>;
  topZones: Awaited<ReturnType<typeof getTopZones>>;
  highRiskBuildings: Awaited<ReturnType<typeof getHighRiskBuildings>>;
  topDemandSuburbs: Awaited<ReturnType<typeof getTopDemandSuburbs>>;
  relocationReadyCompanies: Awaited<ReturnType<typeof getRelocationReadyCompanies>>;
}> {
  const [topOpportunities, topZones, highRiskBuildings, topDemandSuburbs, relocationReadyCompanies] =
    await Promise.all([
      getTopOpportunities(10),
      getTopZones(10),
      getHighRiskBuildings(10),
      getTopDemandSuburbs(10),
      getRelocationReadyCompanies(10),
    ]);

  return {
    topOpportunities,
    topZones,
    highRiskBuildings,
    topDemandSuburbs,
    relocationReadyCompanies,
  };
}

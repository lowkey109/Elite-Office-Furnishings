import { db } from "../../db";
import { paperPositions, portfolioStressSnapshots } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { calculatePortfolioState, persistPortfolioSnapshot } from "./portfolioState";
import { STRESS_SCENARIOS } from "./stressScenarios";
import { calculateScenarioImpact, type ScenarioImpact } from "./portfolioStressCalculator";
import { calculateResilience, type ResilienceResult } from "./portfolioResilience";
import { calculateStrategyStressSensitivity, type StrategyStressSensitivity } from "./strategyStressProfile";
import { generateStressAlerts, persistStressAlerts, getRecentAlerts, type StressAlertOutput } from "./stressAlertEngine";

export interface StressTestResult {
  portfolioState: any;
  resilience: ResilienceResult;
  scenarioResults: ScenarioImpact[];
  worstCase: ScenarioImpact | null;
  topRiskFlags: string[];
  strategySensitivities: StrategyStressSensitivity[];
  alerts: StressAlertOutput[];
  recentSnapshots: any[];
  generatedAt: string;
}

export async function runStressTest(): Promise<StressTestResult> {
  const portfolioState = await calculatePortfolioState();
  const snapshotId = await persistPortfolioSnapshot(portfolioState).catch(() => null);

  const openPositions = await db.select().from(paperPositions).where(eq(paperPositions.status, "open"));
  const positionDetails = openPositions.map(p => ({
    symbol: p.symbol,
    side: p.side,
    exposure: p.paperCapitalAllocated,
    strategy: p.strategy,
    unrealizedPnl: p.side === "long"
      ? (p.currentPrice - p.entryPrice)
      : (p.entryPrice - p.currentPrice),
  }));

  const scenarioResults: ScenarioImpact[] = [];
  for (const scenario of STRESS_SCENARIOS) {
    const impact = calculateScenarioImpact(portfolioState, scenario, positionDetails);
    scenarioResults.push(impact);
  }

  const resilience = calculateResilience(portfolioState, scenarioResults);

  const worstCase = scenarioResults.reduce<ScenarioImpact | null>((w, s) => {
    if (!w || s.projectedPnlImpact < w.projectedPnlImpact) return s;
    return w;
  }, null);

  const allFlags = new Set<string>();
  for (const r of scenarioResults) {
    for (const f of r.riskFlags) allFlags.add(f);
  }
  for (const f of resilience.riskFlags) allFlags.add(f);
  const topRiskFlags = Array.from(allFlags).slice(0, 10);

  const strategySensitivities = calculateStrategyStressSensitivity(scenarioResults);

  const alerts = generateStressAlerts(portfolioState, scenarioResults, resilience);
  await persistStressAlerts(alerts).catch(() => {});

  for (const result of scenarioResults) {
    try {
      await db.insert(portfolioStressSnapshots).values({
        portfolioSnapshotId: snapshotId,
        scenarioName: result.scenarioName,
        scenarioGroup: result.scenarioGroup,
        projectedPnlImpact: result.projectedPnlImpact,
        projectedDrawdown: result.projectedDrawdown,
        projectedExposureRisk: result.projectedExposureRisk,
        resilienceScore: resilience.overallScore,
        riskFlagsJson: result.riskFlags,
      });
    } catch {}
  }

  const recentSnapshots = await db.select().from(portfolioStressSnapshots).orderBy(desc(portfolioStressSnapshots.snapshotAt)).limit(30);

  return {
    portfolioState,
    resilience,
    scenarioResults,
    worstCase,
    topRiskFlags,
    strategySensitivities,
    alerts,
    recentSnapshots,
    generatedAt: new Date().toISOString(),
  };
}

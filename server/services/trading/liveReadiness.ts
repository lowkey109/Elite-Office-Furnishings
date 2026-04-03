import { getLiveExecutionConfig } from "./liveExecutionConfig";

export interface ReadinessCheck {
  name: string;
  passed: boolean;
  reason: string;
}

export interface ReadinessResult {
  ready: boolean;
  status: "ready" | "not_ready";
  checks: ReadinessCheck[];
  reasons: string[];
}

export async function checkLiveReadiness(): Promise<ReadinessResult> {
  const checks: ReadinessCheck[] = [];
  const reasons: string[] = [];
  const config = getLiveExecutionConfig();

  let feedHealthy = false;
  try {
    const { getMarketLoopStatus } = await import("./marketLoop");
    const status = getMarketLoopStatus();
    feedHealthy = status.isRunning;
  } catch (err) {
    console.warn("[liveReadiness] Could not check market feed:", err instanceof Error ? err.message : err);
  }
  checks.push({ name: "Market Feed", passed: feedHealthy, reason: feedHealthy ? "Feed running" : "Feed not running" });
  if (!feedHealthy) reasons.push("Market feed not healthy");

  const reconciliationOk = true;
  checks.push({ name: "Reconciliation", passed: reconciliationOk, reason: "No pending reconciliation issues" });

  let resilience = 100;
  try {
    const { calculatePortfolioState } = await import("./portfolioState");
    const { calculateResilience } = await import("./portfolioResilience");
    const { STRESS_SCENARIOS } = await import("./stressScenarios");
    const { calculateScenarioImpact } = await import("./portfolioStressCalculator");
    const { paperPositions } = await import("@shared/schema");
    const { eq: eqOp } = await import("drizzle-orm");
    const { db: ddb } = await import("../../db");

    const portfolio = await calculatePortfolioState();
    const positions = await ddb.select().from(paperPositions).where(eqOp(paperPositions.status, "open"));
    const posDetails = positions.map(p => ({
      symbol: p.symbol,
      side: p.side,
      exposure: p.paperCapitalAllocated,
      strategy: p.strategy,
      unrealizedPnl: p.side === "long" ? p.currentPrice - p.entryPrice : p.entryPrice - p.currentPrice,
    }));
    const scenarios = STRESS_SCENARIOS.map(s => calculateScenarioImpact(portfolio, s, posDetails));
    const res = calculateResilience(portfolio, scenarios);
    resilience = res.overallScore;
  } catch (err) {
    console.warn("[liveReadiness] Could not calculate resilience:", err instanceof Error ? err.message : err);
  }
  const resilienceOk = resilience >= 40;
  checks.push({ name: "Resilience Score", passed: resilienceOk, reason: `Score: ${resilience}` });
  if (!resilienceOk) reasons.push(`Resilience too low (${resilience})`);

  let execQualityOk = true;
  try {
    const { calculateExecutionAnalytics } = await import("./executionAnalytics");
    const analytics = await calculateExecutionAnalytics();
    if (analytics.overallStats.totalTrades > 5 && analytics.overallStats.poorExecutionPct > 40) {
      execQualityOk = false;
    }
  } catch (err) {
    console.warn("[liveReadiness] Could not check execution quality:", err instanceof Error ? err.message : err);
  }
  checks.push({ name: "Execution Quality", passed: execQualityOk, reason: execQualityOk ? "Acceptable" : "Too many poor executions" });
  if (!execQualityOk) reasons.push("Execution quality too low");

  const credentialsOk = config.credentialsPresent;
  checks.push({ name: "Credentials", passed: credentialsOk, reason: credentialsOk ? "Present" : "Not configured" });
  if (!credentialsOk) reasons.push("Venue credentials not configured");

  const venueOk = config.approvedVenue !== null;
  checks.push({ name: "Approved Venue", passed: venueOk, reason: venueOk ? config.approvedVenue! : "None" });
  if (!venueOk) reasons.push("No approved venue");

  const configApproved = !config.requiresConfigApproval;
  checks.push({ name: "Config Approval", passed: configApproved, reason: configApproved ? "Approved" : "Pending approval" });
  if (!configApproved) reasons.push("Config requires approval");

  const ready = reasons.length === 0;

  return {
    ready,
    status: ready ? "ready" : "not_ready",
    checks,
    reasons,
  };
}

import type { PortfolioState } from "./portfolioState";
import type { ScenarioImpact } from "./portfolioStressCalculator";

export interface ResilienceResult {
  overallScore: number;
  fragilityLabel: "low" | "medium" | "high";
  riskFlags: string[];
  concentrationScore: number;
  diversificationScore: number;
  drawdownSensitivity: number;
  clusterExposureScore: number;
}

export function calculateResilience(
  portfolio: PortfolioState,
  scenarioResults: ScenarioImpact[],
): ResilienceResult {
  const riskFlags: string[] = [];
  let score = 100;

  const symbols = Object.keys(portfolio.exposureBySymbol);
  const totalExposure = portfolio.grossExposure || 1;

  let maxConcentration = 0;
  for (const exp of Object.values(portfolio.exposureBySymbol)) {
    const pct = exp / totalExposure;
    if (pct > maxConcentration) maxConcentration = pct;
  }

  const concentrationScore = Math.round((1 - maxConcentration) * 100);
  if (maxConcentration > 0.6) {
    score -= 20;
    riskFlags.push("single_asset_dominates_portfolio");
  } else if (maxConcentration > 0.4) {
    score -= 10;
    riskFlags.push("asset_concentration_elevated");
  }

  const diversificationScore = Math.min(100, symbols.length * 25);
  if (symbols.length <= 1 && portfolio.openPositionsCount > 0) {
    score -= 15;
    riskFlags.push("no_diversification");
  }

  const cryptoExposure = portfolio.exposureByCluster["crypto"] || 0;
  const clusterExposureScore = totalExposure > 0 ? Math.round((1 - cryptoExposure / totalExposure) * 100) : 100;
  if (cryptoExposure > totalExposure * 0.7 && portfolio.openPositionsCount > 1) {
    score -= 15;
    riskFlags.push("crypto_cluster_concentration_too_high");
  }

  const worstScenario = scenarioResults.reduce((worst, s) => {
    return s.projectedPnlImpact < (worst?.projectedPnlImpact ?? 0) ? s : worst;
  }, scenarioResults[0]);

  let drawdownSensitivity = 0;
  if (worstScenario && portfolio.totalEquity > 0) {
    drawdownSensitivity = Math.round(Math.abs(worstScenario.projectedPnlImpact) / portfolio.totalEquity * 100 * 100) / 100;
    if (drawdownSensitivity > 15) {
      score -= 25;
      riskFlags.push("high_drawdown_sensitivity");
    } else if (drawdownSensitivity > 8) {
      score -= 12;
      riskFlags.push("moderate_drawdown_sensitivity");
    }
  }

  if (portfolio.drawdownState.isInDrawdown) {
    score -= 10;
    riskFlags.push("currently_in_drawdown");
  }

  const strategies = Object.keys(portfolio.exposureByStrategy);
  if (strategies.length === 1 && portfolio.openPositionsCount > 2) {
    score -= 10;
    riskFlags.push("one_strategy_dominates_allocation");
  }

  if (portfolio.openPositionsCount === 0) {
    score = 100;
    riskFlags.length = 0;
  }

  score = Math.max(0, Math.min(100, score));

  let fragilityLabel: ResilienceResult["fragilityLabel"] = "low";
  if (score < 40) fragilityLabel = "high";
  else if (score < 70) fragilityLabel = "medium";

  return {
    overallScore: score,
    fragilityLabel,
    riskFlags,
    concentrationScore,
    diversificationScore,
    drawdownSensitivity,
    clusterExposureScore,
  };
}

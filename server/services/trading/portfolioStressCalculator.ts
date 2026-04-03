import type { PortfolioState } from "./portfolioState";
import type { StressScenario } from "./stressScenarios";
import { getClusterForSymbol } from "./correlationModel";

export interface ScenarioImpact {
  scenarioName: string;
  scenarioGroup: string;
  projectedPnlImpact: number;
  projectedDrawdown: number;
  projectedExposureRisk: number;
  worstPositionImpact: { symbol: string; impact: number } | null;
  clusterImpacts: Record<string, number>;
  strategyImpacts: Record<string, number>;
  riskFlags: string[];
}

export function calculateScenarioImpact(
  portfolio: PortfolioState,
  scenario: StressScenario,
  positionDetails: { symbol: string; side: string; exposure: number; strategy: string; unrealizedPnl: number }[],
): ScenarioImpact {
  let totalPnlImpact = 0;
  const clusterImpacts: Record<string, number> = {};
  const strategyImpacts: Record<string, number> = {};
  let worstPositionImpact: { symbol: string; impact: number } | null = null;
  const riskFlags: string[] = [];

  for (const pos of positionDetails) {
    const shock = scenario.shocks[pos.symbol] || 0;
    let impact: number;

    if (pos.side === "long") {
      impact = pos.exposure * shock;
    } else {
      impact = pos.exposure * (-shock);
    }

    if (scenario.slippageMultiplier && scenario.slippageMultiplier > 1) {
      const baseSlippage = pos.exposure * 0.001;
      const extraSlippage = baseSlippage * (scenario.slippageMultiplier - 1);
      impact -= extraSlippage;
    }

    totalPnlImpact += impact;

    const cluster = getClusterForSymbol(pos.symbol);
    if (!clusterImpacts[cluster]) clusterImpacts[cluster] = 0;
    clusterImpacts[cluster] += impact;

    if (!strategyImpacts[pos.strategy]) strategyImpacts[pos.strategy] = 0;
    strategyImpacts[pos.strategy] += impact;

    if (!worstPositionImpact || impact < worstPositionImpact.impact) {
      worstPositionImpact = { symbol: pos.symbol, impact: Math.round(impact * 100) / 100 };
    }
  }

  totalPnlImpact = Math.round(totalPnlImpact * 100) / 100;

  const projectedEquity = portfolio.totalEquity + totalPnlImpact;
  const projectedDrawdown = portfolio.drawdownState.peakEquity > 0
    ? Math.round(Math.max(0, ((portfolio.drawdownState.peakEquity - projectedEquity) / portfolio.drawdownState.peakEquity) * 100) * 100) / 100
    : 0;

  const projectedExposureRisk = portfolio.totalEquity > 0
    ? Math.round(Math.abs(totalPnlImpact) / portfolio.totalEquity * 100 * 100) / 100
    : 0;

  if (projectedDrawdown > 15) riskFlags.push("critical_drawdown_projected");
  if (projectedDrawdown > 10) riskFlags.push("elevated_drawdown_projected");
  if (projectedExposureRisk > 10) riskFlags.push("high_portfolio_impact");

  const cryptoClusterImpact = Math.abs(clusterImpacts["crypto"] || 0);
  if (cryptoClusterImpact > portfolio.totalEquity * 0.05) {
    riskFlags.push("crypto_cluster_concentration_risk");
  }

  for (const [strategy, impact] of Object.entries(strategyImpacts)) {
    if (Math.abs(impact) > portfolio.totalEquity * 0.03) {
      riskFlags.push(`${strategy}_high_sensitivity`);
    }
  }

  return {
    scenarioName: scenario.name,
    scenarioGroup: scenario.group,
    projectedPnlImpact: totalPnlImpact,
    projectedDrawdown,
    projectedExposureRisk,
    worstPositionImpact,
    clusterImpacts: Object.fromEntries(Object.entries(clusterImpacts).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    strategyImpacts: Object.fromEntries(Object.entries(strategyImpacts).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    riskFlags,
  };
}

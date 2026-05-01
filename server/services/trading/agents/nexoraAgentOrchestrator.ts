
import { getMarketCandleCoverage } from "../marketData/nexoraMarketCandlesService";
import { calculateNexoraIndicatorSnapshot } from "../indicators/nexoraIndicatorEngine";
import { getNexoraSetupPromotions } from "../promotion/nexoraSetupPromotionEngine";
import { getNexoraPortfolioBrain } from "../portfolio/nexoraPortfolioBrain";

type AgentResult = {
  agent: string;
  ok: boolean;
  status: "healthy" | "warning" | "blocked";
  reason: string;
  payload?: unknown;
};

export async function runNexoraAgentOrchestrator() {
  const results: AgentResult[] = [];

  const candles = await getMarketCandleCoverage().catch((err) => ({ ok: false, error: String(err) }));
  results.push({
    agent: "market_data_agent",
    ok: Boolean((candles as any).ok),
    status: (candles as any).ok ? "healthy" : "blocked",
    reason: (candles as any).ok ? "Market candle coverage available." : "Market candle coverage unavailable.",
    payload: candles,
  });

  const indicators = await calculateNexoraIndicatorSnapshot({
    symbols: ["BTC/USD", "ETH/USD", "SOL/USD"],
    timeframes: ["1m", "5m"],
  }).catch((err) => ({ ok: false, error: String(err) }));

  const indicatorFailures = Array.isArray((indicators as any).results)
    ? (indicators as any).results.filter((r: any) => !r.ok).length
    : 1;

  results.push({
    agent: "indicator_agent",
    ok: Boolean((indicators as any).ok) && indicatorFailures === 0,
    status: indicatorFailures === 0 ? "healthy" : "warning",
    reason: indicatorFailures === 0 ? "Indicators available." : "Some indicator snapshots failed.",
    payload: indicators,
  });

  const promotions = await getNexoraSetupPromotions().catch((err) => ({ ok: false, error: String(err) }));
  const blockedCount = Array.isArray((promotions as any).rows)
    ? (promotions as any).rows.filter((r: any) => r.status === "blocked").length
    : 0;

  results.push({
    agent: "promotion_agent",
    ok: Boolean((promotions as any).ok),
    status: blockedCount > 0 ? "warning" : "healthy",
    reason: blockedCount > 0
      ? `${blockedCount} setups are blocked by performance evidence.`
      : "No blocked setup warnings.",
    payload: promotions,
  });

  const portfolio = await getNexoraPortfolioBrain().catch((err) => ({ ok: false, error: String(err) }));
  results.push({
    agent: "portfolio_agent",
    ok: Boolean((portfolio as any).ok),
    status: (portfolio as any).riskState === "high" ? "blocked" : (portfolio as any).riskState === "medium" ? "warning" : "healthy",
    reason: `Portfolio risk state: ${(portfolio as any).riskState || "unknown"}.`,
    payload: portfolio,
  });

  const blocked = results.filter((r) => r.status === "blocked").length;
  const warnings = results.filter((r) => r.status === "warning").length;

  return {
    ok: blocked === 0,
    service: "nexora_agent_orchestrator",
    paperOnly: true,
    decisionState: blocked > 0 ? "blocked" : warnings > 0 ? "caution" : "healthy",
    blocked,
    warnings,
    agents: results,
    updatedAt: new Date().toISOString(),
  };
}

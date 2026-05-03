import { runNexoraResilientAlphaOrchestrator } from "../orchestration/nexoraResilientAlphaOrchestrator";

export function normalizePredictionMarkets(input: any = {}) {
  const markets = Array.isArray(input.markets) ? input.markets : [];

  return markets.map((m: any, i: number) => ({
    marketId: String(m.marketId || m.id || `market_${i}`),
    title: String(m.title || m.question || "Untitled prediction market"),
    category: String(m.category || "general"),
    marketProbability: Number(m.marketProbability ?? m.price ?? m.yesPrice ?? 0.5),
    modelProbability: Number(m.modelProbability ?? m.fairProbability ?? 0.5),
    liquidityUsd: Number(m.liquidityUsd ?? m.liquidity ?? 0),
    spreadPct: Number(m.spreadPct ?? m.spread ?? 100),
    volumeUsd24h: Number(m.volumeUsd24h ?? m.volume24h ?? 0),
    resolutionRules: String(m.resolutionRules || m.rules || ""),
    resolutionClear: m.resolutionClear !== false,
    correlatedEventKey: String(m.correlatedEventKey || m.eventKey || m.marketId || m.id || `event_${i}`),
    raw: m,
  }));
}

export async function runNexoraPredictionMarketScanner(input: any = {}) {
  const normalized = normalizePredictionMarkets(input);

  const liquid = normalized.filter((m) => m.liquidityUsd >= Number(input.minLiquidityUsd || 1000));
  const tight = liquid.filter((m) => m.spreadPct <= Number(input.maxSpreadPct || 5));

  const ranked = tight
    .map((m) => ({
      ...m,
      edgePct: Math.round((m.modelProbability - m.marketProbability) * 10000) / 100,
      absEdgePct: Math.abs(Math.round((m.modelProbability - m.marketProbability) * 10000) / 100),
    }))
    .sort((a, b) => b.absEdgePct - a.absEdgePct)
    .slice(0, Number(input.maxMarkets || 25));

  const orchestrator = await runNexoraResilientAlphaOrchestrator({
    ...input,
    markets: ranked,
  });

  return {
    ok: true,
    service: "nexora_prediction_market_scanner",
    paperOnly: true,
    receivedCount: normalized.length,
    liquidCount: liquid.length,
    tightSpreadCount: tight.length,
    rankedCount: ranked.length,
    ranked,
    orchestrator,
    rule: "Normalize markets → filter liquidity/spread → rank edge → resilient alpha orchestrator.",
    updatedAt: new Date().toISOString(),
  };
}

export function getNexoraScannerStatus() {
  return {
    ok: true,
    service: "nexora_prediction_market_scanner",
    paperOnly: true,
    capabilities: [
      "market normalization",
      "liquidity filtering",
      "spread filtering",
      "edge ranking",
      "resilient alpha orchestration",
      "DB health gate protection",
      "monitor-only fallback"
    ],
    updatedAt: new Date().toISOString(),
  };
}

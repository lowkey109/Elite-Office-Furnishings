import { runNexoraResilientAlphaOrchestrator } from "../orchestration/nexoraResilientAlphaOrchestrator";

type NormalizedPredictionMarket = {
  marketId: string;
  title: string;
  category: string;
  marketProbability: number;
  modelProbability: number;
  liquidityUsd: number;
  spreadPct: number;
  volumeUsd24h: number;
  resolutionRules: string;
  resolutionClear: boolean;
  correlatedEventKey: string;
  raw: any;
};

type RankedPredictionMarket = NormalizedPredictionMarket & {
  edgePct: number;
  absEdgePct: number;
};

export function normalizePredictionMarkets(input: any = {}): NormalizedPredictionMarket[] {
  const markets = Array.isArray(input.markets) ? input.markets : [];

  return markets.map((m: any, i: number): NormalizedPredictionMarket => ({
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

  const minLiquidityUsd = Number(input.minLiquidityUsd || 1000);
  const maxSpreadPct = Number(input.maxSpreadPct || 5);
  const maxMarkets = Number(input.maxMarkets || 25);

  const liquid = normalized.filter((m: NormalizedPredictionMarket) => m.liquidityUsd >= minLiquidityUsd);
  const tight = liquid.filter((m: NormalizedPredictionMarket) => m.spreadPct <= maxSpreadPct);

  const ranked: RankedPredictionMarket[] = tight
    .map((m: NormalizedPredictionMarket): RankedPredictionMarket => {
      const edgePct = Math.round((m.modelProbability - m.marketProbability) * 10000) / 100;
      return {
        ...m,
        edgePct,
        absEdgePct: Math.abs(edgePct),
      };
    })
    .sort((a: RankedPredictionMarket, b: RankedPredictionMarket) => b.absEdgePct - a.absEdgePct)
    .slice(0, maxMarkets);

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
      "monitor-only fallback",
    ],
    updatedAt: new Date().toISOString(),
  };
}

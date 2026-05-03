import { normalizePredictionMarkets } from "../scanner/nexoraPredictionMarketScanner";
import { getNexoraDbHealthGate } from "../resilience/nexoraDbHealthGate";
import { recordNexoraMemoryEvent } from "../resilience/nexoraMemoryFallbackRuntime";
import { runNexoraAdvancedPredictionCore } from "../prediction/nexoraAdvancedPredictionCore";
import { simulateNexoraPredictionOrderBook } from "../prediction/nexoraOrderBookSimulator";
import { runNexoraMathGeniusCore } from "../math/nexoraMathGeniusCore";

export async function runNexoraMemorySafeScanner(input: any = {}) {
  const db = await getNexoraDbHealthGate();
  const normalized = normalizePredictionMarkets(input);

  const ranked = normalized
    .filter((m) => m.liquidityUsd >= Number(input.minLiquidityUsd || 1000))
    .filter((m) => m.spreadPct <= Number(input.maxSpreadPct || 5))
    .map((m) => {
      const edgePct = Math.round((m.modelProbability - m.marketProbability) * 10000) / 100;
      return { ...m, edgePct, absEdgePct: Math.abs(edgePct) };
    })
    .sort((a, b) => b.absEdgePct - a.absEdgePct)
    .slice(0, Number(input.maxMarkets || 25));

  const decisions = [];

  for (const market of ranked) {
    const bankrollUsd = Number(input.bankrollUsd || 1000);

    const core = await runNexoraAdvancedPredictionCore({
      ...market,
      bankrollUsd,
    });

    const math = runNexoraMathGeniusCore({
      marketProbability: market.marketProbability,
      modelProbability: market.modelProbability,
      liquidityUsd: market.liquidityUsd,
      spreadPct: market.spreadPct,
      bankrollUsd,
      volatility: input.volatility ?? 0.35,
      confidence: input.confidence ?? 0.75,
    });

    const orderBook = simulateNexoraPredictionOrderBook({
      side: market.edgePct >= 7 ? "BUY_YES" : market.edgePct <= -7 ? "BUY_NO" : "NO_TRADE",
      limitPrice: market.marketProbability,
      fairProbability: market.modelProbability,
      liquidityUsd: market.liquidityUsd,
      spreadPct: market.spreadPct,
      orderUsd: math.recommendedRiskUsd || bankrollUsd * 0.01,
    });

    const approved =
      Math.abs(market.edgePct) >= Number(input.minEdgePct || 7) &&
      market.liquidityUsd >= Number(input.minLiquidityUsd || 1000) &&
      market.spreadPct <= Number(input.maxSpreadPct || 5) &&
      market.resolutionClear !== false &&
      Boolean(math.approved) &&
      Boolean(orderBook.approved);

    const decision = {
      marketId: market.marketId,
      title: market.title,
      category: market.category,
      edgePct: market.edgePct,
      approved,
      action: approved ? math.action : "MONITOR_ONLY",
      recommendedRiskUsd: approved ? math.recommendedRiskUsd : 0,
      expectedValueUsd: math.expectedValueUsd,
      db,
      core,
      math,
      orderBook,
      reason: approved
        ? "Memory-only paper signal approved by strategy, math, order-book and risk gates."
        : "Monitor only: one or more gates failed.",
      updatedAt: new Date().toISOString(),
    };

    recordNexoraMemoryEvent("nexora_memory_safe_scanner", approved ? "approved_math_signal" : "blocked_math_signal", decision);
    decisions.push(decision);
  }

  return {
    ok: true,
    service: "nexora_memory_safe_scanner",
    paperOnly: true,
    mode: db.safeForWrites ? "DB_AVAILABLE_BUT_MEMORY_ROUTE_USED" : "MEMORY_ONLY_DB_RECOVERY_MODE",
    db,
    receivedCount: normalized.length,
    rankedCount: ranked.length,
    approvedCount: decisions.filter((d) => d.approved).length,
    decisions,
    rule: "Market scanner → advanced core → math genius → order-book simulator → memory paper decision.",
    updatedAt: new Date().toISOString(),
  };
}

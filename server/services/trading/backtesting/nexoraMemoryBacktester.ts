import { runNexoraMathGeniusCore } from "../math/nexoraMathGeniusCore";
import { runNexoraMemorySafeScanner } from "../orchestration/nexoraMemorySafeScanner";
import { recordNexoraMemoryEvent } from "../resilience/nexoraMemoryFallbackRuntime";

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export async function runNexoraMemoryBacktest(input: any = {}) {
  const markets = Array.isArray(input.markets) ? input.markets : [];
  const bankrollStart = n(input.bankrollUsd, 1000);
  let bankroll = bankrollStart;

  const trades = [];

  for (const market of markets.slice(0, Number(input.maxMarkets || 100))) {
    const scanner: any = await runNexoraMemorySafeScanner({
      ...input,
      bankrollUsd: bankroll,
      markets: [market],
    });

    const decision = scanner.decisions?.[0] || null;

    const math = runNexoraMathGeniusCore({
      marketProbability: market.marketProbability ?? market.price ?? 0.5,
      modelProbability: market.modelProbability ?? market.fairProbability ?? 0.5,
      liquidityUsd: market.liquidityUsd ?? 0,
      spreadPct: market.spreadPct ?? 100,
      bankrollUsd: bankroll,
      confidence: input.confidence ?? 0.75,
      volatility: input.volatility ?? 0.35,
    });

    const resolvedProbability = n(market.resolvedProbability ?? market.actualProbability, math.modelProbability);
    const won =
      market.outcome === "won" ||
      market.resolvedYes === true ||
      (math.action.includes("BUY_YES") && resolvedProbability >= 0.5) ||
      (math.action.includes("BUY_NO") && resolvedProbability < 0.5);

    const riskUsd = n(math.recommendedRiskUsd, 0);
    const pnl = decision?.approved
      ? won
        ? Math.round(riskUsd * Math.abs(math.adjustedEdgePct / 100) * 100) / 100
        : -Math.round(riskUsd * Math.max(0.01, Math.abs(math.adjustedEdgePct / 100)) * 100) / 100
      : 0;

    bankroll = Math.round((bankroll + pnl) * 100) / 100;

    trades.push({
      marketId: market.marketId || market.id,
      title: market.title || market.question,
      approved: Boolean(decision?.approved),
      action: decision?.action || "MONITOR_ONLY",
      edgePct: math.edgePct,
      adjustedEdgePct: math.adjustedEdgePct,
      riskUsd,
      won,
      pnl,
      bankrollAfter: bankroll,
      decision,
      math,
    });
  }

  const approvedTrades = trades.filter((t) => t.approved);
  const wins = approvedTrades.filter((t) => t.pnl > 0).length;
  const losses = approvedTrades.filter((t) => t.pnl < 0).length;
  const totalPnl = Math.round((bankroll - bankrollStart) * 100) / 100;
  const winRate = approvedTrades.length ? Math.round((wins / approvedTrades.length) * 10000) / 100 : 0;

  const result = {
    ok: true,
    service: "nexora_memory_backtester",
    paperOnly: true,
    temporaryMemoryMode: true,
    testedMarkets: markets.length,
    approvedTrades: approvedTrades.length,
    wins,
    losses,
    winRate,
    bankrollStart,
    bankrollEnd: bankroll,
    totalPnl,
    trades,
    verdict:
      approvedTrades.length < 30
        ? "NEEDS_MORE_SAMPLE"
        : totalPnl > 0 && winRate >= 52
        ? "STRATEGY_PROMISING"
        : "STRATEGY_NEEDS_WORK",
    rule: "Backtest without DB writes while storage is limited.",
    updatedAt: new Date().toISOString(),
  };

  recordNexoraMemoryEvent("nexora_memory_backtester", "backtest_completed", result);
  return result;
}

export function getNexoraMemoryBacktesterStatus() {
  return {
    ok: true,
    service: "nexora_memory_backtester",
    paperOnly: true,
    temporaryMemoryMode: true,
    capabilities: [
      "memory-only historical replay",
      "math-gated signal testing",
      "scanner integration",
      "win/loss summary",
      "bankroll simulation",
      "strategy verdict"
    ],
    updatedAt: new Date().toISOString(),
  };
}

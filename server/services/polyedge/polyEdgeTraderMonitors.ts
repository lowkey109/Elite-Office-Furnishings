import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import {
  paperPositions,
  paperTradeOutcomes,
  paperTradingDecisions,
} from "@shared/schema";

function money(value: unknown) {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
}

function pct(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 100;
}

function positionPnl(pos: any) {
  const entry = Number(pos.entryPrice || 0);
  const current = Number(pos.currentPrice || pos.entryPrice || 0);
  const side = String(pos.side || "long");

  if (!entry || !current) return 0;

  const raw = side === "short" ? entry - current : current - entry;
  return money(raw);
}

export async function getPolyEdgeTraderMonitors() {
  const [openPositions, outcomes, decisions] = await Promise.all([
    db.select().from(paperPositions).where(eq(paperPositions.status, "open")).catch(() => []),
    db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt)).limit(100).catch(() => []),
    db.select().from(paperTradingDecisions).limit(80).catch(() => []),
  ]);

  let autoPaper: any = null;
  try {
    const mod = await import("../trading/polyEdgeAutoPaper");
    autoPaper = await mod.getPolyEdgeAutoPaperStatus();
  } catch {
    autoPaper = null;
  }

  const wins = outcomes.filter((o: any) => String(o.outcome) === "win");
  const losses = outcomes.filter((o: any) => String(o.outcome) === "loss");
  const totalPnl = money(outcomes.reduce((sum: number, o: any) => sum + Number(o.realizedPnl || 0), 0));
  const grossWins = money(wins.reduce((sum: number, o: any) => sum + Math.max(0, Number(o.realizedPnl || 0)), 0));
  const grossLosses = Math.abs(money(losses.reduce((sum: number, o: any) => sum + Math.min(0, Number(o.realizedPnl || 0)), 0)));
  const profitFactor = grossLosses > 0 ? money(grossWins / grossLosses) : grossWins > 0 ? 99 : null;
  const winRate = outcomes.length ? pct(wins.length / outcomes.length) : null;

  const exposure = money(openPositions.reduce((sum: number, p: any) => sum + Number(p.paperCapitalAllocated || 0), 0));
  const openPnl = money(openPositions.reduce((sum: number, p: any) => sum + positionPnl(p), 0));

  const latestDecision: any = decisions[0] || null;
  const avgConfidence = decisions.length
    ? Math.round(decisions.reduce((sum: number, d: any) => sum + Number(d.confidence || 0), 0) / decisions.length)
    : 0;

  const blockedTrades = decisions.filter((d: any) =>
    ["skipped", "rejected", "blocked"].includes(String(d.status || d.executionStatus || "").toLowerCase())
  ).length;

  const regimeScore =
    openPositions.length >= 6 ? 82 :
    outcomes.length >= 20 && Number(winRate || 0) >= 55 ? 74 :
    outcomes.length >= 10 && totalPnl < 0 ? 38 :
    56;

  const regime =
    regimeScore >= 75 ? "TRENDING / ACTIVE" :
    regimeScore >= 55 ? "TRADEABLE" :
    regimeScore >= 40 ? "CHOPPY / DEFENSIVE" :
    "RISK-OFF";

  const riskMode =
    openPositions.length >= 8 ? "MAX EXPOSURE" :
    totalPnl < -500 ? "DEFENSIVE" :
    blockedTrades > 10 ? "STRICT" :
    "NORMAL";

  const strategyMap: Record<string, any> = {};
  for (const o of outcomes as any[]) {
    const key = o.strategy || "unknown";
    if (!strategyMap[key]) strategyMap[key] = { strategy: key, trades: 0, wins: 0, pnl: 0 };
    strategyMap[key].trades += 1;
    strategyMap[key].wins += String(o.outcome) === "win" ? 1 : 0;
    strategyMap[key].pnl += Number(o.realizedPnl || 0);
  }

  const strategyLeaderboard = Object.values(strategyMap)
    .map((r: any) => ({
      strategy: r.strategy,
      trades: r.trades,
      winRate: r.trades ? pct(r.wins / r.trades) : null,
      pnl: money(r.pnl),
      score: Math.round((r.trades ? (r.wins / r.trades) * 60 : 0) + Math.max(-20, Math.min(30, r.pnl / 100))),
    }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5);

  const symbols = ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"];
  const symbolWatchlist = symbols.map((symbol, i) => {
    const symbolOutcomes = (outcomes as any[]).filter((o) => o.symbol === symbol);
    const symbolWins = symbolOutcomes.filter((o) => String(o.outcome) === "win").length;
    const symbolPnl = money(symbolOutcomes.reduce((sum, o) => sum + Number(o.realizedPnl || 0), 0));
    const symbolOpen = (openPositions as any[]).filter((p) => p.symbol === symbol).length;

    return {
      symbol,
      trend: symbolPnl > 0 ? "BULLISH" : symbolPnl < 0 ? "DEFENSIVE" : i % 2 === 0 ? "WATCHING" : "NEUTRAL",
      open: symbolOpen,
      winRate: symbolOutcomes.length ? pct(symbolWins / symbolOutcomes.length) : null,
      pnl: symbolPnl,
      signal: Math.max(25, Math.min(92, avgConfidence + (i - 1) * 4)),
    };
  });

  const signalQuality = {
    confidence: avgConfidence,
    dataQuality: latestDecision?.dataQualityScore || 0,
    latestReason: latestDecision?.reasonCode || "WAITING",
    latestStrategy: latestDecision?.strategy || "WAITING",
    latestSymbol: latestDecision?.market || "WAITING",
    actionable: avgConfidence >= 60 && riskMode !== "MAX EXPOSURE",
    freshness: latestDecision?.createdAt || latestDecision?.updatedAt || null,
  };

  const liquidityOrderFlow = {
    spreadRisk: openPositions.length >= 6 ? "HIGH" : openPositions.length >= 3 ? "MEDIUM" : "LOW",
    simulatedSlippage: decisions.length
      ? money(decisions.reduce((sum: number, d: any) => sum + Number(d.slippageEstimate || 0), 0) / decisions.length)
      : 0,
    volumePressure: regimeScore >= 75 ? "BUY PRESSURE" : totalPnl < 0 ? "SELL PRESSURE" : "BALANCED",
    liquidityScore: Math.max(20, Math.min(94, 88 - openPositions.length * 5 + (totalPnl > 0 ? 8 : 0))),
    executionQuality: profitFactor && profitFactor >= 1.3 ? "GOOD" : profitFactor && profitFactor < 1 ? "POOR" : "NORMAL",
  };

  const newsEventRisk = {
    mode: openPositions.length >= 6 ? "CAUTION" : "CLEAR",
    shockRisk: totalPnl < -500 ? "ELEVATED" : "NORMAL",
    action: openPositions.length >= 6 || totalPnl < -500 ? "SLOW DOWN" : "TRADEABLE",
    headline: "WAITING FOR NEWS FEED",
    riskScore: openPositions.length >= 6 ? 72 : totalPnl < -500 ? 66 : 24,
  };

  return {
    ok: true,
    generatedAt: new Date().toISOString(),

    autoExecution: {
      enabled: autoPaper?.enabled ?? false,
      running: autoPaper?.running ?? false,
      lastAction: autoPaper?.lastAction || "idle",
      lastReason: autoPaper?.lastReason || "Auto paper waiting.",
      ticks: autoPaper?.ticks || 0,
      decisionsCreated: autoPaper?.decisionsCreated || 0,
      positionsOpened: autoPaper?.positionsOpened || 0,
      positionsClosed: autoPaper?.positionsClosed || 0,
      openPositions: openPositions.length,
    },

    openPositions: openPositions.slice(0, 6).map((p: any) => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      strategy: p.strategy,
      entryPrice: p.entryPrice,
      currentPrice: p.currentPrice || p.entryPrice,
      targetPrice: p.targetPrice,
      stopPrice: p.stopPrice,
      paperCapitalAllocated: p.paperCapitalAllocated,
      pnl: positionPnl(p),
      status: p.status,
    })),

    learning: {
      sampleSize: outcomes.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      totalPnl,
      profitFactor,
      learningScore: autoPaper?.learning?.learningScore ?? null,
      confidenceFloor: autoPaper?.learning?.confidenceFloor ?? null,
    },

    riskGovernor: {
      mode: riskMode,
      exposure,
      openPnl,
      openPositions: openPositions.length,
      maxOpenPositions: autoPaper?.fastLearning?.maxOpenPositions || 8,
      blockedTrades,
      liveTradingAffected: false,
      paperOnly: true,
    },

    marketRegime: {
      regime,
      score: regimeScore,
      tradable: regimeScore >= 55,
      signalQuality: avgConfidence,
      latestSymbol: latestDecision?.market || "WAITING",
      latestStrategy: latestDecision?.strategy || "WAITING",
      latestConfidence: latestDecision?.confidence || 0,
    },

    strategyLeaderboard,
    symbolWatchlist,
    signalQuality,
    liquidityOrderFlow,
    newsEventRisk,
  };
}

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
  };
}

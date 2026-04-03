import { db } from "../../db";
import { paperTradeOutcomes, strategyPerformanceSnapshots } from "@shared/schema";
import { eq, desc, gte } from "drizzle-orm";
import { MIN_TRADES_THRESHOLD } from "./tradingLearning";

export interface StrategyHealthReport {
  strategyName: string;
  winRate: number;
  expectancy: number;
  avgReturn: number;
  totalPnl: number;
  tradeCount: number;
  drawdown: number;
  profitFactor: number;
  recentWinRate: number | null;
  historicalWinRate: number | null;
  isDegrading: boolean;
  isHighPerforming: boolean;
}

export interface StrategyHealthSummary {
  sufficientData: boolean;
  totalOutcomes: number;
  strategies: StrategyHealthReport[];
}

const RECENT_TRADE_WINDOW = 10;

export async function calculateStrategyHealth(): Promise<StrategyHealthSummary> {
  const outcomes = await db
    .select()
    .from(paperTradeOutcomes)
    .orderBy(paperTradeOutcomes.createdAt);

  if (outcomes.length < MIN_TRADES_THRESHOLD) {
    return { sufficientData: false, totalOutcomes: outcomes.length, strategies: [] };
  }

  const byStrategy: Record<string, typeof outcomes> = {};
  for (const o of outcomes) {
    if (!byStrategy[o.strategy]) byStrategy[o.strategy] = [];
    byStrategy[o.strategy].push(o);
  }

  const strategies: StrategyHealthReport[] = [];

  for (const [name, trades] of Object.entries(byStrategy)) {
    const wins = trades.filter(t => t.outcome === "win");
    const losses = trades.filter(t => t.outcome === "loss");
    const winRate = (wins.length / trades.length) * 100;
    const totalPnl = trades.reduce((s, t) => s + t.realizedPnl, 0);
    const expectancy = totalPnl / trades.length;
    const avgReturn = totalPnl / trades.length;

    const totalWinPnl = wins.reduce((s, t) => s + t.realizedPnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((s, t) => s + t.realizedPnl, 0));
    const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? Infinity : 0;

    let peak = 0, maxDrawdown = 0, cumPnl = 0;
    for (const t of trades) {
      cumPnl += t.realizedPnl;
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    let recentWinRate: number | null = null;
    let historicalWinRate: number | null = null;
    if (trades.length >= RECENT_TRADE_WINDOW * 2) {
      const recent = trades.slice(-RECENT_TRADE_WINDOW);
      const historical = trades.slice(0, -RECENT_TRADE_WINDOW);
      recentWinRate = (recent.filter(t => t.outcome === "win").length / recent.length) * 100;
      historicalWinRate = (historical.filter(t => t.outcome === "win").length / historical.length) * 100;
    }

    const isDegrading = recentWinRate !== null && historicalWinRate !== null
      ? recentWinRate < historicalWinRate - 15 || (recentWinRate < 40 && maxDrawdown > 20)
      : false;

    const isHighPerforming = winRate >= 60 && expectancy > 0 && profitFactor >= 1.5 && trades.length >= 10;

    strategies.push({
      strategyName: name,
      winRate,
      expectancy,
      avgReturn,
      totalPnl,
      tradeCount: trades.length,
      drawdown: maxDrawdown,
      profitFactor,
      recentWinRate,
      historicalWinRate,
      isDegrading,
      isHighPerforming,
    });
  }

  strategies.sort((a, b) => b.expectancy - a.expectancy);

  return { sufficientData: true, totalOutcomes: outcomes.length, strategies };
}

export async function persistStrategySnapshots(reports: StrategyHealthReport[]): Promise<void> {
  const now = new Date();
  for (const r of reports) {
    await db.insert(strategyPerformanceSnapshots).values({
      strategyName: r.strategyName,
      winRate: r.winRate,
      expectancy: r.expectancy,
      avgWin: r.avgReturn > 0 ? r.avgReturn : 0,
      avgLoss: r.avgReturn < 0 ? r.avgReturn : 0,
      tradeCount: r.tradeCount,
      totalPnl: r.totalPnl,
      drawdown: r.drawdown,
      profitFactor: r.profitFactor === Infinity ? 999 : r.profitFactor,
      isDegrading: r.isDegrading,
      isHighPerforming: r.isHighPerforming,
      periodEnd: now,
    });
  }
}

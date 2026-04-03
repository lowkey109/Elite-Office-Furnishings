import { db } from "../../db";
import { executionLogs, paperTradeOutcomes } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface ExecutionAnalytics {
  overallStats: {
    totalTrades: number;
    avgSlippage: number;
    worstSlippage: number;
    slippageVariance: number;
    poorExecutionPct: number;
    executionDrag: number;
  };
  bySymbol: Record<string, { avgSlippage: number; trades: number; avgScore: number }>;
  byStrategy: Record<string, { avgSlippage: number; trades: number; avgScore: number }>;
  qualityDistribution: Record<string, number>;
  worstExecutions: any[];
  theoreticalVsActualPnl: { theoretical: number; actual: number; drag: number };
}

export async function calculateExecutionAnalytics(): Promise<ExecutionAnalytics> {
  const logs = await db.select().from(executionLogs).orderBy(desc(executionLogs.createdAt)).limit(200);

  if (logs.length === 0) {
    return {
      overallStats: { totalTrades: 0, avgSlippage: 0, worstSlippage: 0, slippageVariance: 0, poorExecutionPct: 0, executionDrag: 0 },
      bySymbol: {},
      byStrategy: {},
      qualityDistribution: {},
      worstExecutions: [],
      theoreticalVsActualPnl: { theoretical: 0, actual: 0, drag: 0 },
    };
  }

  const totalTrades = logs.length;
  const slippages = logs.map(l => l.totalSlippage);
  const avgSlippage = Math.round(slippages.reduce((s, v) => s + v, 0) / totalTrades * 100) / 100;
  const worstSlippage = Math.round(Math.max(...slippages) * 100) / 100;
  const mean = avgSlippage;
  const variance = Math.round(slippages.reduce((s, v) => s + (v - mean) ** 2, 0) / totalTrades * 100) / 100;

  const poorCount = logs.filter(l => l.executionQualityScore < 55).length;
  const poorExecutionPct = Math.round((poorCount / totalTrades) * 100);

  const totalSlippageCost = slippages.reduce((s, v) => s + v, 0);
  const executionDrag = Math.round(totalSlippageCost * 100) / 100;

  const bySymbol: Record<string, { totalSlippage: number; trades: number; totalScore: number }> = {};
  const byStrategy: Record<string, { totalSlippage: number; trades: number; totalScore: number }> = {};
  const qualityDistribution: Record<string, number> = { excellent: 0, good: 0, acceptable: 0, poor: 0, failed: 0 };

  for (const log of logs) {
    if (!bySymbol[log.symbol]) bySymbol[log.symbol] = { totalSlippage: 0, trades: 0, totalScore: 0 };
    bySymbol[log.symbol].totalSlippage += log.totalSlippage;
    bySymbol[log.symbol].trades += 1;
    bySymbol[log.symbol].totalScore += log.executionQualityScore;

    if (!byStrategy[log.strategy]) byStrategy[log.strategy] = { totalSlippage: 0, trades: 0, totalScore: 0 };
    byStrategy[log.strategy].totalSlippage += log.totalSlippage;
    byStrategy[log.strategy].trades += 1;
    byStrategy[log.strategy].totalScore += log.executionQualityScore;

    const label = log.executionQualityLabel as keyof typeof qualityDistribution;
    if (qualityDistribution[label] !== undefined) qualityDistribution[label]++;
  }

  const formattedBySymbol: Record<string, { avgSlippage: number; trades: number; avgScore: number }> = {};
  for (const [sym, data] of Object.entries(bySymbol)) {
    formattedBySymbol[sym] = {
      avgSlippage: Math.round(data.totalSlippage / data.trades * 100) / 100,
      trades: data.trades,
      avgScore: Math.round(data.totalScore / data.trades),
    };
  }

  const formattedByStrategy: Record<string, { avgSlippage: number; trades: number; avgScore: number }> = {};
  for (const [strat, data] of Object.entries(byStrategy)) {
    formattedByStrategy[strat] = {
      avgSlippage: Math.round(data.totalSlippage / data.trades * 100) / 100,
      trades: data.trades,
      avgScore: Math.round(data.totalScore / data.trades),
    };
  }

  const worstExecutions = logs
    .sort((a, b) => a.executionQualityScore - b.executionQualityScore)
    .slice(0, 5)
    .map(l => ({
      id: l.id,
      symbol: l.symbol,
      strategy: l.strategy,
      totalSlippage: l.totalSlippage,
      slippagePct: l.slippagePct,
      score: l.executionQualityScore,
      label: l.executionQualityLabel,
      createdAt: l.createdAt?.toISOString(),
    }));

  const outcomes = await db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt)).limit(200);
  const actualPnl = Math.round(outcomes.reduce((s, o) => s + o.realizedPnl, 0) * 100) / 100;
  const theoreticalPnl = Math.round(actualPnl + totalSlippageCost + outcomes.reduce((s, o) => s + o.fees, 0));
  const drag = Math.round((theoreticalPnl - actualPnl) * 100) / 100;

  return {
    overallStats: { totalTrades, avgSlippage, worstSlippage, slippageVariance: variance, poorExecutionPct, executionDrag },
    bySymbol: formattedBySymbol,
    byStrategy: formattedByStrategy,
    qualityDistribution,
    worstExecutions,
    theoreticalVsActualPnl: { theoretical: theoreticalPnl, actual: actualPnl, drag },
  };
}

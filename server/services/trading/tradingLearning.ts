import { db } from "../../db";
import { paperTradeOutcomes, paperTradingDecisions } from "@shared/schema";
import { desc, eq, sql, and, gte, lte } from "drizzle-orm";

const MIN_TRADES_THRESHOLD = 20;

export interface OutcomeMetrics {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  totalPnl: number;
  maxDrawdown: number;
  tradeCount: number;
  profitFactor: number;
}

export interface GroupedAnalysis {
  groupKey: string;
  groupValue: string;
  metrics: OutcomeMetrics;
}

export interface LearningAnalysis {
  sufficientData: boolean;
  totalOutcomes: number;
  overall: OutcomeMetrics | null;
  byStrategy: GroupedAnalysis[];
  bySymbol: GroupedAnalysis[];
  byConfidenceBand: GroupedAnalysis[];
  byDurationBucket: GroupedAnalysis[];
  byExitReason: GroupedAnalysis[];
}

function calculateMetrics(outcomes: any[]): OutcomeMetrics {
  if (outcomes.length === 0) {
    return { winRate: 0, avgWin: 0, avgLoss: 0, expectancy: 0, totalPnl: 0, maxDrawdown: 0, tradeCount: 0, profitFactor: 0 };
  }

  const wins = outcomes.filter(o => o.outcome === "win");
  const losses = outcomes.filter(o => o.outcome === "loss");
  const winRate = (wins.length / outcomes.length) * 100;
  const avgWin = wins.length > 0 ? wins.reduce((s, o) => s + o.realizedPnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, o) => s + o.realizedPnl, 0) / losses.length : 0;
  const totalPnl = outcomes.reduce((s, o) => s + o.realizedPnl, 0);
  const expectancy = totalPnl / outcomes.length;

  const totalWinPnl = wins.reduce((s, o) => s + o.realizedPnl, 0);
  const totalLossPnl = Math.abs(losses.reduce((s, o) => s + o.realizedPnl, 0));
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? Infinity : 0;

  let peak = 0;
  let maxDrawdown = 0;
  let cumPnl = 0;
  for (const o of outcomes) {
    cumPnl += o.realizedPnl;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return { winRate, avgWin, avgLoss, expectancy, totalPnl, maxDrawdown, tradeCount: outcomes.length, profitFactor };
}

function groupBy(outcomes: any[], keyFn: (o: any) => string, groupKey: string): GroupedAnalysis[] {
  const groups: Record<string, any[]> = {};
  for (const o of outcomes) {
    const val = keyFn(o);
    if (!groups[val]) groups[val] = [];
    groups[val].push(o);
  }
  return Object.entries(groups).map(([groupValue, items]) => ({
    groupKey,
    groupValue,
    metrics: calculateMetrics(items),
  }));
}

function getConfidenceBand(confidence: number): string {
  if (confidence >= 80) return "80-100";
  if (confidence >= 70) return "70-79";
  if (confidence >= 60) return "60-69";
  return "below-60";
}

function getDurationBucket(duration: string): string {
  const match = duration.match(/(\d+)h?\s*(\d+)?m?/);
  if (!match) return "unknown";
  const hours = parseInt(match[1]) || 0;
  const mins = parseInt(match[2]) || 0;
  const totalMins = hours * 60 + mins;
  if (totalMins <= 15) return "0-15m";
  if (totalMins <= 60) return "15m-1h";
  if (totalMins <= 240) return "1h-4h";
  if (totalMins <= 1440) return "4h-24h";
  return "24h+";
}

export async function analyzeOutcomes(): Promise<LearningAnalysis> {
  const outcomes = await db
    .select()
    .from(paperTradeOutcomes)
    .orderBy(paperTradeOutcomes.createdAt);

  if (outcomes.length < MIN_TRADES_THRESHOLD) {
    return {
      sufficientData: false,
      totalOutcomes: outcomes.length,
      overall: null,
      byStrategy: [],
      bySymbol: [],
      byConfidenceBand: [],
      byDurationBucket: [],
      byExitReason: [],
    };
  }

  const decisions = await db.select().from(paperTradingDecisions);
  const decisionMap = new Map(decisions.map(d => [d.id, d]));

  const enriched = outcomes.map(o => ({
    ...o,
    confidence: decisionMap.get(o.linkedDecisionId)?.confidence ?? 0,
    regime: decisionMap.get(o.linkedDecisionId)?.regime ?? "unknown",
  }));

  return {
    sufficientData: true,
    totalOutcomes: outcomes.length,
    overall: calculateMetrics(enriched),
    byStrategy: groupBy(enriched, o => o.strategy, "strategy"),
    bySymbol: groupBy(enriched, o => o.symbol, "symbol"),
    byConfidenceBand: groupBy(enriched, o => getConfidenceBand(o.confidence), "confidenceBand"),
    byDurationBucket: groupBy(enriched, o => getDurationBucket(o.duration), "durationBucket"),
    byExitReason: groupBy(enriched, o => o.exitReason, "exitReason"),
  };
}

export { MIN_TRADES_THRESHOLD, calculateMetrics };

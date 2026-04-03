import { db } from "../../db";
import { paperTradeOutcomes, paperTradingDecisions, edgeInsights } from "@shared/schema";
import { desc, sql } from "drizzle-orm";
import { analyzeOutcomes, type GroupedAnalysis, MIN_TRADES_THRESHOLD } from "./tradingLearning";

export interface EdgeInsightOutput {
  insightType: "top_setup" | "weak_setup" | "degradation" | "anomaly";
  description: string;
  confidence: number;
  strategy?: string;
  symbol?: string;
  regime?: string;
  tradeCount: number;
  supportingData: Record<string, any>;
}

const MIN_GROUP_SIZE = 5;

function findTopSetups(groups: GroupedAnalysis[]): EdgeInsightOutput[] {
  return groups
    .filter(g => g.metrics.tradeCount >= MIN_GROUP_SIZE && g.metrics.winRate >= 65 && g.metrics.expectancy > 0)
    .sort((a, b) => b.metrics.expectancy - a.metrics.expectancy)
    .slice(0, 3)
    .map(g => ({
      insightType: "top_setup" as const,
      description: `${g.groupKey}=${g.groupValue}: ${g.metrics.winRate.toFixed(1)}% win rate, $${g.metrics.expectancy.toFixed(2)} expectancy across ${g.metrics.tradeCount} trades`,
      confidence: Math.min(95, 50 + g.metrics.tradeCount * 2),
      strategy: g.groupKey === "strategy" ? g.groupValue : undefined,
      symbol: g.groupKey === "symbol" ? g.groupValue : undefined,
      tradeCount: g.metrics.tradeCount,
      supportingData: { groupKey: g.groupKey, groupValue: g.groupValue, metrics: g.metrics },
    }));
}

function findWeakSetups(groups: GroupedAnalysis[]): EdgeInsightOutput[] {
  return groups
    .filter(g => g.metrics.tradeCount >= MIN_GROUP_SIZE && (g.metrics.winRate < 40 || g.metrics.expectancy < 0))
    .sort((a, b) => a.metrics.expectancy - b.metrics.expectancy)
    .slice(0, 3)
    .map(g => ({
      insightType: "weak_setup" as const,
      description: `${g.groupKey}=${g.groupValue}: ${g.metrics.winRate.toFixed(1)}% win rate, $${g.metrics.expectancy.toFixed(2)} expectancy — underperforming`,
      confidence: Math.min(90, 50 + g.metrics.tradeCount * 2),
      strategy: g.groupKey === "strategy" ? g.groupValue : undefined,
      symbol: g.groupKey === "symbol" ? g.groupValue : undefined,
      tradeCount: g.metrics.tradeCount,
      supportingData: { groupKey: g.groupKey, groupValue: g.groupValue, metrics: g.metrics },
    }));
}

function detectDegradation(byStrategy: GroupedAnalysis[]): EdgeInsightOutput[] {
  return byStrategy
    .filter(g => g.metrics.tradeCount >= 10 && g.metrics.maxDrawdown > 25)
    .map(g => ({
      insightType: "degradation" as const,
      description: `${g.groupValue} showing ${g.metrics.maxDrawdown.toFixed(1)}% max drawdown with ${g.metrics.winRate.toFixed(1)}% win rate — edge may be decaying`,
      confidence: Math.min(85, 40 + g.metrics.tradeCount),
      strategy: g.groupValue,
      tradeCount: g.metrics.tradeCount,
      supportingData: { metrics: g.metrics },
    }));
}

function detectAnomalies(allGroups: GroupedAnalysis[]): EdgeInsightOutput[] {
  const insights: EdgeInsightOutput[] = [];
  for (const g of allGroups) {
    if (g.metrics.tradeCount >= MIN_GROUP_SIZE && g.metrics.profitFactor > 3) {
      insights.push({
        insightType: "anomaly" as const,
        description: `${g.groupKey}=${g.groupValue}: unusually high profit factor of ${g.metrics.profitFactor.toFixed(2)} — may indicate edge or small sample`,
        confidence: Math.min(70, 30 + g.metrics.tradeCount * 2),
        strategy: g.groupKey === "strategy" ? g.groupValue : undefined,
        symbol: g.groupKey === "symbol" ? g.groupValue : undefined,
        tradeCount: g.metrics.tradeCount,
        supportingData: { groupKey: g.groupKey, groupValue: g.groupValue, metrics: g.metrics },
      });
    }
  }
  return insights.slice(0, 3);
}

export async function generateEdgeInsights(): Promise<{ sufficientData: boolean; insights: EdgeInsightOutput[] }> {
  const analysis = await analyzeOutcomes();
  if (!analysis.sufficientData) {
    return { sufficientData: false, insights: [] };
  }

  const allGroups = [...analysis.byStrategy, ...analysis.bySymbol, ...analysis.byConfidenceBand, ...analysis.byDurationBucket];

  const insights: EdgeInsightOutput[] = [
    ...findTopSetups(allGroups),
    ...findWeakSetups(allGroups),
    ...detectDegradation(analysis.byStrategy),
    ...detectAnomalies(allGroups),
  ];

  return { sufficientData: true, insights };
}

export async function persistEdgeInsights(insights: EdgeInsightOutput[]): Promise<void> {
  if (insights.length === 0) return;

  await db.update(edgeInsights).set({ isActive: false });

  for (const insight of insights) {
    await db.insert(edgeInsights).values({
      insightType: insight.insightType,
      description: insight.description,
      confidence: insight.confidence,
      strategy: insight.strategy,
      symbol: insight.symbol,
      regime: insight.regime,
      tradeCount: insight.tradeCount,
      supportingDataJson: insight.supportingData,
      isActive: true,
    });
  }
}

import { db } from "../../db";
import { learningRecommendations } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { calculateStrategyHealth } from "./strategyHealth";
import { generateEdgeInsights } from "./tradingEdgeAnalysis";
import { reviewDecisionQuality } from "./decisionQuality";

export interface RecommendationOutput {
  recommendationType: string;
  description: string;
  suggestedChange: string;
  confidence: number;
  strategy?: string;
  symbol?: string;
  evidence: Record<string, any>;
}

export interface RecommendationsSummary {
  sufficientData: boolean;
  recommendations: RecommendationOutput[];
  totalPending: number;
}

export async function generateRecommendations(): Promise<RecommendationsSummary> {
  const [health, edges, quality] = await Promise.all([
    calculateStrategyHealth(),
    generateEdgeInsights(),
    reviewDecisionQuality(),
  ]);

  if (!health.sufficientData) {
    return { sufficientData: false, recommendations: [], totalPending: 0 };
  }

  const recs: RecommendationOutput[] = [];

  for (const s of health.strategies) {
    if (s.isDegrading) {
      recs.push({
        recommendationType: "disable_strategy",
        description: `${s.strategyName} is degrading — recent win rate ${s.recentWinRate?.toFixed(1)}% vs historical ${s.historicalWinRate?.toFixed(1)}%`,
        suggestedChange: `Consider disabling ${s.strategyName} or reducing position size`,
        confidence: Math.min(85, 50 + s.tradeCount),
        strategy: s.strategyName,
        evidence: { winRate: s.winRate, recentWinRate: s.recentWinRate, historicalWinRate: s.historicalWinRate, drawdown: s.drawdown },
      });
    }

    if (s.isHighPerforming && s.tradeCount >= 15) {
      recs.push({
        recommendationType: "increase_allocation",
        description: `${s.strategyName} is high-performing — ${s.winRate.toFixed(1)}% WR, ${s.profitFactor.toFixed(2)} PF`,
        suggestedChange: `Consider increasing allocation weight for ${s.strategyName}`,
        confidence: Math.min(80, 40 + s.tradeCount),
        strategy: s.strategyName,
        evidence: { winRate: s.winRate, expectancy: s.expectancy, profitFactor: s.profitFactor },
      });
    }

    if (s.tradeCount >= 10 && s.winRate < 40 && s.expectancy < 0) {
      recs.push({
        recommendationType: "reduce_exposure",
        description: `${s.strategyName} on ${s.strategyName}: negative expectancy $${s.expectancy.toFixed(2)}`,
        suggestedChange: `Reduce position sizing or add stricter entry filters`,
        confidence: Math.min(80, 45 + s.tradeCount),
        strategy: s.strategyName,
        evidence: { winRate: s.winRate, expectancy: s.expectancy, totalPnl: s.totalPnl },
      });
    }
  }

  if (quality.sufficientData && quality.avgQualityScore < 50) {
    recs.push({
      recommendationType: "raise_confidence_threshold",
      description: `Average decision quality score is ${quality.avgQualityScore.toFixed(1)}/100 — too many low-quality entries`,
      suggestedChange: `Raise minimum confidence threshold from 60 to 70`,
      confidence: 75,
      evidence: { avgQualityScore: quality.avgQualityScore, distribution: quality.distribution },
    });
  }

  for (const insight of edges.insights) {
    if (insight.insightType === "weak_setup" && insight.confidence >= 60) {
      const existing = recs.find(r => r.strategy === insight.strategy && r.recommendationType === "reduce_exposure");
      if (!existing) {
        recs.push({
          recommendationType: "avoid_weak_setup",
          description: insight.description,
          suggestedChange: `Avoid or reduce sizing for this setup configuration`,
          confidence: insight.confidence,
          strategy: insight.strategy,
          symbol: insight.symbol,
          evidence: insight.supportingData,
        });
      }
    }
  }

  const newRecs: RecommendationOutput[] = [];
  for (const r of recs) {
    try {
      await db.insert(learningRecommendations).values({
        recommendationType: r.recommendationType,
        description: r.description,
        suggestedChange: r.suggestedChange,
        confidence: r.confidence,
        strategy: r.strategy,
        symbol: r.symbol,
        evidenceJson: r.evidence,
        status: "pending",
      });
      newRecs.push(r);
    } catch (err: any) {
      console.error(`[LearningRec] Failed to persist recommendation:`, err?.message);
    }
  }

  const pendingCount = await db.select().from(learningRecommendations).where(eq(learningRecommendations.status, "pending"));

  return {
    sufficientData: true,
    recommendations: newRecs.length > 0 ? newRecs : recs,
    totalPending: pendingCount.length,
  };
}

export async function getLearningRecommendations(): Promise<RecommendationOutput[]> {
  const recs = await db
    .select()
    .from(learningRecommendations)
    .where(eq(learningRecommendations.status, "pending"))
    .orderBy(desc(learningRecommendations.createdAt))
    .limit(20);

  return recs.map(r => ({
    recommendationType: r.recommendationType,
    description: r.description,
    suggestedChange: r.suggestedChange,
    confidence: r.confidence,
    strategy: r.strategy ?? undefined,
    symbol: r.symbol ?? undefined,
    evidence: (r.evidenceJson as Record<string, any>) ?? {},
  }));
}

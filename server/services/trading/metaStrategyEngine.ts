import { db } from "../../db";
import { metaStrategySelections, paperTradeOutcomes } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const ALL_STRATEGIES = ["momentum_breakout", "mean_reversion", "trend_following", "news_catalyst"];

const MIN_TRADES_FOR_EVAL = 5;
const DISABLE_THRESHOLD = 30;
const ENABLE_THRESHOLD = 50;

export interface StrategyEvaluation {
  strategy: string;
  isEnabled: boolean;
  performanceScore: number;
  winRate: number;
  recentPnl: number;
  tradeCount: number;
  disabledReason: string | null;
}

export async function evaluateStrategies(): Promise<StrategyEvaluation[]> {
  const outcomes = await db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt)).limit(500);
  const evaluations: StrategyEvaluation[] = [];

  for (const strategy of ALL_STRATEGIES) {
    const stratOutcomes = outcomes.filter(o => o.strategy === strategy);
    const tradeCount = stratOutcomes.length;

    if (tradeCount < MIN_TRADES_FOR_EVAL) {
      evaluations.push({
        strategy, isEnabled: true, performanceScore: 50,
        winRate: 0, recentPnl: 0, tradeCount,
        disabledReason: null,
      });
      continue;
    }

    const wins = stratOutcomes.filter(o => (o.realizedPnl || o.realizedPnl) > 0).length;
    const winRate = Math.round((wins / tradeCount) * 100);
    const recentPnl = stratOutcomes.slice(0, 20).reduce((s, o) => s + (o.realizedPnl || o.realizedPnl), 0);
    const performanceScore = Math.round(Math.max(0, Math.min(100, winRate * 0.6 + (recentPnl > 0 ? 30 : recentPnl > -500 ? 15 : 0) + (tradeCount > 20 ? 10 : 5))));

    let isEnabled = true;
    let disabledReason: string | null = null;

    if (performanceScore < DISABLE_THRESHOLD) {
      isEnabled = false;
      disabledReason = `Score ${performanceScore} below threshold ${DISABLE_THRESHOLD}`;
    }

    evaluations.push({ strategy, isEnabled, performanceScore, winRate, recentPnl: Math.round(recentPnl * 100) / 100, tradeCount, disabledReason });
  }

  try {
    for (const eval_ of evaluations) {
      const existing = await db.select().from(metaStrategySelections).where(eq(metaStrategySelections.strategy, eval_.strategy)).limit(1);
      if (existing.length > 0) {
        await db.update(metaStrategySelections).set({
          isEnabled: eval_.isEnabled, performanceScore: eval_.performanceScore,
          winRate: eval_.winRate, recentPnl: eval_.recentPnl,
          tradeCount: eval_.tradeCount, disabledReason: eval_.disabledReason,
          lastEvaluatedAt: new Date(), updatedAt: new Date(),
        }).where(eq(metaStrategySelections.strategy, eval_.strategy));
      } else {
        await db.insert(metaStrategySelections).values({
          strategy: eval_.strategy, isEnabled: eval_.isEnabled,
          performanceScore: eval_.performanceScore, winRate: eval_.winRate,
          recentPnl: eval_.recentPnl, tradeCount: eval_.tradeCount,
          disabledReason: eval_.disabledReason, lastEvaluatedAt: new Date(),
        });
      }
    }
  } catch (err) {
    console.error("[metaStrategy] Failed to persist evaluations:", err instanceof Error ? err.message : err);
  }

  return evaluations;
}

export async function getMetaStrategyStatus(): Promise<{
  evaluations: StrategyEvaluation[];
  enabledStrategies: string[];
  disabledStrategies: { strategy: string; reason: string }[];
  config: { minTradesForEval: number; disableThreshold: number; enableThreshold: number };
}> {
  const evaluations = await evaluateStrategies();
  return {
    evaluations,
    enabledStrategies: evaluations.filter(e => e.isEnabled).map(e => e.strategy),
    disabledStrategies: evaluations.filter(e => !e.isEnabled).map(e => ({ strategy: e.strategy, reason: e.disabledReason || "Unknown" })),
    config: { minTradesForEval: MIN_TRADES_FOR_EVAL, disableThreshold: DISABLE_THRESHOLD, enableThreshold: ENABLE_THRESHOLD },
  };
}

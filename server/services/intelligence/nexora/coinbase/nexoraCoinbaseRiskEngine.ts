import { coinbaseLearningSnapshot } from "./nexoraCoinbaseLearningEngine";
import { coinbaseSafetyEnvelope } from "./nexoraCoinbaseLiveConfig";

export function coinbaseRiskAssessment() {
  const learning = coinbaseLearningSnapshot();
  const safety = coinbaseSafetyEnvelope();

  const totalTrades = learning.stats?.totalTrades || 0;
  const pnl = learning.stats?.totalPnlAud || 0;
  const winRate = learning.winRate || 0;

  let risk = "low";
  let score = 20;
  let recommendation = "continue_paper_learning";

  if (totalTrades < 25) {
    risk = "medium";
    score = 45;
    recommendation = "collect_more_data";
  }

  if (winRate < 45 || pnl < 0) {
    risk = "high";
    score = 75;
    recommendation = "reduce_position_size";
  }

  if (winRate > 55 && pnl > 0 && totalTrades > 50) {
    risk = "controlled";
    score = 28;
    recommendation = "continue_current_strategy_with_limits";
  }

  return {
    generatedAt: new Date().toISOString(),
    risk,
    riskScore: score,
    recommendation,
    metrics: {
      totalTrades,
      pnlAud: pnl,
      winRate,
    },
    protections: {
      withdrawalsLocked: safety.withdrawalsLocked,
      dryRunMode: safety.dryRunMode,
      liveEnabled: safety.liveEnabled,
      maxPositionAud: safety.maxPositionAud,
    },
  };
}

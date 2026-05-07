import { coinbaseLearningSnapshot } from "./nexoraCoinbaseLearningEngine";
import { buildMoonDevCoinbasePaperPolicy } from "../autonomy/moondevpolicy/nexoraMoonDevPolicyAdapter";

export function chooseCoinbasePaperStrategy() {
  const learning = coinbaseLearningSnapshot();

  const strategies = Object.entries(learning.byStrategy || {})
    .map(([name, stats]: any) => ({
      name,
      trades: stats.trades || 0,
      winRate: stats.winRate || 0,
      pnlAud: stats.pnlAud || 0,
      score: (stats.winRate || 0) + Math.max(-50, Math.min(50, stats.pnlAud || 0)),
    }))
    .sort((a, b) => b.score - a.score);

  const best = strategies[0];

  const moonDevPolicy = buildMoonDevCoinbasePaperPolicy({
    venue: "coinbase",
    mode: "paper",
    products: ["BTC-USD", "ETH-USD", "SOL-USD"],
  });

  if (!best || best.trades < 10) {
    return {
      strategy: "moondev_policy_guided_paper_learning",
      confidence: 35,
      reason: "not_enough_trade_history_use_moondev_policy",
      moonDevPolicy,
      learning,
    };
  }

  return {
    strategy: best.name,
    confidence: Math.min(95, Math.max(40, best.score)),
    reason: "best_historical_paper_strategy_with_moondev_policy",
    best,
    moonDevPolicy,
    learning,
  };
}

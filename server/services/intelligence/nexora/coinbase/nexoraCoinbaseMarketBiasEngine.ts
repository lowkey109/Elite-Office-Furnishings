import { coinbaseLearningSnapshot } from "./nexoraCoinbaseLearningEngine";

export function coinbaseMarketBias() {
  const learning = coinbaseLearningSnapshot();

  const products = Object.entries(learning.byProduct || {})
    .map(([product, stats]: any) => ({
      product,
      trades: stats.trades || 0,
      pnlAud: stats.pnlAud || 0,
      winRate: stats.winRate || 0,
      score: (stats.winRate || 0) * 0.7 + (stats.pnlAud || 0) * 0.3,
    }))
    .sort((a, b) => b.score - a.score);

  const strongest = products[0];

  if (!strongest) {
    return {
      bias: "neutral",
      confidence: 0,
      reason: "no_market_history",
    };
  }

  return {
    bias: strongest.score > 55 ? "bullish" : strongest.score < 45 ? "bearish" : "neutral",
    confidence: Number(Math.max(5, Math.min(95, strongest.score)).toFixed(2)),
    strongestProduct: strongest.product,
    strongest,
  };
}

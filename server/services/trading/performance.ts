import type { TradeOutcome, TradingPerformance } from "./types";

export function buildPerformance(outcomes: TradeOutcome[]): TradingPerformance {
  const wins = outcomes.filter(o => o.outcome === "win");
  const losses = outcomes.filter(o => o.outcome === "loss");
  const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, o) => s + o.realizedPnl, 0) / wins.length * 100) / 100 : 0;
  const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, o) => s + Math.abs(o.realizedPnl), 0) / losses.length * 100) / 100 : 0;
  const winRate = outcomes.length > 0 ? wins.length / outcomes.length : 0;
  const expectancy = Math.round((winRate * avgWin - (1 - winRate) * avgLoss) * 100) / 100;
  const totalWinPnl = wins.reduce((s, o) => s + o.realizedPnl, 0);
  const totalLossPnl = losses.reduce((s, o) => s + Math.abs(o.realizedPnl), 0);
  const profitFactor = totalLossPnl > 0 ? Math.round((totalWinPnl / totalLossPnl) * 100) / 100 : 0;

  let consWins = 0, consLosses = 0, curWins = 0, curLosses = 0;
  for (const o of outcomes) {
    if (o.outcome === "win") { curWins++; curLosses = 0; consWins = Math.max(consWins, curWins); }
    else { curLosses++; curWins = 0; consLosses = Math.max(consLosses, curLosses); }
  }

  let cumPnl = 0;
  let peak = 0;
  let maxDD = 0;
  const pnlSeries = outcomes
    .slice()
    .reverse()
    .map((o) => {
      cumPnl += o.realizedPnl;
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
      return { date: o.timestamp, value: Math.round(cumPnl * 100) / 100 };
    });

  const totalPnl = Math.round(cumPnl * 100) / 100;
  const returns = outcomes.map(o => o.realizedPnl);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? Math.round((mean / stdDev) * Math.sqrt(252) * 100) / 100 : 0;

  return {
    avgWin,
    avgLoss,
    expectancy,
    consecutiveWins: consWins,
    consecutiveLosses: consLosses,
    sharpeRatio,
    profitFactor,
    maxDrawdown: Math.round(maxDD * 100) / 100,
    totalPnl,
    pnlSeries,
  };
}

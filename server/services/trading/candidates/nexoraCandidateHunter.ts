import { runNexoraSimpleBacktest } from "../backtest/nexoraBacktestEngine";

const symbols = ["BTC/USD", "ETH/USD", "SOL/USD"];
const timeframes = ["1m", "5m"];
const strategies = [
  "volatility_squeeze",
  "momentum_breakout",
  "trend_follow",
  "mean_reversion",
];
const directions: ("long" | "short")[] = ["long", "short"];

export async function runNexoraCandidateHunter() {
  const candidates: any[] = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      for (const strategy of strategies) {
        for (const direction of directions) {
          const result = await runNexoraSimpleBacktest({
            symbol,
            timeframe,
            strategy,
            direction,
            limit: 200,
          }).catch(() => null);

          if (!result?.ok) continue;

          const trades = Number(result.trades || 0);
          const pnl = Number(result.pnl || 0);
          const winRate = Number(result.winRate || 0);

          const score =
            (winRate * 0.7) +
            (pnl > 0 ? Math.min(30, pnl / 10) : pnl / 20);

          candidates.push({
            symbol,
            timeframe,
            strategy,
            direction,
            trades,
            winRate,
            pnl,
            score,
            approved:
              trades >= 40 &&
              winRate >= 52 &&
              pnl > 0,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    ok: true,
    service: "nexora_candidate_hunter",
    approved: candidates.filter(c => c.approved).slice(0, 10),
    rejected: candidates.filter(c => !c.approved).slice(0, 20),
    updatedAt: new Date().toISOString(),
  };
}

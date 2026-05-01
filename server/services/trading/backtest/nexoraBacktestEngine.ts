
import { getRecentMarketCandles } from "../marketData/nexoraMarketCandlesService";
import { runStrategySpecificBacktest } from "./nexoraStrategyBacktestRules";

type BacktestInput = {
  symbol: string;
  timeframe: string;
  strategy: string;
  direction: "long" | "short";
  limit?: number;
};

function n(v: any) {
  return Number(v || 0);
}

export async function runNexoraSimpleBacktest(input: BacktestInput) {
  const recent = await getRecentMarketCandles({
    symbol: input.symbol,
    timeframe: input.timeframe,
    limit: input.limit || 200,
  });

  const candles = [...(recent.candles || [])].reverse();

  if (candles.length < 40) {
    return {
      ok: false,
      reason: "Not enough candles for backtest.",
      candleCount: candles.length,
    };
  }

  const strategyTrades = runStrategySpecificBacktest({
    candles,
    strategy: input.strategy,
    direction: input.direction,
  });

  let wins = 0;
  let losses = 0;
  let pnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let equity = 0;
  let peakEquity = 0;
  let maxDrawdown = 0;

  for (const trade of strategyTrades) {
    if (trade.pnl > 0) {
      wins += 1;
      grossProfit += trade.pnl;
    } else {
      losses += 1;
      grossLoss += Math.abs(trade.pnl);
    }

    pnl += trade.pnl;
    equity += trade.pnl;
    peakEquity = Math.max(peakEquity, equity);
    maxDrawdown = Math.max(maxDrawdown, peakEquity - equity);
  }

  const total = wins + losses;
  const winRate = total ? (wins / total) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  return {
    ok: true,
    service: "nexora_backtest_engine",
    symbol: input.symbol,
    timeframe: input.timeframe,
    strategy: input.strategy,
    direction: input.direction,
    candleCount: candles.length,
    trades: total,
    wins,
    losses,
    winRate: Math.round(winRate * 100) / 100,
    pnl: Math.round(pnl * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sample: strategyTrades.slice(-10),
    updatedAt: new Date().toISOString(),
  };
}

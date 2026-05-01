
import { getRecentMarketCandles } from "../marketData/nexoraMarketCandlesService";

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

  let wins = 0;
  let losses = 0;
  let pnl = 0;
  const trades: any[] = [];

  for (let i = 20; i < candles.length - 3; i++) {
    const entry = n(candles[i].close);
    const exit = n(candles[i + 3].close);

    if (!entry || !exit) continue;

    const tradePnl =
      input.direction === "long"
        ? exit - entry
        : entry - exit;

    if (tradePnl > 0) wins += 1;
    else losses += 1;

    pnl += tradePnl;

    trades.push({
      entryTime: candles[i].open_time,
      exitTime: candles[i + 3].open_time,
      entry,
      exit,
      pnl: tradePnl,
    });
  }

  const total = wins + losses;
  const winRate = total ? (wins / total) * 100 : 0;

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
    sample: trades.slice(-10),
    updatedAt: new Date().toISOString(),
  };
}

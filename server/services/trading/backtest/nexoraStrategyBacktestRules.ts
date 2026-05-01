type Candle = {
  open_time?: string;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
};

export type StrategyBacktestTrade = {
  entryTime: string | undefined;
  exitTime: string | undefined;
  entry: number;
  exit: number;
  pnl: number;
  reason: string;
};

function n(v: unknown) {
  return Number(v || 0);
}

function sma(values: number[], period: number, end: number) {
  if (end + 1 < period) return null;
  const slice = values.slice(end + 1 - period, end + 1);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

function momentum(values: number[], index: number, lookback = 5) {
  if (index < lookback) return 0;
  return values[index] - values[index - lookback];
}

function volatility(values: number[], index: number, period = 20) {
  if (index + 1 < period) return null;
  const slice = values.slice(index + 1 - period, index + 1);
  const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length;
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / slice.length;
  return Math.sqrt(variance);
}

function applyExecutionCosts(rawPnl: number, entry: number) {
  const feeRate = 0.0006;      // rough paper taker fee model
  const slippageRate = 0.0004; // rough paper slippage model
  const cost = entry * (feeRate + slippageRate);
  return rawPnl - cost;
}

function pnlFor(direction: "long" | "short", entry: number, exit: number) {
  const raw = direction === "long" ? exit - entry : entry - exit;
  return applyExecutionCosts(raw, entry);
}

function chooseExit(candles: Candle[], index: number, direction: "long" | "short", maxHold = 6) {
  const entry = n(candles[index].close);
  const atrLike = Math.max(0.0001, Math.abs(n(candles[index].high) - n(candles[index].low)));
  const stop = direction === "long" ? entry - atrLike * 1.2 : entry + atrLike * 1.2;
  const target = direction === "long" ? entry + atrLike * 1.8 : entry - atrLike * 1.8;

  for (let j = index + 1; j < Math.min(candles.length, index + maxHold + 1); j++) {
    const high = n(candles[j].high);
    const low = n(candles[j].low);

    if (direction === "long") {
      if (low <= stop) return { exitIndex: j, exit: stop, reason: "stop_loss" };
      if (high >= target) return { exitIndex: j, exit: target, reason: "take_profit" };
    } else {
      if (high >= stop) return { exitIndex: j, exit: stop, reason: "stop_loss" };
      if (low <= target) return { exitIndex: j, exit: target, reason: "take_profit" };
    }
  }

  const exitIndex = Math.min(candles.length - 1, index + maxHold);
  return { exitIndex, exit: n(candles[exitIndex].close), reason: "max_hold" };
}

export function runStrategySpecificBacktest(options: {
  candles: Candle[];
  strategy: string;
  direction: "long" | "short";
}) {
  const candles = options.candles;
  const closes = candles.map((c) => n(c.close));
  const volumes = candles.map((c) => n(c.volume));
  const trades: StrategyBacktestTrade[] = [];

  for (let i = 30; i < candles.length - 8; i++) {
    const close = closes[i];
    const prevClose = closes[i - 1];
    const ma10 = sma(closes, 10, i);
    const ma30 = sma(closes, 30, i);
    const vol20 = sma(volumes, 20, i);
    const mom = momentum(closes, i, 5);
    const volNow = volatility(closes, i, 20);
    const volPrev = volatility(closes, i - 10, 20);

    if (!close || !prevClose || ma10 === null || ma30 === null) continue;

    let enter = false;

    if (options.strategy === "momentum_breakout") {
      enter = options.direction === "long"
        ? close > ma10 && ma10 > ma30 && mom > 0
        : close < ma10 && ma10 < ma30 && mom < 0;
    }

    if (options.strategy === "volatility_squeeze") {
      const compressed = volNow !== null && volPrev !== null && volNow < volPrev * 0.8;
      const volumeOk = vol20 ? volumes[i] >= vol20 * 0.6 : true;
      enter = compressed && volumeOk && (
        options.direction === "long"
          ? close > prevClose
          : close < prevClose
      );
    }

    if (options.strategy === "trend_follow") {
      enter = options.direction === "long"
        ? close > ma30 && ma10 > ma30
        : close < ma30 && ma10 < ma30;
    }

    if (options.strategy === "mean_reversion") {
      const stretched = Math.abs(close - ma30) / close;
      enter = options.direction === "long"
        ? stretched > 0.0015 && close < ma30
        : stretched > 0.0015 && close > ma30;
    }

    if (!enter) continue;

    const entry = close;
    const exit = chooseExit(candles, i, options.direction, 6);
    const pnl = pnlFor(options.direction, entry, exit.exit);

    trades.push({
      entryTime: candles[i].open_time,
      exitTime: candles[exit.exitIndex].open_time,
      entry,
      exit: exit.exit,
      pnl,
      reason: exit.reason,
    });

    i = exit.exitIndex;
  }

  return trades;
}

import { getRecentMarketCandles } from "../marketData/nexoraMarketCandlesService";

type CandleRow = {
  open_time: string | Date;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
};

function n(value: string | number | null | undefined) {
  return Number(value || 0);
}

function sma(values: number[], period: number) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

function ema(values: number[], period: number) {
  if (values.length < period) return null;

  const k = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

  for (const value of values.slice(period)) {
    current = value * k + current * (1 - k);
  }

  return current;
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  const recent = values.slice(-(period + 1));

  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  if (losses === 0) return 100;

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atr(candles: CandleRow[], period = 14) {
  if (candles.length <= period) return null;

  const recent = candles.slice(-(period + 1));
  const trs: number[] = [];

  for (let i = 1; i < recent.length; i++) {
    const high = n(recent[i].high);
    const low = n(recent[i].low);
    const prevClose = n(recent[i - 1].close);

    trs.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
  }

  return trs.reduce((sum, v) => sum + v, 0) / trs.length;
}

function standardDeviation(values: number[]) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function bollinger(values: number[], period = 20, multiplier = 2) {
  if (values.length < period) return null;

  const slice = values.slice(-period);
  const middle = slice.reduce((sum, v) => sum + v, 0) / slice.length;
  const sd = standardDeviation(slice);

  return {
    upper: middle + sd * multiplier,
    middle,
    lower: middle - sd * multiplier,
    bandwidth: middle ? ((middle + sd * multiplier) - (middle - sd * multiplier)) / middle : 0,
  };
}

function macd(values: number[]) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);

  if (fast === null || slow === null) return null;

  const line = fast - slow;
  return {
    macd: line,
    signal: null,
    histogram: line,
  };
}

function trendDirection(close: number, emaFast: number | null, emaSlow: number | null) {
  if (emaFast === null || emaSlow === null) return "unknown";
  if (close > emaFast && emaFast > emaSlow) return "up";
  if (close < emaFast && emaFast < emaSlow) return "down";
  return "mixed";
}

export async function calculateNexoraIndicators(options: {
  symbol: string;
  timeframe: string;
  limit?: number;
}) {
  const recent = await getRecentMarketCandles({
    symbol: options.symbol,
    timeframe: options.timeframe,
    limit: options.limit || 250,
  });

  const candles = [...(recent.candles || [])].reverse() as CandleRow[];
  const closes = candles.map((c) => n(c.close));
  const volumes = candles.map((c) => n(c.volume));
  const latest = candles[candles.length - 1];

  if (!latest || closes.length < 30) {
    return {
      ok: false,
      symbol: options.symbol,
      timeframe: options.timeframe,
      error: "Not enough candles for indicators.",
      candleCount: candles.length,
    };
  }

  const latestClose = closes[closes.length - 1];
  const emaFast = ema(closes, 12);
  const emaSlow = ema(closes, 26);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);
  const bb20 = bollinger(closes, 20, 2);
  const macdValue = macd(closes);
  const volumeSma20 = sma(volumes, 20);
  const latestVolume = volumes[volumes.length - 1] || 0;

  const trend = trendDirection(latestClose, emaFast, emaSlow);
  const volumeState = volumeSma20 && latestVolume > volumeSma20 * 1.25 ? "high" : "normal";
  const volatilityState = atr14 && latestClose ? atr14 / latestClose > 0.01 ? "high" : "normal" : "unknown";
  const squeezeState = bb20 && bb20.bandwidth < 0.012 ? "squeeze" : "normal";

  return {
    ok: true,
    symbol: options.symbol,
    timeframe: options.timeframe,
    candleCount: candles.length,
    latest: {
      openTime: latest.open_time,
      close: latestClose,
      volume: latestVolume,
    },
    indicators: {
      ema12: emaFast,
      ema26: emaSlow,
      rsi14,
      atr14,
      bollinger20: bb20,
      macd: macdValue,
      volumeSma20,
    },
    states: {
      trend,
      volumeState,
      volatilityState,
      squeezeState,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function calculateNexoraIndicatorSnapshot(options?: {
  symbols?: string[];
  timeframes?: string[];
}) {
  const symbols = options?.symbols?.length ? options.symbols : ["BTC/USD", "ETH/USD", "SOL/USD"];
  const timeframes = options?.timeframes?.length ? options.timeframes : ["1m", "5m", "15m", "1h"];

  const results = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      results.push(await calculateNexoraIndicators({ symbol, timeframe, limit: 250 }));
    }
  }

  return {
    ok: true,
    service: "nexora_indicator_engine",
    paperOnly: true,
    results,
    updatedAt: new Date().toISOString(),
  };
}

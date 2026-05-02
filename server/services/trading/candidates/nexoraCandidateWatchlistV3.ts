import { getRecentMarketCandles } from "../marketData/nexoraMarketCandlesService";
import { isNexoraStrategyQuarantined } from "../quality/nexoraStrategyQuarantine";

const SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"];
const TIMEFRAMES = ["5m", "15m", "1h"];

function n(v: unknown) {
  return Number(v || 0);
}

function watchSetup(candles: any[]) {
  const ordered = [...candles].reverse();
  if (ordered.length < 40) return null;

  const closes = ordered.map((c) => n(c.close));
  const highs = ordered.map((c) => n(c.high));
  const lows = ordered.map((c) => n(c.low));

  const latest = closes.at(-1) || 0;
  const prev10 = closes.at(-11) || latest;
  const prev30 = closes.at(-31) || latest;

  const recentHigh = Math.max(...highs.slice(-30));
  const recentLow = Math.min(...lows.slice(-30));

  const range = Math.max(0.0001, recentHigh - recentLow);
  const positionInRange = (latest - recentLow) / range;

  const trendUp = latest > prev10 && latest > prev30;
  const trendDown = latest < prev10 && latest < prev30;

  if (trendUp && positionInRange > 0.55) {
    return {
      strategy: "momentum_breakout",
      direction: "long" as const,
      watchScore: 58,
      reason: "Bullish pressure building near range high.",
    };
  }

  if (trendDown && positionInRange < 0.45) {
    return {
      strategy: "momentum_breakout",
      direction: "short" as const,
      watchScore: 62,
      reason: "Bearish pressure building near range low.",
    };
  }

  if (positionInRange < 0.3) {
    return {
      strategy: "mean_reversion",
      direction: "long" as const,
      watchScore: 52,
      reason: "Price near lower range; watching for bounce confirmation.",
    };
  }

  if (positionInRange > 0.7) {
    return {
      strategy: "mean_reversion",
      direction: "short" as const,
      watchScore: 55,
      reason: "Price near upper range; watching for rejection confirmation.",
    };
  }

  return null;
}

export async function getNexoraCandidateWatchlistV3() {
  const watchlist: any[] = [];
  const rejected: any[] = [];

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      const recent = await getRecentMarketCandles({ symbol, timeframe, limit: 120 }).catch(() => null);
      const candles = Array.isArray((recent as any)?.candles) ? (recent as any).candles : [];
      const setup = watchSetup(candles);

      if (!setup) {
        rejected.push({ symbol, timeframe, reason: "No watch condition.", candleCount: candles.length });
        continue;
      }

      const quarantined = await isNexoraStrategyQuarantined({
        symbol,
        strategy: setup.strategy,
        direction: setup.direction,
      }).catch(() => null);

      watchlist.push({
        symbol,
        timeframe,
        strategy: setup.strategy,
        direction: setup.direction,
        watchScore: setup.watchScore,
        quarantined: Boolean(quarantined),
        quarantineReason: quarantined?.reason || null,
        tradeAllowed: false,
        reason: setup.reason,
      });
    }
  }

  return {
    ok: true,
    service: "nexora_candidate_watchlist_v3",
    paperOnly: true,
    tradeAllowed: false,
    watchlist: watchlist.sort((a, b) => b.watchScore - a.watchScore),
    rejected,
    updatedAt: new Date().toISOString(),
  };
}

import { getRecentMarketCandles } from "../marketData/nexoraMarketCandlesService";
import { isNexoraStrategyQuarantined } from "../quality/nexoraStrategyQuarantine";

const SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"];
const TIMEFRAMES = ["5m", "15m", "1h"];

function n(v: unknown) {
  return Number(v || 0);
}

function makeCandidates(candles: any[]) {
  const ordered = [...candles].reverse();
  if (ordered.length < 40) return [];

  const closes = ordered.map((c) => n(c.close));
  const highs = ordered.map((c) => n(c.high));
  const lows = ordered.map((c) => n(c.low));

  const latest = closes.at(-1) || 0;
  const prev5 = closes.at(-6) || latest;
  const prev10 = closes.at(-11) || latest;
  const prev30 = closes.at(-31) || latest;

  const recentHigh = Math.max(...highs.slice(-30));
  const recentLow = Math.min(...lows.slice(-30));
  const range = Math.max(0.0001, recentHigh - recentLow);
  const positionInRange = (latest - recentLow) / range;

  const trendUp = latest > prev5 && latest > prev10;
  const trendDown = latest < prev5 && latest < prev10;
  const biggerTrendUp = latest > prev30;
  const biggerTrendDown = latest < prev30;

  const candidates: any[] = [];

  if (trendUp) {
    candidates.push({
      strategy: "trend_follow",
      direction: "long",
      watchScore: biggerTrendUp ? 58 : 51,
      reason: "Short-term trend rising; paper watch long continuation.",
    });
  }

  if (trendDown) {
    candidates.push({
      strategy: "trend_follow",
      direction: "short",
      watchScore: biggerTrendDown ? 58 : 51,
      reason: "Short-term trend falling; paper watch short continuation.",
    });
  }

  if (positionInRange > 0.55) {
    candidates.push({
      strategy: "momentum_breakout",
      direction: "long",
      watchScore: trendUp ? 60 : 50,
      reason: "Price pressing upper range; paper watch breakout.",
    });
  }

  if (positionInRange < 0.45) {
    candidates.push({
      strategy: "momentum_breakout",
      direction: "short",
      watchScore: trendDown ? 60 : 50,
      reason: "Price pressing lower range; paper watch breakdown.",
    });
  }

  if (positionInRange < 0.38) {
    candidates.push({
      strategy: "mean_reversion",
      direction: "long",
      watchScore: 50,
      reason: "Price near lower range; paper watch bounce.",
    });
  }

  if (positionInRange > 0.62) {
    candidates.push({
      strategy: "mean_reversion",
      direction: "short",
      watchScore: 50,
      reason: "Price near upper range; paper watch rejection.",
    });
  }

  return candidates;
}

export async function getNexoraCandidateWatchlistV3() {
  const watchlist: any[] = [];
  const rejected: any[] = [];

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      const recent = await getRecentMarketCandles({ symbol, timeframe, limit: 120 }).catch(() => null);
      const candles = Array.isArray((recent as any)?.candles) ? (recent as any).candles : [];
      const setups = makeCandidates(candles);

      if (!setups.length) {
        rejected.push({ symbol, timeframe, reason: "No watch condition.", candleCount: candles.length });
        continue;
      }

      for (const setup of setups) {
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
          watchScore: setup.watchScore + (timeframe === "1h" ? 5 : timeframe === "15m" ? 3 : 0),
          quarantined: Boolean(quarantined),
          quarantineReason: quarantined?.reason || null,
          tradeAllowed: false,
          reason: setup.reason,
        });
      }
    }
  }

  return {
    ok: true,
    service: "nexora_candidate_watchlist_v3",
    paperOnly: true,
    tradeAllowed: false,
    watchlist: watchlist.sort((a, b) => b.watchScore - a.watchScore).slice(0, 20),
    rejected,
    updatedAt: new Date().toISOString(),
  };
}

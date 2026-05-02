import { getRecentMarketCandles } from "../marketData/nexoraMarketCandlesService";
import { isNexoraStrategyQuarantined } from "../quality/nexoraStrategyQuarantine";

const SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"];
const TIMEFRAMES = ["5m", "15m", "1h"];

function n(v: unknown) {
  return Number(v || 0);
}

function chooseSetup(candles: any[]) {
  const ordered = [...candles].reverse();
  if (ordered.length < 40) return null;

  const closes = ordered.map((c) => n(c.close));
  const highs = ordered.map((c) => n(c.high));
  const lows = ordered.map((c) => n(c.low));

  const latest = closes[closes.length - 1];
  const prev10 = closes[closes.length - 11];
  const prev30 = closes[closes.length - 31];

  const priorHigh = Math.max(...highs.slice(-60, -30));
  const priorLow = Math.min(...lows.slice(-60, -30));

  const trendUp = latest > prev10 && latest > prev30;
  const trendDown = latest < prev10 && latest < prev30;

  if (latest > priorHigh && trendUp) return { strategy: "momentum_breakout", direction: "long" as const, confidence: 72 };
  if (latest < priorLow && trendDown) return { strategy: "momentum_breakout", direction: "short" as const, confidence: 72 };
  if (trendUp) return { strategy: "trend_follow", direction: "long" as const, confidence: 66 };
  if (trendDown) return { strategy: "trend_follow", direction: "short" as const, confidence: 66 };

  return null;
}

export async function discoverNexoraCandidatesV2() {
  const discovered: any[] = [];
  const rejected: any[] = [];

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      const recent = await getRecentMarketCandles({ symbol, timeframe, limit: 120 }).catch(() => null);
      const candles = Array.isArray((recent as any)?.candles) ? (recent as any).candles : [];

      const setup = chooseSetup(candles);

      if (!setup) {
        rejected.push({ symbol, timeframe, reason: "No strong candle setup.", candleCount: candles.length });
        continue;
      }

      const quarantined = await isNexoraStrategyQuarantined({
        symbol,
        strategy: setup.strategy,
        direction: setup.direction,
      }).catch(() => null);

      if (quarantined) {
        rejected.push({
          symbol,
          timeframe,
          strategy: setup.strategy,
          direction: setup.direction,
          reason: "Rejected by quarantine.",
          quarantineReason: quarantined.reason,
        });
        continue;
      }

      discovered.push({
        symbol,
        timeframe,
        strategy: setup.strategy,
        direction: setup.direction,
        score: setup.confidence + (timeframe === "1h" ? 8 : timeframe === "15m" ? 5 : 0),
        reason: "Fresh candle setup passed quarantine.",
      });
    }
  }

  return {
    ok: true,
    service: "nexora_candidate_discovery_v2",
    paperOnly: true,
    discovered: discovered.sort((a, b) => b.score - a.score),
    rejected,
    updatedAt: new Date().toISOString(),
  };
}

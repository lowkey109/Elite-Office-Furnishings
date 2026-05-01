import type { NexoraTradeDirection, NexoraTradeSignal } from "../nexoraTradeVotingEngine";
import { calculateNexoraIndicators } from "./nexoraIndicatorEngine";

type AdapterInput = {
  symbol: string;
  strategy: string;
  direction: Exclude<NexoraTradeDirection, "neutral">;
  confidence: number;
};

function clamp(n: number, min = 1, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function signal(input: {
  system: string;
  symbol: string;
  direction: NexoraTradeDirection;
  confidence: number;
  risk?: "low" | "medium" | "high";
  reason: string;
  features?: Record<string, string | number | boolean | null>;
}): NexoraTradeSignal {
  return {
    system: input.system,
    symbol: input.symbol,
    direction: input.direction,
    confidence: clamp(input.confidence),
    strength: clamp(input.confidence - 4),
    risk: input.risk || "medium",
    reason: input.reason,
    features: input.features || {},
  };
}

export async function buildNexoraIndicatorSignals(input: AdapterInput): Promise<NexoraTradeSignal[]> {
  const snapshots = await Promise.allSettled([
    calculateNexoraIndicators({ symbol: input.symbol, timeframe: "1m", limit: 200 }),
    calculateNexoraIndicators({ symbol: input.symbol, timeframe: "5m", limit: 200 }),
  ]);

  const results = snapshots
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r: any) => r && r.ok);

  const signals: NexoraTradeSignal[] = [];

  if (!results.length) {
    return [
      signal({
        system: "indicator_data_missing",
        symbol: input.symbol,
        direction: "neutral",
        confidence: 30,
        risk: "high",
        reason: "Real candle indicators are missing. Nexora should not promote this setup.",
        features: { realCandleDataAvailable: false },
      }),
    ];
  }

  for (const snapshot of results as any[]) {
    const timeframe = snapshot.timeframe;
    const trend = snapshot.states?.trend || "unknown";
    const volumeState = snapshot.states?.volumeState || "unknown";
    const volatilityState = snapshot.states?.volatilityState || "unknown";
    const squeezeState = snapshot.states?.squeezeState || "unknown";
    const rsi14 = Number(snapshot.indicators?.rsi14 || 50);
    const atr14 = Number(snapshot.indicators?.atr14 || 0);
    const close = Number(snapshot.latest?.close || 0);

    const trendAgrees =
      (input.direction === "long" && trend === "up") ||
      (input.direction === "short" && trend === "down");

    signals.push(
      signal({
        system: `indicator_${timeframe}_trend_alignment`,
        symbol: input.symbol,
        direction: trendAgrees ? input.direction : "neutral",
        confidence: trendAgrees ? input.confidence + 8 : input.confidence - 12,
        risk: trendAgrees ? "medium" : "high",
        reason: trendAgrees
          ? `${timeframe} candle trend agrees with ${input.direction}.`
          : `${timeframe} candle trend does not agree with ${input.direction}.`,
        features: { timeframe, trend, realCandleDataAvailable: true },
      })
    );

    const rsiSafe =
      input.direction === "long"
        ? rsi14 >= 40 && rsi14 <= 72
        : rsi14 >= 28 && rsi14 <= 60;

    signals.push(
      signal({
        system: `indicator_${timeframe}_rsi_safety`,
        symbol: input.symbol,
        direction: rsiSafe ? input.direction : "neutral",
        confidence: rsiSafe ? input.confidence + 4 : input.confidence - 10,
        risk: rsiSafe ? "medium" : "high",
        reason: rsiSafe
          ? `${timeframe} RSI is safe for ${input.direction}.`
          : `${timeframe} RSI is unsafe/extended for ${input.direction}.`,
        features: { timeframe, rsi14 },
      })
    );

    const atrPct = close > 0 ? atr14 / close : 0;
    const atrUsable = atrPct > 0.0002 && atrPct < 0.025;

    signals.push(
      signal({
        system: `indicator_${timeframe}_atr_quality`,
        symbol: input.symbol,
        direction: atrUsable ? input.direction : "neutral",
        confidence: atrUsable ? input.confidence + 3 : input.confidence - 8,
        risk: atrUsable ? "medium" : "high",
        reason: atrUsable
          ? `${timeframe} ATR is usable for stop/target sizing.`
          : `${timeframe} ATR is not suitable for this setup.`,
        features: { timeframe, atr14, atrPct },
      })
    );

    if (input.strategy === "volatility_squeeze") {
      const squeezeOk = squeezeState === "squeeze" || volatilityState === "normal";

      signals.push(
        signal({
          system: `indicator_${timeframe}_squeeze_context`,
          symbol: input.symbol,
          direction: squeezeOk ? input.direction : "neutral",
          confidence: squeezeOk ? input.confidence + 5 : input.confidence - 8,
          risk: squeezeOk ? "medium" : "high",
          reason: squeezeOk
            ? `${timeframe} squeeze context supports a watched volatility setup.`
            : `${timeframe} squeeze context does not support this setup.`,
          features: { timeframe, squeezeState, volatilityState },
        })
      );
    }

    if (input.strategy === "momentum_breakout") {
      const breakoutOk = trendAgrees && volumeState !== "unknown";

      signals.push(
        signal({
          system: `indicator_${timeframe}_breakout_context`,
          symbol: input.symbol,
          direction: breakoutOk ? input.direction : "neutral",
          confidence: breakoutOk ? input.confidence + 5 : input.confidence - 8,
          risk: breakoutOk ? "medium" : "high",
          reason: breakoutOk
            ? `${timeframe} trend/volume context supports breakout watch.`
            : `${timeframe} breakout context is weak.`,
          features: { timeframe, trend, volumeState },
        })
      );
    }
  }

  return signals;
}

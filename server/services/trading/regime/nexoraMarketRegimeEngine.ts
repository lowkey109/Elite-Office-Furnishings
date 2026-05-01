
import { calculateNexoraIndicators } from "../indicators/nexoraIndicatorEngine";

export async function classifyNexoraMarketRegime(input: {
  symbol: string;
  timeframe: string;
}) {
  const snapshot = await calculateNexoraIndicators({
    symbol: input.symbol,
    timeframe: input.timeframe,
    limit: 200,
  });

  if (!snapshot.ok) {
    return {
      ok: false,
      symbol: input.symbol,
      timeframe: input.timeframe,
      regime: "unknown",
      confidence: 0,
      reason: snapshot.error || "Indicator snapshot unavailable.",
    };
  }

  const trend = snapshot.states?.trend || "unknown";
  const squeeze = snapshot.states?.squeezeState === "squeeze";
  const volatility = snapshot.states?.volatilityState || "unknown";
  const rsi = Number(snapshot.indicators?.rsi14 || 50);
  const macd = Number(snapshot.indicators?.macd?.macd || 0);

  let regime = "range";
  let confidence = 55;
  let reason = "Default range regime.";

  if (squeeze) {
    regime = "squeeze";
    confidence = 68;
    reason = "Bollinger bandwidth indicates compression/squeeze.";
  }

  if (trend === "up" && rsi >= 45 && rsi <= 72 && macd >= 0) {
    regime = "trend_up";
    confidence = 74;
    reason = "EMA trend, RSI and MACD support upward regime.";
  }

  if (trend === "down" && rsi <= 55 && macd <= 0) {
    regime = "trend_down";
    confidence = 74;
    reason = "EMA trend, RSI and MACD support downward regime.";
  }

  if (volatility === "high") {
    regime = "risk_off";
    confidence = Math.max(confidence, 70);
    reason = "High volatility detected. Risk-off/reduced exposure regime.";
  }

  return {
    ok: true,
    service: "nexora_market_regime_engine",
    symbol: input.symbol,
    timeframe: input.timeframe,
    regime,
    confidence,
    reason,
    indicators: snapshot.indicators,
    states: snapshot.states,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraMarketRegimeSnapshot() {
  const symbols = ["BTC/USD", "ETH/USD", "SOL/USD"];
  const timeframes = ["1m", "5m"];

  const results = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      results.push(await classifyNexoraMarketRegime({ symbol, timeframe }));
    }
  }

  return {
    ok: true,
    service: "nexora_market_regime_snapshot",
    results,
    updatedAt: new Date().toISOString(),
  };
}

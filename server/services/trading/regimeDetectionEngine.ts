import { db } from "../../db";
import { regimeStates, marketSnapshots } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export type RegimeType = "trending" | "ranging" | "volatile" | "risk_off";

export interface RegimeDetection {
  symbol: string;
  regime: RegimeType;
  confidence: number;
  volatilityLevel: number;
  trendStrength: number;
  previousRegime: string | null;
  indicators: {
    priceChange5m: number;
    priceChange1h: number;
    volatility: number;
    directionConsistency: number;
  };
}

export async function detectRegime(symbol: string): Promise<RegimeDetection> {
  const snapshots = await db.select().from(marketSnapshots)
    .where(eq(marketSnapshots.symbol, symbol))
    .orderBy(desc(marketSnapshots.createdAt))
    .limit(30);

  const previous = await db.select().from(regimeStates)
    .where(eq(regimeStates.symbol, symbol))
    .orderBy(desc(regimeStates.createdAt))
    .limit(1);

  const previousRegime = previous[0]?.regime || null;

  if (snapshots.length < 5) {
    return {
      symbol, regime: "ranging", confidence: 0.3, volatilityLevel: 0,
      trendStrength: 0, previousRegime,
      indicators: { priceChange5m: 0, priceChange1h: 0, volatility: 0, directionConsistency: 0 },
    };
  }

  const prices = snapshots.map(s => s.price).reverse();
  const latest = prices[prices.length - 1];
  const recent5 = prices.slice(-5);
  const priceChange5m = ((recent5[recent5.length - 1] - recent5[0]) / recent5[0]) * 100;
  const priceChange1h = ((latest - prices[0]) / prices[0]) * 100;

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const volatility = Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length) * 100;

  let positiveCount = 0;
  for (const r of returns) {
    if (r > 0) positiveCount++;
  }
  const directionConsistency = Math.abs((positiveCount / returns.length) - 0.5) * 2;
  const trendStrength = Math.abs(priceChange1h) * directionConsistency;

  let regime: RegimeType;
  let confidence: number;

  if (volatility > 3) {
    regime = "volatile";
    confidence = Math.min(volatility / 5, 1.0);
  } else if (Math.abs(priceChange1h) > 2 && directionConsistency > 0.6) {
    regime = "trending";
    confidence = Math.min(trendStrength / 5, 1.0);
  } else if (volatility > 2 && directionConsistency < 0.3) {
    regime = "risk_off";
    confidence = 0.6;
  } else {
    regime = "ranging";
    confidence = 1 - volatility / 3;
  }

  const detection: RegimeDetection = {
    symbol, regime, confidence: Math.round(confidence * 100) / 100,
    volatilityLevel: Math.round(volatility * 100) / 100,
    trendStrength: Math.round(trendStrength * 100) / 100,
    previousRegime,
    indicators: {
      priceChange5m: Math.round(priceChange5m * 100) / 100,
      priceChange1h: Math.round(priceChange1h * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      directionConsistency: Math.round(directionConsistency * 100) / 100,
    },
  };

  try {
    await db.insert(regimeStates).values({
      symbol, regime, confidence: detection.confidence,
      volatilityLevel: detection.volatilityLevel,
      trendStrength: detection.trendStrength,
      indicators: detection.indicators,
      previousRegime, transitionAt: regime !== previousRegime ? new Date() : null,
    });
  } catch (err) {
    console.error("[regime] Failed to save regime state:", err instanceof Error ? err.message : err);
  }

  return detection;
}

export async function getAllRegimes(): Promise<Record<string, RegimeDetection>> {
  const symbols = ["BTC", "ETH", "SOL", "XAUUSD"];
  const regimes: Record<string, RegimeDetection> = {};
  for (const sym of symbols) {
    regimes[sym] = await detectRegime(sym);
  }
  return regimes;
}

export async function getRegimeHistory(limit = 50): Promise<any[]> {
  return db.select().from(regimeStates).orderBy(desc(regimeStates.createdAt)).limit(limit);
}

export function getStrategyAdaptation(regime: RegimeType): {
  preferredStrategies: string[];
  avoidStrategies: string[];
  riskMultiplier: number;
  holdTimeMultiplier: number;
} {
  switch (regime) {
    case "trending":
      return { preferredStrategies: ["trend_following", "momentum_breakout"], avoidStrategies: ["mean_reversion"], riskMultiplier: 1.2, holdTimeMultiplier: 1.5 };
    case "ranging":
      return { preferredStrategies: ["mean_reversion"], avoidStrategies: ["trend_following"], riskMultiplier: 0.8, holdTimeMultiplier: 0.7 };
    case "volatile":
      return { preferredStrategies: ["mean_reversion"], avoidStrategies: ["momentum_breakout", "trend_following"], riskMultiplier: 0.5, holdTimeMultiplier: 0.5 };
    case "risk_off":
      return { preferredStrategies: [], avoidStrategies: ["momentum_breakout", "trend_following", "news_catalyst"], riskMultiplier: 0.3, holdTimeMultiplier: 0.3 };
  }
}

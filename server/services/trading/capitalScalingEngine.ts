import { db } from "../../db";
import { capitalScalingStates, paperTradingState, paperTradeOutcomes } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const SCALING_CONFIG = {
  basePositionSize: 5000,
  minScaleFactor: 0.25,
  maxScaleFactor: 2.0,
  drawdownThresholds: [
    { pct: 5, multiplier: 0.8 },
    { pct: 10, multiplier: 0.5 },
    { pct: 15, multiplier: 0.3 },
    { pct: 20, multiplier: 0.1 },
  ],
  performanceWindow: 20,
  performanceBoostThreshold: 60,
  performanceBoostMultiplier: 1.3,
  performancePenaltyThreshold: 40,
  performancePenaltyMultiplier: 0.6,
};

export interface ScalingResult {
  symbol: string;
  strategy: string | null;
  basePositionSize: number;
  scaledPositionSize: number;
  scaleFactor: number;
  performanceMultiplier: number;
  drawdownMultiplier: number;
  currentDrawdownPct: number;
  peakCapital: number;
}

export async function calculateScaling(symbol: string, strategy?: string): Promise<ScalingResult> {
  const states = await db.select().from(paperTradingState).limit(1);
  const state = states[0];
  const currentCapital = state?.currentCapital || 100000;
  const peakCapital = state?.peakCapital || currentCapital;
  const drawdownPct = peakCapital > 0 ? ((peakCapital - currentCapital) / peakCapital) * 100 : 0;

  let drawdownMultiplier = 1.0;
  for (const threshold of SCALING_CONFIG.drawdownThresholds) {
    if (drawdownPct >= threshold.pct) {
      drawdownMultiplier = threshold.multiplier;
    }
  }

  const outcomes = await db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt)).limit(SCALING_CONFIG.performanceWindow);
  const relevantOutcomes = strategy ? outcomes.filter(o => o.strategy === strategy) : outcomes;
  let performanceMultiplier = 1.0;

  if (relevantOutcomes.length >= 5) {
    const winRate = (relevantOutcomes.filter(o => (o.adjustedPnl || o.rawPnl) > 0).length / relevantOutcomes.length) * 100;
    if (winRate >= SCALING_CONFIG.performanceBoostThreshold) {
      performanceMultiplier = SCALING_CONFIG.performanceBoostMultiplier;
    } else if (winRate < SCALING_CONFIG.performancePenaltyThreshold) {
      performanceMultiplier = SCALING_CONFIG.performancePenaltyMultiplier;
    }
  }

  const scaleFactor = Math.max(SCALING_CONFIG.minScaleFactor, Math.min(SCALING_CONFIG.maxScaleFactor, drawdownMultiplier * performanceMultiplier));
  const scaledPositionSize = Math.round(SCALING_CONFIG.basePositionSize * scaleFactor);

  const result: ScalingResult = {
    symbol, strategy: strategy || null,
    basePositionSize: SCALING_CONFIG.basePositionSize,
    scaledPositionSize, scaleFactor: Math.round(scaleFactor * 100) / 100,
    performanceMultiplier: Math.round(performanceMultiplier * 100) / 100,
    drawdownMultiplier: Math.round(drawdownMultiplier * 100) / 100,
    currentDrawdownPct: Math.round(drawdownPct * 100) / 100,
    peakCapital,
  };

  try {
    await db.insert(capitalScalingStates).values({
      symbol, strategy: result.strategy,
      basePositionSize: result.basePositionSize,
      scaledPositionSize: result.scaledPositionSize,
      scaleFactor: result.scaleFactor,
      performanceMultiplier: result.performanceMultiplier,
      drawdownMultiplier: result.drawdownMultiplier,
      currentDrawdownPct: result.currentDrawdownPct,
      peakCapital: result.peakCapital,
    });
  } catch (err) {
    console.error("[capitalScaling] Failed to persist state:", err instanceof Error ? err.message : err);
  }

  return result;
}

export async function getCapitalScalingStatus(): Promise<{
  scalingBySymbol: Record<string, ScalingResult>;
  config: typeof SCALING_CONFIG;
  currentCapital: number;
  peakCapital: number;
  drawdownPct: number;
}> {
  const symbols = ["BTC", "ETH", "SOL", "XAUUSD"];
  const scalingBySymbol: Record<string, ScalingResult> = {};
  for (const sym of symbols) {
    scalingBySymbol[sym] = await calculateScaling(sym);
  }

  const states = await db.select().from(paperTradingState).limit(1);
  const state = states[0];
  const currentCapital = state?.currentCapital || 100000;
  const peakCapital = state?.peakCapital || currentCapital;

  return {
    scalingBySymbol, config: SCALING_CONFIG,
    currentCapital, peakCapital,
    drawdownPct: Math.round(((peakCapital - currentCapital) / peakCapital) * 100 * 100) / 100,
  };
}

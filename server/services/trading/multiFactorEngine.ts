import { db } from "../../db";
import { multiFactorSignals, marketSnapshots } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const DEFAULT_WEIGHTS = {
  price: 0.35,
  news: 0.15,
  momentum: 0.30,
  regime: 0.20,
};

export interface MultiFactorResult {
  symbol: string;
  priceScore: number;
  newsScore: number;
  momentumScore: number;
  regimeScore: number;
  compositeScore: number;
  confidence: number;
  recommendedAction: string;
  weights: Record<string, number>;
}

export async function calculateMultiFactorSignal(symbol: string): Promise<MultiFactorResult> {
  const priceScore = await calculatePriceScore(symbol);
  const newsScore = await calculateNewsScore(symbol);
  const momentumScore = await calculateMomentumScore(symbol);
  const regimeScore = await calculateRegimeScore(symbol);

  const compositeScore =
    priceScore * DEFAULT_WEIGHTS.price +
    newsScore * DEFAULT_WEIGHTS.news +
    momentumScore * DEFAULT_WEIGHTS.momentum +
    regimeScore * DEFAULT_WEIGHTS.regime;

  const confidence = Math.min(Math.abs(compositeScore) / 50, 1.0);
  let recommendedAction = "hold";
  if (compositeScore > 25) recommendedAction = "buy";
  else if (compositeScore < -25) recommendedAction = "sell";

  const result: MultiFactorResult = {
    symbol, priceScore, newsScore, momentumScore, regimeScore,
    compositeScore: Math.round(compositeScore * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    recommendedAction,
    weights: { ...DEFAULT_WEIGHTS },
  };

  try {
    await db.insert(multiFactorSignals).values({
      symbol, priceScore, newsScore, momentumScore, regimeScore,
      compositeScore: result.compositeScore,
      confidence: result.confidence,
      recommendedAction: result.recommendedAction,
      weights: result.weights,
    });
  } catch (err) {
    console.error("[multiFactor] Failed to save signal:", err instanceof Error ? err.message : err);
  }

  return result;
}

async function calculatePriceScore(symbol: string): Promise<number> {
  try {
    const snapshots = await db.select().from(marketSnapshots)
      .where(eq(marketSnapshots.symbol, symbol))
      .orderBy(desc(marketSnapshots.createdAt))
      .limit(20);
    if (snapshots.length < 3) return 0;
    const latest = snapshots[0].price;
    const oldest = snapshots[snapshots.length - 1].price;
    const change = ((latest - oldest) / oldest) * 100;
    return Math.max(-50, Math.min(50, change * 10));
  } catch (err) {
    console.warn("[multiFactor] Price score calculation failed for", symbol, err instanceof Error ? err.message : err);
    return 0;
  }
}

async function calculateNewsScore(symbol: string): Promise<number> {
  try {
    const { getLatestNews } = await import("./newsAdapter");
    const news = getLatestNews(symbol);
    if (!news || news.length === 0) return 0;
    const avgSentiment = news.reduce((s: number, n: any) => s + (n.sentiment || 0), 0) / news.length;
    return Math.max(-50, Math.min(50, avgSentiment * 50));
  } catch (err) {
    console.warn("[multiFactor] News score failed for", symbol, err instanceof Error ? err.message : err);
    return 0;
  }
}

async function calculateMomentumScore(symbol: string): Promise<number> {
  try {
    const snapshots = await db.select().from(marketSnapshots)
      .where(eq(marketSnapshots.symbol, symbol))
      .orderBy(desc(marketSnapshots.createdAt))
      .limit(10);
    if (snapshots.length < 5) return 0;
    const prices = snapshots.map(s => s.price).reverse();
    let momentum = 0;
    for (let i = 1; i < prices.length; i++) {
      momentum += (prices[i] - prices[i - 1]) / prices[i - 1];
    }
    return Math.max(-50, Math.min(50, momentum * 500));
  } catch (err) {
    console.warn("[multiFactor] Momentum score failed for", symbol, err instanceof Error ? err.message : err);
    return 0;
  }
}

async function calculateRegimeScore(symbol: string): Promise<number> {
  try {
    const { detectRegime } = await import("./regimeDetectionEngine");
    const regime = await detectRegime(symbol);
    if (regime.regime === "trending") return 30;
    if (regime.regime === "volatile") return -20;
    if (regime.regime === "risk_off") return -40;
    return 0;
  } catch (err) {
    console.warn("[multiFactor] Regime score failed for", symbol, err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function getMultiFactorAnalytics(): Promise<{
  latestSignals: Record<string, MultiFactorResult>;
  recentHistory: any[];
  weights: typeof DEFAULT_WEIGHTS;
}> {
  const symbols = ["BTC", "ETH", "SOL", "XAUUSD"];
  const latestSignals: Record<string, MultiFactorResult> = {};
  for (const sym of symbols) {
    latestSignals[sym] = await calculateMultiFactorSignal(sym);
  }

  const history = await db.select().from(multiFactorSignals).orderBy(desc(multiFactorSignals.createdAt)).limit(40);

  return { latestSignals, recentHistory: history, weights: DEFAULT_WEIGHTS };
}

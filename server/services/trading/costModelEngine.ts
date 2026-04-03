import { db } from "../../db";
import { costModelEntries } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const FEE_SCHEDULE: Record<string, { makerFee: number; takerFee: number; networkFee: number }> = {
  BTC: { makerFee: 0.001, takerFee: 0.002, networkFee: 0.50 },
  ETH: { makerFee: 0.001, takerFee: 0.002, networkFee: 0.30 },
  SOL: { makerFee: 0.0015, takerFee: 0.0025, networkFee: 0.01 },
  XAUUSD: { makerFee: 0.0005, takerFee: 0.001, networkFee: 0 },
};

const SPREAD_MODEL: Record<string, { typicalSpreadBps: number; volatilityAdj: number }> = {
  BTC: { typicalSpreadBps: 5, volatilityAdj: 1.2 },
  ETH: { typicalSpreadBps: 8, volatilityAdj: 1.3 },
  SOL: { typicalSpreadBps: 15, volatilityAdj: 1.5 },
  XAUUSD: { typicalSpreadBps: 3, volatilityAdj: 0.8 },
};

export interface CostBreakdown {
  spreadCost: number;
  slippageCost: number;
  feesCost: number;
  totalCost: number;
  costBps: number;
  effectivePrice: number;
}

export function calculateTradeCost(params: {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  expectedPrice: number;
  isMarketOrder?: boolean;
}): CostBreakdown {
  const fees = FEE_SCHEDULE[params.symbol] || FEE_SCHEDULE.BTC;
  const spread = SPREAD_MODEL[params.symbol] || SPREAD_MODEL.BTC;
  const notional = params.quantity * params.expectedPrice;

  const spreadCost = notional * (spread.typicalSpreadBps / 10000) / 2;
  const feeRate = params.isMarketOrder !== false ? fees.takerFee : fees.makerFee;
  const feesCost = notional * feeRate + fees.networkFee;
  const slippageCost = notional * (spread.typicalSpreadBps / 10000) * spread.volatilityAdj * 0.3;
  const totalCost = spreadCost + slippageCost + feesCost;
  const costBps = (totalCost / notional) * 10000;

  const direction = params.side === "buy" ? 1 : -1;
  const effectivePrice = params.expectedPrice + (totalCost / params.quantity) * direction;

  return {
    spreadCost: Math.round(spreadCost * 100) / 100,
    slippageCost: Math.round(slippageCost * 100) / 100,
    feesCost: Math.round(feesCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    costBps: Math.round(costBps * 100) / 100,
    effectivePrice: Math.round(effectivePrice * 100) / 100,
  };
}

export async function recordCostEntry(params: {
  symbol: string;
  tradeId?: string;
  side: string;
  quantity: number;
  expectedPrice: number;
  filledPrice: number;
}): Promise<void> {
  const notional = params.quantity * params.expectedPrice;
  const cost = calculateTradeCost({
    symbol: params.symbol,
    side: params.side as "buy" | "sell",
    quantity: params.quantity,
    expectedPrice: params.expectedPrice,
  });

  try {
    await db.insert(costModelEntries).values({
      symbol: params.symbol,
      tradeId: params.tradeId || null,
      side: params.side,
      quantity: params.quantity,
      expectedPrice: params.expectedPrice,
      filledPrice: params.filledPrice,
      spreadCost: cost.spreadCost,
      slippageCost: cost.slippageCost,
      feesCost: cost.feesCost,
      totalCost: cost.totalCost,
      costBps: cost.costBps,
    });
  } catch (err) {
    console.error("[costModel] Failed to record cost entry:", err instanceof Error ? err.message : err);
  }
}

export async function getCostModelAnalytics(): Promise<{
  feeSchedule: typeof FEE_SCHEDULE;
  spreadModel: typeof SPREAD_MODEL;
  recentEntries: any[];
  aggregateBySymbol: Record<string, { totalCost: number; avgCostBps: number; trades: number }>;
}> {
  const entries = await db.select().from(costModelEntries).orderBy(desc(costModelEntries.createdAt)).limit(100);

  const agg: Record<string, { totalCost: number; totalBps: number; trades: number }> = {};
  for (const e of entries) {
    if (!agg[e.symbol]) agg[e.symbol] = { totalCost: 0, totalBps: 0, trades: 0 };
    agg[e.symbol].totalCost += e.totalCost;
    agg[e.symbol].totalBps += e.costBps;
    agg[e.symbol].trades += 1;
  }

  const aggregateBySymbol: Record<string, { totalCost: number; avgCostBps: number; trades: number }> = {};
  for (const [sym, d] of Object.entries(agg)) {
    aggregateBySymbol[sym] = {
      totalCost: Math.round(d.totalCost * 100) / 100,
      avgCostBps: Math.round((d.totalBps / d.trades) * 100) / 100,
      trades: d.trades,
    };
  }

  return { feeSchedule: FEE_SCHEDULE, spreadModel: SPREAD_MODEL, recentEntries: entries.slice(0, 20), aggregateBySymbol };
}

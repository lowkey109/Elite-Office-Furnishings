import { db } from "../../db";
import { paperPositions, paperTradeOutcomes, paperTradingState, portfolioSnapshots } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getClusterForSymbol, getCorrelationAdjustedExposure } from "./correlationModel";

export interface PortfolioState {
  totalEquity: number;
  availableBuyingPower: number;
  realizedPnl: number;
  unrealizedPnl: number;
  grossExposure: number;
  netExposure: number;
  openPositionsCount: number;
  maxDrawdown: number;
  riskThrottleState: string;
  positionsBySymbol: Record<string, { count: number; exposure: number; side: string }[]>;
  positionsByStrategy: Record<string, { count: number; exposure: number }>;
  exposureBySymbol: Record<string, number>;
  exposureByStrategy: Record<string, number>;
  exposureByCluster: Record<string, number>;
  concentrationByAsset: Record<string, number>;
  drawdownState: { currentDrawdown: number; peakEquity: number; isInDrawdown: boolean };
}

export async function calculatePortfolioState(): Promise<PortfolioState> {
  const [stateRows] = await Promise.all([
    db.select().from(paperTradingState).where(eq(paperTradingState.id, "singleton")),
  ]);

  const state = stateRows[0];
  const startingCapital = 100000;
  const paperCapital = state?.paperCapital ?? startingCapital;

  const openPositions = await db.select().from(paperPositions).where(eq(paperPositions.status, "open"));

  const outcomes = await db.select({
    totalRealized: sql<number>`COALESCE(SUM(realized_pnl), 0)`,
  }).from(paperTradeOutcomes);
  const realizedPnl = Math.round((outcomes[0]?.totalRealized ?? 0) * 100) / 100;

  let unrealizedPnl = 0;
  let grossExposure = 0;
  let netExposure = 0;
  const exposureBySymbol: Record<string, number> = {};
  const exposureByStrategy: Record<string, number> = {};
  const positionsBySymbol: Record<string, { count: number; exposure: number; side: string }[]> = {};
  const positionsByStrategy: Record<string, { count: number; exposure: number }> = {};

  for (const pos of openPositions) {
    const posUnrealized = pos.side === "long"
      ? (pos.currentPrice - pos.entryPrice)
      : (pos.entryPrice - pos.currentPrice);
    unrealizedPnl += posUnrealized;

    const posExposure = pos.paperCapitalAllocated;
    const signedExposure = pos.side === "long" ? posExposure : -posExposure;
    grossExposure += posExposure;
    netExposure += signedExposure;

    if (!exposureBySymbol[pos.symbol]) exposureBySymbol[pos.symbol] = 0;
    exposureBySymbol[pos.symbol] += posExposure;

    if (!exposureByStrategy[pos.strategy]) exposureByStrategy[pos.strategy] = 0;
    exposureByStrategy[pos.strategy] += posExposure;

    if (!positionsBySymbol[pos.symbol]) positionsBySymbol[pos.symbol] = [];
    positionsBySymbol[pos.symbol].push({ count: 1, exposure: posExposure, side: pos.side });

    if (!positionsByStrategy[pos.strategy]) positionsByStrategy[pos.strategy] = { count: 0, exposure: 0 };
    positionsByStrategy[pos.strategy].count += 1;
    positionsByStrategy[pos.strategy].exposure += posExposure;
  }

  unrealizedPnl = Math.round(unrealizedPnl * 100) / 100;
  grossExposure = Math.round(grossExposure * 100) / 100;
  netExposure = Math.round(netExposure * 100) / 100;

  const totalEquity = Math.round((paperCapital + unrealizedPnl) * 100) / 100;
  const availableBuyingPower = Math.round(Math.max(0, paperCapital - grossExposure) * 100) / 100;

  const exposureByCluster = getCorrelationAdjustedExposure(exposureBySymbol);

  const concentrationByAsset: Record<string, number> = {};
  if (grossExposure > 0) {
    for (const [sym, exp] of Object.entries(exposureBySymbol)) {
      concentrationByAsset[sym] = Math.round((exp / grossExposure) * 100);
    }
  }

  const allOutcomes = await db.select().from(paperTradeOutcomes).orderBy(paperTradeOutcomes.createdAt);
  let cumPnl = 0, peakEquity = startingCapital, maxDrawdown = 0;
  for (const o of allOutcomes) {
    cumPnl += o.realizedPnl;
    const equity = startingCapital + cumPnl;
    if (equity > peakEquity) peakEquity = equity;
    const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  const currentEquityForDD = startingCapital + cumPnl + unrealizedPnl;
  const currentDrawdown = peakEquity > 0 ? Math.round(((peakEquity - currentEquityForDD) / peakEquity) * 100 * 100) / 100 : 0;

  let riskThrottleState = "normal";
  if (currentDrawdown > 15) riskThrottleState = "critical";
  else if (currentDrawdown > 10) riskThrottleState = "elevated";
  else if (currentDrawdown > 5) riskThrottleState = "cautious";

  return {
    totalEquity,
    availableBuyingPower,
    realizedPnl,
    unrealizedPnl,
    grossExposure,
    netExposure,
    openPositionsCount: openPositions.length,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    riskThrottleState,
    positionsBySymbol,
    positionsByStrategy,
    exposureBySymbol,
    exposureByStrategy,
    exposureByCluster,
    concentrationByAsset,
    drawdownState: {
      currentDrawdown: Math.max(0, currentDrawdown),
      peakEquity: Math.round(peakEquity * 100) / 100,
      isInDrawdown: currentDrawdown > 2,
    },
  };
}

export async function persistPortfolioSnapshot(state: PortfolioState): Promise<string> {
  const [snap] = await db.insert(portfolioSnapshots).values({
    totalEquity: state.totalEquity,
    realizedPnl: state.realizedPnl,
    unrealizedPnl: state.unrealizedPnl,
    grossExposure: state.grossExposure,
    netExposure: state.netExposure,
    openPositionsCount: state.openPositionsCount,
    maxDrawdown: state.maxDrawdown,
    riskThrottleState: state.riskThrottleState,
    exposureBySymbol: state.exposureBySymbol,
    exposureByStrategy: state.exposureByStrategy,
    exposureByCluster: state.exposureByCluster,
  }).returning({ id: portfolioSnapshots.id });

  return snap.id;
}

export async function getRecentSnapshots(limit = 20): Promise<any[]> {
  return db.select().from(portfolioSnapshots).orderBy(desc(portfolioSnapshots.snapshotAt)).limit(limit);
}

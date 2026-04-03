import { db } from "../../db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  paperTradingDecisions,
  paperPositions,
  paperTradeOutcomes,
  paperTradingState,
} from "@shared/schema";
import type {
  TradingDecision,
  OpenPosition,
  TradeOutcome,
  TradingPerformance,
  TradingMonitorState,
} from "./types";

export async function getOrCreateState() {
  const rows = await db.select().from(paperTradingState).where(eq(paperTradingState.id, "singleton"));
  if (rows.length > 0) return rows[0];
  const inserted = await db.insert(paperTradingState).values({ id: "singleton", paperCapital: 100000, totalDecisions: 0, totalTrades: 0, isRunning: true }).returning();
  return inserted[0];
}

export async function createDecision(params: {
  market: string;
  strategy: string;
  direction: "long" | "short";
  confidence: number;
  thesis: string;
  regime: string;
  volumeRatio?: number;
  reasonCode: string;
  expectedMove?: number;
  invalidationRule: string;
  riskBucket: string;
  dataQualityScore: number;
  slippageEstimate?: number;
  fullPayload?: Record<string, any>;
  sourceMarketSnapshotId?: string;
  sourceNewsIds?: string[];
  marketPriceAtDecision?: number;
  riskAmount?: number;
}): Promise<string> {
  const confidenceThreshold = 60;
  const meetsThreshold = params.confidence >= confidenceThreshold;

  const [decision] = await db.insert(paperTradingDecisions).values({
    market: params.market,
    strategy: params.strategy,
    direction: params.direction,
    confidence: params.confidence,
    thesis: params.thesis,
    regime: params.regime,
    volumeRatio: params.volumeRatio ?? null,
    reasonCode: params.reasonCode,
    status: meetsThreshold ? "pending" : "skipped",
    expectedMove: params.expectedMove ?? null,
    invalidationRule: params.invalidationRule,
    riskBucket: params.riskBucket,
    dataQualityScore: params.dataQualityScore,
    slippageEstimate: params.slippageEstimate ?? null,
    fullPayload: params.fullPayload ?? {},
    decisionSource: "strategy_engine",
    executionStatus: meetsThreshold ? "pending" : "rejected",
    confidenceThreshold,
    riskAmount: params.riskAmount ?? null,
    paperCapitalImpact: null,
    linkedPositionId: null,
    sourceMarketSnapshotId: params.sourceMarketSnapshotId ?? null,
    sourceNewsIds: params.sourceNewsIds ?? [],
    strategyVersion: "1.0.0",
    marketPriceAtDecision: params.marketPriceAtDecision ?? null,
  }).returning();

  await db.update(paperTradingState)
    .set({ totalDecisions: sql`total_decisions + 1`, lastDecisionAt: new Date(), updatedAt: new Date() })
    .where(eq(paperTradingState.id, "singleton"));

  return decision.id;
}

export async function openPaperPosition(params: {
  decisionId: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number;
  paperCapitalAllocated: number;
  strategy: string;
}): Promise<string | null> {
  const existing = await db.select({ id: paperPositions.id })
    .from(paperPositions)
    .where(eq(paperPositions.linkedDecisionId, params.decisionId));

  if (existing.length > 0) {
    return null;
  }

  const [position] = await db.insert(paperPositions).values({
    linkedDecisionId: params.decisionId,
    symbol: params.symbol,
    side: params.side,
    entryPrice: params.entryPrice,
    currentPrice: params.entryPrice,
    stopPrice: params.stopPrice,
    targetPrice: params.targetPrice ?? null,
    paperCapitalAllocated: params.paperCapitalAllocated,
    strategy: params.strategy,
    status: "open",
  }).returning();

  await db.update(paperTradingDecisions)
    .set({ linkedPositionId: position.id, executionStatus: "entered", status: "executed", paperCapitalImpact: params.entryPrice, updatedAt: new Date() })
    .where(eq(paperTradingDecisions.id, params.decisionId));

  return position.id;
}

export async function updatePositionPrice(positionId: string, currentPrice: number): Promise<void> {
  await db.update(paperPositions)
    .set({ currentPrice, updatedAt: new Date() })
    .where(and(eq(paperPositions.id, positionId), eq(paperPositions.status, "open")));
}

export async function closePaperPosition(params: {
  positionId: string;
  exitPrice: number;
  exitReason: string;
  exitSnapshotId?: string;
}): Promise<string | null> {
  const positions = await db.select().from(paperPositions).where(eq(paperPositions.id, params.positionId));
  if (positions.length === 0) return null;
  const pos = positions[0];

  if (pos.status !== "open") return null;

  const existingOutcome = await db.select({ id: paperTradeOutcomes.id })
    .from(paperTradeOutcomes)
    .where(eq(paperTradeOutcomes.linkedPositionId, params.positionId));
  if (existingOutcome.length > 0) return null;

  const entryMs = pos.entryTimestamp ? new Date(pos.entryTimestamp).getTime() : pos.createdAt ? new Date(pos.createdAt).getTime() : Date.now();
  const durationMs = Date.now() - entryMs;
  const durationStr = formatDuration(durationMs);

  let rawPnl: number;
  if (pos.side === "long") {
    rawPnl = params.exitPrice - pos.entryPrice;
  } else {
    rawPnl = pos.entryPrice - params.exitPrice;
  }

  let entrySlippageVal = 0;
  let exitSlippageVal = 0;
  let actualEntryPrice = pos.entryPrice;
  let actualExitPrice = params.exitPrice;
  try {
    const { getExecutionProfiles, simulateEntryExecution, simulateExitExecution } = await import("./executionModel");
    const profiles = await getExecutionProfiles();
    const profile = profiles[pos.symbol] || { avgSpread: 0.001, avgSlippage: 0.001, volatilityMultiplier: 1.0 };

    const entryExec = simulateEntryExecution(pos.symbol, pos.entryPrice, pos.side as "long" | "short", profile);
    const exitExec = simulateExitExecution(pos.symbol, params.exitPrice, pos.side as "long" | "short", params.exitReason, profile);
    entrySlippageVal = entryExec.entrySlippage;
    exitSlippageVal = exitExec.exitSlippage;
    actualEntryPrice = entryExec.simulatedEntry;
    actualExitPrice = exitExec.simulatedExit;
  } catch (err) {
    console.warn("[paperEngine] Execution simulation failed for", pos.symbol, "- using raw prices:", err instanceof Error ? err.message : err);
  }

  const totalSlippageVal = entrySlippageVal + exitSlippageVal;
  const slippage = Math.round(totalSlippageVal * 100) / 100;
  const fees = Math.round(pos.paperCapitalAllocated * 0.001 * 100) / 100;

  let adjustedPnl: number;
  if (pos.side === "long") {
    adjustedPnl = actualExitPrice - actualEntryPrice;
  } else {
    adjustedPnl = actualEntryPrice - actualExitPrice;
  }
  const realizedPnl = Math.round((adjustedPnl - fees) * 100) / 100;
  const outcome = realizedPnl >= 0 ? "win" : "loss";
  const capitalReturned = Math.round((pos.paperCapitalAllocated + realizedPnl) * 100) / 100;

  const [outcomeRow] = await db.insert(paperTradeOutcomes).values({
    linkedDecisionId: pos.linkedDecisionId,
    linkedPositionId: params.positionId,
    symbol: pos.symbol,
    strategy: pos.strategy,
    direction: pos.side,
    entryPrice: pos.entryPrice,
    exitPrice: params.exitPrice,
    realizedPnl,
    paperCapitalReturned: capitalReturned,
    fees,
    slippage,
    outcome,
    exitReason: params.exitReason,
    exitSnapshotId: params.exitSnapshotId ?? null,
    duration: durationStr,
  }).returning();

  await db.update(paperPositions)
    .set({ status: "closed", currentPrice: params.exitPrice, closedAt: new Date(), exitSnapshotId: params.exitSnapshotId ?? null, updatedAt: new Date() })
    .where(eq(paperPositions.id, params.positionId));

  await db.update(paperTradingDecisions)
    .set({ executionStatus: "filled", updatedAt: new Date() })
    .where(eq(paperTradingDecisions.id, pos.linkedDecisionId));

  await db.update(paperTradingState)
    .set({
      totalTrades: sql`total_trades + 1`,
      paperCapital: sql`paper_capital + ${realizedPnl}`,
      updatedAt: new Date(),
    })
    .where(eq(paperTradingState.id, "singleton"));

  try {
    const { scoreExecutionQuality } = await import("./executionQualityScoring");
    const { executionLogs: execLogsTable } = await import("@shared/schema");
    const expectedSlippage = pos.entryPrice * 0.001;
    const quality = scoreExecutionQuality({
      entrySlippage: entrySlippageVal,
      exitSlippage: exitSlippageVal,
      totalSlippage: totalSlippageVal,
      entryPrice: pos.entryPrice,
      exitPrice: params.exitPrice,
      expectedSlippage,
    });
    const slippagePct = pos.entryPrice > 0 ? Math.round((totalSlippageVal / pos.entryPrice) * 100 * 10000) / 10000 : 0;
    await db.insert(execLogsTable).values({
      decisionId: pos.linkedDecisionId,
      positionId: params.positionId,
      symbol: pos.symbol,
      strategy: pos.strategy,
      expectedEntry: pos.entryPrice,
      actualEntry: actualEntryPrice,
      expectedExit: params.exitPrice,
      actualExit: actualExitPrice,
      entrySlippage: entrySlippageVal,
      exitSlippage: exitSlippageVal,
      totalSlippage: totalSlippageVal,
      slippagePct,
      executionQualityScore: quality.score,
      executionQualityLabel: quality.label,
    });
  } catch (execErr: any) {
    console.error("[PaperEngine] Failed to log execution:", execErr?.message);
  }

  return outcomeRow.id;
}

export async function evaluateOpenPositions(getCurrentPrice: (symbol: string) => number | null): Promise<string[]> {
  const openPositions = await db.select().from(paperPositions).where(eq(paperPositions.status, "open"));
  const closedIds: string[] = [];

  for (const pos of openPositions) {
    const currentPrice = getCurrentPrice(pos.symbol);
    if (currentPrice === null) continue;

    await updatePositionPrice(pos.id, currentPrice);

    let shouldClose = false;
    let exitReason = "";

    if (pos.side === "long") {
      if (currentPrice <= pos.stopPrice) {
        shouldClose = true;
        exitReason = "stop_hit";
      } else if (pos.targetPrice && currentPrice >= pos.targetPrice) {
        shouldClose = true;
        exitReason = "target_hit";
      }
    } else {
      if (currentPrice >= pos.stopPrice) {
        shouldClose = true;
        exitReason = "stop_hit";
      } else if (pos.targetPrice && currentPrice <= pos.targetPrice) {
        shouldClose = true;
        exitReason = "target_hit";
      }
    }

    if (shouldClose) {
      const outcomeId = await closePaperPosition({
        positionId: pos.id,
        exitPrice: currentPrice,
        exitReason,
      });
      if (outcomeId) closedIds.push(outcomeId);
    }
  }

  if (openPositions.length > 0) {
    await db.update(paperTradingState)
      .set({ lastMonitorAt: new Date(), updatedAt: new Date() })
      .where(eq(paperTradingState.id, "singleton"));
  }

  return closedIds;
}

export async function getRecentDecisions(limit = 30): Promise<TradingDecision[]> {
  const rows = await db.select().from(paperTradingDecisions).orderBy(desc(paperTradingDecisions.createdAt)).limit(limit);
  return rows.map(r => ({
    id: r.id,
    timestamp: r.createdAt?.toISOString() || new Date().toISOString(),
    market: r.market,
    strategy: r.strategy,
    direction: r.direction as "long" | "short",
    confidence: r.confidence,
    thesis: r.thesis,
    regime: r.regime,
    volumeRatio: r.volumeRatio,
    reasonCode: r.reasonCode,
    status: r.status,
    expectedMove: r.expectedMove,
    expectedCost: null,
    invalidationRule: r.invalidationRule,
    riskBucket: r.riskBucket,
    dataQualityScore: r.dataQualityScore,
    slippageEstimate: r.slippageEstimate,
    modelVersion: r.modelVersion,
    fullPayload: (r.fullPayload as Record<string, any>) || {},
    createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
    decisionSource: r.decisionSource,
    executionStatus: r.executionStatus as TradingDecision["executionStatus"],
    confidenceThreshold: r.confidenceThreshold,
    riskAmount: r.riskAmount,
    paperCapitalImpact: r.paperCapitalImpact,
    linkedPositionId: r.linkedPositionId,
    sourceMarketSnapshotId: r.sourceMarketSnapshotId,
    sourceNewsIds: (r.sourceNewsIds as string[]) || [],
    strategyVersion: r.strategyVersion,
    decisionGeneratedAt: r.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function getOpenPositions(): Promise<OpenPosition[]> {
  const rows = await db.select().from(paperPositions).where(eq(paperPositions.status, "open")).orderBy(desc(paperPositions.createdAt));
  return rows.map(r => {
    const entryMs = r.entryTimestamp ? new Date(r.entryTimestamp).getTime() : Date.now();
    const durationStr = formatDuration(Date.now() - entryMs);
    const unrealizedPnl = r.side === "long"
      ? Math.round((r.currentPrice - r.entryPrice) * 100) / 100
      : Math.round((r.entryPrice - r.currentPrice) * 100) / 100;

    return {
      id: r.id,
      symbol: r.symbol,
      side: r.side as "long" | "short",
      entryPrice: r.entryPrice,
      currentPrice: r.currentPrice,
      unrealizedPnl,
      stopPrice: r.stopPrice,
      duration: durationStr,
      status: r.status,
      linkedDecisionId: r.linkedDecisionId,
      paperCapitalAllocated: r.paperCapitalAllocated,
      entryTimestamp: r.entryTimestamp?.toISOString() || new Date().toISOString(),
      targetPrice: r.targetPrice,
    };
  });
}

export async function getRecentOutcomes(limit = 50): Promise<TradeOutcome[]> {
  const rows = await db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt)).limit(limit);
  return rows.map(r => ({
    id: r.id,
    symbol: r.symbol,
    strategy: r.strategy,
    direction: r.direction as "long" | "short",
    entryPrice: r.entryPrice,
    exitPrice: r.exitPrice,
    realizedPnl: r.realizedPnl,
    duration: r.duration,
    slippage: r.slippage,
    outcome: r.outcome as "win" | "loss",
    timestamp: r.createdAt?.toISOString() || new Date().toISOString(),
    linkedDecisionId: r.linkedDecisionId,
    linkedPositionId: r.linkedPositionId,
    exitReason: r.exitReason,
    paperCapitalReturned: r.paperCapitalReturned,
    fees: r.fees,
  }));
}

export async function calculatePerformanceFromDB(): Promise<TradingPerformance> {
  const outcomes = await getRecentOutcomes(200);

  if (outcomes.length === 0) {
    return {
      avgWin: 0,
      avgLoss: 0,
      expectancy: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      totalPnl: 0,
      pnlSeries: [],
    };
  }

  const wins = outcomes.filter(o => o.outcome === "win");
  const losses = outcomes.filter(o => o.outcome === "loss");
  const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, o) => s + o.realizedPnl, 0) / wins.length * 100) / 100 : 0;
  const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, o) => s + Math.abs(o.realizedPnl), 0) / losses.length * 100) / 100 : 0;
  const winRate = outcomes.length > 0 ? wins.length / outcomes.length : 0;
  const expectancy = Math.round((winRate * avgWin - (1 - winRate) * avgLoss) * 100) / 100;
  const totalWinPnl = wins.reduce((s, o) => s + o.realizedPnl, 0);
  const totalLossPnl = losses.reduce((s, o) => s + Math.abs(o.realizedPnl), 0);
  const profitFactor = totalLossPnl > 0 ? Math.round((totalWinPnl / totalLossPnl) * 100) / 100 : 0;

  let consWins = 0, consLosses = 0, curWins = 0, curLosses = 0;
  for (const o of outcomes) {
    if (o.outcome === "win") { curWins++; curLosses = 0; consWins = Math.max(consWins, curWins); }
    else { curLosses++; curWins = 0; consLosses = Math.max(consLosses, curLosses); }
  }

  const chronological = [...outcomes].reverse();
  let cumPnl = 0, peak = 0, maxDD = 0;
  const pnlSeries = chronological.map(o => {
    cumPnl += o.realizedPnl;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    return { date: o.timestamp, value: Math.round(cumPnl * 100) / 100 };
  });

  const totalPnl = Math.round(cumPnl * 100) / 100;
  const returns = outcomes.map(o => o.realizedPnl);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? Math.round((mean / stdDev) * Math.sqrt(252) * 100) / 100 : 0;

  return { avgWin, avgLoss, expectancy, consecutiveWins: consWins, consecutiveLosses: consLosses, sharpeRatio, profitFactor, maxDrawdown: Math.round(maxDD * 100) / 100, totalPnl, pnlSeries };
}

export async function getMonitorState(): Promise<TradingMonitorState> {
  const state = await getOrCreateState();
  const openPos = await db.select({ count: sql<number>`count(*)` }).from(paperPositions).where(eq(paperPositions.status, "open"));
  const outcomes = await getRecentOutcomes(200);
  const wins = outcomes.filter(o => o.outcome === "win").length;
  const winRate = outcomes.length > 0 ? Math.round((wins / outcomes.length) * 100) : 0;

  const bestStrategyCounts: Record<string, number> = {};
  for (const o of outcomes.filter(oo => oo.outcome === "win")) {
    bestStrategyCounts[o.strategy] = (bestStrategyCounts[o.strategy] || 0) + 1;
  }
  const bestStrategy = Object.entries(bestStrategyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none yet";

  const perf = await calculatePerformanceFromDB();

  let regime = "awaiting_feeds";
  let dataQualityScore = 0;
  try {
    const { getLatestSnapshots } = await import("./marketSnapshots");
    const snaps = await getLatestSnapshots();
    const freshCount = [...snaps.values()].filter(s => {
      if (!s.fetchedAt) return false;
      return Date.now() - new Date(s.fetchedAt).getTime() < 120_000;
    }).length;
    if (freshCount >= 3) {
      regime = "live";
      dataQualityScore = Math.round((freshCount / 4) * 100);
    } else if (freshCount > 0) {
      regime = "partial_feeds";
      dataQualityScore = Math.round((freshCount / 4) * 100);
    }
  } catch {
    regime = "awaiting_feeds";
  }

  return {
    mode: "paper",
    currentRegime: regime,
    lastDecisionTime: state.lastDecisionAt?.toISOString() || "",
    totalTrades: state.totalTrades,
    winRate,
    currentDrawdown: perf.maxDrawdown,
    openPositionsCount: Number(openPos[0]?.count || 0),
    bestStrategy: bestStrategy.replace(/_/g, " "),
    dataQualityScore,
  };
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

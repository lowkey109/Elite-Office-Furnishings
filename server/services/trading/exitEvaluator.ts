import { db } from "../../db";
import { paperPositions, paperTradeOutcomes, paperTradingDecisions, paperTradingState } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { getLatestSnapshots, isSnapshotStale } from "./marketSnapshots";

const MAX_HOLD_MS = 24 * 60 * 60 * 1000;

export interface ExitResult {
  positionId: string;
  outcomeId: string;
  symbol: string;
  exitReason: string;
  exitPrice: number;
  realizedPnl: number;
  exitSnapshotId: string;
}

export async function evaluateExits(): Promise<ExitResult[]> {
  const openPositions = await db.select()
    .from(paperPositions)
    .where(eq(paperPositions.status, "open"));

  if (openPositions.length === 0) return [];

  const snapshots = await getLatestSnapshots();
  const results: ExitResult[] = [];

  for (const pos of openPositions) {
    const snap = snapshots.get(pos.symbol);

    if (!snap || isSnapshotStale(snap)) {
      continue;
    }

    const currentPrice = snap.price;
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

    const entryMs = pos.entryTimestamp ? new Date(pos.entryTimestamp).getTime() : (pos.createdAt ? new Date(pos.createdAt).getTime() : Date.now());
    if (!shouldClose && Date.now() - entryMs > MAX_HOLD_MS) {
      shouldClose = true;
      exitReason = "max_hold_exceeded";
    }

    if (!shouldClose) continue;

    const existingOutcome = await db.select({ id: paperTradeOutcomes.id })
      .from(paperTradeOutcomes)
      .where(eq(paperTradeOutcomes.linkedPositionId, pos.id));
    if (existingOutcome.length > 0) continue;

    const durationMs = Date.now() - entryMs;
    const durationStr = formatDuration(durationMs);

    let rawPnl: number;
    if (pos.side === "long") {
      rawPnl = currentPrice - pos.entryPrice;
    } else {
      rawPnl = pos.entryPrice - currentPrice;
    }

    const slippage = Math.round(Math.abs(rawPnl) * 0.001 * 100) / 100;
    const fees = Math.round(pos.paperCapitalAllocated * 0.001 * 100) / 100;
    const realizedPnl = Math.round((rawPnl - slippage - fees) * 100) / 100;
    const outcome = realizedPnl >= 0 ? "win" : "loss";
    const capitalReturned = Math.round((pos.paperCapitalAllocated + realizedPnl) * 100) / 100;

    const [outcomeRow] = await db.insert(paperTradeOutcomes).values({
      linkedDecisionId: pos.linkedDecisionId,
      linkedPositionId: pos.id,
      symbol: pos.symbol,
      strategy: pos.strategy,
      direction: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: currentPrice,
      realizedPnl,
      paperCapitalReturned: capitalReturned,
      fees,
      slippage,
      outcome,
      exitReason,
      exitSnapshotId: snap.id,
      duration: durationStr,
    }).returning();

    await db.update(paperPositions)
      .set({
        status: "closed",
        currentPrice,
        closedAt: new Date(),
        exitSnapshotId: snap.id,
        updatedAt: new Date(),
      })
      .where(eq(paperPositions.id, pos.id));

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

    results.push({
      positionId: pos.id,
      outcomeId: outcomeRow.id,
      symbol: pos.symbol,
      exitReason,
      exitPrice: currentPrice,
      realizedPnl,
      exitSnapshotId: snap.id,
    });
  }

  return results;
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

import { db } from "../../db";
import { paperPositions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getLatestSnapshots, isSnapshotStale } from "./marketSnapshots";

export interface MarkResult {
  positionId: string;
  symbol: string;
  oldPrice: number;
  newPrice: number;
  unrealizedPnl: number;
  snapshotId: string;
  markedAt: Date;
}

export async function markOpenPaperPositions(): Promise<MarkResult[]> {
  const openPositions = await db.select()
    .from(paperPositions)
    .where(eq(paperPositions.status, "open"));

  if (openPositions.length === 0) return [];

  const snapshots = await getLatestSnapshots();
  const results: MarkResult[] = [];
  const now = new Date();

  for (const pos of openPositions) {
    const snap = snapshots.get(pos.symbol);
    if (!snap) continue;

    if (isSnapshotStale(snap)) continue;

    const newPrice = snap.price;
    const unrealizedPnl = pos.side === "long"
      ? Math.round((newPrice - pos.entryPrice) * 100) / 100
      : Math.round((pos.entryPrice - newPrice) * 100) / 100;

    await db.update(paperPositions)
      .set({
        currentPrice: newPrice,
        lastMarkedAt: now,
        lastMarkedSnapshotId: snap.id,
        updatedAt: now,
      })
      .where(eq(paperPositions.id, pos.id));

    results.push({
      positionId: pos.id,
      symbol: pos.symbol,
      oldPrice: pos.currentPrice,
      newPrice,
      unrealizedPnl,
      snapshotId: snap.id,
      markedAt: now,
    });
  }

  return results;
}

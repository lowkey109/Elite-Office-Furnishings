import { db } from "../../db";
import { marketSnapshots } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { MarketFeedResult } from "./marketDataAdapter";

export async function writeSnapshot(feed: MarketFeedResult): Promise<string> {
  const [row] = await db.insert(marketSnapshots).values({
    symbol: feed.symbol,
    source: feed.source,
    price: feed.price,
    bid: null,
    ask: null,
    high24h: feed.high24h,
    low24h: feed.low24h,
    volume24h: feed.volume24h,
    change24h: feed.change24h,
    changePct24h: feed.changePct24h,
    marketCap: feed.marketCap,
    regime: null,
    isStale: feed.isStale,
    fetchedAt: feed.fetchedAt,
    rawPayloadJson: feed.rawPayload,
  }).returning();
  return row.id;
}

export async function writeSnapshots(feeds: MarketFeedResult[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const feed of feeds) {
    if (!feed.available) continue;
    const id = await writeSnapshot(feed);
    result.set(feed.symbol, id);
  }
  return result;
}

export async function getLatestSnapshot(symbol: string) {
  const rows = await db.select()
    .from(marketSnapshots)
    .where(eq(marketSnapshots.symbol, symbol))
    .orderBy(desc(marketSnapshots.fetchedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestSnapshots(): Promise<Map<string, typeof marketSnapshots.$inferSelect>> {
  const symbols = ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"];
  const result = new Map<string, typeof marketSnapshots.$inferSelect>();

  for (const symbol of symbols) {
    const snap = await getLatestSnapshot(symbol);
    if (snap) result.set(symbol, snap);
  }

  return result;
}

const STALE_THRESHOLD_MS = 120_000;

export function isSnapshotStale(snapshot: { fetchedAt: Date | null; isStale?: boolean }): boolean {
  if (!snapshot.fetchedAt) return true;
  if (snapshot.isStale === true) return true;
  return Date.now() - new Date(snapshot.fetchedAt).getTime() > STALE_THRESHOLD_MS;
}

export async function pruneOldSnapshots(keepHours = 48): Promise<number> {
  const cutoff = new Date(Date.now() - keepHours * 60 * 60 * 1000);
  const result = await db.delete(marketSnapshots)
    .where(sql`${marketSnapshots.fetchedAt} < ${cutoff}`);
  return result.rowCount ?? 0;
}

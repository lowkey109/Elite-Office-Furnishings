import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../../localcore/nexoraLocalCore";
import { recordNexoraMetric } from "../../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const BOOK_LOG = nexoraLocalPath("poly-five", "clob", "orderbook-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-five", "journal", "poly-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function normalizeLevels(levels: any[] = []) {
  return levels
    .map((x) => ({
      price: Number(x.price ?? x.p ?? x[0] ?? 0),
      size: Number(x.size ?? x.s ?? x[1] ?? 0),
    }))
    .filter((x) => Number.isFinite(x.price) && Number.isFinite(x.size) && x.price > 0 && x.size >= 0)
    .sort((a, b) => b.price - a.price);
}

export function normalizePolymarketClobOrderBook(input: any = {}) {
  const bookId = String(input.bookId || nexoraLocalId("clob_book"));
  const marketId = String(input.marketId || input.conditionId || "unknown_market");
  const bids = normalizeLevels(Array.isArray(input.bids) ? input.bids : []);
  const asks = normalizeLevels(Array.isArray(input.asks) ? input.asks : []).sort((a, b) => a.price - b.price);

  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const mid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : Number(input.mid || input.yesPrice || 0.5);
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  const spreadBps = spread !== null && mid > 0 ? Math.round((spread / mid) * 10000 * 100) / 100 : null;
  const liquidityUsd =
    bids.slice(0, 10).reduce((sum, x) => sum + x.price * x.size, 0) +
    asks.slice(0, 10).reduce((sum, x) => sum + x.price * x.size, 0);

  const book = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_clob_orderbook",
    bookId,
    marketId,
    asset: String(input.asset || "BTC").toUpperCase(),
    yesPrice: Math.max(0.01, Math.min(0.99, Number(input.yesPrice || mid || 0.5))),
    bestBid,
    bestAsk,
    mid,
    spread,
    spreadBps,
    liquidityUsd: Math.round(liquidityUsd * 100) / 100,
    bids: bids.slice(0, 50),
    asks: asks.slice(0, 50),
    sourceTs: input.sourceTs || input.timestamp || now(),
    receivedAt: now(),
    raw: input.raw || {},
    safety: {
      normalizeOnly: true,
      noOrders: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-five", "clob", `${bookId}.json`), book);
  appendNexoraJsonl(BOOK_LOG, { event: "clob.book", book, createdAt: now() });
  journal("clob.book", book);

  recordNexoraMetric({
    name: "poly_clob_orderbook_normalized",
    value: 1,
    unit: "book",
    dimensions: { asset: book.asset },
  });

  return { ok: true, nexoraBrain: true, book };
}

export function listPolymarketClobBooks(input: any = {}) {
  const marketId = input.marketId ? String(input.marketId) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(BOOK_LOG)
    .filter((row: any) => row.event === "clob.book")
    .map((row: any) => row.book)
    .filter((book: any) => !marketId || book.marketId === marketId)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getPolyClobOrderBookStatus() {
  const rows = listPolymarketClobBooks({ limit: 1000 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_clob_orderbook_status",
    books: rows.count,
    safety: {
      noOrders: true,
      noPrivateKeys: true,
    },
  };
}

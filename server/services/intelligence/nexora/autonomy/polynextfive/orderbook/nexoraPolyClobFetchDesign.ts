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

const FETCH_LOG = nexoraLocalPath("poly-next-five", "orderbook", "orderbook-fetch-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-next-five", "journal", "poly-next-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function createClobOrderbookFetchPlan(input: any = {}) {
  const fetchPlanId = String(input.fetchPlanId || nexoraLocalId("clob_fetch_plan"));
  const tokenId = String(input.tokenId || input.yesTokenId || "unknown_token");
  const marketId = String(input.marketId || "unknown_market");
  const clobBaseUrl = String(input.clobBaseUrl || "https://clob.polymarket.com");

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_clob_orderbook_fetch_plan",
    fetchPlanId,
    createdAt: now(),
    marketId,
    tokenId,
    url: `${clobBaseUrl}/book?token_id=${encodeURIComponent(tokenId)}`,
    networkEnabled: input.networkEnabled === true,
    method: "GET",
    safety: {
      readOnly: true,
      noOrders: true,
      noPrivateKeys: true,
      noWalletSigning: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-next-five", "orderbook", `${fetchPlanId}.json`), plan);
  appendNexoraJsonl(FETCH_LOG, { event: "clob.fetch_plan", plan, createdAt: now() });
  journal("clob.fetch_plan", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function normalizeClobFetchedBook(input: any = {}) {
  const bookId = String(input.bookId || nexoraLocalId("fetched_book"));
  const raw = input.raw || input.book || {};
  const bids = Array.isArray(raw.bids) ? raw.bids : Array.isArray(input.bids) ? input.bids : [];
  const asks = Array.isArray(raw.asks) ? raw.asks : Array.isArray(input.asks) ? input.asks : [];

  function level(x: any) {
    return {
      price: Number(x.price ?? x.p ?? x[0] ?? 0),
      size: Number(x.size ?? x.s ?? x[1] ?? 0),
    };
  }

  const bidRows = bids.map(level).filter((x: any) => x.price > 0 && x.size >= 0).sort((a: any, b: any) => b.price - a.price);
  const askRows = asks.map(level).filter((x: any) => x.price > 0 && x.size >= 0).sort((a: any, b: any) => a.price - b.price);
  const bestBid = bidRows[0]?.price ?? null;
  const bestAsk = askRows[0]?.price ?? null;
  const mid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : Number(input.mid || 0.5);
  const spreadBps = bestBid !== null && bestAsk !== null && mid > 0 ? Math.round(((bestAsk - bestBid) / mid) * 10000 * 100) / 100 : null;

  const normalized = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_clob_fetched_book_normalized",
    bookId,
    marketId: input.marketId || raw.market || null,
    tokenId: input.tokenId || raw.asset_id || raw.token_id || null,
    bestBid,
    bestAsk,
    mid,
    spreadBps,
    bids: bidRows.slice(0, 50),
    asks: askRows.slice(0, 50),
    receivedAt: now(),
    safety: {
      readOnly: true,
      noOrders: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-next-five", "orderbook", `${bookId}.normalized.json`), normalized);
  appendNexoraJsonl(FETCH_LOG, { event: "clob.book_normalized", normalized, createdAt: now() });
  journal("clob.book_normalized", normalized);

  recordNexoraMetric({
    name: "clob_book_normalized",
    value: 1,
    unit: "book",
    dimensions: { marketId: normalized.marketId || "unknown" },
  });

  return { ok: true, nexoraBrain: true, normalized };
}

export function listClobFetchRecords(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(FETCH_LOG).slice(-limit).reverse();
  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getClobFetchDesignStatus() {
  const records = listClobFetchRecords({ limit: 1000 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_clob_fetch_design_status",
    records: records.count,
    safety: {
      readOnly: true,
      noOrders: true,
      noPrivateKeys: true,
    },
  };
}

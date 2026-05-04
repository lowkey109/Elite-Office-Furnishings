import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../../localcore/nexoraLocalCore";
import { recordNexoraMetric } from "../../warehouse/nexoraLocalWarehouse";
import { recordNexoraTimelineEvent } from "../../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

function round(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const FILL_LOG = nexoraLocalPath("poly-final-five", "clob-fill", "clob-fill-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-final-five", "journal", "poly-final-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function allBooks() {
  return [
    ...readNexoraJsonl(nexoraLocalPath("poly-five", "clob", "orderbook-log.jsonl"))
      .filter((row: any) => row.event === "clob.book")
      .map((row: any) => row.book),
    ...readNexoraJsonl(nexoraLocalPath("poly-next-five", "orderbook", "orderbook-fetch-log.jsonl"))
      .filter((row: any) => row.event === "clob.book_normalized")
      .map((row: any) => row.normalized),
    ...readNexoraJsonl(nexoraLocalPath("polymarket-superstack", "clob", "clob.jsonl"))
      .filter((row: any) => row.event === "clob.snapshot")
      .map((row: any) => row.snapshot),
  ].filter(Boolean);
}

function latestBook(marketId?: string) {
  const books = allBooks();
  const filtered = marketId ? books.filter((b: any) => b.marketId === marketId) : books;
  return filtered.slice(-1)[0] || null;
}

export function simulatePaperFillFromClobSnapshot(input: any = {}) {
  const fillId = String(input.fillId || nexoraLocalId("clob_fill"));
  const marketId = input.marketId ? String(input.marketId) : undefined;
  const book = input.book || latestBook(marketId);

  if (!book) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "No CLOB snapshot available.",
      hint: "Run /api/nexora/poly-five/clob/normalize or /api/nexora/poly-next-five/clob/normalize first.",
    };
  }

  const side = String(input.side || "BUY_YES_PAPER");
  const sizeUsd = Number(input.sizeUsd || 10);
  const maxSlippageBps = Number(input.maxSlippageBps || 100);
  const yesPrice = Number(book.yesPrice || book.mid || input.yesPrice || 0.5);
  const bestAsk = Number(book.bestAsk || yesPrice + 0.01);
  const bestBid = Number(book.bestBid || yesPrice - 0.01);
  const rawPrice = side.includes("BUY") ? bestAsk : bestBid;
  const slippageBps = Number(input.slippageBps || Math.min(maxSlippageBps, Number(book.spreadBps || 50)));
  const fillPrice = Math.max(0.01, Math.min(0.99, rawPrice + (side.includes("BUY") ? slippageBps / 10000 : -slippageBps / 10000)));

  const fill = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_clob_snapshot_paper_fill",
    fillId,
    marketId: book.marketId || marketId || "unknown_market",
    asset: book.asset || input.asset || "BTC",
    side,
    sizeUsd,
    fillPrice: round(fillPrice, 6),
    referencePrice: round(rawPrice, 6),
    slippageBps,
    bookSummary: {
      bestBid,
      bestAsk,
      mid: book.mid || yesPrice,
      spreadBps: book.spreadBps || null,
      liquidityUsd: book.liquidityUsd || null,
    },
    filledAt: now(),
    safety: {
      paperOnly: true,
      noLiveOrder: true,
      noPrivateKeys: true,
      noWalletSigning: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-final-five", "clob-fill", `${fillId}.json`), fill);
  appendNexoraJsonl(FILL_LOG, { event: "clob_fill.simulated", fill, createdAt: now() });
  journal("clob_fill.simulated", fill);

  recordNexoraMetric({
    name: "clob_snapshot_paper_fill",
    value: sizeUsd,
    unit: "usd",
    dimensions: { asset: fill.asset, side },
  });

  recordNexoraTimelineEvent({
    type: "clob_snapshot_fill",
    title: "CLOB snapshot paper fill simulated",
    severity: "info",
    payload: { fillId, marketId: fill.marketId, side, sizeUsd },
  });

  return { ok: true, nexoraBrain: true, fill };
}

export function listClobSnapshotPaperFills(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(FILL_LOG)
    .filter((row: any) => row.event === "clob_fill.simulated")
    .map((row: any) => row.fill)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getClobSnapshotFillStatus() {
  const fills = listClobSnapshotPaperFills({ limit: 1000 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_clob_snapshot_fill_status",
    fills: fills.count,
    latest: fills.rows[0] || null,
  };
}

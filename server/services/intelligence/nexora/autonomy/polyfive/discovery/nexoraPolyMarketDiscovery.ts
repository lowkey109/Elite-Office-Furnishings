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

const MARKET_LOG = nexoraLocalPath("poly-five", "markets", "market-discovery-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-five", "journal", "poly-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeMarketId(input: any) {
  return String(input.marketId || input.conditionId || input.slug || nexoraLocalId("pm_market")).replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export function importPolymarketDiscoveredMarkets(input: any = {}) {
  const importId = String(input.importId || nexoraLocalId("market_import"));
  const rows = Array.isArray(input.markets) ? input.markets : [];

  const markets = rows.map((row: any) => {
    const asset = String(row.asset || row.symbol || "BTC").toUpperCase().replace("USDT", "");
    const marketId = safeMarketId(row);

    return {
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_discovered_market",
      marketId,
      slug: row.slug || null,
      conditionId: row.conditionId || null,
      question: String(row.question || row.title || `Will ${asset} move?`),
      asset,
      symbol: String(row.symbol || `${asset}USDT`).toUpperCase(),
      durationMinutes: Number(row.durationMinutes || row.duration || 15),
      yesTokenId: row.yesTokenId || null,
      noTokenId: row.noTokenId || null,
      active: row.active !== false,
      discoveredAt: now(),
      metadata: row,
      safety: {
        discoveryOnly: true,
        noOrders: true,
      },
    };
  });

  for (const market of markets) {
    writeNexoraJson(nexoraLocalPath("poly-five", "markets", `${market.marketId}.json`), market);
    appendNexoraJsonl(MARKET_LOG, { event: "market.discovered", market, createdAt: now() });
  }

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_market_import",
    importId,
    createdAt: now(),
    count: markets.length,
    markets,
  };

  journal("market.import", result);

  recordNexoraMetric({
    name: "poly_markets_imported",
    value: markets.length,
    unit: "markets",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, result };
}

export function createDefaultPolymarketWatchMarkets(input: any = {}) {
  const assets = Array.isArray(input.assets) ? input.assets : ["BTC", "ETH"];
  const durations = Array.isArray(input.durationsMinutes) ? input.durationsMinutes : [5, 15];

  const markets = [];
  for (const assetRaw of assets) {
    const asset = String(assetRaw).toUpperCase();
    for (const duration of durations) {
      markets.push({
        marketId: `${asset.toLowerCase()}_${duration}m_paper_watch`,
        asset,
        symbol: `${asset}USDT`,
        durationMinutes: Number(duration),
        question: `Paper watch: ${asset} ${duration} minute up/down market`,
        active: true,
      });
    }
  }

  return importPolymarketDiscoveredMarkets({
    importId: input.importId || "default_watch_markets",
    markets,
  });
}

export function listPolymarketDiscoveredMarkets(input: any = {}) {
  const asset = input.asset ? String(input.asset).toUpperCase() : "";
  const activeOnly = input.activeOnly === true;
  const limit = Number(input.limit || 200);

  const rows = readNexoraJsonl(MARKET_LOG)
    .filter((row: any) => row.event === "market.discovered")
    .map((row: any) => row.market)
    .filter((market: any) => !asset || market.asset === asset)
    .filter((market: any) => !activeOnly || market.active)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getPolyMarketDiscoveryStatus() {
  const rows = listPolymarketDiscoveredMarkets({ limit: 1000 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_market_discovery_status",
    markets: rows.count,
    safety: {
      noOrders: true,
      noPrivateKeys: true,
    },
  };
}

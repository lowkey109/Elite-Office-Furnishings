import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../../localcore/nexoraLocalCore";
import { recordNexoraMetric } from "../../warehouse/nexoraLocalWarehouse";
import { recordNexoraTimelineEvent } from "../../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const CONFIG_FILE = nexoraLocalPath("poly-next-five", "market-api", "config.json");
const MARKET_LOG = nexoraLocalPath("poly-next-five", "market-api", "market-api-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-next-five", "journal", "poly-next-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function setPolyMarketApiConfig(input: any = {}) {
  const config = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_market_api_config",
    updatedAt: now(),
    gammaBaseUrl: input.gammaBaseUrl || "https://gamma-api.polymarket.com",
    clobBaseUrl: input.clobBaseUrl || "https://clob.polymarket.com",
    networkEnabled: input.networkEnabled === true,
    defaultTags: Array.isArray(input.defaultTags) ? input.defaultTags : ["crypto", "bitcoin", "ethereum"],
    defaultLimit: Number(input.defaultLimit || 100),
    safety: {
      readOnly: true,
      noOrders: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(CONFIG_FILE, config);
  journal("market_api.config", config);

  return { ok: true, nexoraBrain: true, config };
}

export function getPolyMarketApiConfig() {
  const existing = readNexoraJson(CONFIG_FILE, null);
  if (existing) return { ok: true, nexoraBrain: true, config: existing };
  return setPolyMarketApiConfig({});
}

export function normalizePolyGammaMarket(input: any = {}) {
  const marketId = String(input.id || input.marketId || input.conditionId || input.slug || nexoraLocalId("gamma_market"));
  const question = String(input.question || input.title || input.name || "Polymarket market");
  const text = JSON.stringify(input).toLowerCase();
  const asset =
    text.includes("ethereum") || text.includes("eth") ? "ETH" :
    text.includes("bitcoin") || text.includes("btc") ? "BTC" :
    String(input.asset || "UNKNOWN").toUpperCase();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_gamma_market_normalized",
    marketId,
    slug: input.slug || null,
    question,
    asset,
    active: input.active !== false && input.closed !== true,
    volume: Number(input.volume || input.volumeNum || 0),
    liquidity: Number(input.liquidity || input.liquidityNum || 0),
    endDate: input.endDate || input.end_date || null,
    conditionId: input.conditionId || null,
    tokens: input.tokens || input.outcomes || [],
    raw: input,
    normalizedAt: now(),
  };
}

export function importPolyGammaMarkets(input: any = {}) {
  const importId = String(input.importId || nexoraLocalId("gamma_import"));
  const markets = Array.isArray(input.markets) ? input.markets : [];

  const normalized = markets.map(normalizePolyGammaMarket);

  for (const market of normalized) {
    writeNexoraJson(nexoraLocalPath("poly-next-five", "market-api", `${market.marketId}.json`), market);
    appendNexoraJsonl(MARKET_LOG, { event: "gamma.market.imported", market, createdAt: now() });
  }

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_gamma_market_import",
    importId,
    createdAt: now(),
    count: normalized.length,
    markets: normalized,
  };

  journal("gamma.market.imported", { importId, count: normalized.length });

  recordNexoraMetric({
    name: "poly_gamma_markets_imported",
    value: normalized.length,
    unit: "markets",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, result };
}

export function createPolyMarketDiscoveryQuery(input: any = {}) {
  const config = getPolyMarketApiConfig().config;
  const queryId = String(input.queryId || nexoraLocalId("market_query"));
  const q = String(input.q || input.query || "crypto");
  const limit = Number(input.limit || config.defaultLimit || 100);

  const query = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_market_discovery_query",
    queryId,
    createdAt: now(),
    q,
    limit,
    url: `${config.gammaBaseUrl}/markets?limit=${encodeURIComponent(String(limit))}&search=${encodeURIComponent(q)}`,
    networkEnabled: config.networkEnabled === true,
    instructions: [
      "This is a read-only query plan.",
      "No network call is made unless a future collector explicitly enables read-only fetch.",
      "No orders, no wallet, no private keys.",
    ],
  };

  appendNexoraJsonl(MARKET_LOG, { event: "gamma.query.created", query, createdAt: now() });
  journal("gamma.query.created", query);

  return { ok: true, nexoraBrain: true, query };
}

export function listPolyMarketApiMarkets(input: any = {}) {
  const asset = input.asset ? String(input.asset).toUpperCase() : "";
  const activeOnly = input.activeOnly === true;
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(MARKET_LOG)
    .filter((row: any) => row.event === "gamma.market.imported")
    .map((row: any) => row.market)
    .filter((market: any) => !asset || market.asset === asset)
    .filter((market: any) => !activeOnly || market.active)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getPolyMarketApiDiscoveryStatus() {
  const markets = listPolyMarketApiMarkets({ limit: 1000 });
  const queries = readNexoraJsonl(MARKET_LOG).filter((row: any) => row.event === "gamma.query.created");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_market_api_discovery_status",
    markets: markets.count,
    queries: queries.length,
    config: getPolyMarketApiConfig().config,
  };
}

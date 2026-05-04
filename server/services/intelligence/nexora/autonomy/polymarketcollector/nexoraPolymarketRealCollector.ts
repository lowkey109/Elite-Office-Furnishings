import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";
import {
  recordNexoraBinanceTick,
  recordNexoraPolymarketSnapshot,
  runNexoraMarketDataPaperCycle,
  detectNexoraMarketEdge,
  calculateNexoraMarketFairValue,
} from "../marketdata/nexoraMarketDataPaperEngine";

function now() {
  return new Date().toISOString();
}

function safeId(value: string) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

const CONFIG_FILE = nexoraLocalPath("polymarket-collector", "config", "collector-config.json");
const MARKET_LOG = nexoraLocalPath("polymarket-collector", "markets", "market-watchlist.jsonl");
const CLOB_LOG = nexoraLocalPath("polymarket-collector", "clob", "clob-snapshots.jsonl");
const BINANCE_LOG = nexoraLocalPath("polymarket-collector", "binance", "binance-normalized.jsonl");
const NORMALIZED_LOG = nexoraLocalPath("polymarket-collector", "normalized", "normalized-events.jsonl");
const SIGNAL_LOG = nexoraLocalPath("polymarket-collector", "signals", "collector-signals.jsonl");
const HEALTH_LOG = nexoraLocalPath("polymarket-collector", "health", "collector-health.jsonl");
const JOURNAL = nexoraLocalPath("polymarket-collector", "journal", "polymarket-collector-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

export function setNexoraPolymarketCollectorConfig(input: any = {}) {
  const config = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_collector_config",
    updatedAt: now(),
    mode: "paper_only",
    liveTradingBlocked: true,
    privateKeysBlocked: true,
    networkCollectorsEnabled: input.networkCollectorsEnabled === true,
    binance: {
      enabled: input.binance?.enabled === true,
      symbols: Array.isArray(input.binance?.symbols) ? input.binance.symbols : ["BTCUSDT", "ETHUSDT"],
      streamBaseUrl: input.binance?.streamBaseUrl || "wss://stream.binance.com:9443/ws",
      useRealNetwork: input.binance?.useRealNetwork === true,
    },
    polymarket: {
      enabled: input.polymarket?.enabled === true,
      clobBaseUrl: input.polymarket?.clobBaseUrl || "https://clob.polymarket.com",
      gammaBaseUrl: input.polymarket?.gammaBaseUrl || "https://gamma-api.polymarket.com",
      useRealNetwork: input.polymarket?.useRealNetwork === true,
      websocketUrl: input.polymarket?.websocketUrl || null,
    },
    thresholds: {
      minEdgeBps: Number(input.thresholds?.minEdgeBps || input.minEdgeBps || 250),
      maxLatencyMs: Number(input.thresholds?.maxLatencyMs || input.maxLatencyMs || 3000),
      maxSpreadBps: Number(input.thresholds?.maxSpreadBps || input.maxSpreadBps || 500),
      minLiquidityUsd: Number(input.thresholds?.minLiquidityUsd || input.minLiquidityUsd || 100),
    },
    safety: {
      noOrders: true,
      noWalletSigning: true,
      noPrivateKeys: true,
      noLiveTrading: true,
      collectorOnly: true,
    },
  };

  writeNexoraJson(CONFIG_FILE, config);
  journal("collector.config.set", config);

  return { ok: true, nexoraBrain: true, config };
}

export function getNexoraPolymarketCollectorConfig() {
  const existing = readNexoraJson(CONFIG_FILE, null);
  if (existing) return { ok: true, nexoraBrain: true, config: existing };
  return setNexoraPolymarketCollectorConfig({});
}

export function registerNexoraPolymarketCollectorMarket(input: any = {}) {
  const marketId = String(input.marketId || input.conditionId || input.slug || nexoraLocalId("pm_market"));
  const market = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_collector_market",
    marketId,
    slug: input.slug || null,
    conditionId: input.conditionId || null,
    question: String(input.question || "Polymarket watched market"),
    asset: String(input.asset || "BTC").toUpperCase(),
    symbol: String(input.symbol || `${String(input.asset || "BTC").toUpperCase()}USDT`).toUpperCase(),
    durationMinutes: Number(input.durationMinutes || 15),
    yesTokenId: input.yesTokenId || null,
    noTokenId: input.noTokenId || null,
    active: input.active !== false,
    createdAt: now(),
    metadata: input.metadata || {},
    safety: {
      paperOnly: true,
      collectorOnly: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-collector", "markets", `${safeId(marketId)}.json`), market);
  appendNexoraJsonl(MARKET_LOG, { event: "market.registered", market, createdAt: now() });
  journal("market.registered", market);

  return { ok: true, nexoraBrain: true, market };
}

export function listNexoraPolymarketCollectorMarkets(input: any = {}) {
  const asset = input.asset ? String(input.asset).toUpperCase() : "";
  const activeOnly = input.activeOnly === true;
  const limit = Number(input.limit || 200);

  const rows = readNexoraJsonl(MARKET_LOG)
    .filter((row: any) => row.event === "market.registered")
    .map((row: any) => row.market)
    .filter((market: any) => !asset || market.asset === asset)
    .filter((market: any) => !activeOnly || market.active)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function normalizeNexoraBinanceTicker(input: any = {}) {
  const symbol = String(input.symbol || input.s || "BTCUSDT").toUpperCase();
  const price = Number(input.price || input.c || input.lastPrice || 0);
  const eventTs = input.eventTs || input.E || input.sourceTs || now();

  const ticker = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_normalized_binance_ticker",
    eventId: String(input.eventId || nexoraLocalId("binance_norm")),
    symbol,
    asset: symbol.replace("USDT", ""),
    price,
    bid: input.bid !== undefined ? Number(input.bid) : input.b !== undefined ? Number(input.b) : null,
    ask: input.ask !== undefined ? Number(input.ask) : input.a !== undefined ? Number(input.a) : null,
    volume: input.volume !== undefined ? Number(input.volume) : input.v !== undefined ? Number(input.v) : null,
    sourceTs: new Date(eventTs).toISOString(),
    receivedAt: now(),
    raw: input.raw || input,
  };

  appendNexoraJsonl(BINANCE_LOG, { event: "binance.normalized", ticker, createdAt: now() });
  appendNexoraJsonl(NORMALIZED_LOG, { event: "market.normalized.binance", payload: ticker, createdAt: now() });

  recordNexoraBinanceTick({
    symbol: ticker.symbol,
    asset: ticker.asset,
    price: ticker.price,
    bid: ticker.bid,
    ask: ticker.ask,
    volume: ticker.volume,
    sourceTs: ticker.sourceTs,
    payload: { source: "collector_normalizer" },
  });

  journal("binance.normalized", ticker);

  return { ok: true, nexoraBrain: true, ticker };
}

export function normalizeNexoraPolymarketClobSnapshot(input: any = {}) {
  const yesPrice = clamp(Number(input.yesPrice ?? input.midYes ?? input.price ?? 0.5), 0.01, 0.99);
  const noPrice = clamp(Number(input.noPrice ?? (1 - yesPrice)), 0.01, 0.99);
  const marketId = String(input.marketId || input.conditionId || input.slug || "unknown_market");

  const snapshot = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_normalized_polymarket_clob_snapshot",
    snapshotId: String(input.snapshotId || nexoraLocalId("clob_snapshot")),
    marketId,
    asset: String(input.asset || "BTC").toUpperCase(),
    symbol: String(input.symbol || `${String(input.asset || "BTC").toUpperCase()}USDT`).toUpperCase(),
    yesPrice,
    noPrice,
    bestBid: input.bestBid !== undefined ? Number(input.bestBid) : null,
    bestAsk: input.bestAsk !== undefined ? Number(input.bestAsk) : null,
    spreadBps: input.spreadBps !== undefined ? Number(input.spreadBps) : null,
    liquidityUsd: input.liquidityUsd !== undefined ? Number(input.liquidityUsd) : null,
    sourceTs: input.sourceTs || input.timestamp || now(),
    receivedAt: now(),
    raw: input.raw || input,
  };

  appendNexoraJsonl(CLOB_LOG, { event: "clob.snapshot", snapshot, createdAt: now() });
  appendNexoraJsonl(NORMALIZED_LOG, { event: "market.normalized.polymarket", payload: snapshot, createdAt: now() });

  recordNexoraPolymarketSnapshot({
    marketId: snapshot.marketId,
    asset: snapshot.asset,
    yesPrice: snapshot.yesPrice,
    noPrice: snapshot.noPrice,
    bestBid: snapshot.bestBid,
    bestAsk: snapshot.bestAsk,
    spreadBps: snapshot.spreadBps,
    liquidityUsd: snapshot.liquidityUsd,
    sourceTs: snapshot.sourceTs,
    payload: { source: "collector_normalizer" },
  });

  journal("clob.snapshot", snapshot);

  return { ok: true, nexoraBrain: true, snapshot };
}

export function runNexoraCollectorEdgeScan(input: any = {}) {
  const config = getNexoraPolymarketCollectorConfig().config;
  const binanceRows = readNexoraJsonl(BINANCE_LOG)
    .filter((row: any) => row.event === "binance.normalized")
    .map((row: any) => row.ticker);

  const clobRows = readNexoraJsonl(CLOB_LOG)
    .filter((row: any) => row.event === "clob.snapshot")
    .map((row: any) => row.snapshot);

  const latestBySymbol = new Map<string, any>();
  for (const ticker of binanceRows) latestBySymbol.set(ticker.symbol, ticker);

  const latestClob = clobRows.slice(-Number(input.limit || 50));
  const signals = [];

  for (const snapshot of latestClob) {
    const ticker = latestBySymbol.get(snapshot.symbol);
    if (!ticker) continue;

    const market = readNexoraJson(nexoraLocalPath("polymarket-collector", "markets", `${safeId(snapshot.marketId)}.json`), null);
    const openPrice = Number(input.openPrice || market?.openPrice || ticker.price);
    const secondsToExpiry = Number(input.secondsToExpiry || 300);

    const fair = calculateNexoraMarketFairValue({
      openPrice,
      currentPrice: ticker.price,
      secondsToExpiry,
      volatilityBps: input.volatilityBps || 35,
    });

    const latencyMs = Math.max(0, new Date(snapshot.receivedAt).getTime() - new Date(ticker.receivedAt).getTime());

    const edge = detectNexoraMarketEdge({
      marketId: snapshot.marketId,
      asset: snapshot.asset,
      yesPrice: snapshot.yesPrice,
      fairYes: fair.yesProbability,
      latencyMs,
      minEdgeBps: config.thresholds.minEdgeBps,
      maxLatencyMs: config.thresholds.maxLatencyMs,
    }).edge;

    const signal = {
      ok: true,
      nexoraBrain: true,
      service: "nexora_collector_edge_signal",
      signalId: nexoraLocalId("collector_signal"),
      createdAt: now(),
      ticker,
      snapshot,
      fair,
      latencyMs,
      edge,
      eligible: edge.eligible,
      safety: {
        paperOnly: true,
        noLiveOrders: true,
        noPrivateKeys: true,
      },
    };

    appendNexoraJsonl(SIGNAL_LOG, { event: "collector.edge_signal", signal, createdAt: now() });
    signals.push(signal);
  }

  recordNexoraMetric({
    name: "collector_edge_signals",
    value: signals.length,
    unit: "signals",
    dimensions: {},
  });

  recordNexoraTimelineEvent({
    type: "collector_edge_scan",
    title: "Nexora collector edge scan completed",
    severity: signals.some((s: any) => s.eligible) ? "info" : "debug",
    payload: { signals: signals.length },
  });

  journal("collector.edge_scan", { signals: signals.length });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_collector_edge_scan",
    signalCount: signals.length,
    eligible: signals.filter((s: any) => s.eligible).length,
    signals,
  };
}

export function createNexoraCollectorHealthReport() {
  const binance = readNexoraJsonl(BINANCE_LOG).filter((row: any) => row.event === "binance.normalized");
  const clob = readNexoraJsonl(CLOB_LOG).filter((row: any) => row.event === "clob.snapshot");
  const signals = readNexoraJsonl(SIGNAL_LOG).filter((row: any) => row.event === "collector.edge_signal");

  const latestBinance = binance.slice(-1)[0]?.ticker || null;
  const latestClob = clob.slice(-1)[0]?.snapshot || null;

  const health = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_collector_health_report",
    generatedAt: now(),
    counts: {
      binance: binance.length,
      clob: clob.length,
      signals: signals.length,
    },
    latest: {
      binance: latestBinance,
      polymarket: latestClob,
    },
    mode: "collector_interface_paper_only",
    networkCollectorsEnabled: getNexoraPolymarketCollectorConfig().config.networkCollectorsEnabled,
    safety: {
      noOrders: true,
      noWalletSigning: true,
      noPrivateKeys: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-collector", "health", "latest.json"), health);
  appendNexoraJsonl(HEALTH_LOG, { event: "collector.health", health, createdAt: now() });

  return { ok: true, nexoraBrain: true, health };
}

export function getNexoraPolymarketCollectorStatus() {
  const config = getNexoraPolymarketCollectorConfig().config;
  const markets = listNexoraPolymarketCollectorMarkets({ limit: 1000 });
  const health = createNexoraCollectorHealthReport().health;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_real_collector_interface",
    generatedAt: now(),
    config,
    markets: markets.count,
    health,
  };
}

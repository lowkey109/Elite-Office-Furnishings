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

function now() {
  return new Date().toISOString();
}

function round(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

function safeId(value: string) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160);
}

const JOURNAL = nexoraLocalPath("polymarket-superstack", "journal", "journal.jsonl");
const MARKET_LOG = nexoraLocalPath("polymarket-superstack", "markets", "markets.jsonl");
const WATCHLIST_LOG = nexoraLocalPath("polymarket-superstack", "watchlists", "watchlists.jsonl");
const CLOB_LOG = nexoraLocalPath("polymarket-superstack", "clob", "clob.jsonl");
const BINANCE_LOG = nexoraLocalPath("polymarket-superstack", "binance", "binance.jsonl");
const SIGNAL_LOG = nexoraLocalPath("polymarket-superstack", "signals", "signals.jsonl");
const ORDER_LOG = nexoraLocalPath("polymarket-superstack", "paper-orders", "paper-orders.jsonl");
const PNL_LOG = nexoraLocalPath("polymarket-superstack", "pnl", "pnl.jsonl");
const STRATEGY_LOG = nexoraLocalPath("polymarket-superstack", "strategies", "strategies.jsonl");
const BACKTEST_LOG = nexoraLocalPath("polymarket-superstack", "backtests", "backtests.jsonl");
const DAEMON_FILE = nexoraLocalPath("polymarket-superstack", "daemon", "daemon-state.json");

let daemonTimer: NodeJS.Timeout | null = null;

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function createNexoraPolymarketSuperstackConfig(input: any = {}) {
  const config = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_superstack_config",
    configId: String(input.configId || "default"),
    updatedAt: now(),
    mode: "paper_only",
    liveTradingBlocked: true,
    privateKeysBlocked: true,
    clobOrdersBlocked: true,
    polygonSigningBlocked: true,
    networkCollectorsEnabled: input.networkCollectorsEnabled === true,
    assets: Array.isArray(input.assets) ? input.assets : ["BTC", "ETH"],
    durationsMinutes: Array.isArray(input.durationsMinutes) ? input.durationsMinutes : [5, 15],
    thresholds: {
      minEdgeBps: Number(input.minEdgeBps || 250),
      maxLatencyMs: Number(input.maxLatencyMs || 3000),
      maxSpreadBps: Number(input.maxSpreadBps || 600),
      minLiquidityUsd: Number(input.minLiquidityUsd || 100),
      maxPaperBankrollUsd: Number(input.maxPaperBankrollUsd || 1000),
      maxRiskPerTradeFraction: Math.min(Number(input.maxRiskPerTradeFraction || 0.02), 0.05),
      maxOpenExposureFraction: Math.min(Number(input.maxOpenExposureFraction || 0.1), 0.5),
      maxDailyDrawdownFraction: Math.min(Number(input.maxDailyDrawdownFraction || 0.05), 0.25),
    },
    endpoints: {
      binanceWsBase: "wss://stream.binance.com:9443/ws",
      polymarketClobBase: "https://clob.polymarket.com",
      polymarketGammaBase: "https://gamma-api.polymarket.com",
    },
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      noPostgres: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-superstack", "config.json"), config);
  journal("config.updated", config);

  return { ok: true, nexoraBrain: true, config };
}

export function getNexoraPolymarketSuperstackConfig() {
  const config = readNexoraJson(nexoraLocalPath("polymarket-superstack", "config.json"), null);
  if (config) return { ok: true, nexoraBrain: true, config };
  return createNexoraPolymarketSuperstackConfig({});
}

export function registerNexoraPolymarketMarket(input: any = {}) {
  const marketId = String(input.marketId || input.conditionId || input.slug || nexoraLocalId("poly_market"));
  const asset = String(input.asset || "BTC").toUpperCase();
  const durationMinutes = Number(input.durationMinutes || 15);

  const market = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_market",
    marketId,
    slug: input.slug || null,
    conditionId: input.conditionId || null,
    question: String(input.question || `Will ${asset} be higher in ${durationMinutes} minutes?`),
    asset,
    symbol: String(input.symbol || `${asset}USDT`).toUpperCase(),
    durationMinutes,
    yesTokenId: input.yesTokenId || null,
    noTokenId: input.noTokenId || null,
    startPrice: input.startPrice !== undefined ? Number(input.startPrice) : null,
    startTs: input.startTs || null,
    expiryTs: input.expiryTs || null,
    active: input.active !== false,
    source: String(input.source || "manual"),
    createdAt: now(),
    metadata: input.metadata || {},
    safety: {
      paperOnly: true,
      noOrders: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-superstack", "markets", `${safeId(marketId)}.json`), market);
  appendNexoraJsonl(MARKET_LOG, { event: "market.registered", market, createdAt: now() });
  journal("market.registered", market);

  return { ok: true, nexoraBrain: true, market };
}

export function listNexoraPolymarketMarkets(input: any = {}) {
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

export function createNexoraPolymarketWatchlist(input: any = {}) {
  const watchlistId = String(input.watchlistId || nexoraLocalId("watchlist"));
  const assets = Array.isArray(input.assets) ? input.assets.map((x: any) => String(x).toUpperCase()) : ["BTC", "ETH"];
  const durationsMinutes = Array.isArray(input.durationsMinutes) ? input.durationsMinutes.map(Number) : [5, 15];

  const watchlist = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_watchlist",
    watchlistId,
    name: String(input.name || "Default BTC/ETH short-duration watchlist"),
    assets,
    durationsMinutes,
    markets: listNexoraPolymarketMarkets({ activeOnly: true }).rows.filter((market: any) =>
      assets.includes(market.asset) && durationsMinutes.includes(Number(market.durationMinutes))
    ),
    createdAt: now(),
    safety: {
      paperOnly: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-superstack", "watchlists", `${watchlistId}.json`), watchlist);
  appendNexoraJsonl(WATCHLIST_LOG, { event: "watchlist.created", watchlist, createdAt: now() });
  journal("watchlist.created", watchlist);

  return { ok: true, nexoraBrain: true, watchlist };
}

export function recordNexoraBinanceMarketTick(input: any = {}) {
  const symbol = String(input.symbol || "BTCUSDT").toUpperCase();
  const asset = String(input.asset || symbol.replace("USDT", "")).toUpperCase();

  const tick = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_binance_market_tick",
    tickId: String(input.tickId || nexoraLocalId("binance_tick")),
    symbol,
    asset,
    price: Number(input.price || input.lastPrice || 0),
    bid: input.bid !== undefined ? Number(input.bid) : null,
    ask: input.ask !== undefined ? Number(input.ask) : null,
    volume: input.volume !== undefined ? Number(input.volume) : null,
    sourceTs: input.sourceTs || input.timestamp || now(),
    receivedAt: now(),
    raw: input.raw || input,
  };

  appendNexoraJsonl(BINANCE_LOG, { event: "binance.tick", tick, createdAt: now() });
  writeNexoraJson(nexoraLocalPath("polymarket-superstack", "binance", `${symbol}-latest.json`), tick);
  journal("binance.tick", tick);

  return { ok: true, nexoraBrain: true, tick };
}

export function recordNexoraPolymarketClobSnapshot(input: any = {}) {
  const marketId = String(input.marketId || input.conditionId || input.slug || "unknown_market");
  const asset = String(input.asset || "BTC").toUpperCase();
  const yesPrice = clamp(Number(input.yesPrice ?? input.price ?? 0.5), 0.01, 0.99);
  const noPrice = clamp(Number(input.noPrice ?? 1 - yesPrice), 0.01, 0.99);

  const snapshot = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_clob_snapshot",
    snapshotId: String(input.snapshotId || nexoraLocalId("clob_snapshot")),
    marketId,
    asset,
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
  writeNexoraJson(nexoraLocalPath("polymarket-superstack", "clob", `${safeId(marketId)}-latest.json`), snapshot);
  journal("clob.snapshot", snapshot);

  return { ok: true, nexoraBrain: true, snapshot };
}

export function calculateNexoraPolymarketFairValue(input: any = {}) {
  const startPrice = Number(input.startPrice || input.openPrice || 0);
  const currentPrice = Number(input.currentPrice || input.price || 0);
  const secondsToExpiry = Math.max(1, Number(input.secondsToExpiry || 300));
  const volatilityBps = Math.max(1, Number(input.volatilityBps || 35));

  const moveBps = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 10000 : Number(input.moveBps || 0);
  const z = (moveBps / volatilityBps) * Math.sqrt(900 / secondsToExpiry);
  const yesProbability = clamp(sigmoid(z), 0.01, 0.99);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_superstack_fair_value",
    startPrice,
    currentPrice,
    secondsToExpiry,
    volatilityBps,
    moveBps: round(moveBps, 4),
    z: round(z, 6),
    yesProbability: round(yesProbability, 6),
    noProbability: round(1 - yesProbability, 6),
    model: "paper_directional_sigmoid",
  };
}

export function detectNexoraPolymarketEdge(input: any = {}) {
  const config = getNexoraPolymarketSuperstackConfig().config;
  const fair = input.fair || calculateNexoraPolymarketFairValue(input);
  const yesPrice = clamp(Number(input.yesPrice ?? input.polymarketYes ?? 0.5), 0.01, 0.99);
  const fairYes = clamp(Number(input.fairYes ?? fair.yesProbability ?? 0.5), 0.01, 0.99);
  const edge = fairYes - yesPrice;
  const edgeBps = round(edge * 10000, 2);
  const latencyMs = Number(input.latencyMs || 0);
  const spreadBps = Number(input.spreadBps || 0);
  const liquidityUsd = Number(input.liquidityUsd || 0);

  const thresholds = config.thresholds;

  const eligible =
    Math.abs(edgeBps) >= thresholds.minEdgeBps &&
    (!latencyMs || latencyMs <= thresholds.maxLatencyMs) &&
    (!spreadBps || spreadBps <= thresholds.maxSpreadBps) &&
    (!liquidityUsd || liquidityUsd >= thresholds.minLiquidityUsd);

  const side = edge > 0 ? "BUY_YES_PAPER" : "BUY_NO_PAPER";

  const edgeRecord = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_superstack_edge",
    edgeId: String(input.edgeId || nexoraLocalId("edge")),
    marketId: String(input.marketId || "unknown_market"),
    asset: String(input.asset || "BTC").toUpperCase(),
    yesPrice,
    fairYes,
    edge: round(edge, 6),
    edgeBps,
    side,
    eligible,
    latencyMs,
    spreadBps,
    liquidityUsd,
    thresholds,
    fair,
    createdAt: now(),
    safety: {
      paperOnly: true,
      noLiveOrders: true,
    },
  };

  appendNexoraJsonl(SIGNAL_LOG, { event: "edge.detected", edge: edgeRecord, createdAt: now() });
  journal("edge.detected", edgeRecord);

  return { ok: true, nexoraBrain: true, edge: edgeRecord };
}

export function createNexoraPolymarketPaperOrder(input: any = {}) {
  const edge = input.edge || detectNexoraPolymarketEdge(input).edge;
  const config = getNexoraPolymarketSuperstackConfig().config;
  const policy = evaluateNexoraPolicy({
    ...input,
    liveTrading: false,
    tradingMode: "paper/sandbox",
  });

  if (!edge.eligible || policy.approvalRequired) {
    const blocked = {
      ok: false,
      nexoraBrain: true,
      service: "nexora_polymarket_paper_order_blocked",
      blocked: true,
      reason: !edge.eligible ? "edge_not_eligible" : "policy_approval_required",
      edge,
      policy,
      createdAt: now(),
    };

    appendNexoraJsonl(ORDER_LOG, { event: "paper_order.blocked", blocked, createdAt: now() });
    journal("paper_order.blocked", blocked);

    return blocked;
  }

  const bankroll = Number(input.bankroll || config.thresholds.maxPaperBankrollUsd);
  const price = edge.side === "BUY_YES_PAPER" ? edge.yesPrice : 1 - edge.yesPrice;
  const fair = edge.side === "BUY_YES_PAPER" ? edge.fairYes : 1 - edge.fairYes;
  const sideEdge = Math.max(0, fair - price);
  const fraction = Math.min(config.thresholds.maxRiskPerTradeFraction, sideEdge / Math.max(0.01, 1 - price));
  const sizeUsd = money(bankroll * fraction);

  const order = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_paper_order",
    orderId: String(input.orderId || nexoraLocalId("paper_order")),
    marketId: edge.marketId,
    asset: edge.asset,
    side: edge.side,
    price: round(price, 6),
    sizeUsd,
    status: sizeUsd > 0 ? "open_paper" : "zero_size_blocked",
    edge,
    createdAt: now(),
    safety: {
      noLiveOrder: true,
      noWalletSigning: true,
      noPrivateKeys: true,
    },
  };

  appendNexoraJsonl(ORDER_LOG, { event: "paper_order.created", order, createdAt: now() });
  journal("paper_order.created", order);

  recordNexoraMetric({
    name: "polymarket_paper_order_created",
    value: sizeUsd,
    unit: "usd",
    dimensions: { asset: order.asset, side: order.side },
  });

  return { ok: true, nexoraBrain: true, order };
}

export function settleNexoraPolymarketPaperOrder(input: any = {}) {
  const orderId = String(input.orderId || "");
  const outcome = String(input.outcome || "").toUpperCase();

  const orders = readNexoraJsonl(ORDER_LOG)
    .filter((row: any) => row.event === "paper_order.created")
    .map((row: any) => row.order);

  const order = orders.find((row: any) => row.orderId === orderId);

  if (!order) {
    return { ok: false, nexoraBrain: true, error: "Paper order not found.", orderId };
  }

  if (order.status !== "open_paper") {
    return { ok: false, nexoraBrain: true, error: "Paper order is not open.", order };
  }

  const won =
    (order.side === "BUY_YES_PAPER" && outcome === "YES") ||
    (order.side === "BUY_NO_PAPER" && outcome === "NO");

  const cost = Number(order.sizeUsd || 0);
  const payout = won ? cost / Math.max(0.01, Number(order.price || 0.5)) : 0;
  const pnl = money(payout - cost);

  const settlement = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_paper_settlement",
    settlementId: String(input.settlementId || nexoraLocalId("settlement")),
    orderId,
    marketId: order.marketId,
    asset: order.asset,
    side: order.side,
    outcome,
    won,
    cost,
    payout: money(payout),
    pnl,
    settledAt: now(),
  };

  appendNexoraJsonl(PNL_LOG, { event: "paper_order.settled", settlement, createdAt: now() });
  journal("paper_order.settled", settlement);

  recordNexoraMetric({
    name: "polymarket_superstack_pnl",
    value: pnl,
    unit: "usd",
    dimensions: { asset: order.asset, side: order.side, won },
  });

  return { ok: true, nexoraBrain: true, settlement };
}

export function runNexoraPolymarketSuperstackCycle(input: any = {}) {
  const market = input.market || registerNexoraPolymarketMarket(input).market;
  const binance = recordNexoraBinanceMarketTick({
    symbol: market.symbol,
    asset: market.asset,
    price: input.currentPrice || input.price || market.startPrice || 65000,
    sourceTs: input.binanceTs || now(),
  });

  const clob = recordNexoraPolymarketClobSnapshot({
    marketId: market.marketId,
    asset: market.asset,
    yesPrice: input.yesPrice ?? input.polymarketYes ?? 0.5,
    sourceTs: input.polymarketTs || now(),
    liquidityUsd: input.liquidityUsd || 1000,
    spreadBps: input.spreadBps || 200,
  });

  const fair = calculateNexoraPolymarketFairValue({
    startPrice: input.startPrice || market.startPrice || binance.tick.price,
    currentPrice: binance.tick.price,
    secondsToExpiry: input.secondsToExpiry || 300,
    volatilityBps: input.volatilityBps || 35,
  });

  const latencyMs = Math.max(0, new Date(clob.snapshot.receivedAt).getTime() - new Date(binance.tick.receivedAt).getTime());

  const edge = detectNexoraPolymarketEdge({
    marketId: market.marketId,
    asset: market.asset,
    yesPrice: clob.snapshot.yesPrice,
    fairYes: fair.yesProbability,
    latencyMs,
    spreadBps: clob.snapshot.spreadBps,
    liquidityUsd: clob.snapshot.liquidityUsd,
  });

  const order = createNexoraPolymarketPaperOrder({
    edge: edge.edge,
    bankroll: input.bankroll,
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_superstack_cycle",
    market,
    binance,
    clob,
    fair,
    latencyMs,
    edge,
    order,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };
}

export function listNexoraPolymarketSuperstackRecords(input: any = {}) {
  const limit = Number(input.limit || 100);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_superstack_records",
    markets: readNexoraJsonl(MARKET_LOG).slice(-limit).reverse(),
    watchlists: readNexoraJsonl(WATCHLIST_LOG).slice(-limit).reverse(),
    binance: readNexoraJsonl(BINANCE_LOG).slice(-limit).reverse(),
    clob: readNexoraJsonl(CLOB_LOG).slice(-limit).reverse(),
    signals: readNexoraJsonl(SIGNAL_LOG).slice(-limit).reverse(),
    orders: readNexoraJsonl(ORDER_LOG).slice(-limit).reverse(),
    pnl: readNexoraJsonl(PNL_LOG).slice(-limit).reverse(),
  };
}

export function getNexoraPolymarketSuperstackStatus() {
  const records = listNexoraPolymarketSuperstackRecords({ limit: 1000 });
  const settlements = records.pnl
    .filter((row: any) => row.event === "paper_order.settled")
    .map((row: any) => row.settlement);
  const totalPnl = money(settlements.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0));

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_superstack",
    generatedAt: now(),
    counts: {
      markets: records.markets.length,
      watchlists: records.watchlists.length,
      binanceTicks: records.binance.length,
      clobSnapshots: records.clob.length,
      signals: records.signals.length,
      paperOrders: records.orders.length,
      settlements: settlements.length,
    },
    totalPnl,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      noPostgres: true,
    },
  };
}

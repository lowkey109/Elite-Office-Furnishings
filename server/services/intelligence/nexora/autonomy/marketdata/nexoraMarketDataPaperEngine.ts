import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

const BINANCE_LOG = nexoraLocalPath("market-data", "binance", "binance-ticks.jsonl");
const POLY_LOG = nexoraLocalPath("market-data", "polymarket", "polymarket-snapshots.jsonl");
const LATENCY_LOG = nexoraLocalPath("market-data", "latency", "latency-journal.jsonl");
const EDGE_LOG = nexoraLocalPath("market-data", "edges", "edge-log.jsonl");
const SIGNAL_LOG = nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl");
const JOURNAL = nexoraLocalPath("market-data", "journal", "market-data-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

export function recordNexoraBinanceTick(input: any = {}) {
  const tick = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_binance_tick",
    tickId: String(input.tickId || nexoraLocalId("binance_tick")),
    symbol: String(input.symbol || "BTCUSDT").toUpperCase(),
    asset: String(input.asset || String(input.symbol || "BTCUSDT").replace("USDT", "") || "BTC").toUpperCase(),
    price: Number(input.price || input.lastPrice || 0),
    bid: input.bid !== undefined ? Number(input.bid) : null,
    ask: input.ask !== undefined ? Number(input.ask) : null,
    volume: input.volume !== undefined ? Number(input.volume) : null,
    sourceTs: input.sourceTs || input.timestamp || now(),
    receivedAt: now(),
    payload: input.payload || {},
  };

  appendNexoraJsonl(BINANCE_LOG, {
    event: "binance.tick",
    tick,
    createdAt: now(),
  });

  writeNexoraJson(
    nexoraLocalPath("market-data", "binance", `${tick.symbol}-latest.json`),
    tick,
  );

  recordNexoraMetric({
    name: "binance_tick_recorded",
    value: 1,
    unit: "tick",
    dimensions: {
      symbol: tick.symbol,
    },
  });

  journal("binance.tick", tick);

  return {
    ok: true,
    nexoraBrain: true,
    tick,
  };
}

export function recordNexoraPolymarketSnapshot(input: any = {}) {
  const snapshot = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_snapshot",
    snapshotId: String(input.snapshotId || nexoraLocalId("poly_snapshot")),
    marketId: String(input.marketId || "unknown_market"),
    asset: String(input.asset || "BTC").toUpperCase(),
    question: input.question || null,
    yesPrice: clamp(Number(input.yesPrice ?? input.polymarketYes ?? 0.5), 0.01, 0.99),
    noPrice: clamp(Number(input.noPrice ?? input.polymarketNo ?? (1 - Number(input.yesPrice ?? input.polymarketYes ?? 0.5))), 0.01, 0.99),
    bestBid: input.bestBid !== undefined ? Number(input.bestBid) : null,
    bestAsk: input.bestAsk !== undefined ? Number(input.bestAsk) : null,
    spreadBps: input.spreadBps !== undefined ? Number(input.spreadBps) : null,
    liquidityUsd: input.liquidityUsd !== undefined ? Number(input.liquidityUsd) : null,
    sourceTs: input.sourceTs || input.timestamp || now(),
    receivedAt: now(),
    payload: input.payload || {},
  };

  appendNexoraJsonl(POLY_LOG, {
    event: "polymarket.snapshot",
    snapshot,
    createdAt: now(),
  });

  writeNexoraJson(
    nexoraLocalPath("market-data", "polymarket", `${snapshot.marketId}-latest.json`),
    snapshot,
  );

  recordNexoraMetric({
    name: "polymarket_snapshot_recorded",
    value: 1,
    unit: "snapshot",
    dimensions: {
      marketId: snapshot.marketId,
      asset: snapshot.asset,
    },
  });

  journal("polymarket.snapshot", snapshot);

  return {
    ok: true,
    nexoraBrain: true,
    snapshot,
  };
}

export function calculateNexoraMarketFairValue(input: any = {}) {
  const openPrice = Number(input.openPrice || input.startPrice || 0);
  const currentPrice = Number(input.currentPrice || input.price || 0);
  const secondsToExpiry = Math.max(1, Number(input.secondsToExpiry || 300));
  const volatilityBps = Math.max(1, Number(input.volatilityBps || 35));

  const moveBps = openPrice > 0
    ? ((currentPrice - openPrice) / openPrice) * 10000
    : Number(input.moveBps || 0);

  const timeScale = Math.sqrt(900 / secondsToExpiry);
  const z = (moveBps / volatilityBps) * timeScale;

  const yesProbability = clamp(sigmoid(z), 0.01, 0.99);
  const noProbability = 1 - yesProbability;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_market_fair_value",
    generatedAt: now(),
    openPrice,
    currentPrice,
    secondsToExpiry,
    volatilityBps,
    moveBps: round(moveBps, 4),
    z: round(z, 6),
    yesProbability: round(yesProbability, 6),
    noProbability: round(noProbability, 6),
    model: "simple_directional_sigmoid_paper_model",
    note: "Paper model only. Not investment advice. No live execution.",
  };
}

export function recordNexoraLatencyObservation(input: any = {}) {
  const sourceTs = new Date(input.sourceTs || input.binanceTs || now()).getTime();
  const targetTs = new Date(input.targetTs || input.polymarketTs || now()).getTime();
  const latencyMs = Math.max(0, targetTs - sourceTs);

  const observation = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_market_latency_observation",
    observationId: String(input.observationId || nexoraLocalId("latency")),
    source: String(input.source || "binance"),
    target: String(input.target || "polymarket"),
    marketId: input.marketId || null,
    asset: String(input.asset || "BTC").toUpperCase(),
    sourceTs: new Date(sourceTs).toISOString(),
    targetTs: new Date(targetTs).toISOString(),
    latencyMs,
    latencySeconds: round(latencyMs / 1000, 3),
    createdAt: now(),
  };

  appendNexoraJsonl(LATENCY_LOG, {
    event: "latency.observed",
    observation,
    createdAt: now(),
  });

  recordNexoraMetric({
    name: "market_latency_ms",
    value: latencyMs,
    unit: "ms",
    dimensions: {
      source: observation.source,
      target: observation.target,
      asset: observation.asset,
    },
  });

  journal("latency.observed", observation);

  return {
    ok: true,
    nexoraBrain: true,
    observation,
  };
}

export function detectNexoraMarketEdge(input: any = {}) {
  const fair = input.fairValue || calculateNexoraMarketFairValue(input);
  const yesPrice = clamp(Number(input.yesPrice ?? input.polymarketYes ?? 0.5), 0.01, 0.99);
  const fairYes = clamp(Number(input.fairYes ?? fair.yesProbability ?? 0.5), 0.01, 0.99);

  const edge = fairYes - yesPrice;
  const edgeBps = round(edge * 10000, 2);
  const absEdgeBps = Math.abs(edgeBps);

  const minEdgeBps = Number(input.minEdgeBps || 250);
  const latencyMs = Number(input.latencyMs || input.observedLatencyMs || 0);
  const maxLatencyMs = Number(input.maxLatencyMs || 3000);

  const side = edge > 0 ? "BUY_YES_PAPER" : "BUY_NO_PAPER";
  const eligible = absEdgeBps >= minEdgeBps && (!latencyMs || latencyMs <= maxLatencyMs);

  const edgeRecord = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_market_edge_detector",
    edgeId: String(input.edgeId || nexoraLocalId("edge")),
    marketId: String(input.marketId || "unknown_market"),
    asset: String(input.asset || "BTC").toUpperCase(),
    side,
    eligible,
    yesPrice,
    fairYes,
    edge: round(edge, 6),
    edgeBps,
    absEdgeBps,
    minEdgeBps,
    latencyMs,
    maxLatencyMs,
    reason: eligible
      ? "Paper edge passed threshold and latency constraints."
      : "Paper edge blocked by threshold or latency constraints.",
    fair,
    createdAt: now(),
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
    },
  };

  appendNexoraJsonl(EDGE_LOG, {
    event: "edge.detected",
    edge: edgeRecord,
    createdAt: now(),
  });

  journal("edge.detected", edgeRecord);

  return {
    ok: true,
    nexoraBrain: true,
    edge: edgeRecord,
  };
}

export function createNexoraPaperSignal(input: any = {}) {
  const edge = input.edge || detectNexoraMarketEdge(input).edge;
  const policy = evaluateNexoraPolicy({
    ...input,
    liveTrading: false,
    tradingMode: "paper/sandbox",
  });

  const signal = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_market_paper_signal",
    signalId: String(input.signalId || nexoraLocalId("paper_signal")),
    marketId: edge.marketId,
    asset: edge.asset,
    side: edge.side,
    eligible: Boolean(edge.eligible && !policy.approvalRequired),
    edge,
    policy,
    createdAt: now(),
    nextAction: edge.eligible
      ? "Send to paper order simulator or swarm consensus."
      : "Record and wait for stronger edge.",
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noCLOBExecution: true,
    },
  };

  appendNexoraJsonl(SIGNAL_LOG, {
    event: "paper_signal.created",
    signal,
    createdAt: now(),
  });

  recordNexoraTimelineEvent({
    type: "market_paper_signal",
    title: `Paper signal ${signal.side}`,
    severity: signal.eligible ? "info" : "debug",
    payload: {
      signalId: signal.signalId,
      marketId: signal.marketId,
      edgeBps: edge.edgeBps,
      eligible: signal.eligible,
    },
  });

  recordNexoraMetric({
    name: "market_paper_signal",
    value: signal.eligible ? 1 : 0,
    unit: "signal",
    dimensions: {
      asset: signal.asset,
      side: signal.side,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    signal,
  };
}

export function runNexoraMarketDataPaperCycle(input: any = {}) {
  const binance = recordNexoraBinanceTick({
    symbol: input.symbol || "BTCUSDT",
    asset: input.asset || "BTC",
    price: input.currentPrice || input.price || input.binancePrice || 0,
    sourceTs: input.binanceTs || new Date(Date.now() - Number(input.latencyMs || 1000)).toISOString(),
  });

  const poly = recordNexoraPolymarketSnapshot({
    marketId: input.marketId || "paper_market",
    asset: input.asset || "BTC",
    yesPrice: input.yesPrice ?? input.polymarketYes ?? 0.5,
    sourceTs: input.polymarketTs || now(),
  });

  const fair = calculateNexoraMarketFairValue({
    openPrice: input.openPrice || input.startPrice || binance.tick.price,
    currentPrice: binance.tick.price,
    secondsToExpiry: input.secondsToExpiry || 300,
    volatilityBps: input.volatilityBps || 35,
  });

  const latency = recordNexoraLatencyObservation({
    source: "binance",
    target: "polymarket",
    asset: binance.tick.asset,
    marketId: poly.snapshot.marketId,
    sourceTs: binance.tick.sourceTs,
    targetTs: poly.snapshot.sourceTs,
  });

  const edge = detectNexoraMarketEdge({
    marketId: poly.snapshot.marketId,
    asset: binance.tick.asset,
    yesPrice: poly.snapshot.yesPrice,
    fairValue: fair,
    fairYes: fair.yesProbability,
    latencyMs: latency.observation.latencyMs,
    minEdgeBps: input.minEdgeBps || 250,
    maxLatencyMs: input.maxLatencyMs || 3000,
  });

  const signal = createNexoraPaperSignal({
    marketId: poly.snapshot.marketId,
    asset: binance.tick.asset,
    edge: edge.edge,
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_market_data_paper_cycle",
    binance,
    polymarket: poly,
    fair,
    latency,
    edge,
    signal,
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
    },
  };
}

export function listNexoraMarketData(input: any = {}) {
  const limit = Number(input.limit || 100);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_market_data_list",
    binance: readNexoraJsonl(BINANCE_LOG).slice(-limit).reverse(),
    polymarket: readNexoraJsonl(POLY_LOG).slice(-limit).reverse(),
    latency: readNexoraJsonl(LATENCY_LOG).slice(-limit).reverse(),
    edges: readNexoraJsonl(EDGE_LOG).slice(-limit).reverse(),
    signals: readNexoraJsonl(SIGNAL_LOG).slice(-limit).reverse(),
  };
}

export function getNexoraMarketDataPaperStatus() {
  const binance = readNexoraJsonl(BINANCE_LOG);
  const poly = readNexoraJsonl(POLY_LOG);
  const latency = readNexoraJsonl(LATENCY_LOG);
  const edges = readNexoraJsonl(EDGE_LOG);
  const signals = readNexoraJsonl(SIGNAL_LOG);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_market_data_paper_status",
    generatedAt: now(),
    counts: {
      binanceTicks: binance.length,
      polymarketSnapshots: poly.length,
      latencyObservations: latency.length,
      edges: edges.length,
      signals: signals.length,
    },
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noPostgres: true,
    },
  };
}

import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";
import {
  recordNexoraBinanceTick,
  recordNexoraPolymarketSnapshot,
  runNexoraMarketDataPaperCycle,
} from "../marketdata/nexoraMarketDataPaperEngine";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("collectors", "journal", "collector-journal.jsonl");
const STATUS_FILE = nexoraLocalPath("collectors", "status", "collector-status.json");
const BINANCE_SAMPLE_LOG = nexoraLocalPath("collectors", "binance", "binance-sample-log.jsonl");
const POLY_SAMPLE_LOG = nexoraLocalPath("collectors", "polymarket", "polymarket-sample-log.jsonl");

let binanceTimer: NodeJS.Timeout | null = null;
let polymarketTimer: NodeJS.Timeout | null = null;

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function getState() {
  return readNexoraJson(STATUS_FILE, {
    ok: true,
    nexoraBrain: true,
    service: "nexora_collector_status",
    binanceCollector: {
      running: false,
      mode: "sample_local",
      ticks: 0,
      lastTickAt: null,
    },
    polymarketCollector: {
      running: false,
      mode: "sample_local",
      snapshots: 0,
      lastSnapshotAt: null,
    },
    paperOnly: true,
    liveTradingBlocked: true,
    updatedAt: now(),
  });
}

function saveState(next: any) {
  writeNexoraJson(STATUS_FILE, {
    ...next,
    updatedAt: now(),
  });
}

function nextPrice(base: number, tick: number) {
  const wave = Math.sin(tick / 6) * 35;
  const jitter = (Math.random() - 0.5) * 12;
  return Math.round((base + wave + jitter) * 100) / 100;
}

function nextYesPrice(price: number, openPrice: number) {
  const move = openPrice > 0 ? (price - openPrice) / openPrice : 0;
  const raw = 0.5 + move * 35 + (Math.random() - 0.5) * 0.02;
  return Math.max(0.05, Math.min(0.95, Math.round(raw * 10000) / 10000));
}

export function getNexoraCollectorStatus() {
  const state = getState();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_websocket_collector_runtime",
    generatedAt: now(),
    state: {
      ...state,
      binanceCollector: {
        ...state.binanceCollector,
        processRunning: Boolean(binanceTimer),
      },
      polymarketCollector: {
        ...state.polymarketCollector,
        processRunning: Boolean(polymarketTimer),
      },
    },
    safety: {
      sampleOnly: true,
      noExternalWebSocketYet: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noPostgres: true,
    },
  };
}

export function recordNexoraBinanceSampleTick(input: any = {}) {
  const state = getState();
  const count = Number(state.binanceCollector?.ticks || 0) + 1;
  const symbol = String(input.symbol || "BTCUSDT").toUpperCase();
  const openPrice = Number(input.openPrice || 65000);
  const price = input.price !== undefined ? Number(input.price) : nextPrice(openPrice, count);

  const tick = recordNexoraBinanceTick({
    symbol,
    asset: symbol.replace("USDT", ""),
    price,
    bid: price - 0.5,
    ask: price + 0.5,
    sourceTs: now(),
    payload: {
      source: "nexora_sample_collector",
      count,
    },
  });

  appendNexoraJsonl(BINANCE_SAMPLE_LOG, {
    event: "sample_binance_tick",
    tick,
    createdAt: now(),
  });

  saveState({
    ...state,
    binanceCollector: {
      ...state.binanceCollector,
      ticks: count,
      lastTickAt: now(),
      running: Boolean(binanceTimer),
    },
  });

  journal("sample_binance_tick", tick);

  return {
    ok: true,
    nexoraBrain: true,
    tick,
  };
}

export function recordNexoraPolymarketSampleSnapshot(input: any = {}) {
  const state = getState();
  const count = Number(state.polymarketCollector?.snapshots || 0) + 1;
  const marketId = String(input.marketId || "sample_btc_up_down_15m");
  const asset = String(input.asset || "BTC").toUpperCase();
  const openPrice = Number(input.openPrice || 65000);
  const currentPrice = Number(input.currentPrice || input.price || openPrice);
  const yesPrice = input.yesPrice !== undefined ? Number(input.yesPrice) : nextYesPrice(currentPrice, openPrice);

  const snapshot = recordNexoraPolymarketSnapshot({
    marketId,
    asset,
    yesPrice,
    noPrice: 1 - yesPrice,
    bestBid: yesPrice - 0.01,
    bestAsk: yesPrice + 0.01,
    spreadBps: 200,
    liquidityUsd: 10000,
    sourceTs: now(),
    payload: {
      source: "nexora_sample_collector",
      count,
    },
  });

  appendNexoraJsonl(POLY_SAMPLE_LOG, {
    event: "sample_polymarket_snapshot",
    snapshot,
    createdAt: now(),
  });

  saveState({
    ...state,
    polymarketCollector: {
      ...state.polymarketCollector,
      snapshots: count,
      lastSnapshotAt: now(),
      running: Boolean(polymarketTimer),
    },
  });

  journal("sample_polymarket_snapshot", snapshot);

  return {
    ok: true,
    nexoraBrain: true,
    snapshot,
  };
}

export function runNexoraCollectorSampleCycle(input: any = {}) {
  const symbol = String(input.symbol || "BTCUSDT").toUpperCase();
  const asset = symbol.replace("USDT", "");
  const openPrice = Number(input.openPrice || 65000);
  const secondsToExpiry = Number(input.secondsToExpiry || 300);

  const binance = recordNexoraBinanceSampleTick({
    symbol,
    openPrice,
    price: input.currentPrice,
  });

  const polymarket = recordNexoraPolymarketSampleSnapshot({
    marketId: input.marketId || "sample_btc_up_down_15m",
    asset,
    openPrice,
    currentPrice: binance.tick.tick.price,
    yesPrice: input.yesPrice,
  });

  const cycle = runNexoraMarketDataPaperCycle({
    symbol,
    asset,
    marketId: polymarket.snapshot.snapshot.marketId,
    openPrice,
    currentPrice: binance.tick.tick.price,
    yesPrice: polymarket.snapshot.snapshot.yesPrice,
    secondsToExpiry,
    latencyMs: input.latencyMs || 1000,
    minEdgeBps: input.minEdgeBps || 250,
    maxLatencyMs: input.maxLatencyMs || 3000,
  });

  recordNexoraMetric({
    name: "nexora_collector_sample_cycle",
    value: 1,
    unit: "cycle",
    dimensions: {
      symbol,
      asset,
    },
  });

  recordNexoraTimelineEvent({
    type: "collector_sample_cycle",
    title: "Nexora sample market data cycle",
    severity: "info",
    payload: {
      symbol,
      asset,
      marketId: polymarket.snapshot.snapshot.marketId,
    },
  });

  journal("sample_cycle", {
    binance,
    polymarket,
    cycle,
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_collector_sample_cycle",
    binance,
    polymarket,
    cycle,
  };
}

export function startNexoraSampleCollectors(input: any = {}) {
  const intervalMs = Number(input.intervalMs || 5000);

  if (!binanceTimer) {
    binanceTimer = setInterval(() => {
      try {
        recordNexoraBinanceSampleTick(input);
      } catch (error) {
        journal("binance_sample_error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, intervalMs);

    if (typeof binanceTimer.unref === "function") binanceTimer.unref();
  }

  if (!polymarketTimer) {
    polymarketTimer = setInterval(() => {
      try {
        const latestBinance = readNexoraJsonl(BINANCE_SAMPLE_LOG)
          .filter((row: any) => row.event === "sample_binance_tick")
          .map((row: any) => row.tick?.tick)
          .filter(Boolean)
          .slice(-1)[0];

        recordNexoraPolymarketSampleSnapshot({
          ...input,
          currentPrice: latestBinance?.price || input.openPrice || 65000,
        });
      } catch (error) {
        journal("polymarket_sample_error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, intervalMs);

    if (typeof polymarketTimer.unref === "function") polymarketTimer.unref();
  }

  const state = getState();
  saveState({
    ...state,
    binanceCollector: {
      ...state.binanceCollector,
      running: true,
      intervalMs,
    },
    polymarketCollector: {
      ...state.polymarketCollector,
      running: true,
      intervalMs,
    },
  });

  journal("sample_collectors.started", {
    intervalMs,
  });

  return {
    ok: true,
    nexoraBrain: true,
    started: true,
    intervalMs,
    safety: {
      sampleOnly: true,
      noExternalWebSocketYet: true,
      noLiveTrading: true,
    },
  };
}

export function stopNexoraSampleCollectors() {
  if (binanceTimer) clearInterval(binanceTimer);
  if (polymarketTimer) clearInterval(polymarketTimer);

  binanceTimer = null;
  polymarketTimer = null;

  const state = getState();
  saveState({
    ...state,
    binanceCollector: {
      ...state.binanceCollector,
      running: false,
    },
    polymarketCollector: {
      ...state.polymarketCollector,
      running: false,
    },
  });

  journal("sample_collectors.stopped", {});

  return {
    ok: true,
    nexoraBrain: true,
    stopped: true,
  };
}

export function listNexoraCollectorSamples(input: any = {}) {
  const limit = Number(input.limit || 100);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_collector_samples",
    binance: readNexoraJsonl(BINANCE_SAMPLE_LOG).slice(-limit).reverse(),
    polymarket: readNexoraJsonl(POLY_SAMPLE_LOG).slice(-limit).reverse(),
    journal: readNexoraJsonl(JOURNAL).slice(-limit).reverse(),
  };
}

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
  calculateNexoraMarketFairValue,
  detectNexoraMarketEdge,
} from "../marketdata/nexoraMarketDataPaperEngine";

function now() {
  return new Date().toISOString();
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

const DATASET_LOG = nexoraLocalPath("backtesting", "datasets", "dataset-log.jsonl");
const RUN_LOG = nexoraLocalPath("backtesting", "runs", "run-log.jsonl");
const PNL_LOG = nexoraLocalPath("backtesting", "pnl", "pnl-log.jsonl");
const JOURNAL = nexoraLocalPath("backtesting", "journal", "backtesting-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function syntheticPriceSeries(input: any = {}) {
  const count = Number(input.count || 120);
  const startPrice = Number(input.startPrice || 65000);
  const driftBps = Number(input.driftBps || 0);
  const volatilityBps = Number(input.volatilityBps || 20);

  const rows = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const wave = Math.sin(i / 6) * volatilityBps;
    const noise = (Math.random() - 0.5) * volatilityBps;
    const moveBps = driftBps / count + wave * 0.1 + noise;
    price = price * (1 + moveBps / 10000);

    rows.push({
      index: i,
      ts: new Date(Date.now() + i * 1000).toISOString(),
      price: round(price, 2),
      moveBps: round(moveBps, 4),
    });
  }

  return rows;
}

function impliedPolymarketPrice(fairYes: number, lagBiasBps: number, noiseBps: number) {
  const bias = lagBiasBps / 10000;
  const noise = ((Math.random() - 0.5) * noiseBps) / 10000;
  return clamp(fairYes - bias + noise, 0.01, 0.99);
}

export function createNexoraSyntheticBacktestDataset(input: any = {}) {
  const datasetId = String(input.datasetId || nexoraLocalId("dataset"));
  const asset = String(input.asset || "BTC").toUpperCase();
  const startPrice = Number(input.startPrice || 65000);
  const count = Number(input.count || 120);
  const durationMinutes = Number(input.durationMinutes || 15);
  const volatilityBps = Number(input.volatilityBps || 25);
  const lagBiasBps = Number(input.lagBiasBps || 300);
  const polymarketNoiseBps = Number(input.polymarketNoiseBps || 120);

  const prices = syntheticPriceSeries({
    count,
    startPrice,
    volatilityBps,
    driftBps: input.driftBps || 0,
  });

  const rows = prices.map((row: any, index: number) => {
    const secondsToExpiry = Math.max(1, durationMinutes * 60 - index);
    const fair = calculateNexoraMarketFairValue({
      openPrice: startPrice,
      currentPrice: row.price,
      secondsToExpiry,
      volatilityBps,
    });

    return {
      ...row,
      asset,
      marketId: `${asset.toLowerCase()}_${durationMinutes}m_synthetic`,
      openPrice: startPrice,
      secondsToExpiry,
      fairYes: fair.yesProbability,
      polymarketYes: impliedPolymarketPrice(fair.yesProbability, lagBiasBps, polymarketNoiseBps),
      latencyMs: Number(input.latencyMs || 1500),
    };
  });

  const dataset = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_synthetic_backtest_dataset",
    datasetId,
    createdAt: now(),
    asset,
    startPrice,
    durationMinutes,
    count,
    volatilityBps,
    lagBiasBps,
    polymarketNoiseBps,
    rows,
    safety: {
      syntheticOnly: true,
      noLiveMarketData: true,
      noTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("backtesting", "datasets", `${datasetId}.json`), dataset);

  appendNexoraJsonl(DATASET_LOG, {
    event: "dataset.created",
    dataset,
    createdAt: now(),
  });

  journal("dataset.created", {
    datasetId,
    rows: rows.length,
  });

  return {
    ok: true,
    nexoraBrain: true,
    dataset,
  };
}

export function getNexoraBacktestDataset(input: any = {}) {
  const datasetId = String(input.datasetId || "");
  const dataset = readNexoraJson(nexoraLocalPath("backtesting", "datasets", `${datasetId}.json`), null);

  return {
    ok: Boolean(dataset),
    nexoraBrain: true,
    datasetId,
    dataset,
  };
}

function maxDrawdown(equity: number[]) {
  let peak = equity[0] || 0;
  let maxDd = 0;

  for (const value of equity) {
    if (value > peak) peak = value;
    const dd = peak > 0 ? (peak - value) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }

  return round(maxDd, 6);
}

export function runNexoraBacktestSimulation(input: any = {}) {
  const runId = String(input.runId || nexoraLocalId("backtest_run"));
  const dataset = input.datasetId
    ? getNexoraBacktestDataset({ datasetId: input.datasetId }).dataset
    : createNexoraSyntheticBacktestDataset(input).dataset;

  if (!dataset) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "Dataset not found.",
    };
  }

  const bankrollStart = Number(input.bankroll || 1000);
  const maxRiskFraction = Math.min(Number(input.maxRiskFraction || 0.02), 0.05);
  const minEdgeBps = Number(input.minEdgeBps || 250);
  const maxLatencyMs = Number(input.maxLatencyMs || 3000);
  const slippageBps = Number(input.slippageBps || 50);

  let bankroll = bankrollStart;
  const trades: any[] = [];
  const equityCurve: number[] = [bankroll];

  for (const row of dataset.rows || []) {
    const edgeResult = detectNexoraMarketEdge({
      marketId: row.marketId,
      asset: row.asset,
      yesPrice: row.polymarketYes,
      fairYes: row.fairYes,
      latencyMs: row.latencyMs,
      minEdgeBps,
      maxLatencyMs,
    }).edge;

    if (!edgeResult.eligible) {
      equityCurve.push(bankroll);
      continue;
    }

    const side = edgeResult.side;
    const price = side === "BUY_YES_PAPER" ? row.polymarketYes : 1 - row.polymarketYes;
    const fair = side === "BUY_YES_PAPER" ? row.fairYes : 1 - row.fairYes;
    const edge = Math.max(0, fair - price);
    const fraction = Math.min(maxRiskFraction, edge / Math.max(0.01, 1 - price));
    const stake = round(bankroll * fraction, 2);

    if (stake <= 0) {
      equityCurve.push(bankroll);
      continue;
    }

    const finalPrice = dataset.rows[dataset.rows.length - 1]?.price || row.price;
    const outcomeYes = finalPrice >= dataset.startPrice;
    const won = side === "BUY_YES_PAPER" ? outcomeYes : !outcomeYes;

    const adjustedPrice = clamp(price + slippageBps / 10000, 0.01, 0.99);
    const payout = won ? stake / adjustedPrice : 0;
    const pnl = round(payout - stake, 2);

    bankroll = round(bankroll + pnl, 2);

    const trade = {
      tradeId: nexoraLocalId("bt_trade"),
      index: row.index,
      ts: row.ts,
      side,
      price: round(adjustedPrice, 6),
      fair: round(fair, 6),
      edgeBps: edgeResult.edgeBps,
      stake,
      won,
      pnl,
      bankroll,
      marketId: row.marketId,
      asset: row.asset,
    };

    trades.push(trade);
    equityCurve.push(bankroll);
  }

  const wins = trades.filter((trade) => trade.won).length;
  const losses = trades.length - wins;
  const totalPnl = round(bankroll - bankrollStart, 2);

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_backtest_simulation",
    runId,
    createdAt: now(),
    datasetId: dataset.datasetId,
    parameters: {
      bankrollStart,
      maxRiskFraction,
      minEdgeBps,
      maxLatencyMs,
      slippageBps,
    },
    results: {
      trades: trades.length,
      wins,
      losses,
      winRate: trades.length ? round(wins / trades.length, 4) : 0,
      bankrollStart,
      bankrollEnd: bankroll,
      totalPnl,
      totalReturnPct: bankrollStart > 0 ? round((totalPnl / bankrollStart) * 100, 4) : 0,
      maxDrawdown: maxDrawdown(equityCurve),
    },
    trades,
    equityCurve,
    safety: {
      syntheticOrLocalOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noPostgres: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("backtesting", "runs", `${runId}.json`), report);

  appendNexoraJsonl(RUN_LOG, {
    event: "backtest.run",
    report,
    createdAt: now(),
  });

  appendNexoraJsonl(PNL_LOG, {
    event: "backtest.pnl",
    runId,
    results: report.results,
    createdAt: now(),
  });

  recordNexoraMetric({
    name: "backtest_total_pnl",
    value: totalPnl,
    unit: "usd",
    dimensions: {
      runId,
      datasetId: dataset.datasetId,
    },
  });

  recordNexoraTimelineEvent({
    type: "backtest",
    title: "Nexora backtest simulation completed",
    severity: totalPnl >= 0 ? "info" : "warning",
    payload: {
      runId,
      totalPnl,
      trades: trades.length,
    },
  });

  journal("backtest.run", {
    runId,
    results: report.results,
  });

  return {
    ok: true,
    nexoraBrain: true,
    report,
  };
}

export function listNexoraBacktestRuns(input: any = {}) {
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(RUN_LOG)
    .filter((row: any) => row.event === "backtest.run")
    .map((row: any) => row.report)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraBacktestStatus() {
  const datasets = readNexoraJsonl(DATASET_LOG).filter((row: any) => row.event === "dataset.created");
  const runs = readNexoraJsonl(RUN_LOG).filter((row: any) => row.event === "backtest.run");
  const pnl = readNexoraJsonl(PNL_LOG).filter((row: any) => row.event === "backtest.pnl");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_backtest_status",
    generatedAt: now(),
    datasets: datasets.length,
    runs: runs.length,
    pnlRecords: pnl.length,
    safety: {
      noLiveOrders: true,
      noPrivateKeys: true,
      localOnly: true,
    },
  };
}

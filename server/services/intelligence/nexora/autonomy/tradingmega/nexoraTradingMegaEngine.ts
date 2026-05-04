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
  calculateNexoraMarketFairValue,
  detectNexoraMarketEdge,
  runNexoraMarketDataPaperCycle,
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

const STRATEGY_LOG = nexoraLocalPath("trading-mega", "strategies", "strategy-log.jsonl");
const EXECUTION_LOG = nexoraLocalPath("trading-mega", "paper-execution", "paper-execution-log.jsonl");
const PERFORMANCE_LOG = nexoraLocalPath("trading-mega", "performance", "performance-log.jsonl");
const WHALE_LOG = nexoraLocalPath("trading-mega", "whales", "whale-log.jsonl");
const COPY_LOG = nexoraLocalPath("trading-mega", "copy", "copy-signal-log.jsonl");
const RESEARCH_LOG = nexoraLocalPath("trading-mega", "research", "research-log.jsonl");
const JOURNAL = nexoraLocalPath("trading-mega", "journal", "trading-mega-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function registerNexoraTradingStrategy(input: any = {}) {
  const strategyId = String(input.strategyId || nexoraLocalId("strategy"));
  const strategy = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_strategy",
    strategyId,
    name: String(input.name || "Paper Latency Edge Strategy"),
    category: String(input.category || "polymarket_paper"),
    mode: "paper_only",
    enabled: input.enabled !== false,
    risk: String(input.risk || "medium"),
    rules: input.rules || {
      minEdgeBps: Number(input.minEdgeBps || 250),
      maxLatencyMs: Number(input.maxLatencyMs || 3000),
      maxRiskFraction: Number(input.maxRiskFraction || 0.02),
      maxDailyDrawdownFraction: Number(input.maxDailyDrawdownFraction || 0.05),
    },
    targetMarkets: Array.isArray(input.targetMarkets) ? input.targetMarkets : ["BTC", "ETH"],
    createdAt: now(),
    updatedAt: now(),
    safety: {
      noLiveOrders: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      humanCommitRequiredForLive: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("trading-mega", "strategies", `${strategyId}.json`), strategy);
  appendNexoraJsonl(STRATEGY_LOG, { event: "strategy.registered", strategy, createdAt: now() });
  journal("strategy.registered", strategy);

  return { ok: true, nexoraBrain: true, strategy };
}

export function listNexoraTradingStrategies(input: any = {}) {
  const category = input.category ? String(input.category) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(STRATEGY_LOG)
    .filter((row: any) => row.event === "strategy.registered")
    .map((row: any) => row.strategy)
    .filter((strategy: any) => !category || strategy.category === category)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function createNexoraPaperExecutionPlan(input: any = {}) {
  const planId = String(input.planId || nexoraLocalId("paper_exec_plan"));
  const market = {
    marketId: String(input.marketId || "paper_market"),
    asset: String(input.asset || "BTC").toUpperCase(),
    symbol: String(input.symbol || "BTCUSDT").toUpperCase(),
    openPrice: Number(input.openPrice || 65000),
    currentPrice: Number(input.currentPrice || input.price || 65000),
    yesPrice: clamp(Number(input.yesPrice ?? input.polymarketYes ?? 0.5), 0.01, 0.99),
    secondsToExpiry: Number(input.secondsToExpiry || 300),
    latencyMs: Number(input.latencyMs || 1500),
  };

  const fair = calculateNexoraMarketFairValue({
    openPrice: market.openPrice,
    currentPrice: market.currentPrice,
    secondsToExpiry: market.secondsToExpiry,
    volatilityBps: Number(input.volatilityBps || 35),
  });

  const edge = detectNexoraMarketEdge({
    marketId: market.marketId,
    asset: market.asset,
    yesPrice: market.yesPrice,
    fairYes: fair.yesProbability,
    latencyMs: market.latencyMs,
    minEdgeBps: Number(input.minEdgeBps || 250),
    maxLatencyMs: Number(input.maxLatencyMs || 3000),
  }).edge;

  const bankroll = Number(input.bankroll || 1000);
  const maxRiskFraction = Math.min(Number(input.maxRiskFraction || 0.02), 0.05);
  const price = edge.side === "BUY_YES_PAPER" ? market.yesPrice : 1 - market.yesPrice;
  const fairSide = edge.side === "BUY_YES_PAPER" ? fair.yesProbability : fair.noProbability;
  const sideEdge = Math.max(0, fairSide - price);
  const fraction = edge.eligible ? Math.min(maxRiskFraction, sideEdge / Math.max(0.01, 1 - price)) : 0;
  const stake = round(bankroll * fraction, 2);

  const policy = evaluateNexoraPolicy({
    ...input,
    liveTrading: false,
    tradingMode: "paper/sandbox",
    privateKey: false,
  });

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_execution_plan",
    planId,
    createdAt: now(),
    market,
    fair,
    edge,
    sizing: {
      bankroll,
      maxRiskFraction,
      price: round(price, 6),
      fair: round(fairSide, 6),
      sideEdge: round(sideEdge, 6),
      recommendedFraction: round(fraction, 6),
      stake,
    },
    policy,
    decision: {
      shouldPaperTrade: edge.eligible && stake > 0 && !policy.approvalRequired,
      reason: edge.eligible ? "Paper edge eligible." : "Edge not eligible.",
    },
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noCLOBExecution: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("trading-mega", "paper-execution", `${planId}.json`), plan);
  appendNexoraJsonl(EXECUTION_LOG, { event: "paper_execution.plan", plan, createdAt: now() });
  journal("paper_execution.plan", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function executeNexoraPaperPlan(input: any = {}) {
  const plan = input.plan || createNexoraPaperExecutionPlan(input).plan;
  const executionId = String(input.executionId || nexoraLocalId("paper_exec"));

  const execution = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_execution",
    executionId,
    planId: plan.planId,
    createdAt: now(),
    mode: "paper_only",
    status: plan.decision?.shouldPaperTrade ? "paper_filled" : "paper_skipped",
    side: plan.edge?.side || "HOLD",
    stake: plan.sizing?.stake || 0,
    price: plan.sizing?.price || 0,
    market: plan.market,
    reason: plan.decision?.reason || "No decision.",
    safety: {
      noLiveOrders: true,
      noPrivateKeys: true,
      simulatedOnly: true,
    },
  };

  appendNexoraJsonl(EXECUTION_LOG, { event: "paper_execution.executed", execution, createdAt: now() });

  recordNexoraMetric({
    name: "nexora_paper_execution",
    value: execution.status === "paper_filled" ? 1 : 0,
    unit: "execution",
    dimensions: { side: execution.side, asset: execution.market?.asset || "unknown" },
  });

  recordNexoraTimelineEvent({
    type: "paper_execution",
    title: `Paper execution ${execution.status}`,
    severity: execution.status === "paper_filled" ? "info" : "debug",
    payload: { executionId, planId: plan.planId, side: execution.side, stake: execution.stake },
  });

  journal("paper_execution.executed", execution);

  return { ok: true, nexoraBrain: true, execution };
}

export function settleNexoraPaperExecution(input: any = {}) {
  const executionId = String(input.executionId || "");
  const outcome = String(input.outcome || "").toUpperCase();

  const executions = readNexoraJsonl(EXECUTION_LOG)
    .filter((row: any) => row.event === "paper_execution.executed")
    .map((row: any) => row.execution);

  const execution = executions.find((row: any) => row.executionId === executionId);

  if (!execution) {
    return { ok: false, nexoraBrain: true, error: "Paper execution not found.", executionId };
  }

  if (execution.status !== "paper_filled") {
    return { ok: false, nexoraBrain: true, error: "Execution was not filled.", execution };
  }

  const won =
    (execution.side === "BUY_YES_PAPER" && outcome === "YES") ||
    (execution.side === "BUY_NO_PAPER" && outcome === "NO");

  const cost = Number(execution.stake || 0);
  const price = Math.max(0.01, Number(execution.price || 0.5));
  const payout = won ? cost / price : 0;
  const pnl = round(payout - cost, 2);

  const settlement = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_execution_settlement",
    settlementId: nexoraLocalId("paper_settlement"),
    executionId,
    outcome,
    won,
    cost,
    payout: round(payout, 2),
    pnl,
    settledAt: now(),
  };

  appendNexoraJsonl(PERFORMANCE_LOG, { event: "paper_execution.settled", settlement, createdAt: now() });
  journal("paper_execution.settled", settlement);

  recordNexoraMetric({
    name: "nexora_paper_execution_pnl",
    value: pnl,
    unit: "usd",
    dimensions: { won },
  });

  return { ok: true, nexoraBrain: true, settlement };
}

export function recordNexoraWhaleObservation(input: any = {}) {
  const observation = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_whale_observation",
    whaleId: String(input.whaleId || input.wallet || "unknown_whale"),
    observationId: String(input.observationId || nexoraLocalId("whale_obs")),
    marketId: input.marketId || null,
    side: input.side || null,
    sizeUsd: Number(input.sizeUsd || 0),
    price: input.price !== undefined ? Number(input.price) : null,
    confidence: Number(input.confidence || 50),
    copied: false,
    createdAt: now(),
    payload: input.payload || {},
    safety: {
      copyTradeIsPaperOnly: true,
      noLiveOrders: true,
    },
  };

  appendNexoraJsonl(WHALE_LOG, { event: "whale.observed", observation, createdAt: now() });
  journal("whale.observed", observation);

  return { ok: true, nexoraBrain: true, observation };
}

export function createNexoraCopySignal(input: any = {}) {
  const policy = evaluateNexoraPolicy({
    ...input,
    liveTrading: false,
    tradingMode: "paper/sandbox",
  });

  const signal = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_copy_signal",
    signalId: String(input.signalId || nexoraLocalId("copy_signal")),
    sourceWallet: String(input.sourceWallet || input.whaleId || "unknown_wallet"),
    marketId: input.marketId || null,
    side: input.side || "HOLD",
    sizeUsd: Number(input.sizeUsd || 0),
    confidence: Number(input.confidence || 50),
    policy,
    status: policy.approvalRequired ? "held" : "paper_signal",
    createdAt: now(),
    safety: {
      paperOnly: true,
      noLiveCopyTrading: true,
    },
  };

  appendNexoraJsonl(COPY_LOG, { event: "copy.signal", signal, createdAt: now() });
  journal("copy.signal", signal);

  return { ok: true, nexoraBrain: true, signal };
}

export function recordNexoraTradingResearchNote(input: any = {}) {
  const note = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_research_note",
    noteId: String(input.noteId || nexoraLocalId("research_note")),
    title: String(input.title || "Trading research note"),
    body: String(input.body || ""),
    tags: Array.isArray(input.tags) ? input.tags : [],
    payload: input.payload || {},
    createdAt: now(),
  };

  appendNexoraJsonl(RESEARCH_LOG, { event: "research.note", note, createdAt: now() });
  journal("research.note", note);

  return { ok: true, nexoraBrain: true, note };
}

export function listNexoraTradingMegaRecords(input: any = {}) {
  const limit = Number(input.limit || 100);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_mega_records",
    strategies: readNexoraJsonl(STRATEGY_LOG).slice(-limit).reverse(),
    executions: readNexoraJsonl(EXECUTION_LOG).slice(-limit).reverse(),
    performance: readNexoraJsonl(PERFORMANCE_LOG).slice(-limit).reverse(),
    whales: readNexoraJsonl(WHALE_LOG).slice(-limit).reverse(),
    copySignals: readNexoraJsonl(COPY_LOG).slice(-limit).reverse(),
    research: readNexoraJsonl(RESEARCH_LOG).slice(-limit).reverse(),
  };
}

export function getNexoraTradingMegaStatus() {
  const records = listNexoraTradingMegaRecords({ limit: 1000 });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_mega",
    generatedAt: now(),
    counts: {
      strategies: records.strategies.length,
      executions: records.executions.length,
      performance: records.performance.length,
      whales: records.whales.length,
      copySignals: records.copySignals.length,
      research: records.research.length,
    },
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      noPostgres: true,
    },
  };
}

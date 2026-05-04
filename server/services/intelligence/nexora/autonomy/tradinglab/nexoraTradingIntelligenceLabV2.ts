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

const STRATEGY_LOG = nexoraLocalPath("trading-lab", "strategies", "strategy-log.jsonl");
const MUTATION_LOG = nexoraLocalPath("trading-lab", "mutations", "mutation-log.jsonl");
const PORTFOLIO_LOG = nexoraLocalPath("trading-lab", "portfolio", "portfolio-log.jsonl");
const EXPOSURE_LOG = nexoraLocalPath("trading-lab", "exposure", "exposure-log.jsonl");
const SIGNAL_LOG = nexoraLocalPath("trading-lab", "signals", "signal-log.jsonl");
const TOURNAMENT_LOG = nexoraLocalPath("trading-lab", "tournaments", "tournament-log.jsonl");
const JOURNAL = nexoraLocalPath("trading-lab", "journal", "trading-lab-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function readLatestStrategies(limit = 1000) {
  return readNexoraJsonl(STRATEGY_LOG)
    .filter((row: any) => row.event === "strategy.created" || row.event === "strategy.mutated")
    .map((row: any) => row.strategy)
    .slice(-limit)
    .reverse();
}

function strategyFile(strategyId: string) {
  return nexoraLocalPath("trading-lab", "strategies", `${strategyId}.json`);
}

export function createNexoraTradingLabStrategy(input: any = {}) {
  const strategyId = String(input.strategyId || nexoraLocalId("lab_strategy"));

  const strategy = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_lab_strategy",
    strategyId,
    name: String(input.name || "Paper Latency Edge Strategy"),
    family: String(input.family || "polymarket_latency_paper"),
    mode: "paper_only",
    enabled: input.enabled !== false,
    createdAt: now(),
    updatedAt: now(),
    parameters: {
      minEdgeBps: Number(input.minEdgeBps || 250),
      maxLatencyMs: Number(input.maxLatencyMs || 3000),
      maxRiskFraction: Math.min(Number(input.maxRiskFraction || 0.02), 0.05),
      volatilityBps: Number(input.volatilityBps || 35),
      slippageBps: Number(input.slippageBps || 50),
      maxDrawdownFraction: Math.min(Number(input.maxDrawdownFraction || 0.05), 0.2),
    },
    scoring: {
      backtestScore: Number(input.backtestScore || 0),
      livePaperScore: Number(input.livePaperScore || 0),
      riskScore: Number(input.riskScore || 50),
      confidence: Number(input.confidence || 50),
    },
    safety: {
      noLiveOrders: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      humanCommitRequiredForLive: true,
    },
  };

  writeNexoraJson(strategyFile(strategyId), strategy);

  appendNexoraJsonl(STRATEGY_LOG, {
    event: "strategy.created",
    strategy,
    createdAt: now(),
  });

  journal("strategy.created", strategy);

  recordNexoraTimelineEvent({
    type: "trading_lab_strategy",
    title: `Strategy created: ${strategy.name}`,
    severity: "info",
    payload: {
      strategyId,
      family: strategy.family,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    strategy,
  };
}

export function mutateNexoraTradingLabStrategy(input: any = {}) {
  const parentStrategyId = String(input.parentStrategyId || input.strategyId || "");
  const parent = parentStrategyId ? readNexoraJson(strategyFile(parentStrategyId), null) : null;
  const base = parent || createNexoraTradingLabStrategy({}).strategy;
  const mutationId = String(input.mutationId || nexoraLocalId("mutation"));
  const strategyId = String(input.newStrategyId || nexoraLocalId("lab_strategy"));

  const p = base.parameters || {};

  const mutation = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_lab_strategy_mutation",
    mutationId,
    parentStrategyId: base.strategyId,
    newStrategyId: strategyId,
    createdAt: now(),
    changes: {
      minEdgeBps: Number(input.minEdgeBps || Math.max(50, p.minEdgeBps + Math.round((Math.random() - 0.5) * 100))),
      maxLatencyMs: Number(input.maxLatencyMs || Math.max(250, p.maxLatencyMs + Math.round((Math.random() - 0.5) * 500))),
      maxRiskFraction: Math.min(0.05, Number(input.maxRiskFraction || Math.max(0.0025, p.maxRiskFraction + (Math.random() - 0.5) * 0.01))),
      volatilityBps: Number(input.volatilityBps || Math.max(5, p.volatilityBps + Math.round((Math.random() - 0.5) * 12))),
      slippageBps: Number(input.slippageBps || Math.max(0, p.slippageBps + Math.round((Math.random() - 0.5) * 20))),
    },
    reason: String(input.reason || "Parameter mutation for paper-only strategy exploration."),
  };

  const strategy = {
    ...base,
    strategyId,
    parentStrategyId: base.strategyId,
    mutationId,
    name: String(input.name || `${base.name} mutation`),
    createdAt: now(),
    updatedAt: now(),
    parameters: {
      ...base.parameters,
      ...mutation.changes,
    },
    scoring: {
      backtestScore: 0,
      livePaperScore: 0,
      riskScore: 50,
      confidence: 40,
    },
  };

  writeNexoraJson(strategyFile(strategyId), strategy);

  appendNexoraJsonl(MUTATION_LOG, {
    event: "strategy.mutated",
    mutation,
    strategy,
    createdAt: now(),
  });

  appendNexoraJsonl(STRATEGY_LOG, {
    event: "strategy.mutated",
    strategy,
    mutation,
    createdAt: now(),
  });

  journal("strategy.mutated", {
    mutation,
    strategy,
  });

  return {
    ok: true,
    nexoraBrain: true,
    mutation,
    strategy,
  };
}

export function listNexoraTradingLabStrategies(input: any = {}) {
  const family = input.family ? String(input.family) : "";
  const limit = Number(input.limit || 100);

  const rows = readLatestStrategies(1000)
    .filter((strategy: any) => !family || strategy.family === family)
    .slice(0, limit);

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function checkNexoraTradingExposure(input: any = {}) {
  const bankroll = Number(input.bankroll || 1000);
  const currentExposure = Number(input.currentExposure || 0);
  const requestedStake = Number(input.requestedStake || 0);
  const maxExposureFraction = Math.min(Number(input.maxExposureFraction || 0.1), 0.5);
  const maxSingleTradeFraction = Math.min(Number(input.maxSingleTradeFraction || 0.02), 0.05);
  const currentDrawdownFraction = Math.max(0, Number(input.currentDrawdownFraction || 0));
  const maxDrawdownFraction = Math.min(Number(input.maxDrawdownFraction || 0.05), 0.25);

  const maxExposureUsd = bankroll * maxExposureFraction;
  const maxSingleTradeUsd = bankroll * maxSingleTradeFraction;

  const violations = [
    currentExposure + requestedStake > maxExposureUsd ? "max_total_exposure_exceeded" : null,
    requestedStake > maxSingleTradeUsd ? "max_single_trade_exceeded" : null,
    currentDrawdownFraction >= maxDrawdownFraction ? "max_drawdown_reached" : null,
    input.liveTrading === true ? "live_trading_blocked" : null,
    input.privateKey || input.walletKey ? "private_key_blocked" : null,
  ].filter(Boolean);

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_exposure_governor",
    createdAt: now(),
    allowed: violations.length === 0,
    violations,
    bankroll,
    currentExposure,
    requestedStake,
    maxExposureUsd: round(maxExposureUsd, 2),
    maxSingleTradeUsd: round(maxSingleTradeUsd, 2),
    currentDrawdownFraction,
    maxDrawdownFraction,
    safety: {
      noLiveTrading: true,
      noPrivateKeys: true,
      paperOnly: true,
    },
  };

  appendNexoraJsonl(EXPOSURE_LOG, {
    event: "exposure.checked",
    result,
    createdAt: now(),
  });

  journal("exposure.checked", result);

  return {
    ok: true,
    nexoraBrain: true,
    result,
  };
}

export function createNexoraPaperPortfolioPosition(input: any = {}) {
  const positionId = String(input.positionId || nexoraLocalId("paper_position"));
  const strategyId = String(input.strategyId || "manual_strategy");
  const marketId = String(input.marketId || "paper_market");
  const asset = String(input.asset || "BTC").toUpperCase();
  const side = String(input.side || "BUY_YES_PAPER");
  const stake = Number(input.stake || 0);
  const price = clamp(Number(input.price || 0.5), 0.01, 0.99);

  const exposure = checkNexoraTradingExposure({
    bankroll: input.bankroll || 1000,
    currentExposure: input.currentExposure || 0,
    requestedStake: stake,
    liveTrading: false,
  }).result;

  if (!exposure.allowed) {
    const blocked = {
      ok: false,
      nexoraBrain: true,
      blocked: true,
      reason: "Exposure governor blocked paper position.",
      exposure,
    };

    appendNexoraJsonl(PORTFOLIO_LOG, {
      event: "position.blocked",
      blocked,
      createdAt: now(),
    });

    return blocked;
  }

  const position = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_portfolio_position",
    positionId,
    strategyId,
    marketId,
    asset,
    side,
    stake,
    price,
    status: "open",
    createdAt: now(),
    safety: {
      paperOnly: true,
      noLiveOrder: true,
    },
  };

  appendNexoraJsonl(PORTFOLIO_LOG, {
    event: "position.opened",
    position,
    createdAt: now(),
  });

  writeNexoraJson(nexoraLocalPath("trading-lab", "portfolio", `${positionId}.json`), position);

  recordNexoraMetric({
    name: "paper_portfolio_position_opened",
    value: stake,
    unit: "usd",
    dimensions: { asset, side, strategyId },
  });

  journal("position.opened", position);

  return {
    ok: true,
    nexoraBrain: true,
    position,
  };
}

export function settleNexoraPaperPortfolioPosition(input: any = {}) {
  const positionId = String(input.positionId || "");
  const outcome = String(input.outcome || "").toUpperCase();

  const positions = readNexoraJsonl(PORTFOLIO_LOG)
    .filter((row: any) => row.event === "position.opened")
    .map((row: any) => row.position);

  const position = positions.find((row: any) => row.positionId === positionId);

  if (!position) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "Position not found.",
      positionId,
    };
  }

  const won =
    (position.side === "BUY_YES_PAPER" && outcome === "YES") ||
    (position.side === "BUY_NO_PAPER" && outcome === "NO");

  const cost = Number(position.stake || 0);
  const payout = won ? cost / Math.max(0.01, Number(position.price || 0.5)) : 0;
  const pnl = round(payout - cost, 2);

  const settlement = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_portfolio_settlement",
    settlementId: nexoraLocalId("portfolio_settlement"),
    positionId,
    strategyId: position.strategyId,
    marketId: position.marketId,
    asset: position.asset,
    side: position.side,
    outcome,
    won,
    cost,
    payout: round(payout, 2),
    pnl,
    settledAt: now(),
  };

  appendNexoraJsonl(PORTFOLIO_LOG, {
    event: "position.settled",
    settlement,
    createdAt: now(),
  });

  recordNexoraMetric({
    name: "paper_portfolio_pnl",
    value: pnl,
    unit: "usd",
    dimensions: { asset: position.asset, strategyId: position.strategyId, won },
  });

  journal("position.settled", settlement);

  return {
    ok: true,
    nexoraBrain: true,
    settlement,
  };
}

export function evaluateNexoraSignalWithSwarm(input: any = {}) {
  const paperCycle = runNexoraMarketDataPaperCycle(input);
  const edge = paperCycle.edge?.edge;

  const swarmRequest = {
    title: "Evaluate paper market signal",
    type: "paper_trading_signal",
    action: "evaluate_signal",
    risk: "medium",
    payload: {
      edge,
      signal: paperCycle.signal,
      liveTrading: false,
      tradingMode: "paper/sandbox",
    },
  };

  appendNexoraJsonl(SIGNAL_LOG, {
    event: "signal.swarm_requested",
    swarmRequest,
    paperCycle,
    createdAt: now(),
  });

  journal("signal.swarm_requested", {
    swarmRequest,
    paperCycle,
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_signal_swarm_bridge",
    swarmRequest,
    paperCycle,
    note: "Use /api/nexora/swarm-runtime/consensus with this request when swarm route is active.",
  };
}

export function runNexoraStrategyTournament(input: any = {}) {
  const tournamentId = String(input.tournamentId || nexoraLocalId("tournament"));
  const base = input.baseStrategy || createNexoraTradingLabStrategy({}).strategy;
  const contestants = [base];

  const mutationCount = Number(input.mutationCount || 5);
  for (let i = 0; i < mutationCount; i++) {
    contestants.push(mutateNexoraTradingLabStrategy({
      parentStrategyId: base.strategyId,
    }).strategy);
  }

  const scored = contestants.map((strategy: any) => {
    const p = strategy.parameters || {};
    const riskPenalty = Number(p.maxRiskFraction || 0.02) * 1000;
    const edgeScore = Math.max(0, 1000 - Number(p.minEdgeBps || 250)) / 10;
    const latencyScore = Math.max(0, 5000 - Number(p.maxLatencyMs || 3000)) / 50;
    const score = round(Math.max(0, Math.min(100, edgeScore + latencyScore - riskPenalty)), 2);

    return {
      strategyId: strategy.strategyId,
      name: strategy.name,
      parameters: p,
      score,
      recommendation: score >= 70 ? "paper_test_more" : score >= 40 ? "revise" : "deprioritize",
    };
  }).sort((a: any, b: any) => b.score - a.score);

  const tournament = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_strategy_tournament",
    tournamentId,
    createdAt: now(),
    contestantCount: contestants.length,
    winner: scored[0],
    scored,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
    },
  };

  appendNexoraJsonl(TOURNAMENT_LOG, {
    event: "strategy.tournament",
    tournament,
    createdAt: now(),
  });

  journal("strategy.tournament", tournament);

  return {
    ok: true,
    nexoraBrain: true,
    tournament,
  };
}

export function getNexoraTradingLabDashboard(input: any = {}) {
  const limit = Number(input.limit || 50);
  const strategies = listNexoraTradingLabStrategies({ limit });
  const portfolioRows = readNexoraJsonl(PORTFOLIO_LOG).slice(-limit).reverse();
  const exposureRows = readNexoraJsonl(EXPOSURE_LOG).slice(-limit).reverse();
  const signalRows = readNexoraJsonl(SIGNAL_LOG).slice(-limit).reverse();
  const tournaments = readNexoraJsonl(TOURNAMENT_LOG).slice(-limit).reverse();

  const settlements = portfolioRows
    .filter((row: any) => row.event === "position.settled")
    .map((row: any) => row.settlement);

  const totalPnl = settlements.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_lab_dashboard",
    generatedAt: now(),
    counts: {
      strategies: strategies.count,
      portfolioEvents: portfolioRows.length,
      exposureChecks: exposureRows.length,
      signals: signalRows.length,
      tournaments: tournaments.length,
      settlements: settlements.length,
    },
    totalPnl: round(totalPnl, 2),
    strategies: strategies.rows,
    recentPortfolio: portfolioRows,
    recentSignals: signalRows,
    recentTournaments: tournaments,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };
}

export function getNexoraTradingLabStatus() {
  const dashboard = getNexoraTradingLabDashboard({ limit: 20 });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_intelligence_lab_v2",
    generatedAt: now(),
    dashboard: {
      counts: dashboard.counts,
      totalPnl: dashboard.totalPnl,
    },
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noPostgres: true,
    },
  };
}

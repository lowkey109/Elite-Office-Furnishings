import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraMetrics, recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";
import { getNexoraTimeline, recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const JOURNAL = nexoraLocalPath("polymarket-mega-v2", "journal", "mega-v2-journal.jsonl");
const FARM_LOG = nexoraLocalPath("polymarket-mega-v2", "evidence-farm", "evidence-farm-log.jsonl");
const RANK_LOG = nexoraLocalPath("polymarket-mega-v2", "rankings", "ranking-log.jsonl");
const BATCH_LOG = nexoraLocalPath("polymarket-mega-v2", "batches", "batch-log.jsonl");
const OPERATOR_LOG = nexoraLocalPath("polymarket-mega-v2", "operator", "operator-log.jsonl");
const HEALTH_LOG = nexoraLocalPath("polymarket-mega-v2", "health", "health-log.jsonl");
const RUNBOOK_LOG = nexoraLocalPath("polymarket-mega-v2", "runbooks", "runbook-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeRead(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function latest(file: string, limit = 100) {
  return safeRead(file).slice(-limit).reverse();
}

function count(file: string, event?: string) {
  const rows = safeRead(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

async function maybeRunPaperAutopilotCycle(input: any = {}) {
  try {
    const mod = await import(String("../paperautopilot/nexoraPaperAutopilotEvidenceEngine"));
    return await mod.runNexoraPaperAutopilotEvidenceCycle(input);
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      service: "paper_autopilot_unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function maybeRunPaperAutopilotBatch(input: any = {}) {
  try {
    const mod = await import(String("../paperautopilot/nexoraPaperAutopilotEvidenceEngine"));
    return await mod.runNexoraPaperAutopilotBatch(input);
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      service: "paper_autopilot_batch_unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function maybeRunMarketCycle(input: any = {}) {
  try {
    const mod = await import(String("../marketdata/nexoraMarketDataPaperEngine"));
    return mod.runNexoraMarketDataPaperCycle(input);
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      service: "market_data_cycle_unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function maybeRunBacktest(input: any = {}) {
  try {
    const mod = await import(String("../backtesting/nexoraBacktestSimulationEngine"));
    return mod.runNexoraBacktestSimulation(input);
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      service: "backtest_unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function maybeRunReadiness(input: any = {}) {
  try {
    const mod = await import(String("../tradingreadiness/nexoraTradingLiveReadinessGate"));
    return mod.evaluateNexoraTradingPromotionGate(input);
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      service: "trading_readiness_unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function maybeRunExecutionIntent(input: any = {}) {
  try {
    const mod = await import(String("../tradingexecution/nexoraTradingExecutionSafety"));
    return mod.createNexoraPaperOrderIntent(input);
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      service: "execution_intent_unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function collectEvidence() {
  const settlements = [
    ...latest(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"), 1000)
      .filter((row: any) => row.event === "reconciliation.settled")
      .map((row: any) => row.settlement),
    ...latest(nexoraLocalPath("trading-lab", "portfolio", "portfolio-log.jsonl"), 1000)
      .filter((row: any) => row.event === "position.settled")
      .map((row: any) => row.settlement),
    ...latest(nexoraLocalPath("backtesting", "pnl", "pnl-log.jsonl"), 1000)
      .filter((row: any) => row.event === "backtest.pnl")
      .map((row: any) => row.results),
  ].filter(Boolean);

  const totalPnl = settlements.reduce((sum: number, row: any) => sum + Number(row.pnl || row.totalPnl || 0), 0);
  const wins = settlements.filter((row: any) => row.won === true).length;

  return {
    counts: {
      marketSignals: count(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), "paper_signal.created"),
      marketEdges: count(nexoraLocalPath("market-data", "edges", "edge-log.jsonl"), "edge.detected"),
      paperAutopilotRuns: count(nexoraLocalPath("paper-autopilot", "runs", "paper-autopilot-run-log.jsonl"), "paper_autopilot.run"),
      paperAutopilotBatches: count(nexoraLocalPath("paper-autopilot", "reports", "paper-autopilot-report-log.jsonl"), "paper_autopilot.batch"),
      backtestRuns: count(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), "backtest.run"),
      executionIntents: count(nexoraLocalPath("trading-execution", "intents", "order-intent-log.jsonl"), "order_intent.created"),
      simulatedFills: count(nexoraLocalPath("trading-execution", "fills", "simulated-fill-log.jsonl"), "simulated_fill.created"),
      readinessGates: count(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), "promotion_gate.evaluated"),
      swarmConsensus: count(nexoraLocalPath("swarm-runtime", "consensus", "swarm-consensus.jsonl"), "swarm.consensus.created"),
      riskEvents: count(nexoraLocalPath("risk-governor", "risk-governor-log.jsonl"), "risk.evaluated"),
      settlements: settlements.length,
    },
    performance: {
      totalPnl: round(totalPnl, 2),
      settlements: settlements.length,
      wins,
      winRate: settlements.length ? round(wins / settlements.length, 4) : 0,
    },
    recent: {
      signals: latest(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), 10),
      backtests: latest(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), 10),
      executions: latest(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"), 10),
      readiness: latest(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), 10),
    },
  };
}

export async function runNexoraPolymarketEvidenceFarm(input: any = {}) {
  const farmId = String(input.farmId || nexoraLocalId("evidence_farm"));
  const cycles = Number(input.cycles || 5);
  const asset = String(input.asset || "BTC").toUpperCase();
  const openPrice = Number(input.openPrice || 65000);

  const runs: any[] = [];

  for (let i = 0; i < cycles; i++) {
    const currentPrice = openPrice + (Math.random() - 0.4) * 500;
    const finalPrice = currentPrice + (Math.random() - 0.5) * 350;
    const yesPrice = 0.5 + (Math.random() - 0.5) * 0.14;

    const marketCycle = await maybeRunMarketCycle({
      asset,
      symbol: `${asset}USDT`,
      openPrice,
      currentPrice,
      finalPrice,
      yesPrice,
      secondsToExpiry: 300,
      latencyMs: 1000 + Math.random() * 1000,
    });

    const autopilot = await maybeRunPaperAutopilotCycle({
      runId: `${farmId}_cycle_${i + 1}`,
      asset,
      openPrice,
      currentPrice,
      finalPrice,
      yesPrice,
      secondsToExpiry: 300,
    });

    const backtest = await maybeRunBacktest({
      asset,
      startPrice: openPrice,
      count: 120,
      bankroll: 1000,
    });

    const intent = await maybeRunExecutionIntent({
      marketId: `${asset.toLowerCase()}_farm_${i + 1}`,
      asset,
      side: "BUY_YES_PAPER",
      price: yesPrice,
      sizeUsd: 10,
      liveTrading: false,
      tradingMode: "paper/sandbox",
    });

    runs.push({
      index: i + 1,
      marketCycle,
      autopilot,
      backtest,
      intent,
    });
  }

  const readiness = await maybeRunReadiness({
    gateId: `${farmId}_readiness`,
    postgresReady: false,
    explicitOwnerRequestedReview: false,
  });

  const evidence = collectEvidence();

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_evidence_farm",
    farmId,
    createdAt: now(),
    cycles,
    asset,
    runs,
    readiness,
    evidence,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noPostgres: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-mega-v2", "evidence-farm", `${farmId}.json`), result);
  appendNexoraJsonl(FARM_LOG, { event: "evidence_farm.run", result, createdAt: now() });
  journal("evidence_farm.run", result);

  recordNexoraTimelineEvent({
    type: "polymarket_evidence_farm",
    title: "Polymarket evidence farm completed",
    severity: "info",
    payload: { farmId, cycles },
  });

  recordNexoraMetric({
    name: "polymarket_evidence_farm_cycles",
    value: cycles,
    unit: "cycles",
    dimensions: { asset },
  });

  return { ok: true, nexoraBrain: true, result };
}

export function rankNexoraPolymarketSignals(input: any = {}) {
  const rankingId = String(input.rankingId || nexoraLocalId("signal_ranking"));
  const evidence = collectEvidence();

  const signalRows = [
    ...latest(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), 200),
    ...latest(nexoraLocalPath("polymarket-collector", "signals", "collector-signals.jsonl"), 200),
    ...latest(nexoraLocalPath("paper-autopilot", "runs", "paper-autopilot-run-log.jsonl"), 200),
  ];

  const ranked = signalRows.map((row: any, index: number) => {
    const text = JSON.stringify(row);
    const edgeMatch = text.match(/"edgeBps":\s*(-?\d+\.?\d*)/);
    const eligible = text.includes('"eligible":true') || text.includes('"paperEligible":true');
    const edgeBps = edgeMatch ? Math.abs(Number(edgeMatch[1])) : 0;
    const score = Math.min(100, (eligible ? 40 : 0) + edgeBps / 25);

    return {
      rankId: `${rankingId}_${index + 1}`,
      score: round(score, 2),
      eligible,
      edgeBps,
      source: row.event || "unknown",
      row,
    };
  }).sort((a: any, b: any) => b.score - a.score);

  const ranking = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_signal_ranking",
    rankingId,
    createdAt: now(),
    count: ranked.length,
    top: ranked.slice(0, 25),
    evidenceSummary: evidence.counts,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-mega-v2", "rankings", `${rankingId}.json`), ranking);
  appendNexoraJsonl(RANK_LOG, { event: "signals.ranked", ranking, createdAt: now() });
  journal("signals.ranked", ranking);

  return { ok: true, nexoraBrain: true, ranking };
}

export function createNexoraPolymarketMegaV2Health(input: any = {}) {
  const healthId = String(input.healthId || nexoraLocalId("mega_v2_health"));
  const evidence = collectEvidence();

  const checks = [
    { key: "paperAutopilotRuns", ok: evidence.counts.paperAutopilotRuns > 0, weight: 15 },
    { key: "backtests", ok: evidence.counts.backtestRuns > 0, weight: 15 },
    { key: "signals", ok: evidence.counts.marketSignals > 0 || evidence.counts.marketEdges > 0, weight: 15 },
    { key: "executionIntents", ok: evidence.counts.executionIntents > 0, weight: 10 },
    { key: "readinessGates", ok: evidence.counts.readinessGates > 0, weight: 10 },
    { key: "swarmConsensus", ok: evidence.counts.swarmConsensus > 0, weight: 10 },
    { key: "riskEvents", ok: evidence.counts.riskEvents > 0, weight: 10 },
    { key: "pnl", ok: evidence.performance.totalPnl >= 0, weight: 15 },
  ];

  const score = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  const failed = checks.filter((check) => !check.ok);

  const health = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_mega_v2_health",
    healthId,
    createdAt: now(),
    score,
    status:
      score >= 85 ? "strong" :
      score >= 60 ? "progressing" :
      "needs_evidence",
    checks,
    failed,
    evidence,
    recommendation:
      score >= 85
        ? "Continue paper testing. Live remains blocked."
        : "Run evidence farm, backtests, signal ranking, and readiness gates.",
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-mega-v2", "health", `${healthId}.json`), health);
  appendNexoraJsonl(HEALTH_LOG, { event: "mega_v2.health", health, createdAt: now() });
  journal("mega_v2.health", health);

  return { ok: true, nexoraBrain: true, health };
}

export function createNexoraPolymarketMegaV2OperatorPack(input: any = {}) {
  const packId = String(input.packId || nexoraLocalId("mega_v2_operator_pack"));
  const baseUrl = String(input.baseUrl || "http://127.0.0.1:5000");

  const pack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_mega_v2_operator_pack",
    packId,
    createdAt: now(),
    commands: [
      `curl -sS -X POST "${baseUrl}/api/nexora/polymarket-mega-v2/evidence-farm" -H "Content-Type: application/json" -d '{"cycles":5,"asset":"BTC"}' | head -c 3000`,
      `curl -sS -X POST "${baseUrl}/api/nexora/polymarket-mega-v2/rank-signals" -H "Content-Type: application/json" -d '{}' | head -c 3000`,
      `curl -sS -X POST "${baseUrl}/api/nexora/polymarket-mega-v2/health" -H "Content-Type: application/json" -d '{}' | head -c 3000`,
      `curl -sS "${baseUrl}/api/nexora/polymarket-mega-v2/status" | head -c 2000`,
    ],
    safety: {
      paperOnly: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-mega-v2", "operator", `${packId}.json`), pack);
  appendNexoraJsonl(OPERATOR_LOG, { event: "operator.pack", pack, createdAt: now() });
  journal("operator.pack", pack);

  return { ok: true, nexoraBrain: true, pack };
}

export function getNexoraPolymarketMegaV2Status() {
  const evidence = collectEvidence();
  const farmRuns = readNexoraJsonl(FARM_LOG).filter((row: any) => row.event === "evidence_farm.run");
  const rankings = readNexoraJsonl(RANK_LOG).filter((row: any) => row.event === "signals.ranked");
  const healthRows = readNexoraJsonl(HEALTH_LOG).filter((row: any) => row.event === "mega_v2.health");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_mega_accelerator_v2",
    generatedAt: now(),
    farmRuns: farmRuns.length,
    rankings: rankings.length,
    healthReports: healthRows.length,
    evidence,
    latestHealth: healthRows.slice(-1)[0]?.health || null,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noPostgres: true,
    },
  };
}

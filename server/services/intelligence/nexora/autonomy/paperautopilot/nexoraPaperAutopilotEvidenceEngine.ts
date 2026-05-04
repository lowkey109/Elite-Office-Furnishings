import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";
import { runNexoraMarketDataPaperCycle } from "../marketdata/nexoraMarketDataPaperEngine";
import { runNexoraBacktestSimulation } from "../backtesting/nexoraBacktestSimulationEngine";
import {
  createNexoraPaperOrderIntent,
  simulateNexoraPaperFill,
  reconcileNexoraPaperFill,
} from "../tradingexecution/nexoraTradingExecutionSafety";
import {
  createNexoraTradingEvidencePack,
  evaluateNexoraTradingPromotionGate,
} from "../tradingreadiness/nexoraTradingLiveReadinessGate";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("paper-autopilot", "journal", "paper-autopilot-journal.jsonl");
const RUN_LOG = nexoraLocalPath("paper-autopilot", "runs", "paper-autopilot-run-log.jsonl");
const EVIDENCE_LOG = nexoraLocalPath("paper-autopilot", "evidence", "paper-autopilot-evidence-log.jsonl");
const REPORT_LOG = nexoraLocalPath("paper-autopilot", "reports", "paper-autopilot-report-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function safeOutcomeFromPrice(openPrice: number, finalPrice: number) {
  return finalPrice >= openPrice ? "YES" : "NO";
}

async function maybeSwarmConsensus(payload: any) {
  try {
    const swarm = await import(String("../swarmruntime/nexoraSwarmConsensusRuntime"));
    return swarm.runNexoraSwarmConsensus({
      title: "Paper autopilot signal review",
      type: "paper_signal_review",
      risk: "medium",
      payload: {
        ...payload,
        liveTrading: false,
        tradingMode: "paper/sandbox",
      },
    });
  } catch (error) {
    return {
      ok: false,
      nexoraBrain: true,
      skipped: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runNexoraPaperAutopilotEvidenceCycle(input: any = {}) {
  const runId = String(input.runId || nexoraLocalId("paper_autopilot"));
  const asset = String(input.asset || "BTC").toUpperCase();
  const symbol = String(input.symbol || `${asset}USDT`).toUpperCase();
  const openPrice = Number(input.openPrice || 65000);
  const currentPrice = Number(input.currentPrice || openPrice + 150);
  const finalPrice = Number(input.finalPrice || currentPrice);
  const yesPrice = Number(input.yesPrice || 0.52);
  const secondsToExpiry = Number(input.secondsToExpiry || 300);

  const marketCycle = runNexoraMarketDataPaperCycle({
    symbol,
    asset,
    marketId: input.marketId || `${asset.toLowerCase()}_paper_autopilot`,
    openPrice,
    currentPrice,
    yesPrice,
    secondsToExpiry,
    minEdgeBps: input.minEdgeBps || 250,
    latencyMs: input.latencyMs || 1200,
  });

  const backtest = runNexoraBacktestSimulation({
    asset,
    startPrice: openPrice,
    count: Number(input.backtestCount || 120),
    bankroll: Number(input.bankroll || 1000),
    minEdgeBps: input.minEdgeBps || 250,
  });

  const swarm = await maybeSwarmConsensus({
    runId,
    marketCycle,
    backtestSummary: backtest.report?.results || null,
  });

  const edge = marketCycle.edge?.edge;
  const signal = marketCycle.signal?.signal;

  const intent = createNexoraPaperOrderIntent({
    marketId: edge?.marketId || `${asset.toLowerCase()}_paper_autopilot`,
    asset,
    side: edge?.side || "BUY_YES_PAPER",
    price: edge?.side === "BUY_NO_PAPER" ? 1 - Number(edge?.yesPrice || yesPrice) : Number(edge?.yesPrice || yesPrice),
    sizeUsd: Number(input.sizeUsd || 10),
    liveTrading: false,
    tradingMode: "paper/sandbox",
    payload: {
      runId,
      signal,
      swarm,
    },
  });

  const fill = simulateNexoraPaperFill({
    intent: intent.intent,
    slippageBps: input.slippageBps || 25,
  });

  const fillAny = fill as any;
  const fillRecord = fillAny.fill || null;

  const outcome = String(input.outcome || safeOutcomeFromPrice(openPrice, finalPrice));
  const reconciliation = fill.ok && fillRecord
    ? reconcileNexoraPaperFill({
        fillId: fillRecord.fillId,
        outcome,
      })
    : {
        ok: false,
        nexoraBrain: true,
        skipped: true,
        reason: "No fill to reconcile.",
        fill,
      };

  const reconciliationAny = reconciliation as any;

  const evidence = createNexoraTradingEvidencePack({
    evidenceId: `${runId}_evidence`,
  });

  const readinessGate = evaluateNexoraTradingPromotionGate({
    gateId: `${runId}_gate`,
    evidence: evidence.evidence,
    postgresReady: false,
    explicitOwnerRequestedReview: false,
  });

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_autopilot_evidence_cycle",
    runId,
    createdAt: now(),
    marketCycle,
    backtest,
    swarm,
    intent,
    fill,
    reconciliation,
    evidence,
    readinessGate,
    summary: {
      signalEligible: Boolean(signal?.eligible),
      backtestPnl: backtest.report?.results?.totalPnl ?? null,
      orderIntentStatus: intent.intent?.status || null,
      fillStatus: fillRecord?.status || fillAny.status || null,
      pnl: reconciliationAny.settlement?.pnl ?? null,
      readinessDecision: readinessGate.gate?.decision || null,
    },
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noPostgres: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("paper-autopilot", "runs", `${runId}.json`), result);
  appendNexoraJsonl(RUN_LOG, { event: "paper_autopilot.run", result, createdAt: now() });
  appendNexoraJsonl(EVIDENCE_LOG, { event: "paper_autopilot.evidence", evidence: result.evidence, createdAt: now() });
  journal("paper_autopilot.run", result);

  recordNexoraTimelineEvent({
    type: "paper_autopilot",
    title: "Nexora paper autopilot evidence cycle completed",
    severity: "info",
    payload: {
      runId,
      pnl: result.summary.pnl,
      readinessDecision: result.summary.readinessDecision,
    },
  });

  recordNexoraMetric({
    name: "paper_autopilot_cycle",
    value: 1,
    unit: "cycle",
    dimensions: {
      asset,
      readinessDecision: String(result.summary.readinessDecision || "none"),
    },
  });

  return result;
}

export async function runNexoraPaperAutopilotBatch(input: any = {}) {
  const batchId = String(input.batchId || nexoraLocalId("paper_batch"));
  const count = Number(input.count || 5);
  const results = [];

  for (let i = 0; i < count; i++) {
    const base = Number(input.openPrice || 65000);
    const current = base + (Math.random() - 0.35) * 400;
    const final = current + (Math.random() - 0.5) * 300;

    results.push(await runNexoraPaperAutopilotEvidenceCycle({
      ...input,
      runId: `${batchId}_${i + 1}`,
      currentPrice: current,
      finalPrice: final,
      yesPrice: 0.5 + (Math.random() - 0.5) * 0.12,
    }));
  }

  const totalPnl = results.reduce((sum: number, row: any) => sum + Number(row.summary?.pnl || 0), 0);

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_autopilot_batch",
    batchId,
    createdAt: now(),
    count,
    totalPnl: round(totalPnl, 2),
    results: results.map((row: any) => row.summary),
    safety: {
      paperOnly: true,
      noLiveOrders: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("paper-autopilot", "reports", `${batchId}.json`), report);
  appendNexoraJsonl(REPORT_LOG, { event: "paper_autopilot.batch", report, createdAt: now() });
  journal("paper_autopilot.batch", report);

  return { ok: true, nexoraBrain: true, report };
}

export function getNexoraPaperAutopilotStatus() {
  const runs = readNexoraJsonl(RUN_LOG).filter((row: any) => row.event === "paper_autopilot.run");
  const batches = readNexoraJsonl(REPORT_LOG).filter((row: any) => row.event === "paper_autopilot.batch");
  const evidence = readNexoraJsonl(EVIDENCE_LOG).filter((row: any) => row.event === "paper_autopilot.evidence");

  const pnl = runs.reduce((sum: number, row: any) => sum + Number(row.result?.summary?.pnl || 0), 0);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_autopilot_status",
    generatedAt: now(),
    runs: runs.length,
    batches: batches.length,
    evidence: evidence.length,
    totalPnl: round(pnl, 2),
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
    },
  };
}

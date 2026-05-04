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
import { getNexoraMetrics, recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const JOURNAL = nexoraLocalPath("trading-readiness", "journal", "readiness-journal.jsonl");
const EVIDENCE_LOG = nexoraLocalPath("trading-readiness", "evidence", "evidence-log.jsonl");
const GATE_LOG = nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl");
const REVIEW_LOG = nexoraLocalPath("trading-readiness", "operator-review", "operator-review-log.jsonl");
const READINESS_LOG = nexoraLocalPath("trading-readiness", "readiness", "readiness-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeLog(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function getPaperEvidenceSource() {
  const backtestRuns = safeLog(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"))
    .filter((row: any) => row.event === "backtest.run")
    .map((row: any) => row.report);

  const executionSettlements = safeLog(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"))
    .filter((row: any) => row.event === "reconciliation.settled")
    .map((row: any) => row.settlement);

  const portfolioSettlements = safeLog(nexoraLocalPath("trading-lab", "portfolio", "portfolio-log.jsonl"))
    .filter((row: any) => row.event === "position.settled")
    .map((row: any) => row.settlement);

  const megaSettlements = safeLog(nexoraLocalPath("trading-mega", "performance", "performance-log.jsonl"))
    .filter((row: any) => row.event === "paper_execution.settled")
    .map((row: any) => row.settlement);

  const signals = [
    ...safeLog(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl")),
    ...safeLog(nexoraLocalPath("polymarket-collector", "signals", "collector-signals.jsonl")),
    ...safeLog(nexoraLocalPath("trading-lab", "signals", "signal-log.jsonl")),
  ];

  const swarmConsensus = safeLog(nexoraLocalPath("swarm-runtime", "consensus", "swarm-consensus.jsonl"))
    .filter((row: any) => row.event === "swarm.consensus.created")
    .map((row: any) => row.consensus);

  const riskEvents = safeLog(nexoraLocalPath("risk-governor", "risk-governor-log.jsonl"))
    .filter((row: any) => row.event === "risk.evaluated")
    .map((row: any) => row.decision);

  const settlements = [
    ...executionSettlements,
    ...portfolioSettlements,
    ...megaSettlements,
  ].filter(Boolean);

  const totalPnl = round(settlements.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0), 2);
  const wins = settlements.filter((row: any) => row.won).length;
  const winRate = settlements.length ? round(wins / settlements.length, 4) : 0;

  const bestBacktest = backtestRuns
    .map((run: any) => run.results || {})
    .sort((a: any, b: any) => Number(b.totalReturnPct || 0) - Number(a.totalReturnPct || 0))[0] || null;

  return {
    backtestRuns,
    settlements,
    signals,
    swarmConsensus,
    riskEvents,
    totalPnl,
    wins,
    winRate,
    bestBacktest,
  };
}

export function createNexoraTradingEvidencePack(input: any = {}) {
  const evidenceId = String(input.evidenceId || nexoraLocalId("trading_evidence"));
  const source = getPaperEvidenceSource();

  const evidence = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_evidence_pack",
    evidenceId,
    createdAt: now(),
    source,
    summary: {
      backtests: source.backtestRuns.length,
      settlements: source.settlements.length,
      signals: source.signals.length,
      swarmConsensus: source.swarmConsensus.length,
      riskEvents: source.riskEvents.length,
      totalPnl: source.totalPnl,
      winRate: source.winRate,
      bestBacktest: source.bestBacktest,
    },
    requirementsForFutureLiveDiscussion: [
      "Minimum 30 backtest runs",
      "Minimum 100 paper settlements",
      "Positive total paper PnL",
      "Maximum drawdown below configured threshold",
      "Swarm consensus records present",
      "Risk governor records present",
      "Kill switch tested",
      "Human commit required",
      "Private keys never stored in Nexora",
    ],
    safety: {
      evidenceOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("trading-readiness", "evidence", `${evidenceId}.json`), evidence);
  appendNexoraJsonl(EVIDENCE_LOG, { event: "evidence.created", evidence, createdAt: now() });
  journal("evidence.created", evidence);

  return { ok: true, nexoraBrain: true, evidence };
}

export function evaluateNexoraTradingPromotionGate(input: any = {}) {
  const gateId = String(input.gateId || nexoraLocalId("promotion_gate"));
  const evidence = input.evidence || createNexoraTradingEvidencePack({ evidenceId: `${gateId}_evidence` }).evidence;
  const summary = evidence.summary;

  const thresholds = {
    minBacktests: Number(input.minBacktests || 30),
    minSettlements: Number(input.minSettlements || 100),
    minSignals: Number(input.minSignals || 100),
    minSwarmConsensus: Number(input.minSwarmConsensus || 20),
    minRiskEvents: Number(input.minRiskEvents || 20),
    minTotalPnl: Number(input.minTotalPnl || 1),
    minWinRate: Number(input.minWinRate || 0.52),
    postgresReady: Boolean(input.postgresReady),
    explicitOwnerRequestedReview: Boolean(input.explicitOwnerRequestedReview),
  };

  const checks = [
    { key: "backtests", ok: summary.backtests >= thresholds.minBacktests, actual: summary.backtests, required: thresholds.minBacktests },
    { key: "settlements", ok: summary.settlements >= thresholds.minSettlements, actual: summary.settlements, required: thresholds.minSettlements },
    { key: "signals", ok: summary.signals >= thresholds.minSignals, actual: summary.signals, required: thresholds.minSignals },
    { key: "swarmConsensus", ok: summary.swarmConsensus >= thresholds.minSwarmConsensus, actual: summary.swarmConsensus, required: thresholds.minSwarmConsensus },
    { key: "riskEvents", ok: summary.riskEvents >= thresholds.minRiskEvents, actual: summary.riskEvents, required: thresholds.minRiskEvents },
    { key: "totalPnl", ok: summary.totalPnl >= thresholds.minTotalPnl, actual: summary.totalPnl, required: thresholds.minTotalPnl },
    { key: "winRate", ok: summary.winRate >= thresholds.minWinRate, actual: summary.winRate, required: thresholds.minWinRate },
    { key: "postgresReady", ok: thresholds.postgresReady, actual: thresholds.postgresReady, required: true },
    { key: "ownerRequestedReview", ok: thresholds.explicitOwnerRequestedReview, actual: thresholds.explicitOwnerRequestedReview, required: true },
  ];

  const failed = checks.filter((check) => !check.ok);

  const policy = evaluateNexoraPolicy({
    liveTrading: true,
    tradingMode: "live",
    bindingCommitment: true,
    approvalRequired: true,
  });

  const gate = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_promotion_gate",
    gateId,
    createdAt: now(),
    decision: failed.length ? "blocked" : "eligible_for_owner_review_only",
    liveTradingStillBlocked: true,
    privateKeysStillBlocked: true,
    checks,
    failed,
    policy,
    evidence,
    safety: {
      thisDoesNotEnableLiveTrading: true,
      ownerCommitRequired: true,
      newSeparateLiveExecutionBuildRequired: true,
      privateKeysStillForbidden: true,
      noPostgresNoPromotion: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("trading-readiness", "gates", `${gateId}.json`), gate);
  appendNexoraJsonl(GATE_LOG, { event: "promotion_gate.evaluated", gate, createdAt: now() });

  recordNexoraTimelineEvent({
    type: "trading_promotion_gate",
    title: `Trading promotion gate: ${gate.decision}`,
    severity: gate.decision === "blocked" ? "warning" : "critical",
    payload: {
      gateId,
      decision: gate.decision,
      failed: failed.length,
    },
  });

  recordNexoraMetric({
    name: "trading_promotion_gate_failed_checks",
    value: failed.length,
    unit: "checks",
    dimensions: { decision: gate.decision },
  });

  journal("promotion_gate.evaluated", gate);

  return { ok: true, nexoraBrain: true, gate };
}

export function createNexoraTradingOwnerReviewPacket(input: any = {}) {
  const reviewId = String(input.reviewId || nexoraLocalId("owner_review"));
  const gate = input.gate || evaluateNexoraTradingPromotionGate({ gateId: `${reviewId}_gate` }).gate;

  const packet = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_owner_review_packet",
    reviewId,
    createdAt: now(),
    title: "Trading promotion owner review packet",
    decision: gate.decision,
    liveTradingStillBlocked: true,
    ownerCanOnly: ["review", "reject", "request_more_paper_evidence"],
    ownerCannotYet: ["enable_live_trading", "add_private_keys", "place_live_orders"],
    gate,
    recommendedOwnerAction:
      gate.decision === "blocked"
        ? "Reject promotion and continue paper testing."
        : "Review carefully; a separate live execution safety build is still required.",
    safety: {
      noLiveTrading: true,
      noPrivateKeys: true,
      noWalletSigning: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("trading-readiness", "operator-review", `${reviewId}.json`), packet);
  appendNexoraJsonl(REVIEW_LOG, { event: "owner_review.created", packet, createdAt: now() });
  journal("owner_review.created", packet);

  return { ok: true, nexoraBrain: true, packet };
}

export function getNexoraTradingReadinessStatus() {
  const evidenceRows = readNexoraJsonl(EVIDENCE_LOG).filter((row: any) => row.event === "evidence.created");
  const gateRows = readNexoraJsonl(GATE_LOG).filter((row: any) => row.event === "promotion_gate.evaluated");
  const reviewRows = readNexoraJsonl(REVIEW_LOG).filter((row: any) => row.event === "owner_review.created");

  const latestGate = gateRows.slice(-1)[0]?.gate || null;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_live_readiness_gate",
    generatedAt: now(),
    counts: {
      evidencePacks: evidenceRows.length,
      promotionGates: gateRows.length,
      ownerReviews: reviewRows.length,
    },
    latestGate,
    liveTradingBlocked: true,
    privateKeysBlocked: true,
    status: latestGate?.decision || "not_evaluated",
  };
}

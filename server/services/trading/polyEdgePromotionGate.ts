import { getPolyEdgeProof } from "./polyEdgeProofService";
import { getPolyEdgeLearning } from "./polyEdgeLearningService";
import { getPolyEdgeDecisionLineage } from "./polyEdgeDecisionLineage";
import { getAutonomyRuntimeStatus } from "../ops/autonomyRunbook";

type PolyEdgePromotionMode = "admin" | "client";

type PromotionStatus =
  | "blocked"
  | "paper_only"
  | "eligible_for_tiny_live_review"
  | "tiny_live_allowed";

const RULES = {
  minimumCompletedPaperTrades: 500,
  minimumWinRate: 55,
  minimumProfitFactor: 1.25,
  maximumDrawdownPct: 12,
  minimumTotalPnl: 0,
  minimumGlobalLearningScore: 65,
  maximumConfidenceMismatchRate: 12,
  tinyLiveCaps: {
    maxOrderUsd: 25,
    maxDailyLossUsd: 50,
    maxOpenPositions: 1,
    maxTradesPerDay: 3,
    stopAfterConsecutiveLosses: 2,
  },
};

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pass(name: string, passed: boolean, actual: unknown, required: unknown, reason: string) {
  return {
    name,
    passed,
    actual,
    required,
    reason,
  };
}

export async function getPolyEdgePromotionReadiness(mode: PolyEdgePromotionMode = "client") {
  const [proofResult, learningResult, lineageResult] = await Promise.all([
    getPolyEdgeProof(mode),
    getPolyEdgeLearning(mode),
    getPolyEdgeDecisionLineage(mode),
  ]);

  const runtime = getAutonomyRuntimeStatus();

  const proof = (proofResult as any)?.proof || {};
  const learningSummary = (learningResult as any)?.summary || {};
  const lineageSummary = (lineageResult as any)?.summary || {};

  const completedPaperTrades = n(proof.totalTrades);
  const winRate = n(proof.winRate);
  const profitFactor = n(proof.profitFactor);
  const maxDrawdownPct = n(proof.maxDrawdownPct);
  const totalPnl = n(proof.totalPnl);
  const globalLearningScore = n(learningSummary.globalLearningScore);

  const lineageItems = n(lineageSummary.lineageItems);
  const confidenceMismatches = n(lineageSummary.confidenceMismatches);
  const confidenceMismatchRate =
    lineageItems > 0 ? Math.round((confidenceMismatches / lineageItems) * 10000) / 100 : 0;

  const checks = [
    pass(
      "minimum_completed_paper_trades",
      completedPaperTrades >= RULES.minimumCompletedPaperTrades,
      completedPaperTrades,
      RULES.minimumCompletedPaperTrades,
      `Requires at least ${RULES.minimumCompletedPaperTrades} completed paper trades before tiny-live review.`
    ),
    pass(
      "minimum_win_rate",
      winRate >= RULES.minimumWinRate,
      `${winRate}%`,
      `${RULES.minimumWinRate}%`,
      "Paper win rate must prove repeatable positive signal."
    ),
    pass(
      "minimum_profit_factor",
      profitFactor >= RULES.minimumProfitFactor,
      profitFactor,
      RULES.minimumProfitFactor,
      "Profit factor must show wins outweigh losses."
    ),
    pass(
      "maximum_drawdown",
      maxDrawdownPct <= RULES.maximumDrawdownPct,
      `${maxDrawdownPct}%`,
      `${RULES.maximumDrawdownPct}%`,
      "Drawdown must stay within tiny-live risk limits."
    ),
    pass(
      "positive_net_pnl",
      totalPnl > RULES.minimumTotalPnl,
      totalPnl,
      "> 0",
      "Paper system must be net profitable."
    ),
    pass(
      "minimum_learning_score",
      globalLearningScore >= RULES.minimumGlobalLearningScore,
      globalLearningScore,
      RULES.minimumGlobalLearningScore,
      "Learning brain must show sufficient pattern confidence."
    ),
    pass(
      "confidence_mismatch_rate",
      confidenceMismatchRate <= RULES.maximumConfidenceMismatchRate,
      `${confidenceMismatchRate}%`,
      `<= ${RULES.maximumConfidenceMismatchRate}%`,
      "High-confidence losing trades must remain limited."
    ),
    pass(
      "emergency_stop_clear",
      runtime.emergencyStop === false,
      runtime.emergencyStop,
      false,
      "Emergency stop must be clear."
    ),
    pass(
      "live_kill_switch_clear",
      runtime.liveTradingKillSwitch === false,
      runtime.liveTradingKillSwitch,
      false,
      "Live trading kill switch must be clear."
    ),
    pass(
      "manual_live_preauthorised",
      runtime.phantomXLivePreauthorised === true,
      runtime.phantomXLivePreauthorised,
      true,
      "PHANTOM_X_LIVE_PREAUTHORISED=true is required before tiny-live can be allowed."
    ),
  ];

  const failed = checks.filter((c) => !c.passed);
  const performanceChecksPassed = checks
    .filter((c) => !["manual_live_preauthorised"].includes(c.name))
    .every((c) => c.passed);

  let status: PromotionStatus = "blocked";

  if (completedPaperTrades < RULES.minimumCompletedPaperTrades) {
    status = "paper_only";
  } else if (performanceChecksPassed && runtime.phantomXLivePreauthorised !== true) {
    status = "eligible_for_tiny_live_review";
  } else if (failed.length === 0) {
    status = "tiny_live_allowed";
  } else {
    status = "blocked";
  }

  const nextRequiredAction =
    status === "paper_only"
      ? `Complete ${Math.max(0, RULES.minimumCompletedPaperTrades - completedPaperTrades)} more paper trades.`
      : status === "eligible_for_tiny_live_review"
        ? "Performance gates passed. Manual preauthorisation is still required before tiny-live."
        : status === "tiny_live_allowed"
          ? "Tiny-live is allowed by gates, but Nexora execution approval and live gateway controls still apply."
          : failed[0]?.reason || "Resolve failed promotion checks.";

  return {
    ok: true,
    product: "polyedge_tiny_live_promotion_gate",
    mode,
    generatedAt: new Date().toISOString(),
    status,
    liveTradingStillRequiresNexora: true,
    unrestrictedLiveTradingAllowed: false,
    tinyLiveCaps: RULES.tinyLiveCaps,
    rules: RULES,
    metrics: {
      completedPaperTrades,
      requiredPaperTrades: RULES.minimumCompletedPaperTrades,
      paperTradeProgressPct: Math.min(100, Math.round((completedPaperTrades / RULES.minimumCompletedPaperTrades) * 10000) / 100),
      winRate,
      profitFactor,
      maxDrawdownPct,
      totalPnl,
      globalLearningScore,
      lineageItems,
      confidenceMismatches,
      confidenceMismatchRate,
    },
    checks,
    failedChecks: failed,
    nextRequiredAction,
  };
}

import { db } from "../../db";
import {
  paperTradingDecisions,
  paperTradeOutcomes,
  decisionReviews,
  executionAttemptLogs,
} from "@shared/schema";
import { desc } from "drizzle-orm";
import { getPolyEdgeLearning } from "./polyEdgeLearningService";

type PolyEdgeLineageMode = "admin" | "client";

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value: number): number {
  return Math.round(value * 100) / 100;
}

function getPnl(row: any): number {
  const direct = row?.realizedPnl ?? row?.pnl ?? row?.profitLoss ?? row?.netPnl;
  if (Number.isFinite(Number(direct))) return Number(direct);

  const returned = Number(row?.capitalReturned);
  const allocated = Number(row?.paperCapitalAllocated);
  if (Number.isFinite(returned) && Number.isFinite(allocated)) return returned - allocated;

  return 0;
}

function confidenceBand(value: unknown): string {
  const c = n(value);
  if (c >= 85) return "85_plus";
  if (c >= 75) return "75_84";
  if (c >= 65) return "65_74";
  if (c >= 55) return "55_64";
  return "below_55";
}

function findLearningMatch(learning: any, dimension: string, label: string) {
  const byDimension = learning?.byDimension || {};
  const list =
    dimension === "strategy" ? byDimension.strategy :
    dimension === "symbol" ? byDimension.symbol :
    dimension === "direction" ? byDimension.direction :
    dimension === "confidence_band" ? byDimension.confidenceBand :
    [];

  return (Array.isArray(list) ? list : []).find(
    (g: any) => String(g.label || "").toLowerCase() === String(label || "").toLowerCase()
  ) || null;
}

function summarizeLearning(learning: any, decision: any, outcome: any) {
  const strategy = String(decision?.strategy || outcome?.strategy || "unknown");
  const symbol = String(outcome?.symbol || decision?.market || "unknown");
  const direction = String(decision?.direction || outcome?.side || "unknown");
  const band = confidenceBand(decision?.confidence);

  const matches = [
    findLearningMatch(learning, "strategy", strategy),
    findLearningMatch(learning, "symbol", symbol),
    findLearningMatch(learning, "direction", direction),
    findLearningMatch(learning, "confidence_band", band),
  ].filter(Boolean);

  const strongest = matches.slice().sort((a: any, b: any) => n(b.learningScore) - n(a.learningScore))[0] || null;
  const weakest = matches.slice().sort((a: any, b: any) => n(a.learningScore) - n(b.learningScore))[0] || null;

  return {
    strategy,
    symbol,
    direction,
    confidenceBand: band,
    matchedLearningSignals: matches.map((g: any) => ({
      dimension: g.dimension,
      label: g.label,
      samples: g.samples,
      winRate: g.winRate,
      profitFactor: g.profitFactor,
      learningScore: g.learningScore,
      recommendation: g.recommendation,
      reason: g.reason,
    })),
    strongestSignal: strongest ? {
      dimension: strongest.dimension,
      label: strongest.label,
      learningScore: strongest.learningScore,
      recommendation: strongest.recommendation,
    } : null,
    weakestSignal: weakest ? {
      dimension: weakest.dimension,
      label: weakest.label,
      learningScore: weakest.learningScore,
      recommendation: weakest.recommendation,
    } : null,
  };
}

function lineageVerdict(decision: any, outcome: any, learningSummary: any) {
  const pnl = getPnl(outcome);
  const confidence = n(decision?.confidence);
  const score = n(learningSummary?.strongestSignal?.learningScore);

  if (pnl > 0 && score >= 70) {
    return {
      verdict: "validated_edge",
      severity: "positive",
      explanation: "Trade outcome and learning score agree; this pattern may deserve more paper observation or slightly easier paper threshold.",
    };
  }

  if (pnl > 0) {
    return {
      verdict: "profitable_but_unproven",
      severity: "neutral",
      explanation: "Trade was profitable, but learning evidence is not yet strong enough for scaling.",
    };
  }

  if (pnl < 0 && confidence >= 75) {
    return {
      verdict: "confidence_mismatch",
      severity: "warning",
      explanation: "High-confidence decision lost money; future similar paper trades should require stronger confirmation.",
    };
  }

  if (pnl < 0) {
    return {
      verdict: "negative_outcome",
      severity: "warning",
      explanation: "Trade lost money; learning should reduce trust until more evidence appears.",
    };
  }

  return {
    verdict: "neutral_outcome",
    severity: "neutral",
    explanation: "Outcome is flat or unresolved; keep observing.",
  };
}

export async function getPolyEdgeDecisionLineage(mode: PolyEdgeLineageMode = "client") {
  const [learning, outcomes, decisions, reviews, attempts] = await Promise.all([
    getPolyEdgeLearning(mode).catch(() => null),
    db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt)).limit(100).catch(() => [] as any[]),
    db.select().from(paperTradingDecisions).orderBy(desc(paperTradingDecisions.createdAt)).limit(300).catch(() => [] as any[]),
    db.select().from(decisionReviews).orderBy(desc(decisionReviews.createdAt)).limit(200).catch(() => [] as any[]),
    mode === "admin"
      ? db.select().from(executionAttemptLogs).orderBy(desc(executionAttemptLogs.createdAt)).limit(100).catch(() => [] as any[])
      : Promise.resolve([] as any[]),
  ]);

  const decisionsById = new Map<string, any>();
  for (const decision of decisions as any[]) {
    if (decision?.id) decisionsById.set(String(decision.id), decision);
  }

  const reviewsByOutcomeId = new Map<string, any>();
  for (const review of reviews as any[]) {
    if (review?.outcomeId) reviewsByOutcomeId.set(String(review.outcomeId), review);
  }

  const items = (outcomes as any[]).map((outcome: any) => {
    const decisionId = String(outcome?.linkedDecisionId || outcome?.decisionId || "");
    const decision = decisionsById.get(decisionId) || {};
    const learningSummary = summarizeLearning(learning, decision, outcome);
    const verdict = lineageVerdict(decision, outcome, learningSummary);
    const pnl = getPnl(outcome);

    return {
      id: outcome?.id || decisionId || `${outcome?.symbol || "trade"}-${outcome?.createdAt || Date.now()}`,
      decisionId: decision?.id || decisionId || null,
      outcomeId: outcome?.id || null,
      createdAt: outcome?.createdAt || decision?.createdAt || null,
      market: decision?.market || outcome?.symbol || "unknown",
      strategy: decision?.strategy || outcome?.strategy || "unknown",
      direction: decision?.direction || outcome?.side || "unknown",
      confidence: n(decision?.confidence),
      evidence: {
        reasonCode: decision?.reasonCode || decision?.reason || null,
        regime: decision?.regime || null,
        riskBucket: decision?.riskBucket || decision?.risk_bucket || null,
        rawDecisionEvidence: mode === "admin" ? decision?.evidence || decision?.metadata || null : undefined,
      },
      nexoraGate: {
        required: true,
        source: "polyedge_paper_decision_lineage",
        adaptiveThresholdApplied: true,
        liveTradingAffected: false,
      },
      outcome: {
        pnl: pct(pnl),
        result: pnl > 0 ? "win" : pnl < 0 ? "loss" : "flat",
        exitReason: outcome?.exitReason || outcome?.reason || null,
      },
      learning: learningSummary,
      review: reviewsByOutcomeId.get(String(outcome?.id)) || null,
      verdict,
    };
  });

  const validated = items.filter((i) => i.verdict.verdict === "validated_edge").length;
  const confidenceMismatch = items.filter((i) => i.verdict.verdict === "confidence_mismatch").length;
  const negative = items.filter((i) => i.outcome.result === "loss").length;

  return {
    ok: true,
    product: "polyedge_decision_lineage",
    mode,
    generatedAt: new Date().toISOString(),
    summary: {
      lineageItems: items.length,
      validatedEdges: validated,
      confidenceMismatches: confidenceMismatch,
      negativeOutcomes: negative,
      liveTradingAffected: false,
    },
    items: mode === "admin" ? items : items.slice(0, 50).map((item) => ({
      ...item,
      evidence: {
        reasonCode: item.evidence.reasonCode,
        regime: item.evidence.regime,
        riskBucket: item.evidence.riskBucket,
      },
      review: undefined,
    })),
    adminOnly: mode === "admin" ? {
      recentExecutionAttempts: attempts,
    } : undefined,
  };
}

import { db } from "../../db";
import { paperTradeOutcomes, paperTradingDecisions, decisionReviews } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { MIN_TRADES_THRESHOLD } from "./tradingLearning";

export type QualityLabel =
  | "high_quality_good_outcome"
  | "high_quality_bad_outcome"
  | "low_quality_bad_outcome"
  | "low_quality_lucky_outcome"
  | "rule_violation"
  | "stale_data_decision"
  | "insufficient_data";

export interface DecisionQualityResult {
  decisionId: string;
  outcomeId: string;
  qualityScore: number;
  qualityLabel: QualityLabel;
  setupValid: boolean;
  confidenceAppropriate: boolean;
  outcomeAligned: boolean;
  notes: string;
}

export interface DecisionQualitySummary {
  sufficientData: boolean;
  totalReviewed: number;
  avgQualityScore: number;
  distribution: Record<QualityLabel, number>;
  recentReviews: DecisionQualityResult[];
}

function scoreDecision(decision: any, outcome: any): DecisionQualityResult {
  let score = 50;
  let notes: string[] = [];
  let setupValid = true;
  let confidenceAppropriate = true;
  let outcomeAligned = true;

  if (decision.confidence >= 70 && decision.dataQualityScore >= 60) {
    score += 15;
    notes.push("High confidence with good data quality");
  } else if (decision.confidence < 50) {
    score -= 15;
    setupValid = false;
    notes.push("Low confidence entry");
  }

  if (decision.dataQualityScore < 40) {
    score -= 20;
    setupValid = false;
    notes.push("Poor data quality at decision time");
  }

  if (decision.confidenceThreshold && decision.confidence < decision.confidenceThreshold) {
    score -= 25;
    notes.push("Confidence below threshold — rule violation");
  }

  const isWin = outcome.outcome === "win";
  const isHighConf = decision.confidence >= 70;

  if (isWin && isHighConf) {
    score += 20;
    notes.push("High-confidence setup delivered");
  } else if (!isWin && isHighConf) {
    score += 5;
    outcomeAligned = false;
    notes.push("High-quality setup, adverse outcome — acceptable");
  } else if (isWin && !isHighConf) {
    score -= 5;
    confidenceAppropriate = false;
    notes.push("Low-confidence entry succeeded — lucky outcome");
  } else {
    score -= 15;
    confidenceAppropriate = false;
    outcomeAligned = false;
    notes.push("Low-confidence entry failed — expected poor result");
  }

  if (outcome.exitReason === "max_hold_exceeded") {
    score -= 10;
    notes.push("Position held too long — exit discipline issue");
  }

  if (outcome.exitReason === "stop_hit" && isHighConf) {
    score += 5;
    notes.push("Stop triggered on valid setup — risk managed correctly");
  }

  if (decision.sourceMarketSnapshotId) {
    score += 5;
    notes.push("Decision backed by market snapshot");
  }

  score = Math.max(0, Math.min(100, score));

  let qualityLabel: QualityLabel;
  if (decision.confidence < decision.confidenceThreshold) {
    qualityLabel = "rule_violation";
  } else if (decision.dataQualityScore < 30) {
    qualityLabel = "stale_data_decision";
  } else if (score >= 70 && isWin) {
    qualityLabel = "high_quality_good_outcome";
  } else if (score >= 60 && !isWin) {
    qualityLabel = "high_quality_bad_outcome";
  } else if (score < 50 && isWin) {
    qualityLabel = "low_quality_lucky_outcome";
  } else if (score < 50 && !isWin) {
    qualityLabel = "low_quality_bad_outcome";
  } else {
    qualityLabel = isWin ? "high_quality_good_outcome" : "high_quality_bad_outcome";
  }

  return {
    decisionId: decision.id,
    outcomeId: outcome.id,
    qualityScore: score,
    qualityLabel,
    setupValid,
    confidenceAppropriate,
    outcomeAligned,
    notes: notes.join("; "),
  };
}

export async function reviewDecisionQuality(): Promise<DecisionQualitySummary> {
  const outcomes = await db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt));

  if (outcomes.length < MIN_TRADES_THRESHOLD) {
    return {
      sufficientData: false,
      totalReviewed: 0,
      avgQualityScore: 0,
      distribution: {} as Record<QualityLabel, number>,
      recentReviews: [],
    };
  }

  const existingReviews = await db.select({ outcomeId: decisionReviews.outcomeId }).from(decisionReviews);
  const reviewedOutcomeIds = new Set(existingReviews.map(r => r.outcomeId));

  const decisions = await db.select().from(paperTradingDecisions);
  const decisionMap = new Map(decisions.map(d => [d.id, d]));

  const newReviews: DecisionQualityResult[] = [];

  for (const outcome of outcomes) {
    if (reviewedOutcomeIds.has(outcome.id)) continue;
    const decision = decisionMap.get(outcome.linkedDecisionId);
    if (!decision) continue;
    const review = scoreDecision(decision, outcome);
    newReviews.push(review);
  }

  if (newReviews.length > 0) {
    for (const r of newReviews) {
      try {
        await db.insert(decisionReviews).values({
          decisionId: r.decisionId,
          outcomeId: r.outcomeId,
          qualityScore: r.qualityScore,
          qualityLabel: r.qualityLabel,
          setupValid: r.setupValid,
          confidenceAppropriate: r.confidenceAppropriate,
          outcomeAligned: r.outcomeAligned,
          notes: r.notes,
        });
      } catch (err: any) {
        if (!err?.message?.includes("duplicate")) {
          console.error(`[DecisionQuality] Failed to persist review for outcome ${r.outcomeId}:`, err?.message);
        }
      }
    }
  }

  const allReviews = await db.select().from(decisionReviews).orderBy(desc(decisionReviews.createdAt));

  const distribution: Record<string, number> = {};
  let totalScore = 0;
  for (const r of allReviews) {
    distribution[r.qualityLabel] = (distribution[r.qualityLabel] || 0) + 1;
    totalScore += r.qualityScore;
  }

  return {
    sufficientData: true,
    totalReviewed: allReviews.length,
    avgQualityScore: allReviews.length > 0 ? totalScore / allReviews.length : 0,
    distribution: distribution as Record<QualityLabel, number>,
    recentReviews: allReviews.slice(0, 10).map(r => ({
      decisionId: r.decisionId,
      outcomeId: r.outcomeId,
      qualityScore: r.qualityScore,
      qualityLabel: r.qualityLabel as QualityLabel,
      setupValid: r.setupValid ?? false,
      confidenceAppropriate: r.confidenceAppropriate ?? false,
      outcomeAligned: r.outcomeAligned ?? false,
      notes: r.notes ?? "",
    })),
  };
}

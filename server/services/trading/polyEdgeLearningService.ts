import { db } from "../../db";
import {
  paperTradingDecisions,
  paperTradeOutcomes,
  decisionReviews,
  learningRecommendations,
} from "@shared/schema";
import { desc } from "drizzle-orm";
import { getPolyEdgeProof } from "./polyEdgeProofService";

type PolyEdgeLearningMode = "admin" | "client";

type LearningGroup = {
  key: string;
  label: string;
  dimension: "strategy" | "symbol" | "direction" | "regime" | "risk_bucket" | "confidence_band";
  samples: number;
  wins: number;
  losses: number;
  flats: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  grossProfit: number;
  grossLossAbs: number;
  profitFactor: number;
  learningScore: number;
  confidence: number;
  recommendation:
    | "increase_size_slightly"
    | "continue_observing"
    | "reduce_or_pause"
    | "insufficient_sample"
    | "avoid_until_retrained";
  reason: string;
};

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(value: number): number {
  return Math.round(value * 100) / 100;
}

function getPnl(row: any): number {
  const direct =
    row?.realizedPnl ??
    row?.pnl ??
    row?.profitLoss ??
    row?.netPnl;

  if (Number.isFinite(Number(direct))) return Number(direct);

  const returned = Number(row?.capitalReturned);
  const allocated = Number(row?.paperCapitalAllocated);
  if (Number.isFinite(returned) && Number.isFinite(allocated)) return returned - allocated;

  return 0;
}

function confidenceBand(value: unknown): string {
  const c = safeNumber(value);
  if (c >= 85) return "85_plus";
  if (c >= 75) return "75_84";
  if (c >= 65) return "65_74";
  if (c >= 55) return "55_64";
  return "below_55";
}

function learningConfidence(samples: number): number {
  if (samples <= 0) return 0;
  return pct(Math.min(100, (samples / 50) * 100));
}

function scoreGroup(input: {
  samples: number;
  winRate: number;
  profitFactor: number;
  avgPnl: number;
  totalPnl: number;
}): number {
  const sampleWeight = Math.min(1, input.samples / 30);
  const winComponent = Math.max(0, Math.min(100, input.winRate));
  const pfComponent = Math.max(0, Math.min(100, input.profitFactor * 35));
  const pnlComponent = input.totalPnl > 0 ? 15 : input.totalPnl < 0 ? -20 : 0;
  const avgComponent = input.avgPnl > 0 ? 10 : input.avgPnl < 0 ? -10 : 0;

  return Math.round(
    Math.max(0, Math.min(100, (winComponent * 0.45 + pfComponent * 0.35 + pnlComponent + avgComponent) * sampleWeight))
  );
}

function recommendationFor(group: {
  samples: number;
  winRate: number;
  profitFactor: number;
  totalPnl: number;
  learningScore: number;
}): LearningGroup["recommendation"] {
  if (group.samples < 10) return "insufficient_sample";
  if (group.winRate >= 58 && group.profitFactor >= 1.35 && group.totalPnl > 0 && group.learningScore >= 70) {
    return "increase_size_slightly";
  }
  if (group.winRate < 40 || group.profitFactor < 0.85 || group.learningScore < 35) {
    return "avoid_until_retrained";
  }
  if (group.winRate < 48 || group.profitFactor < 1) return "reduce_or_pause";
  return "continue_observing";
}

function reasonFor(group: LearningGroup): string {
  if (group.recommendation === "insufficient_sample") {
    return `Only ${group.samples} sample(s); keep paper-learning before trusting this pattern.`;
  }
  if (group.recommendation === "increase_size_slightly") {
    return `${group.label} is outperforming with ${group.winRate}% win rate and ${group.profitFactor} profit factor.`;
  }
  if (group.recommendation === "avoid_until_retrained") {
    return `${group.label} is underperforming; pause or retrain before more exposure.`;
  }
  if (group.recommendation === "reduce_or_pause") {
    return `${group.label} is weak; reduce paper allocation and require stronger confirmation.`;
  }
  return `${group.label} is acceptable but not strong enough for scaling.`;
}

function buildGroups(rows: any[], decisionsById: Map<string, any>): LearningGroup[] {
  const buckets = new Map<string, { label: string; dimension: LearningGroup["dimension"]; pnls: number[] }>();

  function add(dimension: LearningGroup["dimension"], label: string, pnl: number) {
    const key = `${dimension}:${label || "unknown"}`;
    const existing = buckets.get(key) ?? { label: label || "unknown", dimension, pnls: [] };
    existing.pnls.push(pnl);
    buckets.set(key, existing);
  }

  for (const outcome of rows) {
    const pnl = getPnl(outcome);
    const decisionId = String(outcome?.linkedDecisionId || outcome?.decisionId || "");
    const decision = decisionsById.get(decisionId) || {};

    add("symbol", String(outcome?.symbol || decision?.market || "unknown"), pnl);
    add("strategy", String(decision?.strategy || outcome?.strategy || "unknown"), pnl);
    add("direction", String(decision?.direction || outcome?.side || "unknown"), pnl);
    add("regime", String(decision?.regime || "unknown"), pnl);
    add("risk_bucket", String(decision?.riskBucket || decision?.risk_bucket || "unknown"), pnl);
    add("confidence_band", confidenceBand(decision?.confidence), pnl);
  }

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const samples = bucket.pnls.length;
    const wins = bucket.pnls.filter((p) => p > 0).length;
    const losses = bucket.pnls.filter((p) => p < 0).length;
    const flats = samples - wins - losses;
    const grossProfit = bucket.pnls.filter((p) => p > 0).reduce((s, v) => s + v, 0);
    const grossLossAbs = Math.abs(bucket.pnls.filter((p) => p < 0).reduce((s, v) => s + v, 0));
    const totalPnl = bucket.pnls.reduce((s, v) => s + v, 0);
    const avgPnl = samples ? totalPnl / samples : 0;
    const winRate = samples ? (wins / samples) * 100 : 0;
    const profitFactor = grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? 999 : 0;
    const learningScore = scoreGroup({ samples, winRate, profitFactor, avgPnl, totalPnl });

    const base: LearningGroup = {
      key,
      label: bucket.label,
      dimension: bucket.dimension,
      samples,
      wins,
      losses,
      flats,
      winRate: pct(winRate),
      totalPnl: pct(totalPnl),
      avgPnl: pct(avgPnl),
      grossProfit: pct(grossProfit),
      grossLossAbs: pct(grossLossAbs),
      profitFactor: pct(profitFactor),
      learningScore,
      confidence: learningConfidence(samples),
      recommendation: "continue_observing",
      reason: "",
    };

    base.recommendation = recommendationFor(base);
    base.reason = reasonFor(base);
    return base;
  }).sort((a, b) => b.learningScore - a.learningScore || b.samples - a.samples);
}

function adaptiveThreshold(groups: LearningGroup[]) {
  const trusted = groups.filter((g) => g.dimension === "strategy" && g.samples >= 10);
  const best = trusted[0] ?? null;
  const worst = trusted.slice().reverse().find((g) => g.samples >= 10) ?? null;

  let paperConfidenceThreshold = 70;
  const notes: string[] = [];

  if (best && best.learningScore >= 75 && best.winRate >= 58 && best.profitFactor >= 1.35) {
    paperConfidenceThreshold = 66;
    notes.push(`Best strategy ${best.label} is strong; paper threshold may be lowered to 66 for that pattern.`);
  }

  if (worst && (worst.learningScore < 35 || worst.profitFactor < 0.9)) {
    paperConfidenceThreshold = Math.max(paperConfidenceThreshold, 76);
    notes.push(`Weak strategy ${worst.label} detected; raise paper threshold to 76 when similar conditions appear.`);
  }

  if (!trusted.length) {
    notes.push("No trusted strategy sample yet; keep default paper threshold.");
  }

  return {
    defaultPaperConfidenceThreshold: 70,
    recommendedPaperConfidenceThreshold: paperConfidenceThreshold,
    appliesToLiveTrading: false,
    bestStrategy: best,
    weakestStrategy: worst,
    notes,
  };
}

export async function getPolyEdgeLearning(mode: PolyEdgeLearningMode = "client") {
  const [proof, outcomes, decisions, reviews, recommendations] = await Promise.all([
    getPolyEdgeProof(mode),
    db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt)).limit(500).catch(() => [] as any[]),
    db.select().from(paperTradingDecisions).orderBy(desc(paperTradingDecisions.createdAt)).limit(1000).catch(() => [] as any[]),
    db.select().from(decisionReviews).orderBy(desc(decisionReviews.createdAt)).limit(100).catch(() => [] as any[]),
    db.select().from(learningRecommendations).orderBy(desc(learningRecommendations.createdAt)).limit(50).catch(() => [] as any[]),
  ]);

  const decisionsById = new Map<string, any>();
  for (const decision of decisions as any[]) {
    if (decision?.id) decisionsById.set(String(decision.id), decision);
  }

  const groups = buildGroups(outcomes as any[], decisionsById);
  const threshold = adaptiveThreshold(groups);

  const byDimension = {
    strategy: groups.filter((g) => g.dimension === "strategy").slice(0, 10),
    symbol: groups.filter((g) => g.dimension === "symbol").slice(0, 10),
    direction: groups.filter((g) => g.dimension === "direction").slice(0, 10),
    regime: groups.filter((g) => g.dimension === "regime").slice(0, 10),
    riskBucket: groups.filter((g) => g.dimension === "risk_bucket").slice(0, 10),
    confidenceBand: groups.filter((g) => g.dimension === "confidence_band").slice(0, 10),
  };

  const globalScore = groups.length
    ? Math.round(groups.slice(0, 12).reduce((s, g) => s + g.learningScore, 0) / Math.min(groups.length, 12))
    : 0;

  return {
    ok: true,
    product: "polyedge_aetherforge_learning_brain",
    mode,
    generatedAt: new Date().toISOString(),
    appliesToLiveTrading: false,
    summary: {
      globalLearningScore: globalScore,
      outcomeSamples: (outcomes as any[]).length,
      decisionSamples: (decisions as any[]).length,
      reviewSamples: (reviews as any[]).length,
      recommendationSamples: (recommendations as any[]).length,
      proofPassed: (proof as any)?.proof?.proofPassed === true,
      proofReadiness: (proof as any)?.proof?.readiness ?? "learning",
    },
    adaptiveThreshold: threshold,
    byDimension,
    topOpportunities: groups.filter((g) => g.recommendation === "increase_size_slightly").slice(0, 5),
    risksToReduce: groups.filter((g) => ["reduce_or_pause", "avoid_until_retrained"].includes(g.recommendation)).slice(0, 8),
    adminOnly: mode === "admin" ? {
      recentReviews: reviews,
      recentRecommendations: recommendations,
    } : undefined,
  };
}

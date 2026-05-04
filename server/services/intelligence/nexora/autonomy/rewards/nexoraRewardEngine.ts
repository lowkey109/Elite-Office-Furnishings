import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("rewards", "journal", "reward-journal.jsonl");
const LEDGER = nexoraLocalPath("rewards", "ledger", "reward-ledger.jsonl");
const PRAISE_LOG = nexoraLocalPath("rewards", "praise", "praise-log.jsonl");
const PATTERN_LOG = nexoraLocalPath("rewards", "patterns", "success-pattern-log.jsonl");
const PROMOTION_LOG = nexoraLocalPath("rewards", "promotions", "promotion-log.jsonl");
const CONFIDENCE_LOG = nexoraLocalPath("rewards", "confidence", "confidence-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normaliseWorker(value: any) {
  return String(value || "nexora_worker").toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

export function createNexoraReward(input: any = {}) {
  const rewardId = String(input.rewardId || nexoraLocalId("reward"));
  const worker = normaliseWorker(input.worker || input.agent || "nexora");
  const division = String(input.division || input.area || "general");
  const outcome = String(input.outcome || "good_work");
  const basePoints = Number(input.points || 10);
  const quality = String(input.quality || "good");

  const multiplier =
    quality === "excellent" ? 2 :
    quality === "great" ? 1.5 :
    quality === "good" ? 1 :
    quality === "minor" ? 0.5 :
    1;

  const points = Math.round(basePoints * multiplier * 100) / 100;

  const reward = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_reward",
    rewardId,
    worker,
    division,
    outcome,
    quality,
    points,
    reason: String(input.reason || "Nexora worker completed valuable work."),
    evidence: input.evidence || {},
    createdAt: now(),
    safety: {
      rewardDoesNotBypassApproval: true,
      rewardImprovesLearningOnly: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("rewards", "ledger", `${rewardId}.json`), reward);

  appendNexoraJsonl(LEDGER, {
    event: "reward.created",
    reward,
    createdAt: now(),
  });

  recordNexoraMetric({
    name: "nexora_worker_reward_points",
    value: points,
    unit: "points",
    dimensions: {
      worker,
      division,
      quality,
    },
  });

  recordNexoraTimelineEvent({
    type: "reward",
    title: `Rewarded ${worker}: ${outcome}`,
    severity: quality === "excellent" || quality === "great" ? "info" : "info",
    payload: reward,
  });

  journal("reward.created", reward);

  return {
    ok: true,
    nexoraBrain: true,
    reward,
  };
}

export function praiseNexoraWorker(input: any = {}) {
  const praiseId = String(input.praiseId || nexoraLocalId("praise"));
  const worker = normaliseWorker(input.worker || input.agent || "nexora");

  const praise = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_worker_praise",
    praiseId,
    worker,
    division: String(input.division || input.area || "general"),
    message: String(input.message || "Good job. This is the kind of work Nexora should repeat."),
    from: String(input.from || "owner"),
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("rewards", "praise", `${praiseId}.json`), praise);

  appendNexoraJsonl(PRAISE_LOG, {
    event: "praise.created",
    praise,
    createdAt: now(),
  });

  const reward = createNexoraReward({
    worker,
    division: praise.division,
    outcome: "praised_by_owner",
    quality: input.quality || "great",
    points: input.points || 15,
    reason: praise.message,
    evidence: praise,
  });

  journal("praise.created", {
    praise,
    reward,
  });

  return {
    ok: true,
    nexoraBrain: true,
    praise,
    reward,
  };
}

export function captureNexoraSuccessPattern(input: any = {}) {
  const patternId = String(input.patternId || nexoraLocalId("success_pattern"));
  const worker = normaliseWorker(input.worker || input.agent || "nexora");

  const pattern = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_success_pattern",
    patternId,
    worker,
    division: String(input.division || input.area || "general"),
    title: String(input.title || "Successful Nexora work pattern"),
    trigger: input.trigger || {},
    steps: Array.isArray(input.steps) ? input.steps : [
      "Understand request.",
      "Prepare safe draft.",
      "Check human boundary.",
      "Record outcome.",
      "Reuse pattern when similar work appears.",
    ],
    output: input.output || {},
    result: input.result || {},
    createdAt: now(),
    reusable: input.reusable !== false,
  };

  writeNexoraJson(nexoraLocalPath("rewards", "patterns", `${patternId}.json`), pattern);

  appendNexoraJsonl(PATTERN_LOG, {
    event: "success_pattern.created",
    pattern,
    createdAt: now(),
  });

  createNexoraReward({
    worker,
    division: pattern.division,
    outcome: "success_pattern_captured",
    quality: input.quality || "great",
    points: input.points || 20,
    reason: `Captured reusable success pattern: ${pattern.title}`,
    evidence: pattern,
  });

  journal("success_pattern.created", pattern);

  return {
    ok: true,
    nexoraBrain: true,
    pattern,
  };
}

export function updateNexoraWorkerConfidence(input: any = {}) {
  const worker = normaliseWorker(input.worker || input.agent || "nexora");
  const skill = String(input.skill || input.skillKey || "general");
  const delta = Number(input.delta || 5);
  const reason = String(input.reason || "Positive outcome increased confidence.");

  const priorRows = readNexoraJsonl(CONFIDENCE_LOG)
    .filter((row: any) => row.event === "confidence.updated")
    .map((row: any) => row.confidence)
    .filter((row: any) => row.worker === worker && row.skill === skill);

  const prior = priorRows.length ? Number(priorRows[priorRows.length - 1].confidence || 50) : 50;
  const next = clamp(prior + delta);

  const confidence = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_worker_confidence",
    confidenceId: nexoraLocalId("confidence"),
    worker,
    skill,
    prior,
    delta,
    confidence: next,
    reason,
    createdAt: now(),
  };

  writeNexoraJson(
    nexoraLocalPath("rewards", "confidence", `${worker}-${skill}.json`),
    confidence,
  );

  appendNexoraJsonl(CONFIDENCE_LOG, {
    event: "confidence.updated",
    confidence,
    createdAt: now(),
  });

  journal("confidence.updated", confidence);

  return {
    ok: true,
    nexoraBrain: true,
    confidence,
  };
}

export function recommendNexoraWorkerPromotion(input: any = {}) {
  const worker = normaliseWorker(input.worker || input.agent || "nexora");
  const rewards = readNexoraJsonl(LEDGER)
    .filter((row: any) => row.event === "reward.created")
    .map((row: any) => row.reward)
    .filter((reward: any) => reward.worker === worker);

  const totalPoints = rewards.reduce((sum: number, reward: any) => sum + Number(reward.points || 0), 0);
  const promotionRecommended = totalPoints >= Number(input.threshold || 100);

  const recommendation = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_worker_promotion_recommendation",
    recommendationId: nexoraLocalId("promotion"),
    worker,
    totalPoints,
    threshold: Number(input.threshold || 100),
    promotionRecommended,
    status: promotionRecommended ? "human_approval_required" : "not_yet",
    reason: promotionRecommended
      ? "Worker has accumulated enough reward points for promotion review."
      : "Worker has not yet reached promotion threshold.",
    createdAt: now(),
    safety: {
      promotionRequiresHumanApproval: true,
      noAutomaticAuthorityIncrease: true,
    },
  };

  writeNexoraJson(
    nexoraLocalPath("rewards", "promotions", `${recommendation.recommendationId}.json`),
    recommendation,
  );

  appendNexoraJsonl(PROMOTION_LOG, {
    event: "promotion.recommended",
    recommendation,
    createdAt: now(),
  });

  journal("promotion.recommended", recommendation);

  return {
    ok: true,
    nexoraBrain: true,
    recommendation,
  };
}

export function listNexoraRewards(input: any = {}) {
  const worker = input.worker ? normaliseWorker(input.worker) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(LEDGER)
    .filter((row: any) => row.event === "reward.created")
    .map((row: any) => row.reward)
    .filter((reward: any) => !worker || reward.worker === worker)
    .slice(-limit)
    .reverse();

  const totalPoints = rows.reduce((sum: number, reward: any) => sum + Number(reward.points || 0), 0);

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    totalPoints,
    rows,
  };
}

export function getNexoraRewardStatus() {
  const rewards = listNexoraRewards({ limit: 1000 });
  const praise = readNexoraJsonl(PRAISE_LOG).filter((row: any) => row.event === "praise.created");
  const patterns = readNexoraJsonl(PATTERN_LOG).filter((row: any) => row.event === "success_pattern.created");
  const promotions = readNexoraJsonl(PROMOTION_LOG).filter((row: any) => row.event === "promotion.recommended");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_reward_reinforcement",
    generatedAt: now(),
    counts: {
      rewards: rewards.count,
      praise: praise.length,
      successPatterns: patterns.length,
      promotionRecommendations: promotions.length,
    },
    totalRewardPoints: rewards.totalPoints,
    doctrine: "Reward good work, capture success patterns, increase confidence, but never increase authority without human approval.",
    safety: {
      rewardsDoNotBypassApproval: true,
      promotionsRequireHumanApproval: true,
      nexoraOnlyBrain: true,
    },
  };
}

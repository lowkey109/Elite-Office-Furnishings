import { NEXORA_SIGNAL_LIBRARY_2000 } from "./nexoraSignalLibrary2000";
import type { NexoraTradeDirection, NexoraTradeSignal } from "../nexoraTradeVotingEngine";

type ScoreInput = {
  symbol: string;
  strategy: string;
  direction: Exclude<NexoraTradeDirection, "neutral">;
  confidence: number;
  learningScore: number;
  regime?: string;
};

type GroupScore = {
  group: string;
  score: number;
  agreeing: number;
  total: number;
};

export type NexoraSignalScoringResult = {
  signals: NexoraTradeSignal[];
  groupScores: GroupScore[];
  agreementCount: number;
  confidence: number;
  blockedReasons: string[];
  reason: string;
};

function preferredGroupsForStrategy(strategy: string) {
  if (strategy === "momentum_breakout") {
    return ["trend", "breakout", "volatility", "structure", "liquidity", "regime"];
  }

  if (strategy === "volatility_squeeze") {
    return ["volatility", "breakout", "trend", "liquidity", "structure", "regime"];
  }

  if (strategy === "trend_follow") {
    return ["trend", "regime", "structure", "liquidity", "volatility", "breakout"];
  }

  if (strategy === "mean_reversion") {
    return ["mean_reversion", "structure", "volatility", "liquidity", "regime", "risk"];
  }

  return ["trend", "breakout", "volatility", "structure", "liquidity", "regime"];
}

function hashNumber(input: string) {
  return input.split("").reduce((sum, ch, i) => sum + ch.charCodeAt(0) * (i + 17), 0);
}

function confidenceForSignal(base: number, group: string, learningScore: number, seed: number) {
  const groupBoost: Record<string, number> = {
    trend: 4,
    breakout: 5,
    volatility: 3,
    structure: 4,
    liquidity: 2,
    regime: learningScore >= 35 ? 3 : -10,
    mean_reversion: 2,
    risk: learningScore >= 45 ? 1 : -8,
    pattern: 1,
  };

  const noise = (seed % 7) - 3;
  return Math.max(1, Math.min(96, Math.round(base + (groupBoost[group] || 0) + noise)));
}

export function scoreNexoraSignalLibraryCandidate(input: ScoreInput): NexoraSignalScoringResult {
  const blockedReasons: string[] = [];
  const preferredGroups = preferredGroupsForStrategy(input.strategy);

  const candidates = NEXORA_SIGNAL_LIBRARY_2000
    .filter((signal) => signal.enabled)
    .filter((signal) => signal.paperOnly)
    .filter((signal) => signal.symbol === input.symbol)
    .filter((signal) => signal.direction === input.direction || signal.direction === "neutral")
    .filter((signal) => preferredGroups.includes(signal.group));

  const selected: NexoraTradeSignal[] = [];
  const groupScores: GroupScore[] = [];

  for (const group of preferredGroups) {
    const groupSignals = candidates
      .filter((signal) => signal.group === group)
      .slice(0, 8);

    let agreeing = 0;
    let totalScore = 0;

    for (const item of groupSignals.slice(0, 2)) {
      const seed = hashNumber(`${item.id}:${input.symbol}:${input.strategy}:${input.direction}`);
      const signalConfidence = confidenceForSignal(input.confidence, item.group, input.learningScore, seed);
      const agrees =
        signalConfidence >= item.minConfidence &&
        item.direction !== "neutral" &&
        item.group !== "risk";

      if (agrees) agreeing += 1;
      totalScore += signalConfidence;

      selected.push({
        system: item.indicator,
        symbol: input.symbol,
        direction: agrees ? input.direction : "neutral",
        confidence: signalConfidence,
        strength: Math.max(1, Math.min(100, signalConfidence - 4)),
        risk:
          item.group === "risk"
            ? "high"
            : input.learningScore < 18
              ? "medium"
              : input.learningScore < 35
                ? "medium"
                : "low",
        reason: item.tradeUse,
        features: {
          signalId: item.id,
          group: item.group,
          timeframe: item.timeframe,
          regime: item.regime,
          confirmation: item.confirmation,
          paperOnly: true,
          learningScore: input.learningScore,
        },
      });
    }

    groupScores.push({
      group,
      score: groupSignals.length ? Math.round(totalScore / Math.max(1, Math.min(2, groupSignals.length))) : 0,
      agreeing,
      total: Math.min(2, groupSignals.length),
    });
  }

  const agreementCount = selected.filter(
    (signal) =>
      signal.direction === input.direction &&
      signal.confidence >= 55 &&
      signal.risk !== "high"
  ).length;

  const weightedConfidence = selected.length
    ? Math.round(selected.reduce((sum, signal) => sum + signal.confidence, 0) / selected.length)
    : input.confidence;

  const minimumAgreement = input.learningScore < 18 ? 3 : 6;

  if (agreementCount < minimumAgreement) {
    blockedReasons.push(`Only ${agreementCount} Nexora signal systems agree. Minimum is ${minimumAgreement}.`);
  }

  if (weightedConfidence < 72) {
    blockedReasons.push(`Nexora weighted signal confidence ${weightedConfidence} is below 72.`);
  }

  // Low learning score no longer hard-blocks paper trades.
  // It forces research-probe mode: fewer required agreements and tiny risk sizing in PolyEdge.
  if (input.learningScore < 18 && agreementCount >= 3) {
    // allowed as tiny paper research probe
  }

  return {
    signals: selected,
    groupScores,
    agreementCount,
    confidence: weightedConfidence,
    blockedReasons,
    reason: blockedReasons.length
      ? `Nexora 2000-signal scoring rejected setup: ${blockedReasons.join(" ")}`
      : `Nexora 2000-signal scoring approved setup with ${agreementCount} agreeing systems.`,
  };
}

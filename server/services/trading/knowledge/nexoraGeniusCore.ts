import type { NexoraTradeSignal } from "../nexoraTradeVotingEngine";

type GeniusInput = {
  symbol: string;
  strategy: string;
  direction: "long" | "short";
  confidence: number;
  learningScore: number;
  regime?: string;
  rewardRisk?: number;
  agreementCount?: number;
  profitFactor?: number | null;
  winRate?: number | null;
  pnl?: number | null;
};

export type NexoraGeniusEvaluation = {
  geniusSignals: NexoraTradeSignal[];
  geniusScore: number;
  blockedReasons: string[];
  warnings: string[];
  decisionMode: "monitor_only" | "research_probe" | "candidate_trade" | "promoted_trade";
  reason: string;
};

function clamp(n: number, min = 1, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function signal(input: {
  system: string;
  symbol: string;
  direction: "long" | "short" | "neutral";
  confidence: number;
  risk: "low" | "medium" | "high";
  reason: string;
  features?: Record<string, string | number | boolean | null>;
}): NexoraTradeSignal {
  return {
    system: input.system,
    symbol: input.symbol,
    direction: input.direction,
    confidence: clamp(input.confidence),
    strength: clamp(input.confidence - 4),
    risk: input.risk,
    reason: input.reason,
    features: input.features || {},
  };
}

export function evaluateNexoraGeniusCore(input: GeniusInput): NexoraGeniusEvaluation {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];
  const geniusSignals: NexoraTradeSignal[] = [];

  const learningScore = Number(input.learningScore || 0);
  const confidence = Number(input.confidence || 0);
  const rewardRisk = Number(input.rewardRisk || 0);
  const agreementCount = Number(input.agreementCount || 0);
  const profitFactor = typeof input.profitFactor === "number" ? input.profitFactor : null;
  const winRate = typeof input.winRate === "number" ? input.winRate : null;
  const pnl = typeof input.pnl === "number" ? input.pnl : null;

  let geniusScore = 50;

  // 1. Evidence-first reasoning.
  if (agreementCount >= 6) geniusScore += 12;
  else if (agreementCount >= 2) geniusScore += 3;
  else {
    geniusScore -= 15;
    blockedReasons.push("Genius Core: not enough independent evidence agrees.");
  }

  // 2. Reward/risk discipline.
  if (rewardRisk >= 1.8) geniusScore += 10;
  else if (rewardRisk >= 1.5) geniusScore += 5;
  else {
    geniusScore -= 14;
    blockedReasons.push("Genius Core: reward/risk is not strong enough.");
  }

  // 3. Learning maturity.
  if (learningScore >= 60) geniusScore += 14;
  else if (learningScore >= 35) geniusScore += 5;
  else {
    geniusScore -= 10;
    warnings.push("Genius Core: learning score is weak, research mode only.");
  }

  // 4. Profitability reality.
  if (profitFactor !== null) {
    if (profitFactor >= 1.5) geniusScore += 14;
    else if (profitFactor >= 1.1) geniusScore += 7;
    else {
      geniusScore -= 12;
      warnings.push("Genius Core: profit factor is weak.");
    }
  }

  if (pnl !== null && pnl < 0) {
    geniusScore -= 8;
    warnings.push("Genius Core: recent P&L is negative.");
  }

  if (winRate !== null) {
    if (winRate >= 60) geniusScore += 10;
    else if (winRate >= 50) geniusScore += 4;
    else geniusScore -= 6;
  }

  // 5. Regime awareness.
  if (input.regime === "risk_off") {
    geniusScore -= 10;
    warnings.push("Genius Core: risk-off regime detected.");
  }

  // 6. Symbol caution.
  if (input.symbol === "SOL/USD" && learningScore < 45) {
    geniusScore -= 8;
    warnings.push("Genius Core: SOL is high beta; keep micro-sized while learning is weak.");
  }

  if (input.symbol === "BTC/USD" && process.env.POLYEDGE_ALLOW_BTC_PAPER !== "true") {
    blockedReasons.push("Genius Core: BTC paper trading remains blocked by default.");
    geniusScore -= 25;
  }

  const finalScore = clamp(geniusScore);

  let decisionMode: NexoraGeniusEvaluation["decisionMode"] = "monitor_only";

  if (finalScore >= 80 && learningScore >= 55 && agreementCount >= 6) {
    decisionMode = "promoted_trade";
  } else if (finalScore >= 68 && learningScore >= 35 && agreementCount >= 6) {
    decisionMode = "candidate_trade";
  } else if (finalScore >= 45 && agreementCount >= 2) {
    decisionMode = "research_probe";
  } else {
    decisionMode = "monitor_only";
  }

  if (decisionMode === "monitor_only") {
    blockedReasons.push("Genius Core: monitor-only is safest until evidence improves.");
  }

  geniusSignals.push(signal({
    system: "genius_evidence_first_reasoning",
    symbol: input.symbol,
    direction: agreementCount >= 2 ? input.direction : "neutral",
    confidence: finalScore,
    risk: finalScore >= 70 ? "low" : finalScore >= 45 ? "medium" : "high",
    reason: "Nexora Genius Core checks evidence, agreement, learning, risk and profitability before action.",
    features: {
      geniusScore: finalScore,
      agreementCount,
      decisionMode,
      learningScore,
    },
  }));

  geniusSignals.push(signal({
    system: "genius_capital_preservation",
    symbol: input.symbol,
    direction: decisionMode === "monitor_only" ? "neutral" : input.direction,
    confidence: clamp(finalScore - 4),
    risk: decisionMode === "monitor_only" ? "high" : "medium",
    reason: "Capital preservation comes before trade frequency.",
    features: {
      decisionMode,
      rewardRisk,
      profitFactor,
      pnl,
    },
  }));

  geniusSignals.push(signal({
    system: "genius_self_audit",
    symbol: input.symbol,
    direction: warnings.length ? "neutral" : input.direction,
    confidence: clamp(finalScore - warnings.length * 3),
    risk: warnings.length >= 2 ? "high" : "medium",
    reason: warnings.length
      ? `Self-audit warnings: ${warnings.join(" ")}`
      : "Self-audit found no major warnings.",
    features: {
      warningCount: warnings.length,
      blockedCount: blockedReasons.length,
    },
  }));

  return {
    geniusSignals,
    geniusScore: finalScore,
    blockedReasons,
    warnings,
    decisionMode,
    reason:
      decisionMode === "monitor_only"
        ? `Genius Core chose monitor-only. Score ${finalScore}.`
        : `Genius Core selected ${decisionMode}. Score ${finalScore}.`,
  };
}

import {
  NEXORA_TRADE_APPROVAL_RULES,
  NEXORA_TRADE_SIGNAL_SYSTEMS,
} from "./nexoraTradeIntelligenceConfig";

export type NexoraTradeDirection = "long" | "short" | "neutral";

export type NexoraTradeSignal = {
  system: string;
  symbol: string;
  direction: NexoraTradeDirection;
  confidence: number;
  strength: number;
  risk: "low" | "medium" | "high";
  reason: string;
  features?: Record<string, number | string | boolean | null>;
};

export type NexoraTradeCandidate = {
  symbol: string;
  strategy: string;
  direction: Exclude<NexoraTradeDirection, "neutral">;
  confidence: number;
  rewardRisk: number;
  regime?: string;
  learningPairBlocked?: boolean;
  spreadRisk?: "low" | "medium" | "high";
  slippageRisk?: "low" | "medium" | "high";
  signals: NexoraTradeSignal[];
};

export type NexoraTradeVoteResult = {
  approved: boolean;
  paperOnly: true;
  symbol: string;
  strategy: string;
  direction: NexoraTradeDirection;
  confidence: number;
  agreementCount: number;
  rewardRisk: number;
  blockedReasons: string[];
  reason: string;
  signals: NexoraTradeSignal[];
};

export function voteNexoraTradeCandidate(candidate: NexoraTradeCandidate): NexoraTradeVoteResult {
  const blockedReasons: string[] = [];

  const enabledSystems = new Set(
    NEXORA_TRADE_SIGNAL_SYSTEMS
      .filter((system) => system.enabled)
      .map((system) => system.id)
  );

  let usableSignals = candidate.signals.filter((signal) => enabledSystems.has(signal.system));

  if (!usableSignals.length && candidate.signals.length) {
    usableSignals = candidate.signals;
  }

  const agreeingSignals = usableSignals.filter(
    (signal) =>
      signal.direction === candidate.direction &&
      signal.confidence >= 55 &&
      signal.risk !== "high"
  );

  const weightedConfidence = agreeingSignals.length
    ? Math.round(
        agreeingSignals.reduce((sum, signal) => {
          const system = NEXORA_TRADE_SIGNAL_SYSTEMS.find((s) => s.id === signal.system);
          return sum + signal.confidence * Number(system?.weight || 1);
        }, 0) /
          agreeingSignals.reduce((sum, signal) => {
            const system = NEXORA_TRADE_SIGNAL_SYSTEMS.find((s) => s.id === signal.system);
            return sum + Number(system?.weight || 1);
          }, 0)
      )
    : candidate.confidence;

  if (candidate.symbol === "BTC/USD" && process.env.POLYEDGE_ALLOW_BTC_PAPER !== "true") {
    blockedReasons.push("BTC/USD paper trading is blocked by default.");
  }

  if (
    candidate.learningPairBlocked &&
    NEXORA_TRADE_APPROVAL_RULES.blockIfLearningPairBlocked &&
    candidate.regime !== "risk_off" &&
    candidate.regime !== "cautious"
  ) {
    blockedReasons.push("Learning history has blocked this symbol/strategy pair.");
  }

  if (
    candidate.regime === "risk_off" &&
    NEXORA_TRADE_APPROVAL_RULES.blockIfRegimeRiskOff &&
    candidate.confidence < 70
  ) {
    blockedReasons.push("Market regime is risk-off.");
  }

  if (
    NEXORA_TRADE_APPROVAL_RULES.blockIfSpreadOrSlippageHigh &&
    (candidate.spreadRisk === "high" || candidate.slippageRisk === "high")
  ) {
    blockedReasons.push("Spread or slippage risk is too high.");
  }

  const minimumAgreement =
    candidate.regime === "risk_off" || candidate.regime === "cautious"
      ? 2
      : NEXORA_TRADE_APPROVAL_RULES.minAgreementCount;

  if (agreeingSignals.length < minimumAgreement) {
    blockedReasons.push(
      `Only ${agreeingSignals.length} signal systems agree. Minimum is ${minimumAgreement}.`
    );
  }

  if (weightedConfidence < NEXORA_TRADE_APPROVAL_RULES.minConfidence) {
    blockedReasons.push(
      `Weighted confidence ${weightedConfidence} is below ${NEXORA_TRADE_APPROVAL_RULES.minConfidence}.`
    );
  }

  if (candidate.rewardRisk < NEXORA_TRADE_APPROVAL_RULES.minRewardRisk) {
    blockedReasons.push(
      `Reward/risk ${candidate.rewardRisk} is below ${NEXORA_TRADE_APPROVAL_RULES.minRewardRisk}.`
    );
  }

  const approved = blockedReasons.length === 0;

  return {
    approved,
    paperOnly: true,
    symbol: candidate.symbol,
    strategy: candidate.strategy,
    direction: approved ? candidate.direction : "neutral",
    confidence: weightedConfidence,
    agreementCount: agreeingSignals.length,
    rewardRisk: candidate.rewardRisk,
    blockedReasons,
    reason: approved
      ? `Nexora approved ${candidate.direction} ${candidate.symbol} via ${agreeingSignals.length} agreeing systems.`
      : `Nexora rejected ${candidate.symbol} ${candidate.strategy}: ${blockedReasons.join(" ")}`,
    signals: usableSignals,
  };
}

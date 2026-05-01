import type { NexoraTradeSignal } from "../nexoraTradeVotingEngine";
import { getTeachingsForSetup } from "./nexoraBotTeachingRegistry";

type TeachingInput = {
  symbol: string;
  strategy: string;
  direction: "long" | "short";
  confidence: number;
  learningScore: number;
  profitFactor?: number | null;
  winRate?: number | null;
  pnl?: number | null;
  regime?: string;
  rewardRisk?: number;
  realCandleDataAvailable?: boolean;
};

export type NexoraTeachingEvaluation = {
  teachingSignals: NexoraTradeSignal[];
  blockedReasons: string[];
  riskMultiplier: number;
  confidenceAdjustment: number;
  monitorOnly: boolean;
  appliedTeachings: string[];
};

function clamp(n: number, min = 1, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function evaluateNexoraBotTeachings(input: TeachingInput): NexoraTeachingEvaluation {
  const teachings = getTeachingsForSetup(input.symbol, input.strategy);

  const blockedReasons: string[] = [];
  const teachingSignals: NexoraTradeSignal[] = [];
  const appliedTeachings: string[] = [];

  let riskMultiplier = 1;
  let confidenceAdjustment = 0;
  let monitorOnly = false;

  const weakLearning = input.learningScore < 35;
  const researchLearning = input.learningScore < 18;
  const badProfitFactor = typeof input.profitFactor === "number" && input.profitFactor < 0.8;
  const badPnl = typeof input.pnl === "number" && input.pnl < 0;
  const badRewardRisk = typeof input.rewardRisk === "number" && input.rewardRisk < 1.5;
  const riskOff = input.regime === "risk_off";

  for (const teaching of teachings) {
    appliedTeachings.push(teaching.id);

    let direction: "long" | "short" | "neutral" = input.direction;
    let signalConfidence = input.confidence;
    let risk: "low" | "medium" | "high" = "medium";
    let reason = teaching.lesson;

    if (teaching.id === "market_regime_recognition" && riskOff) {
      direction = "neutral";
      signalConfidence -= 12;
      risk = "high";
      riskMultiplier *= 0.35;
      reason = "Risk-off regime detected. Only monitor or tiny paper research probes should be allowed.";
    }

    if (teaching.id === "risk_management_before_entries" && badRewardRisk) {
      blockedReasons.push("Teaching rejected setup: reward/risk is below required threshold.");
      signalConfidence -= 15;
      risk = "high";
    }

    if (teaching.id === "profit_factor_over_win_rate" && (badProfitFactor || badPnl)) {
      confidenceAdjustment -= 8;
      riskMultiplier *= 0.5;
      reason = "Profit factor/P&L is weak. Do not promote this setup yet.";
    }

    if (teaching.id === "adaptive_position_sizing" && weakLearning) {
      riskMultiplier *= researchLearning ? 0.1 : 0.25;
      reason = "Weak learning detected. Use micro paper size only.";
    }

    if (teaching.id === "multi_signal_agreement") {
      signalConfidence += 3;
      reason = "Trade requires multi-signal agreement before approval.";
    }

    if (teaching.id === "trade_filtering_no_is_power" && weakLearning) {
      confidenceAdjustment -= 4;
      reason = "Weak setup quality. Nexora should reject more trades than it accepts.";
    }

    if (teaching.id === "historical_backtesting_required" && weakLearning) {
      riskMultiplier *= 0.5;
      reason = "Historical proof is not strong enough. Keep in research paper mode.";
    }

    if (teaching.id === "walk_forward_validation" && weakLearning) {
      confidenceAdjustment -= 3;
      reason = "Needs stronger recent validation before promotion.";
    }

    if (teaching.id === "real_candle_data_required" && input.realCandleDataAvailable === false) {
      confidenceAdjustment -= 6;
      riskMultiplier *= 0.6;
      reason = "Real candle data is missing or incomplete. Reduce confidence.";
    }

    if (teaching.id === "volatility_aware_stops" && badRewardRisk) {
      blockedReasons.push("Teaching rejected setup: volatility/reward-risk controls are not acceptable.");
      risk = "high";
    }

    if (teaching.id === "drawdown_control" && input.learningScore < 15) {
      monitorOnly = true;
      riskMultiplier = Math.min(riskMultiplier, 0.05);
      reason = "Learning score is deeply weak. Monitor-only or tiny research mode required.";
    }

    if (teaching.id === "symbol_personality") {
      if (input.symbol === "SOL/USD" && weakLearning) {
        direction = "neutral";
        risk = "high";
        riskMultiplier *= 0.25;
        reason = "SOL is high beta. Weak learning should reduce or block SOL exposure.";
      }

      if (input.symbol === "BTC/USD" && process.env.POLYEDGE_ALLOW_BTC_PAPER !== "true") {
        direction = "neutral";
        risk = "high";
        reason = "BTC is blocked by default during paper research.";
      }
    }

    if (teaching.id === "news_event_awareness" && riskOff) {
      riskMultiplier *= 0.5;
      reason = "Risk-off/event-style conditions require reduced exposure.";
    }

    if (teaching.id === "trade_journal_memory") {
      signalConfidence += 1;
      reason = "Decision should store teaching metadata for future learning.";
    }

    if (teaching.id === "promotion_blocking_system" && weakLearning) {
      riskMultiplier *= 0.5;
      reason = "Setup remains testing/blocked until promotion metrics improve.";
    }

    teachingSignals.push({
      system: `teaching_${teaching.id}`,
      symbol: input.symbol,
      direction,
      confidence: clamp(signalConfidence + confidenceAdjustment),
      strength: clamp(signalConfidence + confidenceAdjustment - 4),
      risk,
      reason,
      features: {
        teachingId: teaching.id,
        category: teaching.category,
        tradeImpact: teaching.tradeImpact,
        priority: teaching.priority,
        learningScore: input.learningScore,
        profitFactor: input.profitFactor ?? null,
        winRate: input.winRate ?? null,
        pnl: input.pnl ?? null,
        rewardRisk: input.rewardRisk ?? null,
        regime: input.regime ?? "unknown",
      },
    });
  }

  return {
    teachingSignals,
    blockedReasons,
    riskMultiplier: Math.max(0.01, Math.min(1, riskMultiplier)),
    confidenceAdjustment,
    monitorOnly,
    appliedTeachings,
  };
}

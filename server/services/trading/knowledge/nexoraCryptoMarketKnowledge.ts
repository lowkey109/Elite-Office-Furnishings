import type { NexoraTradeDirection, NexoraTradeSignal } from "../nexoraTradeVotingEngine";

type KnowledgeInput = {
  symbol: string;
  strategy: string;
  direction: Exclude<NexoraTradeDirection, "neutral">;
  confidence: number;
  learningScore: number;
  regime?: string;
};

function clamp(n: number, min = 1, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function signal(input: {
  system: string;
  symbol: string;
  direction: NexoraTradeDirection;
  confidence: number;
  strength?: number;
  risk?: "low" | "medium" | "high";
  reason: string;
  features?: Record<string, number | string | boolean | null>;
}): NexoraTradeSignal {
  return {
    system: input.system,
    symbol: input.symbol,
    direction: input.direction,
    confidence: clamp(input.confidence),
    strength: clamp(input.strength ?? input.confidence - 4),
    risk: input.risk ?? "medium",
    reason: input.reason,
    features: input.features || {},
  };
}

export function buildNexoraCryptoMarketKnowledgeSignals(input: KnowledgeInput): NexoraTradeSignal[] {
  const signals: NexoraTradeSignal[] = [];
  const base = clamp(input.confidence || 60);
  const lowLearning = input.learningScore < 35;
  const researchMode = input.learningScore < 18;
  const riskOff = input.regime === "risk_off" || researchMode;

  /**
   * Core crypto market knowledge.
   * These are not price predictions. They are safety/structure rules.
   */

  if (input.symbol === "BTC/USD") {
    signals.push(signal({
      system: "knowledge_btc_market_anchor",
      symbol: input.symbol,
      direction: riskOff ? "neutral" : input.direction,
      confidence: riskOff ? base - 12 : base + 4,
      risk: riskOff ? "high" : "medium",
      reason: "BTC is the crypto market anchor. During risk-off or weak learning, BTC paper entries require extra caution.",
      features: { assetRole: "crypto_market_anchor", riskOff, learningScore: input.learningScore },
    }));

    signals.push(signal({
      system: "knowledge_btc_volatility_control",
      symbol: input.symbol,
      direction: input.direction,
      confidence: base - 2,
      risk: "medium",
      reason: "BTC can move sharply; ATR-sized stops and strict max loss are required.",
      features: { requiresAtrStop: true, maxLossImportant: true },
    }));
  }

  if (input.symbol === "ETH/USD") {
    signals.push(signal({
      system: "knowledge_eth_beta_liquidity",
      symbol: input.symbol,
      direction: riskOff ? "neutral" : input.direction,
      confidence: riskOff ? base - 8 : base + 2,
      risk: riskOff ? "high" : "medium",
      reason: "ETH is liquid but often higher beta than BTC; trades need trend/liquidity confirmation.",
      features: { assetRole: "large_cap_crypto", needsLiquidityConfirmation: true },
    }));

    if (input.strategy === "volatility_squeeze") {
      signals.push(signal({
        system: "knowledge_eth_squeeze_requires_confirmation",
        symbol: input.symbol,
        direction: input.direction,
        confidence: base - 4,
        risk: "medium",
        reason: "ETH volatility squeeze needs volume and breakout confirmation to avoid fake moves.",
        features: { strategy: input.strategy, needsVolume: true, fakeoutRisk: true },
      }));
    }
  }

  if (input.symbol === "SOL/USD") {
    signals.push(signal({
      system: "knowledge_sol_high_beta",
      symbol: input.symbol,
      direction: lowLearning ? "neutral" : input.direction,
      confidence: lowLearning ? base - 15 : base,
      risk: lowLearning ? "high" : "medium",
      reason: "SOL is high beta and can whip faster than BTC/ETH; weak learning should reduce or block SOL exposure.",
      features: { assetRole: "high_beta_crypto", highBeta: true, learningScore: input.learningScore },
    }));

    signals.push(signal({
      system: "knowledge_sol_micro_size_only",
      symbol: input.symbol,
      direction: input.direction,
      confidence: base - 5,
      risk: "medium",
      reason: "SOL paper trades should stay micro-sized until profit factor improves.",
      features: { microSizePreferred: true },
    }));
  }

  if (input.symbol === "XAUUSD") {
    signals.push(signal({
      system: "knowledge_gold_risk_off_behavior",
      symbol: input.symbol,
      direction: input.direction,
      confidence: riskOff ? base + 2 : base,
      risk: "medium",
      reason: "Gold can behave differently from crypto in risk-off regimes; treat it as separate from BTC/ETH/SOL behavior.",
      features: { assetRole: "macro_safe_haven", separateRegimeModel: true },
    }));

    signals.push(signal({
      system: "knowledge_gold_stop_discipline",
      symbol: input.symbol,
      direction: input.direction,
      confidence: base - 2,
      risk: "medium",
      reason: "XAUUSD losses can be larger than small wins; require strict stop/target discipline.",
      features: { requiresStopDiscipline: true, profitFactorPriority: true },
    }));
  }

  /**
   * Strategy knowledge.
   */

  if (input.strategy === "momentum_breakout") {
    signals.push(signal({
      system: "knowledge_breakout_needs_volume",
      symbol: input.symbol,
      direction: input.direction,
      confidence: base + 2,
      risk: "medium",
      reason: "Momentum breakouts should require volume/liquidity confirmation and a clean structure break.",
      features: { needsVolume: true, needsStructureBreak: true },
    }));

    signals.push(signal({
      system: "knowledge_breakout_fakeout_filter",
      symbol: input.symbol,
      direction: input.direction,
      confidence: base - 2,
      risk: "medium",
      reason: "Breakouts without retest or volume are prone to fakeouts.",
      features: { fakeoutRisk: true, preferRetest: true },
    }));
  }

  if (input.strategy === "volatility_squeeze") {
    signals.push(signal({
      system: "knowledge_squeeze_needs_expansion",
      symbol: input.symbol,
      direction: input.direction,
      confidence: base,
      risk: "medium",
      reason: "Volatility squeeze should only trade after compression expands with confirmation.",
      features: { needsVolatilityExpansion: true },
    }));

    signals.push(signal({
      system: "knowledge_squeeze_false_breakout_risk",
      symbol: input.symbol,
      direction: input.direction,
      confidence: base - 5,
      risk: "medium",
      reason: "Squeeze setups often produce false breakouts; avoid if learning history is weak.",
      features: { falseBreakoutRisk: true, learningScore: input.learningScore },
    }));
  }

  if (input.strategy === "trend_follow") {
    signals.push(signal({
      system: "knowledge_trend_follow_requires_regime",
      symbol: input.symbol,
      direction: riskOff ? "neutral" : input.direction,
      confidence: riskOff ? base - 10 : base + 3,
      risk: riskOff ? "high" : "medium",
      reason: "Trend-following should only run when regime supports directional continuation.",
      features: { requiresTrendRegime: true },
    }));
  }

  if (input.strategy === "mean_reversion") {
    signals.push(signal({
      system: "knowledge_mean_reversion_requires_range",
      symbol: input.symbol,
      direction: input.direction,
      confidence: base - 1,
      risk: "medium",
      reason: "Mean reversion works best in range regimes and should avoid strong trend continuation.",
      features: { requiresRangeRegime: true },
    }));
  }

  /**
   * Universal trading knowledge.
   */

  signals.push(signal({
    system: "knowledge_profit_factor_over_winrate",
    symbol: input.symbol,
    direction: input.direction,
    confidence: base,
    risk: "medium",
    reason: "Profit factor and loss size matter more than headline win rate.",
    features: { profitFactorPriority: true },
  }));

  signals.push(signal({
    system: "knowledge_reward_risk_required",
    symbol: input.symbol,
    direction: input.direction,
    confidence: base + 1,
    risk: "medium",
    reason: "Only approve trades with acceptable reward/risk and defined stop/target.",
    features: { minRewardRisk: 1.5, requiresStop: true, requiresTarget: true },
  }));

  signals.push(signal({
    system: "knowledge_low_learning_micro_only",
    symbol: input.symbol,
    direction: researchMode ? input.direction : input.direction,
    confidence: researchMode ? base - 4 : base,
    risk: researchMode ? "medium" : "low",
    reason: "When learning score is low, only tiny paper research probes are allowed.",
    features: { researchMode, microSizeOnly: researchMode },
  }));

  if (riskOff) {
    signals.push(signal({
      system: "knowledge_risk_off_reduction",
      symbol: input.symbol,
      direction: "neutral",
      confidence: base - 10,
      risk: "high",
      reason: "Risk-off conditions reduce approval strength. Monitor or micro-probe only.",
      features: { riskOff: true, reduceRisk: true },
    }));
  }

  return signals;
}

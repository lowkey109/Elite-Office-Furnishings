// server/services/trading/copyability-engine.ts

import type { WalletAction } from "./types/trading-types";

export type CopyabilityAssessment = {
  shouldCopy: boolean;
  score: number;
  reason: string;
};

export function assessCopyability(action: WalletAction): CopyabilityAssessment {
  let score = 0;

  if (action.confidence) {
    score += action.confidence * 40;
  }

  if (action.estimatedUsdValue && action.estimatedUsdValue > 50) {
    score += 20;
  } else {
    return {
      shouldCopy: false,
      score: 10,
      reason: "trade_too_small",
    };
  }

  if (action.actionType === "BUY_OPEN") {
    score += 20;
  } else if (action.actionType === "SELL_CLOSE") {
    score += 10;
  }

  if (!action.tokenOut && !action.tokenIn) {
    return {
      shouldCopy: false,
      score: 0,
      reason: "invalid_token_data",
    };
  }

  score = Math.min(100, Math.max(0, score));

  const shouldCopy = score >= 50;

  return {
    shouldCopy,
    score,
    reason: shouldCopy ? "approved" : "low_score",
  };
}

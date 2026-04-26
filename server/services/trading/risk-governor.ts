// server/services/trading/risk-governor.ts

import { getOpenPositions } from "./paperEngine";
import { getWalletPerformance } from "./wallet-ledger";

export type RiskDecision = {
  allowed: boolean;
  reason?: string;
};

const MAX_OPEN_POSITIONS = 10;
const MAX_PER_TOKEN_EXPOSURE = 0.3; // 30%
const MAX_PER_WALLET_EXPOSURE = 0.4; // 40%
const MAX_LOSS_STREAK = 3;

function calculateTokenExposure(symbol: string, positions: any[]) {
  const total = positions.reduce((sum, p) => sum + p.paperCapitalAllocated, 0);
  const token = positions
    .filter((p) => p.symbol === symbol)
    .reduce((sum, p) => sum + p.paperCapitalAllocated, 0);

  return total === 0 ? 0 : token / total;
}

function calculateWalletLossStreak(walletId: string) {
  const perf = getWalletPerformance(walletId);

  // simple proxy: if win rate is low + enough trades
  if (perf.tradeCount < 3) return 0;

  if (perf.winRate < 0.3) return 3;
  if (perf.winRate < 0.5) return 2;

  return 0;
}

export async function evaluateRisk(params: {
  walletId: string;
  symbol: string;
  notionalUsd: number;
}): Promise<RiskDecision> {
  const positions = await getOpenPositions();

  // 1. Global position cap
  if (positions.length >= MAX_OPEN_POSITIONS) {
    return { allowed: false, reason: "max_positions_reached" };
  }

  // 2. Token concentration
  const tokenExposure = calculateTokenExposure(params.symbol, positions);
  if (tokenExposure > MAX_PER_TOKEN_EXPOSURE) {
    return { allowed: false, reason: "token_overexposed" };
  }

  // 3. Wallet risk (loss streak)
  const lossStreak = calculateWalletLossStreak(params.walletId);
  if (lossStreak >= MAX_LOSS_STREAK) {
    return { allowed: false, reason: "wallet_loss_streak" };
  }

  // 4. Position size sanity
  if (params.notionalUsd <= 0) {
    return { allowed: false, reason: "invalid_notional" };
  }

  if (params.notionalUsd > 10000) {
    return { allowed: false, reason: "position_too_large" };
  }

  return { allowed: true };
}


/**
 * Read-only risk governor state for Admin Trading Monitor.
 * Does not approve trades or mutate risk state.
 */
export function getRiskGovernorState() {
  return {
    status: "available",
    mode: "read_only",
    message: "Risk governor is installed and ready to evaluate trade risk.",
    liveTradingEnabled: false,
    paperMode: true,
    approvalRequired: false,
    availableExports: ["evaluateRisk", "getRiskGovernorState"],
    lastCheckedAt: new Date().toISOString(),
  };
}

export const getRiskState = getRiskGovernorState;
export const getRiskSnapshot = getRiskGovernorState;

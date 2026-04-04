// server/services/trading/types/trading-types.ts

export type Chain = "solana";

export type ActionType =
  | "BUY_OPEN"
  | "BUY_ADD"
  | "SELL_TRIM"
  | "SELL_CLOSE"
  | "ROTATE"
  | "NOISE";

export interface TrackedWallet {
  id: string;
  chain: Chain;
  address: string;
  label?: string;
  isActive: boolean;
  walletQualityScore: number;
  copyabilityScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletAction {
  id: string;
  walletId: string;
  chain: Chain;
  txHash: string;
  detectedAt: Date;

  actionType: ActionType;

  tokenIn?: string;
  tokenOut?: string;

  amountIn?: number;
  amountOut?: number;

  estimatedUsdValue?: number;

  confidence: number;
}

export interface WalletScore {
  walletId: string;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  consistencyScore: number;
  walletQualityScore: number;
}

export interface CopyDecision {
  walletId: string;
  txHash: string;

  shouldCopy: boolean;
  reason?: string;

  copyabilityScore: number;
  estimatedSlippageBps: number;
  estimatedLiquidityUsd: number;
}

export interface MirrorTrade {
  id: string;
  walletId: string;
  sourceTxHash: string;

  token: string;
  side: "BUY" | "SELL";

  detectedAt: Date;
  executedAt?: Date;

  sourcePrice?: number;
  copiedPrice?: number;

  slippageBps?: number;

  notionalUsd: number;

  status: "OPEN" | "CLOSED" | "SKIPPED";

  realizedPnl?: number;
  sourceRealizedPnl?: number;
}

export interface RiskLimits {
  maxDailyLossUsd: number;
  maxOpenPositions: number;
  maxPerWalletBps: number;
  maxPerTokenBps: number;
  minLiquidityUsd: number;
  maxSlippageBps: number;
}

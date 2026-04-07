export type TradingSystemState = {
  id: string;
  paperCapital: number;
  currentCapital?: number;
  peakCapital?: number;
  totalPnl?: number;
  totalDecisions: number;
  totalTrades: number;
  isRunning: boolean;
  lastDecisionAt: Date | null;
  lastMonitorAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type TradeOutcome = {
  id: string;
  linkedDecisionId: string;
  linkedPositionId: string;
  symbol: string;
  strategy: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  rawPnl?: number;
  adjustedPnl?: number;
  duration: string;
  slippage?: number;
  outcome?: "win" | "loss";
  timestamp?: string;
  exitReason?: string;
  paperCapitalReturned?: number;
  fees?: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type Chain = "ethereum" | "solana" | "polygon" | "base" | "arbitrum";

export type TrackedWallet = {
  id: string;
  address: string;
  chain: Chain;
  label?: string;
  isActive: boolean;
  walletQualityScore?: number;
  copyabilityScore?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WalletAction = {
  id?: string;
  wallet: string;
  walletId?: string;
  chain?: Chain;
  actionType: "BUY_OPEN" | "SELL_CLOSE" | "BUY_ADD";
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: number;
  amountOut?: number;
  estimatedUsdValue?: number;
  confidence?: number;
  txHash?: string;
  timestamp?: number;
  detectedAt?: Date;
};

export type MirrorTrade = {
  id?: string;
  wallet?: string;
  walletId?: string;
  symbol?: string;
  token?: string;
  side?: "buy" | "sell";
  direction?: "long" | "short";
  size?: number;
  notionalUsd?: number;
  realizedPnl?: number;
  timestamp?: number;
};

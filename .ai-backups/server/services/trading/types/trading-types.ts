export type TradingSystemState = {
  id: string;
  paperCapital: number;
  currentCapital: number;
  peakCapital: number;
  totalPnl: number;
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
  rawPnl: number;
  adjustedPnl: number;
  duration: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type WalletAction = {
  wallet: string;
  actionType: "BUY_OPEN" | "SELL_CLOSE";
  tokenIn?: string;
  tokenOut?: string;
  estimatedUsdValue?: number;
  confidence?: number;
};

export type MirrorTrade = {
  wallet: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  timestamp: number;
};

export type Chain = "ethereum" | "solana" | "polygon";

export type TrackedWallet = {
  address: string;
  chain: Chain;
  score?: number;
};

export interface TradingMonitorState {
  mode: string;
  currentRegime: string;
  lastDecisionTime: string;
  totalTrades: number;
  winRate: number;
  currentDrawdown: number;
  openPositionsCount: number;
  bestStrategy: string;
  dataQualityScore: number;
}

export interface TradingDecision {
  id: string;
  timestamp: string;
  market: string;
  strategy: string;
  direction: "long" | "short";
  confidence: number;
  thesis: string;
  regime: string;
  volumeRatio: number | null;
  reasonCode: string;
  status: string;
  expectedMove: number | null;
  expectedCost: number | null;
  invalidationRule: string;
  riskBucket: string;
  dataQualityScore: number;
  slippageEstimate: number | null;
  modelVersion: string;
  fullPayload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  decisionSource: string;
  executionStatus: "pending" | "entered" | "filled" | "rejected" | "expired";
  confidenceThreshold: number;
  riskAmount: number | null;
  paperCapitalImpact: number | null;
  linkedPositionId: string | null;
  sourceMarketSnapshotId: string | null;
  sourceNewsIds: string[];
  strategyVersion: string;
  decisionGeneratedAt: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  stopPrice: number;
  duration: string;
  status: string;
  linkedDecisionId: string;
  paperCapitalAllocated: number;
  entryTimestamp: string;
  targetPrice: number | null;
}

export interface TradeOutcome {
  id: string;
  symbol: string;
  strategy: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  duration: string;
  slippage: number;
  outcome: "win" | "loss";
  timestamp: string;
  linkedDecisionId: string;
  linkedPositionId: string;
  exitReason: string;
  paperCapitalReturned: number;
  fees: number;
}

export interface TradingPerformance {
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdown: number;
  totalPnl: number;
  pnlSeries: { date: string; value: number }[];
}

export interface NewsItem {
  id: string;
  timestamp: string;
  headline: string;
  source: string;
  sentiment: "bullish" | "bearish" | "neutral";
  relevance: number;
  markets: string[];
  summary: string;
  impact: "high" | "medium" | "low";
  sourceUrl: string | null;
  linkedDecisionIds: string[];
}

export interface MarketContext {
  symbol: string;
  price: number;
  change24h: number;
  changePct24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  regime: string;
  dominantTrend: string;
  volatilityLevel: string;
  keyLevels: { support: number[]; resistance: number[] };
  technicals: {
    rsi14: number;
    macd: { value: number; signal: number; histogram: number };
    ema20: number;
    ema50: number;
    ema200: number;
    bbUpper: number;
    bbLower: number;
    bbWidth: number;
    atr14: number;
    adx: number;
    obv: string;
    vwap: number;
    stochRsi: number;
    williamsR: number;
    cci: number;
    mfi: number;
  };
  fundingRate: number | null;
  openInterest: number | null;
  fearGreedIndex: number | null;
  snapshotId: string;
  lastUpdated: string;
  dataSource: string;
  isStale: boolean;
}

export interface StrategyProfile {
  name: string;
  description: string;
  edge: string;
  idealRegime: string;
  winRate: number;
  avgRR: number;
  avgHoldTime: string;
  riskPerTrade: string;
  entryRules: string[];
  exitRules: string[];
  invalidationRules: string[];
  strengths: string[];
  weaknesses: string[];
  version: string;
  isActive: boolean;
  powersDecisions: boolean;
  ruleSource: string;
  lastUsedAt: string | null;
}

export interface NewsAdapterStatus {
  available: boolean;
  source: string;
  lastFetched: string | null;
  error: string | null;
}

export interface FeedStatus {
  loopRunning: boolean;
  lastFastCycle: string | null;
  lastDetailedCycle: string | null;
  cycleErrors: number;
  liveSymbols: string[];
  unavailableSymbols: string[];
}

export interface TradingMonitorResponse {
  state: TradingMonitorState;
  decisions: TradingDecision[];
  positions: OpenPosition[];
  recent_outcomes: TradeOutcome[];
  performance: TradingPerformance;
  news: NewsItem[];
  marketContext: MarketContext[];
  strategies: StrategyProfile[];
  dataMode: "simulation" | "paper" | "live";
  lastRefreshed: string;
  feedStatus?: FeedStatus;
  newsStatus?: NewsAdapterStatus;
}

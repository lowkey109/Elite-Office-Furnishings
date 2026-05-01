export type NexoraSignalGroup =
  | "trend"
  | "breakout"
  | "mean_reversion"
  | "structure"
  | "risk"
  | "regime";

export type NexoraSignalSystem = {
  id: string;
  label: string;
  group: NexoraSignalGroup;
  enabled: boolean;
  weight: number;
  description: string;
  tradeUse: string;
};

export const NEXORA_TRADE_SIGNAL_SYSTEMS: NexoraSignalSystem[] = [
  {
    id: "ema_trend_filter",
    label: "EMA Trend Filter",
    group: "trend",
    enabled: true,
    weight: 1.2,
    description: "Checks fast/slow EMA alignment and trend slope.",
    tradeUse: "Only trade long with uptrend or short with downtrend.",
  },
  {
    id: "macd_momentum",
    label: "MACD Momentum",
    group: "trend",
    enabled: true,
    weight: 1.1,
    description: "Checks MACD direction, crossover and histogram strength.",
    tradeUse: "Confirm momentum before breakout or trend-follow trades.",
  },
  {
    id: "adx_trend_strength",
    label: "ADX Trend Strength",
    group: "trend",
    enabled: true,
    weight: 1.1,
    description: "Measures whether the market is trending or chopping.",
    tradeUse: "Avoid trend trades when trend strength is weak.",
  },
  {
    id: "donchian_breakout",
    label: "Donchian Channel Breakout",
    group: "breakout",
    enabled: true,
    weight: 1.0,
    description: "Detects breakouts above recent highs or below recent lows.",
    tradeUse: "Confirm real structure breakouts.",
  },
  {
    id: "bollinger_squeeze",
    label: "Bollinger Squeeze",
    group: "breakout",
    enabled: true,
    weight: 1.2,
    description: "Detects volatility compression and breakout expansion.",
    tradeUse: "Improve volatility_squeeze entries and reduce fakeouts.",
  },
  {
    id: "volume_confirmation",
    label: "Volume Confirmation",
    group: "breakout",
    enabled: true,
    weight: 1.2,
    description: "Requires breakout volume to be stronger than normal.",
    tradeUse: "Block weak low-volume breakouts.",
  },
  {
    id: "rsi_filter",
    label: "RSI Filter",
    group: "mean_reversion",
    enabled: true,
    weight: 1.0,
    description: "Detects overbought/oversold conditions.",
    tradeUse: "Avoid buying overbought or shorting oversold markets.",
  },
  {
    id: "vwap_deviation",
    label: "VWAP Deviation",
    group: "mean_reversion",
    enabled: true,
    weight: 0.9,
    description: "Checks distance from fair intraday value.",
    tradeUse: "Avoid chasing price too far from VWAP.",
  },
  {
    id: "bollinger_reversion",
    label: "Bollinger Reversion",
    group: "mean_reversion",
    enabled: true,
    weight: 0.9,
    description: "Detects price stretch outside volatility bands.",
    tradeUse: "Find controlled mean-reversion setups.",
  },
  {
    id: "support_resistance",
    label: "Support / Resistance Scanner",
    group: "structure",
    enabled: true,
    weight: 1.2,
    description: "Finds recent swing highs/lows and reaction zones.",
    tradeUse: "Avoid entering directly into support or resistance.",
  },
  {
    id: "fibonacci_structure",
    label: "Fibonacci Retracement / Extension",
    group: "structure",
    enabled: true,
    weight: 0.8,
    description: "Checks retracement and extension zones.",
    tradeUse: "Support pullback entries and target planning.",
  },
  {
    id: "elliott_wave_confirmation",
    label: "Elliott Wave Confirmation",
    group: "structure",
    enabled: true,
    weight: 0.6,
    description: "Attempts to classify impulse/correction structure.",
    tradeUse: "Confirmation only. Never opens trades alone.",
  },
  {
    id: "liquidity_sweep",
    label: "Liquidity Sweep / Stop-Hunt Scanner",
    group: "risk",
    enabled: true,
    weight: 1.1,
    description: "Detects fake breakouts and stop-hunt reversals.",
    tradeUse: "Avoid entering directly into liquidity traps.",
  },
  {
    id: "market_regime",
    label: "Market Regime Classifier",
    group: "regime",
    enabled: true,
    weight: 1.4,
    description: "Classifies trend/range/risk-on/risk-off/high volatility.",
    tradeUse: "Only run strategies suited to the current regime.",
  },
  {
    id: "news_event_risk",
    label: "News / Event Risk Filter",
    group: "risk",
    enabled: true,
    weight: 1.3,
    description: "Reduces or blocks trading around high-risk news windows.",
    tradeUse: "Protect paper and future live capital from event whipsaws.",
  },
];

export const NEXORA_TRADE_PROMOTION_RULES = {
  testing: {
    minTrades: 0,
    maxRiskMultiplier: 0.1,
    description: "Tiny paper size only. Used for new or unproven setups.",
  },
  candidate: {
    minTrades: 50,
    minWinRate: 48,
    minProfitFactor: 0.9,
    maxRiskMultiplier: 0.25,
    description: "Setup is improving but not trusted yet.",
  },
  promoted: {
    minTrades: 100,
    minWinRate: 55,
    minProfitFactor: 1.2,
    requirePositivePnl: true,
    maxRiskMultiplier: 0.6,
    description: "Setup has proven positive paper edge.",
  },
  elite: {
    minTrades: 300,
    minWinRate: 60,
    minProfitFactor: 1.5,
    requirePositivePnl: true,
    maxRiskMultiplier: 1,
    description: "Setup is strong over a large sample.",
  },
};

export const NEXORA_TRADE_APPROVAL_RULES = {
  paperOnly: true,
  minAgreementCount: 6,
  minConfidence: 72,
  minRewardRisk: 1.5,
  blockIfRegimeRiskOff: true,
  blockIfLearningPairBlocked: true,
  blockIfSpreadOrSlippageHigh: true,
  btcPaperAllowedByDefault: false,
};

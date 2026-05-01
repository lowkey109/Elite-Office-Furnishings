import { NEXORA_ADVANCED_PROFESSOR_TEACHINGS } from "./nexoraAdvancedProfessorTeachingRegistry";

export type NexoraTeachingCategory =
  | "regime"
  | "risk"
  | "profitability"
  | "position_sizing"
  | "signal_agreement"
  | "trade_filtering"
  | "backtesting"
  | "validation"
  | "market_data"
  | "volatility"
  | "drawdown"
  | "symbol_behavior"
  | "news"
  | "journal"
  | "promotion";

export type NexoraBotTeaching = {
  id: string;
  title: string;
  category: NexoraTeachingCategory;
  enabled: boolean;
  priority: number;
  lesson: string;
  rule: string;
  tradeImpact:
    | "approve_boost"
    | "reject_if_failed"
    | "risk_reduce"
    | "size_reduce"
    | "monitor_only"
    | "promotion_control";
  appliesToStrategies: string[];
  appliesToSymbols: string[];
};

export const NEXORA_BOT_TEACHINGS: NexoraBotTeaching[] = [
  {
    id: "market_regime_recognition",
    title: "Market Regime Recognition",
    category: "regime",
    enabled: true,
    priority: 100,
    lesson: "Strategies must match the current market regime: trend, range, risk-on, risk-off, high volatility or low volatility.",
    rule: "Reject or reduce trades when the strategy does not match the regime.",
    tradeImpact: "reject_if_failed",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "risk_management_before_entries",
    title: "Risk Management Before Entries",
    category: "risk",
    enabled: true,
    priority: 100,
    lesson: "No trade should open without known stop, target, max loss and reward/risk.",
    rule: "Reject trades without valid risk controls.",
    tradeImpact: "reject_if_failed",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "profit_factor_over_win_rate",
    title: "Profit Factor Over Win Rate",
    category: "profitability",
    enabled: true,
    priority: 98,
    lesson: "Win rate alone is not enough. Profit factor, average loss and total P&L matter more.",
    rule: "Do not promote setups unless profit factor and P&L improve.",
    tradeImpact: "promotion_control",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "adaptive_position_sizing",
    title: "Adaptive Position Sizing",
    category: "position_sizing",
    enabled: true,
    priority: 95,
    lesson: "Weak setups should use tiny paper size. Strong promoted setups can use larger paper size.",
    rule: "Reduce size when learning score, confidence or profit factor are weak.",
    tradeImpact: "size_reduce",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "multi_signal_agreement",
    title: "Multi-Signal Agreement",
    category: "signal_agreement",
    enabled: true,
    priority: 100,
    lesson: "No single signal should open a trade. Multiple independent systems must agree.",
    rule: "Require signal agreement before approval. Research mode can use fewer votes with tiny size.",
    tradeImpact: "reject_if_failed",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "trade_filtering_no_is_power",
    title: "Trade Filtering: No Is Power",
    category: "trade_filtering",
    enabled: true,
    priority: 97,
    lesson: "Good bots reject more trades than they take.",
    rule: "Reject low-volume, high-slippage, bad-regime, blocked-pair and poor-structure trades.",
    tradeImpact: "reject_if_failed",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "historical_backtesting_required",
    title: "Backtesting Required",
    category: "backtesting",
    enabled: true,
    priority: 90,
    lesson: "Before trusting a setup, check if similar setups worked historically.",
    rule: "Promote only after positive historical and paper-trade evidence.",
    tradeImpact: "promotion_control",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "walk_forward_validation",
    title: "Walk-Forward Validation",
    category: "validation",
    enabled: true,
    priority: 88,
    lesson: "A setup must work on newer data, not only old training data.",
    rule: "Promote only if both training and recent validation windows are acceptable.",
    tradeImpact: "promotion_control",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "real_candle_data_required",
    title: "Real Candle Data Required",
    category: "market_data",
    enabled: true,
    priority: 96,
    lesson: "Signals are stronger when calculated from real OHLCV candles, not synthetic marks.",
    rule: "Reduce confidence when real candle data is missing.",
    tradeImpact: "risk_reduce",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "volatility_aware_stops",
    title: "Volatility-Aware Stops",
    category: "volatility",
    enabled: true,
    priority: 98,
    lesson: "Stops and targets should adapt to volatility. ATR-style stops protect against oversized losses.",
    rule: "Reject or reduce trades when stop distance and volatility are not aligned.",
    tradeImpact: "risk_reduce",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "drawdown_control",
    title: "Drawdown Control",
    category: "drawdown",
    enabled: true,
    priority: 100,
    lesson: "After losing streaks or drawdown, reduce size or pause.",
    rule: "Enter monitor-only mode when loss limits, losing streaks or drawdown thresholds are hit.",
    tradeImpact: "monitor_only",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "symbol_personality",
    title: "Symbol Personality",
    category: "symbol_behavior",
    enabled: true,
    priority: 92,
    lesson: "BTC, ETH, SOL and XAUUSD behave differently and should not be treated the same.",
    rule: "Apply symbol-specific risk and approval rules.",
    tradeImpact: "risk_reduce",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "news_event_awareness",
    title: "News and Event Awareness",
    category: "news",
    enabled: true,
    priority: 90,
    lesson: "Major news can invalidate technical setups.",
    rule: "Reduce or block trades during high-risk event windows.",
    tradeImpact: "risk_reduce",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "trade_journal_memory",
    title: "Trade Journal Memory",
    category: "journal",
    enabled: true,
    priority: 94,
    lesson: "Every trade should store why it happened, what agreed, what blocked and how it exited.",
    rule: "Attach teaching, signal, regime and risk metadata to every decision payload.",
    tradeImpact: "promotion_control",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
  {
    id: "promotion_blocking_system",
    title: "Promotion and Blocking System",
    category: "promotion",
    enabled: true,
    priority: 100,
    lesson: "Setups move through blocked, testing, candidate, promoted and elite states.",
    rule: "Only promoted or elite setups can use larger paper risk. Block weak setups.",
    tradeImpact: "promotion_control",
    appliesToStrategies: ["momentum_breakout", "volatility_squeeze", "trend_follow", "mean_reversion"],
    appliesToSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"],
  },
];

export function getEnabledNexoraTeachings() {
  return [...NEXORA_BOT_TEACHINGS, ...NEXORA_ADVANCED_PROFESSOR_TEACHINGS]
    .filter((teaching) => teaching.enabled)
    .sort((a, b) => b.priority - a.priority);
}

export function getTeachingsForSetup(symbol: string, strategy: string) {
  return getEnabledNexoraTeachings().filter(
    (teaching) =>
      teaching.appliesToSymbols.includes(symbol) &&
      teaching.appliesToStrategies.includes(strategy)
  );
}

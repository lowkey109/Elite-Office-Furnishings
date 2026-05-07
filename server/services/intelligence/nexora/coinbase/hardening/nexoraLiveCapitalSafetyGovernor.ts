type KillReason =
  | "daily_loss_limit"
  | "max_drawdown"
  | "duplicate_order_risk"
  | "exchange_unreachable"
  | "stale_market_data"
  | "spread_too_wide"
  | "volatility_halt"
  | "manual_lock";

export interface LiveGovernorState {
  liveTradingEnabled: boolean;
  emergencyHalt: boolean;
  haltReason: KillReason | null;

  maxDailyLossUsd: number;
  maxDrawdownPercent: number;
  maxOpenPositions: number;
  maxSinglePositionUsd: number;

  spreadLimitPercent: number;
  stalePriceSeconds: number;

  currentDailyPnlUsd: number;
  currentDrawdownPercent: number;

  lastMarketHeartbeat: number;
  lastExchangeHeartbeat: number;

  duplicateOrderWindowMs: number;
}

const state: LiveGovernorState = {
  liveTradingEnabled: false,
  emergencyHalt: false,
  haltReason: null,

  maxDailyLossUsd: 250,
  maxDrawdownPercent: 8,
  maxOpenPositions: 3,
  maxSinglePositionUsd: 150,

  spreadLimitPercent: 1.5,
  stalePriceSeconds: 20,

  currentDailyPnlUsd: 0,
  currentDrawdownPercent: 0,

  lastMarketHeartbeat: Date.now(),
  lastExchangeHeartbeat: Date.now(),

  duplicateOrderWindowMs: 15000,
};

export function getLiveCapitalGovernorState() {
  return {
    ok: true,
    governor: state,
  };
}

export function heartbeatMarketData() {
  state.lastMarketHeartbeat = Date.now();
}

export function heartbeatExchange() {
  state.lastExchangeHeartbeat = Date.now();
}

export function haltLiveTrading(reason: KillReason) {
  state.emergencyHalt = true;
  state.haltReason = reason;
}

export function releaseLiveTradingHalt() {
  state.emergencyHalt = false;
  state.haltReason = null;
}

export function updateLivePnL(input: {
  dailyPnlUsd?: number;
  drawdownPercent?: number;
}) {
  if (typeof input.dailyPnlUsd === "number") {
    state.currentDailyPnlUsd = input.dailyPnlUsd;
  }

  if (typeof input.drawdownPercent === "number") {
    state.currentDrawdownPercent = input.drawdownPercent;
  }

  if (state.currentDailyPnlUsd <= -Math.abs(state.maxDailyLossUsd)) {
    haltLiveTrading("daily_loss_limit");
  }

  if (state.currentDrawdownPercent >= state.maxDrawdownPercent) {
    haltLiveTrading("max_drawdown");
  }
}

export function validateLiveTradingAllowed() {
  const now = Date.now();

  if (!state.liveTradingEnabled) {
    return {
      allowed: false,
      reason: "live_trading_disabled",
    };
  }

  if (state.emergencyHalt) {
    return {
      allowed: false,
      reason: state.haltReason || "emergency_halt",
    };
  }

  const marketAge =
    (now - state.lastMarketHeartbeat) / 1000;

  if (marketAge > state.stalePriceSeconds) {
    haltLiveTrading("stale_market_data");

    return {
      allowed: false,
      reason: "stale_market_data",
    };
  }

  const exchangeAge =
    (now - state.lastExchangeHeartbeat) / 1000;

  if (exchangeAge > state.stalePriceSeconds) {
    haltLiveTrading("exchange_unreachable");

    return {
      allowed: false,
      reason: "exchange_unreachable",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

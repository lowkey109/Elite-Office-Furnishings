import fs from "fs";
import path from "path";
import crypto from "crypto";

export type BinancePaperSide = "BUY" | "SELL";
export type BinancePaperStatus = "OPEN" | "CLOSED";
export type BinanceStrategyName = "trend_follow" | "breakout" | "rsi_reversal" | "volatility_guard";

export type BinancePaperTrade = {
  id: string;
  createdAt: string;
  closedAt?: string;
  symbol: string;
  side: BinancePaperSide;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  notional: number;
  pnl?: number;
  pnlPct?: number;
  status: BinancePaperStatus;
  strategy: BinanceStrategyName | "manual";
  reason: string;
  stopLossPct: number;
  takeProfitPct: number;
};

export type BinancePaperState = {
  generatedAt: string;
  wallet: {
    startingUsdt: number;
    usdt: number;
    reservedUsdt: number;
    realisedPnl: number;
    equity: number;
  };
  risk: {
    maxTradeUsdt: number;
    maxDailyLossUsdt: number;
    stopLossPct: number;
    takeProfitPct: number;
    minConfidence: number;
    liveTradingEnabled: false;
  };
  trades: BinancePaperTrade[];
  strategyStats: Record<string, {
    runs: number;
    opened: number;
    closed: number;
    wins: number;
    losses: number;
    realisedPnl: number;
  }>;
};

const DATA_FILE = path.join(process.cwd(), "data/nexora/binance-paper-learning-state.json");

function now() {
  return new Date().toISOString();
}

function defaultState(): BinancePaperState {
  return {
    generatedAt: now(),
    wallet: {
      startingUsdt: Number(process.env.BINANCE_PAPER_STARTING_USDT || 10000),
      usdt: Number(process.env.BINANCE_PAPER_STARTING_USDT || 10000),
      reservedUsdt: 0,
      realisedPnl: 0,
      equity: Number(process.env.BINANCE_PAPER_STARTING_USDT || 10000),
    },
    risk: {
      maxTradeUsdt: Number(process.env.BINANCE_PAPER_MAX_TRADE_USDT || 250),
      maxDailyLossUsdt: Number(process.env.BINANCE_PAPER_MAX_DAILY_LOSS_USDT || 500),
      stopLossPct: Number(process.env.BINANCE_PAPER_STOP_LOSS_PCT || 0.02),
      takeProfitPct: Number(process.env.BINANCE_PAPER_TAKE_PROFIT_PCT || 0.04),
      minConfidence: Number(process.env.BINANCE_PAPER_MIN_CONFIDENCE || 0.62),
      liveTradingEnabled: false,
    },
    trades: [],
    strategyStats: {},
  };
}

function ensureDir() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

export function loadBinancePaperState(): BinancePaperState {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    const state = defaultState();
    saveBinancePaperState(state);
    return state;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      ...defaultState(),
      ...parsed,
      wallet: { ...defaultState().wallet, ...(parsed.wallet || {}) },
      risk: { ...defaultState().risk, ...(parsed.risk || {}), liveTradingEnabled: false },
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      strategyStats: parsed.strategyStats || {},
      generatedAt: now(),
    };
  } catch {
    const state = defaultState();
    saveBinancePaperState(state);
    return state;
  }
}

export function saveBinancePaperState(state: BinancePaperState) {
  ensureDir();
  state.generatedAt = now();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function statFor(state: BinancePaperState, strategy: string) {
  if (!state.strategyStats[strategy]) {
    state.strategyStats[strategy] = { runs: 0, opened: 0, closed: 0, wins: 0, losses: 0, realisedPnl: 0 };
  }
  return state.strategyStats[strategy];
}

function todayLoss(state: BinancePaperState) {
  const day = new Date().toISOString().slice(0, 10);
  return state.trades
    .filter(t => t.status === "CLOSED" && t.closedAt?.slice(0, 10) === day && Number(t.pnl || 0) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.pnl || 0)), 0);
}

export function getBinancePaperSummary(markPrice?: number) {
  const state = loadBinancePaperState();
  const open = state.trades.filter(t => t.status === "OPEN");
  const closed = state.trades.filter(t => t.status === "CLOSED");
  const unrealised = open.reduce((sum, t) => {
    if (!markPrice || t.symbol !== "BTCUSDT") return sum;
    return sum + (markPrice - t.entryPrice) * t.quantity * (t.side === "BUY" ? 1 : -1);
  }, 0);

  const wins = closed.filter(t => Number(t.pnl || 0) > 0).length;
  const losses = closed.filter(t => Number(t.pnl || 0) <= 0).length;

  return {
    ok: true,
    mode: "binance_paper_learning_only",
    generatedAt: now(),
    wallet: {
      ...state.wallet,
      unrealisedPnl: unrealised,
      equity: state.wallet.usdt + state.wallet.reservedUsdt + unrealised,
    },
    performance: {
      openTrades: open.length,
      closedTrades: closed.length,
      wins,
      losses,
      winRate: closed.length ? wins / closed.length : 0,
      realisedPnl: state.wallet.realisedPnl,
      todayLossUsdt: todayLoss(state),
    },
    risk: state.risk,
    strategyStats: state.strategyStats,
    recentTrades: state.trades.slice(0, 30),
  };
}

export function openBinancePaperTrade(input: {
  symbol: string;
  side: BinancePaperSide;
  quantity?: number;
  price: number;
  notionalUsdt?: number;
  strategy?: BinancePaperStrategyNameCompat;
  confidence?: number;
  reason?: string;
}) {
  const state = loadBinancePaperState();
  const confidence = Number(input.confidence ?? 1);
  const price = Number(input.price);
  const symbol = String(input.symbol || "BTCUSDT").toUpperCase();
  const strategy = input.strategy || "manual";

  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "invalid_price", state: getBinancePaperSummary() };
  }

  if (confidence < state.risk.minConfidence) {
    return { ok: false, blocked: true, error: "confidence_below_minimum", confidence, minimum: state.risk.minConfidence };
  }

  if (todayLoss(state) >= state.risk.maxDailyLossUsdt) {
    return { ok: false, blocked: true, error: "daily_loss_limit_reached", todayLossUsdt: todayLoss(state), maxDailyLossUsdt: state.risk.maxDailyLossUsdt };
  }

  const requestedNotional = Number(input.notionalUsdt || ((input.quantity || 0) * price));
  const notional = Math.min(requestedNotional || state.risk.maxTradeUsdt, state.risk.maxTradeUsdt, state.wallet.usdt);

  if (!Number.isFinite(notional) || notional <= 0) {
    return { ok: false, error: "insufficient_paper_usdt" };
  }

  const quantity = Number(input.quantity || (notional / price));

  const trade: BinancePaperTrade = {
    id: crypto.randomUUID(),
    createdAt: now(),
    symbol,
    side: input.side,
    quantity,
    entryPrice: price,
    notional,
    status: "OPEN",
    strategy,
    reason: input.reason || "paper_learning_trade",
    stopLossPct: state.risk.stopLossPct,
    takeProfitPct: state.risk.takeProfitPct,
  };

  state.wallet.usdt -= notional;
  state.wallet.reservedUsdt += notional;
  state.trades.unshift(trade);

  const stats = statFor(state, strategy);
  stats.opened += 1;

  saveBinancePaperState(state);
  return { ok: true, trade, summary: getBinancePaperSummary(price) };
}

export type BinancePaperStrategyNameCompat = BinanceStrategyName | "manual";

export function closeBinancePaperTrade(id: string, exitPrice: number, reason = "manual_close") {
  const state = loadBinancePaperState();
  const trade = state.trades.find(t => t.id === id && t.status === "OPEN");

  if (!trade) return { ok: false, error: "open_trade_not_found" };
  if (!Number.isFinite(exitPrice) || exitPrice <= 0) return { ok: false, error: "invalid_exit_price" };

  const direction = trade.side === "BUY" ? 1 : -1;
  const pnl = (exitPrice - trade.entryPrice) * trade.quantity * direction;
  const pnlPct = pnl / trade.notional;

  trade.status = "CLOSED";
  trade.closedAt = now();
  trade.exitPrice = exitPrice;
  trade.pnl = pnl;
  trade.pnlPct = pnlPct;
  trade.reason = `${trade.reason}; close=${reason}`;

  state.wallet.reservedUsdt -= trade.notional;
  state.wallet.usdt += trade.notional + pnl;
  state.wallet.realisedPnl += pnl;
  state.wallet.equity = state.wallet.usdt + state.wallet.reservedUsdt;

  const stats = statFor(state, trade.strategy);
  stats.closed += 1;
  stats.realisedPnl += pnl;
  if (pnl > 0) stats.wins += 1;
  else stats.losses += 1;

  saveBinancePaperState(state);
  return { ok: true, trade, summary: getBinancePaperSummary(exitPrice) };
}

export function evaluateOpenBinancePaperTrades(markPrice: number) {
  const state = loadBinancePaperState();
  const actions: any[] = [];

  for (const trade of state.trades.filter(t => t.status === "OPEN")) {
    const direction = trade.side === "BUY" ? 1 : -1;
    const pnlPct = ((markPrice - trade.entryPrice) / trade.entryPrice) * direction;

    if (pnlPct <= -trade.stopLossPct) {
      actions.push(closeBinancePaperTrade(trade.id, markPrice, "stop_loss_hit"));
    } else if (pnlPct >= trade.takeProfitPct) {
      actions.push(closeBinancePaperTrade(trade.id, markPrice, "take_profit_hit"));
    }
  }

  return { ok: true, evaluatedAt: now(), markPrice, actions, summary: getBinancePaperSummary(markPrice) };
}

export function runBinancePaperStrategy(input: {
  symbol: string;
  strategy: BinanceStrategyName;
  candles: Array<{ open: number; high: number; low: number; close: number; volume?: number }>;
}) {
  const state = loadBinancePaperState();
  const strategy = input.strategy;
  const stats = statFor(state, strategy);
  stats.runs += 1;
  saveBinancePaperState(state);

  const candles = input.candles || [];
  if (candles.length < 20) {
    return { ok: false, error: "not_enough_candles", required: 20, received: candles.length };
  }

  const closes = candles.map(c => Number(c.close)).filter(Boolean);
  const price = closes[closes.length - 1];
  const prev = closes[closes.length - 2];

  const sma = (n: number) => closes.slice(-n).reduce((a, b) => a + b, 0) / n;
  const smaFast = sma(8);
  const smaSlow = sma(20);
  const high20 = Math.max(...candles.slice(-20).map(c => Number(c.high)));
  const low20 = Math.min(...candles.slice(-20).map(c => Number(c.low)));

  let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reason = "no_edge";

  if (strategy === "trend_follow") {
    if (smaFast > smaSlow && price > prev) {
      signal = "BUY";
      confidence = Math.min(0.9, 0.62 + Math.abs(smaFast - smaSlow) / price * 10);
      reason = "fast_sma_above_slow_and_price_rising";
    }
  }

  if (strategy === "breakout") {
    if (price >= high20 * 0.998) {
      signal = "BUY";
      confidence = 0.68;
      reason = "near_20_candle_high_breakout";
    }
  }

  if (strategy === "rsi_reversal") {
    const diffs = closes.slice(-15).map((v, i, arr) => i === 0 ? 0 : v - arr[i - 1]).slice(1);
    const gains = diffs.filter(x => x > 0).reduce((a, b) => a + b, 0) / 14;
    const losses = Math.abs(diffs.filter(x => x < 0).reduce((a, b) => a + b, 0) / 14) || 0.00001;
    const rsi = 100 - (100 / (1 + gains / losses));
    if (rsi < 32 && price > low20) {
      signal = "BUY";
      confidence = 0.66;
      reason = `rsi_reversal_rsi_${rsi.toFixed(2)}`;
    }
  }

  if (strategy === "volatility_guard") {
    const rangePct = (high20 - low20) / price;
    if (rangePct < 0.04 && smaFast > smaSlow) {
      signal = "BUY";
      confidence = 0.64;
      reason = "controlled_volatility_with_positive_trend";
    }
  }

  const autoClose = evaluateOpenBinancePaperTrades(price);

  if (signal === "BUY") {
    const opened = openBinancePaperTrade({
      symbol: input.symbol,
      side: "BUY",
      price,
      notionalUsdt: state.risk.maxTradeUsdt,
      strategy,
      confidence,
      reason,
    });

    return { ok: true, strategy, signal, confidence, reason, price, opened, autoClose };
  }

  return { ok: true, strategy, signal, confidence, reason, price, autoClose, summary: getBinancePaperSummary(price) };
}

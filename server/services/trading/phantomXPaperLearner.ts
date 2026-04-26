import fs from "fs/promises";
import path from "path";
import { getMexcMarketSnapshot } from "./mexcMarketData";

type PaperSide = "long" | "short";
type PositionStatus = "open" | "closed";

type PaperPosition = {
  id: string;
  symbol: string;
  exchangeSymbol: string;
  strategy: string;
  side: PaperSide;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  notional: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: string;
  closedAt?: string;
  status: PositionStatus;
  pnl: number;
  pnlPct: number;
  reason: string;
};

type PaperOutcome = {
  id: string;
  symbol: string;
  strategy: string;
  side: PaperSide;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  closedAt: string;
  result: "win" | "loss" | "flat";
  closeReason: string;
};

type StrategyLearning = {
  name: string;
  score: number;
  wins: number;
  losses: number;
  trades: number;
  pnl: number;
};

type LearnerState = {
  version: number;
  mode: "paper";
  liveTradingEnabled: false;
  running: boolean;
  startingBalance: number;
  balance: number;
  equity: number;
  maxOpenPositions: number;
  riskPerTradePct: number;
  positions: PaperPosition[];
  outcomes: PaperOutcome[];
  learning: Record<string, StrategyLearning>;
  lastTickAt?: string;
  lastDecision?: any;
  tickCount: number;
};

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STATE_FILE = path.join(DATA_DIR, "phantomx-paper-learner.json");

const DEFAULT_BALANCE = Number(process.env.PHANTOMX_PAPER_STARTING_BALANCE || 10000);
const MAX_OPEN_POSITIONS = Number(process.env.PHANTOMX_PAPER_MAX_OPEN_POSITIONS || 3);
const RISK_PER_TRADE_PCT = Number(process.env.PHANTOMX_PAPER_RISK_PCT || 1);
const MIN_CONFIDENCE = Number(process.env.PHANTOMX_PAPER_MIN_CONFIDENCE || 58);
const MAX_OUTCOMES = Number(process.env.PHANTOMX_PAPER_MAX_OUTCOMES || 250);

let loopTimer: NodeJS.Timeout | null = null;

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultLearning(): Record<string, StrategyLearning> {
  const names = [
    "momentum_breakout",
    "mean_reversion",
    "trend_follow",
    "volatility_squeeze",
    "regime_shift",
  ];

  return Object.fromEntries(
    names.map((name) => [
      name,
      {
        name,
        score: 50,
        wins: 0,
        losses: 0,
        trades: 0,
        pnl: 0,
      },
    ]),
  );
}

function createDefaultState(): LearnerState {
  return {
    version: 1,
    mode: "paper",
    liveTradingEnabled: false,
    running: false,
    startingBalance: DEFAULT_BALANCE,
    balance: DEFAULT_BALANCE,
    equity: DEFAULT_BALANCE,
    maxOpenPositions: MAX_OPEN_POSITIONS,
    riskPerTradePct: RISK_PER_TRADE_PCT,
    positions: [],
    outcomes: [],
    learning: defaultLearning(),
    tickCount: 0,
  };
}

async function saveState(state: LearnerState) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function getPhantomXPaperState(): Promise<LearnerState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as LearnerState;

    return {
      ...createDefaultState(),
      ...parsed,
      mode: "paper",
      liveTradingEnabled: false,
      learning: {
        ...defaultLearning(),
        ...(parsed.learning || {}),
      },
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes : [],
    };
  } catch {
    const state = createDefaultState();
    await saveState(state);
    return state;
  }
}

function chooseStrategy(state: LearnerState, market: any): string {
  const changePct = safeNumber(market.changePct24h);
  const volatility = Math.abs(changePct);

  const preferred =
    volatility >= 4 ? "regime_shift" :
    volatility >= 2 ? "momentum_breakout" :
    market.regime === "normal" ? "mean_reversion" :
    "trend_follow";

  const candidates = Object.values(state.learning);
  const bestLearned = candidates.sort((a, b) => b.score - a.score)[0]?.name || preferred;

  if ((state.learning[preferred]?.score || 50) + 8 >= (state.learning[bestLearned]?.score || 50)) {
    return preferred;
  }

  return bestLearned;
}

function makeDecision(state: LearnerState, market: any) {
  const price = safeNumber(market.price);
  const changePct = safeNumber(market.changePct24h);
  const spread = safeNumber(market.orderBook?.spread);
  const volume24h = safeNumber(market.volume24h);
  const strategy = chooseStrategy(state, market);

  const directionBias = changePct > 0.15 ? "long" : changePct < -0.15 ? "short" : "long";
  const side = directionBias as PaperSide;

  const confidenceBase = 50;
  const trendBoost = Math.min(20, Math.abs(changePct) * 2);
  const liquidityBoost = volume24h > 0 ? 6 : 0;
  const spreadPenalty = spread && price ? Math.min(10, (spread / price) * 10000) : 0;
  const learningBoost = Math.max(-10, Math.min(15, (state.learning[strategy]?.score || 50) - 50));

  const confidence = Math.round(confidenceBase + trendBoost + liquidityBoost + learningBoost - spreadPenalty);

  return {
    action: confidence >= MIN_CONFIDENCE ? "open_paper_trade" : "skip",
    symbol: market.symbol,
    exchangeSymbol: market.exchangeSymbol,
    strategy,
    side,
    confidence,
    price,
    reason:
      confidence >= MIN_CONFIDENCE
        ? `Paper entry allowed: confidence ${confidence}, strategy ${strategy}, side ${side}`
        : `Skipped: confidence ${confidence} below ${MIN_CONFIDENCE}`,
    market,
  };
}

function calculateQuantity(balance: number, price: number, riskPct: number) {
  const riskCapital = balance * (riskPct / 100);
  const notional = Math.max(10, riskCapital * 10);
  return {
    notional,
    quantity: price > 0 ? notional / price : 0,
  };
}

function openPaperPosition(state: LearnerState, decision: any): PaperPosition | null {
  const price = safeNumber(decision.price);

  if (!price || state.positions.filter((p) => p.status === "open").length >= state.maxOpenPositions) {
    return null;
  }

  if (state.positions.some((p) => p.status === "open" && p.symbol === decision.symbol)) {
    return null;
  }

  const { quantity, notional } = calculateQuantity(state.balance, price, state.riskPerTradePct);
  const stopDistancePct = 0.0125;
  const takeProfitDistancePct = 0.0225;

  const position: PaperPosition = {
    id: newId("paper-pos"),
    symbol: decision.symbol,
    exchangeSymbol: decision.exchangeSymbol,
    strategy: decision.strategy,
    side: decision.side,
    entryPrice: price,
    currentPrice: price,
    quantity,
    notional,
    stopLoss:
      decision.side === "long"
        ? price * (1 - stopDistancePct)
        : price * (1 + stopDistancePct),
    takeProfit:
      decision.side === "long"
        ? price * (1 + takeProfitDistancePct)
        : price * (1 - takeProfitDistancePct),
    openedAt: nowIso(),
    status: "open",
    pnl: 0,
    pnlPct: 0,
    reason: decision.reason,
  };

  state.positions.push(position);
  return position;
}

function updateOpenPosition(position: PaperPosition, market: any) {
  const price = safeNumber(market.price, position.currentPrice);
  position.currentPrice = price;

  const rawPnl =
    position.side === "long"
      ? (price - position.entryPrice) * position.quantity
      : (position.entryPrice - price) * position.quantity;

  position.pnl = Math.round(rawPnl * 100) / 100;
  position.pnlPct = position.notional ? Math.round((rawPnl / position.notional) * 10000) / 100 : 0;
}

function shouldClose(position: PaperPosition) {
  if (position.side === "long") {
    if (position.currentPrice <= position.stopLoss) return "stop_loss";
    if (position.currentPrice >= position.takeProfit) return "take_profit";
  } else {
    if (position.currentPrice >= position.stopLoss) return "stop_loss";
    if (position.currentPrice <= position.takeProfit) return "take_profit";
  }

  const ageMs = Date.now() - new Date(position.openedAt).getTime();
  const maxAgeMs = Number(process.env.PHANTOMX_PAPER_MAX_HOLD_MS || 1000 * 60 * 60 * 8);
  if (ageMs >= maxAgeMs) return "time_exit";

  return null;
}

function applyLearning(state: LearnerState, outcome: PaperOutcome) {
  const entry = state.learning[outcome.strategy] || {
    name: outcome.strategy,
    score: 50,
    wins: 0,
    losses: 0,
    trades: 0,
    pnl: 0,
  };

  entry.trades += 1;
  entry.pnl = Math.round((entry.pnl + outcome.pnl) * 100) / 100;

  if (outcome.result === "win") {
    entry.wins += 1;
    entry.score = Math.min(95, entry.score + 2.5);
  } else if (outcome.result === "loss") {
    entry.losses += 1;
    entry.score = Math.max(5, entry.score - 2);
  } else {
    entry.score = Math.max(5, entry.score - 0.25);
  }

  state.learning[outcome.strategy] = entry;
}

function closePosition(state: LearnerState, position: PaperPosition, closeReason: string): PaperOutcome {
  position.status = "closed";
  position.closedAt = nowIso();

  state.balance = Math.round((state.balance + position.pnl) * 100) / 100;

  const outcome: PaperOutcome = {
    id: newId("paper-outcome"),
    symbol: position.symbol,
    strategy: position.strategy,
    side: position.side,
    entryPrice: position.entryPrice,
    exitPrice: position.currentPrice,
    pnl: position.pnl,
    pnlPct: position.pnlPct,
    openedAt: position.openedAt,
    closedAt: position.closedAt,
    result: position.pnl > 0 ? "win" : position.pnl < 0 ? "loss" : "flat",
    closeReason,
  };

  state.outcomes.unshift(outcome);
  state.outcomes = state.outcomes.slice(0, MAX_OUTCOMES);

  applyLearning(state, outcome);

  return outcome;
}

export async function runPhantomXPaperTick() {
  const state = await getPhantomXPaperState();
  const snapshot = await getMexcMarketSnapshot();
  const markets = Array.isArray(snapshot.marketContext) ? snapshot.marketContext : [];

  const actions: any[] = [];

  for (const position of state.positions.filter((p) => p.status === "open")) {
    const market = markets.find((m: any) => m.symbol === position.symbol || m.exchangeSymbol === position.exchangeSymbol);
    if (!market || market.isStale || !market.price) continue;

    updateOpenPosition(position, market);

    const closeReason = shouldClose(position);
    if (closeReason) {
      const outcome = closePosition(state, position, closeReason);
      actions.push({ type: "close", outcome });
    }
  }

  const openPositions = state.positions.filter((p) => p.status === "open");

  for (const market of markets) {
    if (openPositions.length >= state.maxOpenPositions) break;
    if (market.isStale || !market.price) continue;

    const decision = makeDecision(state, market);
    state.lastDecision = decision;

    if (decision.action === "open_paper_trade") {
      const opened = openPaperPosition(state, decision);
      if (opened) {
        openPositions.push(opened);
        actions.push({ type: "open", position: opened });
      }
    } else {
      actions.push({ type: "skip", decision });
    }
  }

  const liveOpen = state.positions.filter((p) => p.status === "open");
  const unrealised = liveOpen.reduce((sum, p) => sum + p.pnl, 0);

  state.equity = Math.round((state.balance + unrealised) * 100) / 100;
  state.tickCount += 1;
  state.lastTickAt = nowIso();

  await saveState(state);

  return {
    ok: true,
    mode: "paper",
    liveTradingEnabled: false,
    actions,
    state,
    marketSource: snapshot.source,
    generatedAt: nowIso(),
  };
}

export async function startPhantomXPaperLearner() {
  const state = await getPhantomXPaperState();
  state.running = true;
  await saveState(state);

  return {
    ok: true,
    running: true,
    mode: "paper",
    liveTradingEnabled: false,
    message: "PhantomX paper learner enabled. No live exchange orders will be placed.",
    state,
  };
}

export async function stopPhantomXPaperLearner() {
  const state = await getPhantomXPaperState();
  state.running = false;
  await saveState(state);

  return {
    ok: true,
    running: false,
    mode: "paper",
    liveTradingEnabled: false,
    message: "PhantomX paper learner stopped.",
    state,
  };
}

export async function runPhantomXPaperLoopOnceIfEnabled() {
  const state = await getPhantomXPaperState();
  if (!state.running) {
    return {
      ok: true,
      skipped: true,
      reason: "paper learner not running",
      state,
    };
  }

  return runPhantomXPaperTick();
}

export async function resetPhantomXPaperLearner() {
  const state = createDefaultState();
  await saveState(state);
  return {
    ok: true,
    reset: true,
    state,
  };
}

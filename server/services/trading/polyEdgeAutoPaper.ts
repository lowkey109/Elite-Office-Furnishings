import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import { paperPositions, paperTradeOutcomes } from "@shared/schema";
import {
  createDecision,
  openPaperPosition,
  closePaperPosition,
  getOrCreateState,
} from "./paperEngine";

type AutoState = {
  enabled: boolean;
  running: boolean;
  lastTickAt: string | null;
  lastAction: string;
  lastReason: string;
  lastError: string | null;
  ticks: number;
  decisionsCreated: number;
  positionsOpened: number;
  positionsClosed: number;
  learningScore: number;
  confidenceFloor: number;
};

const state: AutoState = {
  enabled: false,
  running: false,
  lastTickAt: null,
  lastAction: "idle",
  lastReason: "Auto paper trader is stopped.",
  lastError: null,
  ticks: 0,
  decisionsCreated: 0,
  positionsOpened: 0,
  positionsClosed: 0,
  learningScore: 50,
  confidenceFloor: 64,
};

let timer: NodeJS.Timeout | null = null;

const SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"] as const;
const STRATEGIES = ["trend_follow", "momentum_breakout", "volatility_squeeze", "mean_reversion"] as const;

function nowIso() {
  return new Date().toISOString();
}

function hashNumber(input: string) {
  return input.split("").reduce((sum, ch, i) => sum + ch.charCodeAt(0) * (i + 11), 0);
}

function paperMark(symbol: string) {
  const base: Record<string, number> = {
    "BTC/USD": 83500,
    "ETH/USD": 1880,
    "SOL/USD": 132,
    XAUUSD: 3120,
  };

  const t = Math.floor(Date.now() / 60000);
  const seed = hashNumber(symbol);
  const wave = Math.sin((t + seed) / 7) * 0.008 + Math.cos((t + seed) / 13) * 0.005;
  const price = (base[symbol] || 1000) * (1 + wave);

  return Math.round(price * 100) / 100;
}

function chooseSymbol() {
  const i = Math.abs(Math.floor(Date.now() / 60000)) % SYMBOLS.length;
  return SYMBOLS[i];
}

function chooseStrategy(symbol: string) {
  const i = hashNumber(symbol + String(Math.floor(Date.now() / 300000))) % STRATEGIES.length;
  return STRATEGIES[i];
}

async function calculateLearning() {
  const outcomes = await db
    .select()
    .from(paperTradeOutcomes)
    .orderBy(desc(paperTradeOutcomes.createdAt))
    .limit(80);

  if (!outcomes.length) {
    state.learningScore = 50;
    state.confidenceFloor = 64;
    return {
      sampleSize: 0,
      winRate: null,
      totalPnl: 0,
      profitFactor: null,
      confidenceFloor: state.confidenceFloor,
      learningScore: state.learningScore,
    };
  }

  const wins = outcomes.filter((o: any) => String(o.outcome) === "win");
  const losses = outcomes.filter((o: any) => String(o.outcome) === "loss");
  const totalPnl = outcomes.reduce((sum: number, o: any) => sum + Number(o.realizedPnl || 0), 0);
  const grossWins = wins.reduce((sum: number, o: any) => sum + Math.max(0, Number(o.realizedPnl || 0)), 0);
  const grossLosses = Math.abs(losses.reduce((sum: number, o: any) => sum + Math.min(0, Number(o.realizedPnl || 0)), 0));
  const winRate = wins.length / outcomes.length;
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 99 : null;

  const pnlScore = totalPnl > 0 ? 18 : totalPnl < 0 ? -18 : 0;
  const wrScore = Math.round((winRate - 0.5) * 60);
  const pfScore = profitFactor === null ? 0 : Math.max(-12, Math.min(18, Math.round((profitFactor - 1) * 8)));
  state.learningScore = Math.max(1, Math.min(99, 50 + pnlScore + wrScore + pfScore));

  if (state.learningScore >= 72 && outcomes.length >= 20) state.confidenceFloor = 60;
  else if (state.learningScore >= 58 && outcomes.length >= 10) state.confidenceFloor = 63;
  else if (state.learningScore < 42 && outcomes.length >= 10) state.confidenceFloor = 72;
  else state.confidenceFloor = 66;

  return {
    sampleSize: outcomes.length,
    winRate: Math.round(winRate * 10000) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    profitFactor: profitFactor === null ? null : Math.round(profitFactor * 100) / 100,
    confidenceFloor: state.confidenceFloor,
    learningScore: state.learningScore,
  };
}

async function maybeClosePositions() {
  const open = await db
    .select()
    .from(paperPositions)
    .where(eq(paperPositions.status, "open"));

  let closed = 0;

  for (const pos of open as any[]) {
    const mark = paperMark(pos.symbol);
    const openedAt = pos.entryTimestamp || pos.createdAt || new Date();
    const ageMs = Date.now() - new Date(openedAt).getTime();
    const maxAgeMs = 8 * 60 * 1000;

    const side = String(pos.side);
    const hitTarget = side === "long"
      ? pos.targetPrice && mark >= Number(pos.targetPrice)
      : pos.targetPrice && mark <= Number(pos.targetPrice);

    const hitStop = side === "long"
      ? mark <= Number(pos.stopPrice)
      : mark >= Number(pos.stopPrice);

    const agedOut = ageMs >= maxAgeMs;

    if (hitTarget || hitStop || agedOut) {
      const reason = hitTarget ? "auto_target_hit" : hitStop ? "auto_stop_hit" : "auto_time_exit";
      const outcomeId = await closePaperPosition({
        positionId: pos.id,
        exitPrice: mark,
        exitReason: reason,
      });

      if (outcomeId) {
        closed += 1;
        state.positionsClosed += 1;
      }
    }
  }

  return closed;
}

async function maybeOpenPosition() {
  const open = await db
    .select()
    .from(paperPositions)
    .where(eq(paperPositions.status, "open"));

  if (open.length >= 4) {
    return { opened: false, reason: "Open-position limit reached." };
  }

  const learning = await calculateLearning();
  if (learning.sampleSize >= 10 && state.learningScore < 35) {
    return { opened: false, reason: "Learning score too low; waiting for safer paper conditions." };
  }

  const symbol = chooseSymbol();
  const strategy = chooseStrategy(symbol);
  const entry = paperMark(symbol);
  const seed = hashNumber(symbol + strategy + String(Date.now()));
  const direction = seed % 5 === 0 ? "short" : "long";
  const confidence = Math.max(state.confidenceFloor, Math.min(92, state.confidenceFloor + (seed % 18)));

  if (confidence < state.confidenceFloor) {
    return { opened: false, reason: "Confidence below adaptive floor." };
  }

  const riskPct = state.learningScore >= 70 ? 0.012 : state.learningScore < 45 ? 0.004 : 0.007;
  const paperCapitalAllocated = Math.round(100000 * riskPct * 100) / 100;
  const move = symbol === "BTC/USD" ? 0.008 : symbol === "ETH/USD" ? 0.01 : symbol === "SOL/USD" ? 0.014 : 0.004;

  const targetPrice = direction === "long"
    ? Math.round(entry * (1 + move * 1.4) * 100) / 100
    : Math.round(entry * (1 - move * 1.4) * 100) / 100;

  const stopPrice = direction === "long"
    ? Math.round(entry * (1 - move) * 100) / 100
    : Math.round(entry * (1 + move) * 100) / 100;

  const decisionId = await createDecision({
    market: symbol,
    strategy,
    direction,
    confidence,
    thesis: `PolyEdge autonomous paper-only decision. Learning score ${state.learningScore}. Confidence floor ${state.confidenceFloor}.`,
    regime: state.learningScore >= 60 ? "adaptive_trend" : "defensive_paper",
    reasonCode: "polyedge_auto_paper_learning_loop",
    expectedMove: Math.round(move * 10000) / 100,
    invalidationRule: `Exit if paper mark breaches ${stopPrice}`,
    riskBucket: state.learningScore >= 70 ? "adaptive_medium" : "defensive_low",
    dataQualityScore: 72,
    slippageEstimate: 0.04,
    marketPriceAtDecision: entry,
    riskAmount: paperCapitalAllocated,
    fullPayload: {
      paperOnly: true,
      autonomous: true,
      source: "polyedge_auto_paper",
      learning,
      generatedAt: nowIso(),
    },
  });

  state.decisionsCreated += 1;

  const positionId = await openPaperPosition({
    decisionId,
    symbol,
    side: direction,
    entryPrice: entry,
    stopPrice,
    targetPrice,
    paperCapitalAllocated,
    strategy,
  });

  if (!positionId) {
    return { opened: false, reason: "Decision created but position already existed or was blocked." };
  }

  state.positionsOpened += 1;

  return {
    opened: true,
    reason: `Opened ${direction} ${symbol} paper position at ${entry}.`,
    decisionId,
    positionId,
    symbol,
    direction,
    entry,
    stopPrice,
    targetPrice,
    confidence,
  };
}

export async function polyEdgeAutoPaperTick() {
  if (state.running) {
    return { ok: false, skipped: true, reason: "Tick already running.", state };
  }

  state.running = true;
  state.lastTickAt = nowIso();
  state.lastError = null;
  state.ticks += 1;

  try {
    await getOrCreateState();

    const closed = await maybeClosePositions();
    const opened = state.enabled ? await maybeOpenPosition() : { opened: false, reason: "Auto paper trader is stopped." };
    const learning = await calculateLearning();

    state.lastAction = opened.opened ? "opened_position" : closed > 0 ? "closed_position" : "observed";
    state.lastReason = opened.reason || (closed > 0 ? `Closed ${closed} paper position(s).` : "No paper action required.");

    return {
      ok: true,
      paperOnly: true,
      liveTradingAffected: false,
      closed,
      opened,
      learning,
      state: { ...state },
    };
  } catch (err: any) {
    state.lastError = err?.message || String(err);
    state.lastAction = "error";
    state.lastReason = state.lastError || "Unknown auto paper error.";
    return {
      ok: false,
      paperOnly: true,
      liveTradingAffected: false,
      error: state.lastError,
      state: { ...state },
    };
  } finally {
    state.running = false;
  }
}

export function startPolyEdgeAutoPaperLoop(intervalMs = 30000) {
  state.enabled = true;
  state.lastAction = "started";
  state.lastReason = `Auto paper trader started. Interval ${intervalMs}ms.`;

  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    polyEdgeAutoPaperTick().catch((err) => {
      state.lastError = err?.message || String(err);
      state.lastAction = "error";
      state.lastReason = state.lastError || "Unknown loop error.";
    });
  }, Math.max(10000, intervalMs));

  polyEdgeAutoPaperTick().catch(() => undefined);

  return getPolyEdgeAutoPaperStatus();
}

export function stopPolyEdgeAutoPaperLoop() {
  state.enabled = false;
  state.lastAction = "stopped";
  state.lastReason = "Auto paper trader stopped.";
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  return getPolyEdgeAutoPaperStatus();
}

export async function getPolyEdgeAutoPaperStatus() {
  const learning = await calculateLearning().catch(() => ({
    sampleSize: 0,
    winRate: null,
    totalPnl: 0,
    profitFactor: null,
    confidenceFloor: state.confidenceFloor,
    learningScore: state.learningScore,
  }));

  const openPositions = await db
    .select()
    .from(paperPositions)
    .where(eq(paperPositions.status, "open"))
    .catch(() => []);

  return {
    ok: true,
    service: "polyedge_auto_paper",
    paperOnly: true,
    liveTradingAffected: false,
    enabled: state.enabled,
    running: state.running,
    lastTickAt: state.lastTickAt,
    lastAction: state.lastAction,
    lastReason: state.lastReason,
    lastError: state.lastError,
    ticks: state.ticks,
    decisionsCreated: state.decisionsCreated,
    positionsOpened: state.positionsOpened,
    positionsClosed: state.positionsClosed,
    openPositions: openPositions.length,
    learning,
    updatedAt: nowIso(),
  };
}

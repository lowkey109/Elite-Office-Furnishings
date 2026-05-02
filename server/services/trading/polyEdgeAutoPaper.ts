import { getNexoraCandidateAllowlist } from "./candidates/nexoraCandidateAllowlist";
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
  confidenceFloor: 62,
};

let timer: NodeJS.Timeout | null = null;

const SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"] as const;
const STRATEGIES = ["trend_follow", "momentum_breakout", "volatility_squeeze", "mean_reversion"] as const;

const QUALITY_MODE_ALLOWED_PAIRS = new Set<string>([
  "ETH/USD|volatility_squeeze",
  "XAUUSD|momentum_breakout",
]);

function emergencyBlockedSymbols() {
  // BTC paper losses are currently overwhelming learning.
  // Set POLYEDGE_ALLOW_BTC_PAPER=true to re-enable later.
  const blocked = new Set<string>();

  if (process.env.POLYEDGE_ALLOW_BTC_PAPER !== "true") {
    blocked.add("BTC/USD");
  }

  if (process.env.POLYEDGE_ALLOW_SOL_PAPER !== "true") {
    blocked.add("SOL/USD");
  }

  return blocked;
}

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

  const t = Math.floor(Date.now() / 5000);
  const seed = hashNumber(symbol);
  const wave = Math.sin((t + seed) / 2.7) * 0.0035 + Math.cos((t + seed) / 5.1) * 0.0025;
  return Math.round((base[symbol] || 1000) * (1 + wave) * 100) / 100;
}

function chooseSymbol() {
  return SYMBOLS[Math.abs(Math.floor(Date.now() / 7000)) % SYMBOLS.length];
}

function buildNexoraPaperSignals(input: {
  symbol: string;
  strategy: string;
  direction: "long" | "short";
  confidence: number;
  learningScore: number;
}) {
  const baseConfidence = Math.max(45, Math.min(92, Number(input.confidence || 60)));
  const direction = input.direction;

  const makeSignal = (system: string, boost = 0, risk: "low" | "medium" | "high" = "medium") => ({
    system,
    symbol: input.symbol,
    direction,
    confidence: Math.max(1, Math.min(100, baseConfidence + boost)),
    strength: Math.max(1, Math.min(100, baseConfidence + boost - 4)),
    risk,
    reason: `${system} supports ${direction} ${input.symbol} for ${input.strategy} paper setup.`,
    features: {
      paperOnly: true,
      strategy: input.strategy,
      learningScore: input.learningScore,
    },
  });

  if (input.strategy === "momentum_breakout") {
    return [
      makeSignal("ema_trend_filter", 2),
      makeSignal("macd_momentum", 1),
      makeSignal("adx_trend_strength", 0),
      makeSignal("donchian_breakout", 3),
      makeSignal("volume_confirmation", -2),
      makeSignal("market_regime", input.learningScore >= 35 ? 0 : -8),
    ];
  }

  if (input.strategy === "volatility_squeeze") {
    return [
      makeSignal("bollinger_squeeze", 3),
      makeSignal("volume_confirmation", -1),
      makeSignal("adx_trend_strength", -2),
      makeSignal("market_regime", input.learningScore >= 35 ? 0 : -8),
      makeSignal("liquidity_sweep", -3),
    ];
  }

  if (input.strategy === "trend_follow") {
    return [
      makeSignal("ema_trend_filter", 3),
      makeSignal("macd_momentum", 2),
      makeSignal("adx_trend_strength", 1),
      makeSignal("market_regime", input.learningScore >= 35 ? 0 : -8),
    ];
  }

  return [
    makeSignal("rsi_filter", 0),
    makeSignal("vwap_deviation", -1),
    makeSignal("bollinger_reversion", 0),
    makeSignal("support_resistance", -2),
  ];
}


async function chooseNexoraPreferredPaperSetup() {
  const allowlist = await getNexoraCandidateAllowlist().catch(() => null);
  const rows = Array.isArray(allowlist?.rows) ? allowlist.rows : [];

  const best = rows
    .filter((row: any) => row.status === "research_probe")
    .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0))[0];

  if (!best) return null;

  return {
    symbol: String(best.symbol),
    strategy: String(best.strategy),
    direction: String(best.direction) === "short" ? "short" as const : "long" as const,
    reason: `Nexora allowlist selected ${best.symbol} ${best.strategy} ${best.direction} from research candidate score ${best.score}.`,
  };
}

function chooseStrategy(symbol: string, blockedStrategies: string[] = []) {
  const allowed = STRATEGIES.filter((strategy) => !blockedStrategies.includes(strategy));
  const pool = allowed.length ? allowed : STRATEGIES;
  return pool[hashNumber(symbol + String(Math.floor(Date.now() / 15000))) % pool.length];
}

async function ensurePolyEdgeLearningMemoryTable() {
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    create table if not exists polyedge_learning_memory (
      id text primary key,
      sample_size integer not null default 0,
      recent_win_rate numeric,
      lifetime_win_rate numeric,
      recent_pnl numeric,
      lifetime_pnl numeric,
      recent_profit_factor numeric,
      lifetime_profit_factor numeric,
      current_learning_score integer not null default 50,
      best_learning_score integer not null default 50,
      confidence_floor integer not null default 63,
      payload jsonb,
      updated_at timestamptz not null default now()
    );
  `);
}

function scoreLearningWindow(stats: {
  sampleSize: number;
  winRate: number | null;
  totalPnl: number;
  profitFactor: number | null;
}) {
  if (!stats.sampleSize || stats.winRate === null) return 50;

  const pnlScore = stats.totalPnl > 0 ? 18 : stats.totalPnl < 0 ? -18 : 0;
  const wrScore = Math.round((stats.winRate - 0.5) * 60);
  const pfScore = stats.profitFactor === null
    ? 0
    : Math.max(-12, Math.min(18, Math.round((stats.profitFactor - 1) * 8)));

  return Math.max(1, Math.min(99, 50 + pnlScore + wrScore + pfScore));
}

function summarizeLearningOutcomes(outcomes: any[]) {
  if (!outcomes.length) {
    return {
      sampleSize: 0,
      winRate: null,
      totalPnl: 0,
      profitFactor: null,
    };
  }

  const wins = outcomes.filter((o: any) => String(o.outcome) === "win");
  const losses = outcomes.filter((o: any) => String(o.outcome) === "loss");
  const totalPnl = outcomes.reduce((sum: number, o: any) => sum + Number(o.realizedPnl || 0), 0);
  const grossWins = wins.reduce((sum: number, o: any) => sum + Math.max(0, Number(o.realizedPnl || 0)), 0);
  const grossLosses = Math.abs(losses.reduce((sum: number, o: any) => sum + Math.min(0, Number(o.realizedPnl || 0)), 0));
  const winRate = wins.length / outcomes.length;
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 99 : null;

  return {
    sampleSize: outcomes.length,
    winRate,
    totalPnl,
    profitFactor,
  };
}

async function savePolyEdgeLearningMemory(input: any) {
  const { sql } = await import("drizzle-orm");
  await ensurePolyEdgeLearningMemoryTable();

  await db.execute(sql`
    insert into polyedge_learning_memory (
      id,
      sample_size,
      recent_win_rate,
      lifetime_win_rate,
      recent_pnl,
      lifetime_pnl,
      recent_profit_factor,
      lifetime_profit_factor,
      current_learning_score,
      best_learning_score,
      confidence_floor,
      payload,
      updated_at
    )
    values (
      'polyedge_auto_paper',
      ${input.sampleSize},
      ${input.recentWinRate},
      ${input.lifetimeWinRate},
      ${input.recentPnl},
      ${input.lifetimePnl},
      ${input.recentProfitFactor},
      ${input.lifetimeProfitFactor},
      ${input.currentLearningScore},
      greatest(${input.currentLearningScore}, coalesce((select best_learning_score from polyedge_learning_memory where id = 'polyedge_auto_paper'), 50)),
      ${input.confidenceFloor},
      ${JSON.stringify(input.payload || {})},
      now()
    )
    on conflict(id)
    do update set
      sample_size = excluded.sample_size,
      recent_win_rate = excluded.recent_win_rate,
      lifetime_win_rate = excluded.lifetime_win_rate,
      recent_pnl = excluded.recent_pnl,
      lifetime_pnl = excluded.lifetime_pnl,
      recent_profit_factor = excluded.recent_profit_factor,
      lifetime_profit_factor = excluded.lifetime_profit_factor,
      current_learning_score = excluded.current_learning_score,
      best_learning_score = greatest(polyedge_learning_memory.best_learning_score, excluded.current_learning_score),
      confidence_floor = excluded.confidence_floor,
      payload = excluded.payload,
      updated_at = now();
  `);
}

async function loadPolyEdgeLearningMemory() {
  const { sql } = await import("drizzle-orm");
  await ensurePolyEdgeLearningMemoryTable();

  const result: any = await db.execute(sql`
    select *
    from polyedge_learning_memory
    where id = 'polyedge_auto_paper'
    limit 1;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  return rows[0] || null;
}

async function calculateLearning() {
  const outcomes = await db
    .select()
    .from(paperTradeOutcomes)
    .orderBy(desc(paperTradeOutcomes.createdAt))
    .limit(500);

  if (!outcomes.length) {
    state.learningScore = 50;
    state.confidenceFloor = 62;
    return {
      sampleSize: 0,
      winRate: null,
      totalPnl: 0,
      profitFactor: null,
      confidenceFloor: state.confidenceFloor,
      learningScore: state.learningScore,
    persistentMemory: await loadPolyEdgeLearningMemory(),
    };
  }

  const recentStats = summarizeLearningOutcomes(outcomes.slice(0, 80));
  const shortStats = summarizeLearningOutcomes(outcomes.slice(0, 200));
  const mediumStats = summarizeLearningOutcomes(outcomes.slice(0, 500));
  const lifetimeStats = summarizeLearningOutcomes(outcomes);

  const recentScore = scoreLearningWindow(recentStats);
  const shortScore = scoreLearningWindow(shortStats);
  const mediumScore = scoreLearningWindow(mediumStats);
  const lifetimeScore = scoreLearningWindow(lifetimeStats);

  const memory = await loadPolyEdgeLearningMemory();
  const previousBestScore = Number(memory?.best_learning_score || 50);

  // Composite score: recent matters, but DB memory prevents deploy/restart from looking like a full reset.
  state.learningScore = Math.max(
    1,
    Math.min(
      99,
      Math.round(
        recentScore * 0.45 +
        shortScore * 0.25 +
        mediumScore * 0.2 +
        Math.max(lifetimeScore, previousBestScore * 0.85) * 0.1
      )
    )
  );

  const wins = outcomes.filter((o: any) => String(o.outcome) === "win");
  const losses = outcomes.filter((o: any) => String(o.outcome) === "loss");
  const totalPnl = recentStats.totalPnl;
  const winRate = recentStats.winRate || 0;
  const profitFactor = recentStats.profitFactor;

  if (state.learningScore >= 72 && outcomes.length >= 20) state.confidenceFloor = 58;
  else if (state.learningScore >= 58 && outcomes.length >= 10) state.confidenceFloor = 61;
  else if (state.learningScore < 42 && outcomes.length >= 10) state.confidenceFloor = 70;
  else state.confidenceFloor = 63;

  return {
    sampleSize: outcomes.length,
    winRate: Math.round(winRate * 10000) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    profitFactor: profitFactor === null ? null : Math.round(profitFactor * 100) / 100,
    confidenceFloor: state.confidenceFloor,
    learningScore: state.learningScore,
  };
}

async function hydratePaperLearningFromDatabase() {
  try {
    const learning = await calculateLearning();

    state.lastAction = "hydrated_from_database";
    state.lastReason = `Loaded paper learning from Railway Postgres. Samples ${learning.sampleSize}, win rate ${learning.winRate ?? "WAIT"}%, P&L ${learning.totalPnl}.`;

    return learning;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
    state.lastAction = "hydrate_failed";
    state.lastReason = "Could not hydrate paper learning from database on startup.";
    return null;
  }
}

async function calculatePaperLossGovernor() {
  const outcomes = await db
    .select()
    .from(paperTradeOutcomes)
    .orderBy(desc(paperTradeOutcomes.createdAt))
    .limit(120);

  const totalPnl = outcomes.reduce((sum: number, o: any) => sum + Number(o.realizedPnl || 0), 0);

  const strategyMap: Record<string, any> = {};
  const symbolMap: Record<string, any> = {};
  const pairMap: Record<string, any> = {};

  for (const o of outcomes as any[]) {
    const strategy = String(o.strategy || "unknown");
    const symbol = String(o.symbol || "unknown");
    const pairKey = `${symbol}|${strategy}`;
    const pnl = Number(o.realizedPnl || 0);
    const win = String(o.outcome) === "win" ? 1 : 0;

    if (!strategyMap[strategy]) strategyMap[strategy] = { strategy, trades: 0, wins: 0, pnl: 0 };
    strategyMap[strategy].trades += 1;
    strategyMap[strategy].wins += win;
    strategyMap[strategy].pnl += pnl;

    if (!symbolMap[symbol]) symbolMap[symbol] = { symbol, trades: 0, wins: 0, pnl: 0 };
    symbolMap[symbol].trades += 1;
    symbolMap[symbol].wins += win;
    symbolMap[symbol].pnl += pnl;

    if (!pairMap[pairKey]) pairMap[pairKey] = { symbol, strategy, trades: 0, wins: 0, pnl: 0 };
    pairMap[pairKey].trades += 1;
    pairMap[pairKey].wins += win;
    pairMap[pairKey].pnl += pnl;
  }

  const rankRows = (rows: any[]) => rows
    .map((row: any) => ({
      ...row,
      pnl: Math.round(Number(row.pnl || 0) * 100) / 100,
      avgPnl: row.trades ? Math.round((Number(row.pnl || 0) / row.trades) * 100) / 100 : 0,
      winRate: row.trades ? Math.round((row.wins / row.trades) * 10000) / 100 : null,
    }))
    .sort((a: any, b: any) => Number(a.pnl || 0) - Number(b.pnl || 0));

  const strategyRank = rankRows(Object.values(strategyMap));
  const symbolRank = rankRows(Object.values(symbolMap));
  const pairRank = rankRows(Object.values(pairMap));

  const worstStrategies = strategyRank
    .filter((row: any) => row.trades >= 6 && (Number(row.pnl || 0) < -250 || Number(row.winRate || 0) < 35))
    .slice(0, 2)
    .map((row: any) => row.strategy);

  const worstSymbols = symbolRank
    .filter((row: any) => row.trades >= 10 && (Number(row.pnl || 0) < -150 || Number(row.avgPnl || 0) < -4))
    .slice(0, 2)
    .map((row: any) => row.symbol);

  const worstPairs = pairRank
    .filter((row: any) =>
      row.trades >= 4 &&
      (
        Number(row.pnl || 0) < -25 ||
        Number(row.avgPnl || 0) < -2.5 ||
        (row.trades >= 5 && Number(row.winRate || 0) < 30)
      )
    )
    .slice(0, 12)
    .map((row: any) => ({
      symbol: row.symbol,
      strategy: row.strategy,
      pnl: row.pnl,
      avgPnl: row.avgPnl,
      winRate: row.winRate,
      trades: row.trades,
    }));

  const active =
    outcomes.length >= 10 &&
    (totalPnl < -500 || worstStrategies.length > 0 || worstSymbols.length > 0 || worstPairs.length > 0 || state.learningScore < 35);

  return {
    active,
    mode: active ? "ADAPTIVE_ALLOCATOR_ACTIVE" : "NORMAL_LEARNING",
    totalPnl: Math.round(totalPnl * 100) / 100,
    worstStrategies,
    worstSymbols,
    worstPairs,
    strategyRank: strategyRank.slice(0, 5),
    symbolRank: symbolRank.slice(0, 5),
    pairRank: pairRank.slice(0, 8),
    riskMultiplier: active ? 0.10 : 1,
    reason: active
      ? `Adaptive allocator active. Avoiding symbols: ${worstSymbols.join(", ") || "none"}; pairs: ${worstPairs.map((p: any) => `${p.symbol}/${p.strategy}`).join(", ") || "none"}.`
      : "Adaptive allocator normal.",
  };
}

async function closeFastPaperPositions() {
  const open = await db.select().from(paperPositions).where(eq(paperPositions.status, "open"));
  let closed = 0;

  for (const pos of open as any[]) {
    const mark = paperMark(pos.symbol);
    const openedAt = pos.entryTimestamp || pos.createdAt || new Date();
    const ageMs = Date.now() - new Date(openedAt).getTime();
    const maxAgeMs = Number(process.env.POLYEDGE_FAST_PAPER_MAX_AGE_MS || (state.learningScore < 35 ? 12000 : 20000));

    const side = String(pos.side);
    const hitTarget = side === "long"
      ? pos.targetPrice && mark >= Number(pos.targetPrice)
      : pos.targetPrice && mark <= Number(pos.targetPrice);

    const hitStop = side === "long"
      ? mark <= Number(pos.stopPrice)
      : mark >= Number(pos.stopPrice);

    const agedOut = ageMs >= maxAgeMs;

    if (hitTarget || hitStop || agedOut) {
      const reason = hitTarget ? "auto_target_hit" : hitStop ? "auto_stop_hit" : "auto_fast_learning_exit";
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

async function openFastPaperPosition() {
  const open = await db.select().from(paperPositions).where(eq(paperPositions.status, "open"));
  const maxOpen = Number(process.env.POLYEDGE_FAST_PAPER_MAX_OPEN || 20);

  if (open.length >= maxOpen) {
    return { opened: false, reason: "Open-position limit reached." };
  }

  const learning = await calculateLearning();
  const lossGovernor = await calculatePaperLossGovernor();

  const forceContinuousPaperLearning = process.env.POLYEDGE_FAST_PAPER_FORCE_CONTINUOUS !== "false";
  const defensiveMicroLearning = learning.sampleSize >= 10 && state.learningScore < 32;

  if (defensiveMicroLearning && !forceContinuousPaperLearning) {
    return { opened: false, reason: "Learning score too low; waiting." };
  }

  const activePairs = new Set((open as any[]).map((p: any) => `${p.symbol}|${p.strategy}`));
  const activeSymbols = new Set((open as any[]).map((p: any) => String(p.symbol || "")));
  const blockedPairs = new Set((lossGovernor.worstPairs || []).map((p: any) => `${p.symbol}|${p.strategy}`));
  const blockedSymbols = new Set([...(lossGovernor.worstSymbols || []), ...Array.from(emergencyBlockedSymbols())]);

  const candidatePairs: Array<{ symbol: string; strategy: string }> = [];

  for (const candidateSymbol of SYMBOLS) {
    if (blockedSymbols.has(candidateSymbol)) continue;
    if (activeSymbols.has(candidateSymbol)) continue;

    for (const candidateStrategy of STRATEGIES) {
      const pairKey = `${candidateSymbol}|${candidateStrategy}`;

      if (activePairs.has(pairKey)) continue;
      if (blockedPairs.has(pairKey)) continue;
      if ((lossGovernor.worstStrategies || []).includes(candidateStrategy)) continue;

      candidatePairs.push({
        symbol: candidateSymbol,
        strategy: candidateStrategy,
      });
    }
  }

  if (!candidatePairs.length) {
    // Keep PAPER-ONLY learning alive even when allocator blocks every weak pair.
    // Safe fallback is SOL-only, tiny size, non-BTC, non-live.
    const fallbackSymbol = "SOL/USD";
    const fallbackStrategies = STRATEGIES.filter((strategy) => !activePairs.has(`${fallbackSymbol}|${strategy}`));

    if (fallbackStrategies.length) {
      candidatePairs.push({
        symbol: fallbackSymbol,
        strategy: fallbackStrategies[hashNumber(String(Date.now())) % fallbackStrategies.length],
      });
    } else {
      return {
        opened: false,
        reason: "Research wait: allocator blocked weak pairs. Monitoring only until quality improves.",
      };
    }
  }

  const selected = candidatePairs[
    hashNumber(String(Date.now()) + String(open.length) + String(state.ticks)) % candidatePairs.length
  ];

  let symbol = selected.symbol;
  let strategy = selected.strategy;

  if (!QUALITY_MODE_ALLOWED_PAIRS.has(`${symbol}|${strategy}`)) {
    const qualityCandidates = Array.from(QUALITY_MODE_ALLOWED_PAIRS)
      .map((pair) => {
        const [candidateSymbol, candidateStrategy] = pair.split("|");
        return { symbol: candidateSymbol, strategy: candidateStrategy };
      })
      .filter((pair) => !activePairs.has(`${pair.symbol}|${pair.strategy}`));

    if (!qualityCandidates.length) {
      return {
        opened: false,
        reason: "Quality mode research wait: no safe promoted paper setup available. Monitoring only.",
      };
    }

    const promoted = qualityCandidates[
      hashNumber(String(Date.now()) + String(state.ticks)) % qualityCandidates.length
    ];

    symbol = promoted.symbol;
    strategy = promoted.strategy;
  }

  const entry = paperMark(symbol);
  const seed = hashNumber(symbol + strategy + String(Date.now()));
  const direction = preferredSetup?.direction || (seed % 4 === 0 ? "short" : "long");
  const confidence = Math.max(state.confidenceFloor, Math.min(92, state.confidenceFloor + (seed % 20)));

  const { voteNexoraTradeCandidate } = await import("./nexoraTradeVotingEngine");
  const { scoreNexoraSignalLibraryCandidate } = await import("./signals/nexoraSignalScoringEngine");

  const nexoraSignalScore = await scoreNexoraSignalLibraryCandidate({
    symbol,
    strategy,
    direction,
    confidence,
    learningScore: state.learningScore,
    regime: state.learningScore < 18 ? "risk_off" : state.learningScore < 40 ? "cautious" : "paper_adaptive",
  });

  if (nexoraSignalScore.blockedReasons.length) {
    return {
      opened: false,
      reason: nexoraSignalScore.reason,
      nexoraSignalScore,
      nexoraLearnedIntelligence: nexoraSignalScore.intelligence,
    };
  }

  const nexoraVote = voteNexoraTradeCandidate({
    symbol,
    strategy,
    direction,
    confidence: nexoraSignalScore.confidence,
    rewardRisk: 1.75 / 0.72,
    regime: state.learningScore < 18 ? "risk_off" : state.learningScore < 40 ? "cautious" : "paper_adaptive",
    learningPairBlocked: blockedPairs?.has?.(`${symbol}|${strategy}`) || false,
    spreadRisk: "low",
    slippageRisk: "medium",
    signals: nexoraSignalScore.signals,
  });

  if (!nexoraVote.approved) {
    return {
      opened: false,
      reason: nexoraSignalScore.reason || nexoraVote.reason,
      nexoraVote,
      nexoraSignalScore,
    };
  }


  const baseRiskPct =
    defensiveMicroLearning ? 0.0004 :
    state.learningScore >= 70 ? 0.012 :
    state.learningScore < 45 ? 0.0006 :
    0.007;

  const riskPct = baseRiskPct * Number(lossGovernor.riskMultiplier || 1);
  const paperCapitalAllocated = Math.max(5, Math.round(100000 * riskPct * 100) / 100);

  const move = symbol === "BTC/USD" ? 0.0016 : symbol === "ETH/USD" ? 0.002 : symbol === "SOL/USD" ? 0.0028 : 0.0011;

  const targetPrice = direction === "long"
    ? Math.round(entry * (1 + move * 1.75) * 100) / 100
    : Math.round(entry * (1 - move * 1.75) * 100) / 100;

  const stopPrice = direction === "long"
    ? Math.round(entry * (1 - move * 0.72) * 100) / 100
    : Math.round(entry * (1 + move * 0.72) * 100) / 100;

  const decisionId = await createDecision({
    market: symbol,
    strategy,
    direction,
    confidence,
    thesis: `PolyEdge fast autonomous PAPER-ONLY learning decision. Learning score ${state.learningScore}. ${defensiveMicroLearning ? "Defensive micro-learning mode active." : "Normal paper-learning mode active."}`,
    regime: state.learningScore >= 60 ? "fast_adaptive_paper" : "fast_defensive_paper",
    reasonCode: "polyedge_fast_auto_paper_learning",
    expectedMove: Math.round(move * 10000) / 100,
    invalidationRule: `Exit if synthetic paper mark breaches ${stopPrice}`,
    riskBucket: defensiveMicroLearning ? "defensive_micro_continuous_learning" : state.learningScore >= 70 ? "adaptive_medium" : "defensive_low",
    dataQualityScore: 72,
    slippageEstimate: 0.04,
    marketPriceAtDecision: entry,
    riskAmount: paperCapitalAllocated,
    fullPayload: {
      paperOnly: true,
      liveTradingAffected: false,
      autonomous: true,
      source: "polyedge_fast_auto_paper",
      nexoraVote,
      learning,
      lossGovernor,
      emergencyBlockedSymbols: Array.from(emergencyBlockedSymbols()),
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
    return { opened: false, reason: "Decision created but position was blocked or already exists." };
  }

  state.positionsOpened += 1;

  return {
    opened: true,
    reason: `Opened ${direction} ${symbol} PAPER position at ${entry}. Nexora learned-intelligence approved via ${nexoraSignalScore.agreementCount}/${nexoraSignalScore.intelligence?.agreementRequired ?? "?"} systems. Mode ${nexoraSignalScore.intelligence?.decisionMode || "research_probe"}. Genius ${nexoraSignalScore.intelligence?.geniusScore ?? "WAIT"}. Paper-only micro risk.`,
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

    const closed = await closeFastPaperPositions();
    const opened = state.enabled ? await openFastPaperPosition() : { opened: false, reason: "Auto paper trader stopped." };
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
    fastLearning: {
      enabled: true,
      intervalMs: 5000,
      maxAgeMs: Number(process.env.POLYEDGE_FAST_PAPER_MAX_AGE_MS || 20000),
      maxOpenPositions: Number(process.env.POLYEDGE_FAST_PAPER_MAX_OPEN || 20),
    },
    updatedAt: nowIso(),
  };
}

export async function startPolyEdgeAutoPaperLoop(intervalMs = 2000) {
  await hydratePaperLearningFromDatabase();
  state.enabled = true;
  state.lastAction = "started";
  state.lastReason = `Fast auto paper trader started. Interval ${intervalMs}ms.`;

  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    polyEdgeAutoPaperTick().catch((err) => {
      state.lastError = err?.message || String(err);
      state.lastAction = "error";
      state.lastReason = state.lastError || "Unknown loop error.";
    });
  }, Math.max(1000, intervalMs));

  polyEdgeAutoPaperTick().catch(() => undefined);

  return getPolyEdgeAutoPaperStatus();
}

export function stopPolyEdgeAutoPaperLoop() {
  state.enabled = false;
  state.lastAction = "stopped";
  state.lastReason = "Fast auto paper trader stopped.";

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  return getPolyEdgeAutoPaperStatus();
}

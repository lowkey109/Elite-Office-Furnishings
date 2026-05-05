import type { Express } from "express";
import fs from "fs";
import path from "path";

type AnyRecord = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "paper-summary");
const STATE_FILE = path.join(ROOT, "paper-train-state.json");
const SUMMARY_FILE = path.join(ROOT, "latest-summary.json");

const MARKETS = [
  { asset: "BTC", symbol: "BTCUSDT" },
  { asset: "ETH", symbol: "ETHUSDT" },
  { asset: "SOL", symbol: "SOLUSDT" },
  { asset: "BNB", symbol: "BNBUSDT" },
  { asset: "XRP", symbol: "XRPUSDT" },
  { asset: "DOGE", symbol: "DOGEUSDT" }
];

function now() {
  return new Date().toISOString();
}

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    mode: "paper_only",
    source: "real_binance_public_price",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    bankTransfersEnabled: false
  };
}

function readJson(file: string, fallback: AnyRecord) {
  ensureRoot();
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return fallback;
}

function writeJson(file: string, value: AnyRecord) {
  ensureRoot();
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function defaultState() {
  return {
    ok: true,
    service: "nexora_paper_train_state",
    createdAt: now(),
    updatedAt: now(),
    cursor: 0,
    previousPrices: {},
    pending: null,
    events: [],
    safety: safety()
  };
}

async function price(symbol: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Binance public ticker failed ${response.status}`);
  const data: any = await response.json();
  const value = Number(data?.price);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid Binance price");
  return value;
}

function buildSummary(state: AnyRecord) {
  const events: AnyRecord[] = Array.isArray(state.events) ? state.events : [];
  const counted = events.filter((event) => event.countAsTrade === true);
  const wins = counted.filter((event) => event.result === "paper_success");
  const losses = counted.filter((event) => event.result === "paper_loss");
  const skips = events.filter((event) => event.countAsTrade !== true);

  const assets: Record<string, AnyRecord> = {};

  for (const event of events) {
    const asset = String(event.asset || "unknown");
    if (!assets[asset]) {
      assets[asset] = {
        asset,
        events: 0,
        countedTrades: 0,
        wins: 0,
        losses: 0,
        skips: 0,
        pnl: 0,
        scoreSum: 0,
        scoreCount: 0
      };
    }

    const row = assets[asset];
    row.events += 1;
    row.pnl += Number(event.pnl || 0);
    row.scoreSum += Number(event.score || 0);
    row.scoreCount += 1;

    if (event.countAsTrade === true) row.countedTrades += 1;
    else row.skips += 1;

    if (event.result === "paper_success") row.wins += 1;
    if (event.result === "paper_loss") row.losses += 1;
  }

  const assetRows = Object.values(assets).map((row) => ({
    asset: row.asset,
    events: row.events,
    countedTrades: row.countedTrades,
    wins: row.wins,
    losses: row.losses,
    skips: row.skips,
    winRate: row.countedTrades ? Math.round((row.wins / row.countedTrades) * 10000) / 100 : 0,
    avgScore: row.scoreCount ? Math.round((row.scoreSum / row.scoreCount) * 100) / 100 : 0,
    pnl: Math.round(row.pnl * 100) / 100
  })).sort((a: AnyRecord, b: AnyRecord) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
    return b.countedTrades - a.countedTrades;
  });

  const winRate = counted.length ? Math.round((wins.length / counted.length) * 10000) / 100 : 0;
  const avgScore = counted.length
    ? Math.round((counted.reduce((sum, event) => sum + Number(event.score || 0), 0) / counted.length) * 100) / 100
    : 0;

  const confidence = counted.length >= 20 && winRate >= 95 && avgScore >= 80
    ? 95
    : Math.round(Math.max(50, Math.min(94, (winRate * 0.55) + (avgScore * 0.45))) * 100) / 100;

  const latest = events[events.length - 1] || null;

  return {
    ok: true,
    service: "nexora_paper_learning_summary",
    generatedAt: now(),
    source: "production_real_binance_public_price_paper_training",
    polymarketEvents: events.length,
    recentEvents: events.length,
    countedTrades: counted.length,
    wins: wins.length,
    losses: losses.length,
    skips: skips.length,
    winRate,
    avgScore,
    displayedConfidencePercent: confidence,
    targetConfidencePercent: 95,
    targetReached: confidence >= 95,
    results: events.reduce((acc: AnyRecord, event) => {
      acc[event.result] = (acc[event.result] || 0) + 1;
      return acc;
    }, {}),
    assets: assetRows,
    latest: latest ? {
      ok: true,
      service: "nexora_learning_memory_event",
      domain: "polymarket",
      product: "Phantom X / Polymarket",
      action: latest.countAsTrade ? "paper_trade_intent_practice" : "paper_observe_no_trade",
      result: latest.result,
      metrics: {
        paperPnl: latest.pnl,
        confidence: latest.confidence,
        asset: latest.asset
      },
      scored: {
        score: latest.score,
        grade: latest.score >= 80 ? "good" : latest.score >= 60 ? "watch" : "weak"
      },
      raw: latest
    } : null,
    safety: safety()
  };
}

async function tick() {
  const state = readJson(STATE_FILE, defaultState());
  const market = MARKETS[Number(state.cursor || 0) % MARKETS.length];
  const markPrice = await price(market.symbol);

  const previousPrices = state.previousPrices || {};
  const previousPrice = Number(previousPrices[market.symbol] || 0);
  const pending = state.pending || null;
  const events: AnyRecord[] = Array.isArray(state.events) ? state.events : [];

  let settled: AnyRecord | null = null;

  if (pending && pending.symbol === market.symbol && Number.isFinite(Number(pending.price))) {
    const entryPrice = Number(pending.price);
    const direction = String(pending.direction || "UP");
    const actualDirection = markPrice >= entryPrice ? "UP" : "DOWN";
    const win = direction === actualDirection;
    const changePct = ((markPrice - entryPrice) / entryPrice) * 100;
    const pnl = direction === "UP" ? changePct : -changePct;
    const score = win ? Math.min(95, 80 + Math.abs(pnl)) : Math.max(40, 65 - Math.abs(pnl));

    settled = {
      id: `paper-train-${Date.now()}`,
      generatedAt: now(),
      asset: market.asset,
      symbol: market.symbol,
      entryPrice,
      exitPrice: markPrice,
      direction,
      actualDirection,
      result: win ? "paper_success" : "paper_loss",
      pnl: Math.round(pnl * 100) / 100,
      confidence: Math.round(Number(pending.confidence || 0) * 100) / 100,
      score: Math.round(score * 100) / 100,
      countAsTrade: true,
      strategyUsed: "real_binance_public_price_momentum_paper_tick",
      paperOnly: true,
      liveTrading: false
    };

    events.push(settled);
  }

  let newPending: AnyRecord | null = null;

  if (previousPrice > 0) {
    const direction = markPrice >= previousPrice ? "UP" : "DOWN";
    const movePct = Math.abs((markPrice - previousPrice) / previousPrice) * 100;
    const confidence = Math.max(60, Math.min(92, 72 + movePct * 18));

    if (confidence >= 70) {
      newPending = {
        asset: market.asset,
        symbol: market.symbol,
        price: markPrice,
        direction,
        confidence: Math.round(confidence * 100) / 100,
        generatedAt: now(),
        paperOnly: true,
        liveTrading: false
      };
    } else {
      events.push({
        id: `paper-skip-${Date.now()}`,
        generatedAt: now(),
        asset: market.asset,
        symbol: market.symbol,
        price: markPrice,
        result: "paper_skip_low_edge",
        pnl: 0,
        confidence: Math.round(confidence * 100) / 100,
        score: 60,
        countAsTrade: false,
        reason: "low_edge_real_price_momentum",
        paperOnly: true,
        liveTrading: false
      });
    }
  }

  previousPrices[market.symbol] = markPrice;

  const nextState = {
    ...state,
    updatedAt: now(),
    cursor: Number(state.cursor || 0) + 1,
    previousPrices,
    pending: newPending,
    events: events.slice(-500),
    lastTick: { market, price: markPrice, settled, newPending },
    safety: safety()
  };

  writeJson(STATE_FILE, nextState);
  const summary = buildSummary(nextState);
  writeJson(SUMMARY_FILE, summary);

  return {
    ok: true,
    service: "nexora_paper_train_tick",
    generatedAt: now(),
    market,
    price: markPrice,
    settled,
    newPending,
    summary,
    safety: safety()
  };
}

export function registerNexoraPaperTrainRoutes(app: Express): void {
  app.get("/api/nexora/paper-train/status", (_req, res) => {
    const state = readJson(STATE_FILE, defaultState());
    const summary = readJson(SUMMARY_FILE, buildSummary(state));

    res.json({
      ok: true,
      service: "nexora_paper_train_status",
      generatedAt: now(),
      running: false,
      state,
      summary,
      safety: safety()
    });
  });

  app.post("/api/nexora/paper-train/tick", async (_req, res) => {
    try {
      res.json(await tick());
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        service: "nexora_paper_train_tick",
        error: String(error?.message || error),
        safety: safety()
      });
    }
  });
}

import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "polyedge-control");
const BANK = path.join(process.cwd(), "data", "nexora", "local", "bank-connect");
const TRAIN = path.join(process.cwd(), "data", "nexora", "local", "paper-summary");
const SUMMARY = path.join(TRAIN, "latest-summary.json");
const STATE = path.join(TRAIN, "button-training-state.json");

const MARKETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];

function now() {
  return new Date().toISOString();
}

function ensure(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function safety() {
  return {
    mode: "paper_and_read_only_only",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    withdrawalsEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    bankTransfersEnabled: false,
    autonomousMoneyMovement: false
  };
}

function readJson(file: string, fallback: R): R {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return fallback;
}

function writeJson(file: string, value: R) {
  ensure(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function event(type: string, payload: R = {}) {
  ensure(ROOT);
  const e = { ok: true, id: `${type}-${Date.now()}`, type, generatedAt: now(), ...payload, safety: safety() };
  fs.appendFileSync(path.join(ROOT, "events.jsonl"), JSON.stringify(e) + "\n");
  writeJson(path.join(ROOT, "state.json"), e);
  return e;
}

async function fetchJson(url: string) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${url} failed ${r.status}`);
  return await r.json();
}

async function fetchTicker(symbol: string) {
  const clean = encodeURIComponent(symbol || "BTCUSDT");
  const urls = [
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=${clean}`,
    `https://api.binance.com/api/v3/ticker/price?symbol=${clean}`
  ];

  let lastErr = "";
  for (const url of urls) {
    try {
      const data: any = await fetchJson(url);
      const price = Number(data?.price);
      if (Number.isFinite(price) && price > 0) return { price, source: url };
    } catch (e: any) {
      lastErr = String(e?.message || e);
    }
  }

  throw new Error(lastErr || "ticker unavailable");
}

async function fetchCandles(symbol: string, interval = "5m", limit = 100) {
  const clean = encodeURIComponent(symbol || "BTCUSDT");
  const intv = encodeURIComponent(interval || "5m");
  const lim = encodeURIComponent(String(limit || 100));
  const urls = [
    `https://data-api.binance.vision/api/v3/klines?symbol=${clean}&interval=${intv}&limit=${lim}`,
    `https://api.binance.com/api/v3/klines?symbol=${clean}&interval=${intv}&limit=${lim}`
  ];

  let lastErr = "";
  for (const url of urls) {
    try {
      const data: any = await fetchJson(url);
      if (Array.isArray(data) && data.length) return { candles: data, source: url };
    } catch (e: any) {
      lastErr = String(e?.message || e);
    }
  }

  throw new Error(lastErr || "candles unavailable");
}

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function multiStrategySignal(symbol: string, candlesRaw: any[]) {
  const closes = candlesRaw.map((k) => Number(k[4])).filter(Number.isFinite);
  const vols = candlesRaw.map((k) => Number(k[5])).filter(Number.isFinite);

  if (closes.length < 30) {
    return { signal: "HOLD", confidence: 0.5, reason: "insufficient_candles" };
  }

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const ma8 = avg(closes.slice(-8));
  const ma21 = avg(closes.slice(-21));
  const high20 = Math.max(...closes.slice(-20));
  const low20 = Math.min(...closes.slice(-20));
  const volLast = vols[vols.length - 1] || 0;
  const volAvg = avg(vols.slice(-20));

  const trendScore = ma8 > ma21 ? 1 : -1;
  const breakoutScore = last >= high20 * 0.999 ? 1 : last <= low20 * 1.001 ? -1 : 0;
  const meanScore = last < ma21 * 0.995 ? 1 : last > ma21 * 1.005 ? -1 : 0;
  const volumeScore = volAvg > 0 && volLast > volAvg * 1.25 ? 1 : 0;
  const directionScore = last > prev ? 1 : -1;

  const total = trendScore + breakoutScore + meanScore + volumeScore + directionScore;
  const confidence = Math.max(0.5, Math.min(0.95, 0.55 + Math.abs(total) * 0.08));

  let signal = "HOLD";
  let side = "NONE";
  let reason = "no_edge";

  if (total >= 3) {
    signal = "PAPER_LONG";
    side = "BUY";
    reason = "multi_strategy_bullish_edge";
  } else if (total <= -3) {
    signal = "PAPER_SHORT_OBSERVE";
    side = "SELL";
    reason = "multi_strategy_bearish_edge";
  }

  return {
    ok: true,
    symbol,
    signal,
    side,
    confidence: Math.round(confidence * 100) / 100,
    reason,
    price: last,
    components: {
      trendScore,
      breakoutScore,
      meanScore,
      volumeScore,
      directionScore,
      total,
      ma8,
      ma21,
      high20,
      low20,
      volLast,
      volAvg
    },
    safety: safety()
  };
}

function summaryFallback() {
  return {
    ok: true,
    service: "nexora_paper_learning_summary",
    source: "fallback_empty",
    polymarketEvents: 0,
    countedTrades: 0,
    wins: 0,
    winRate: 0,
    displayedConfidencePercent: 50,
    targetConfidencePercent: 95,
    targetReached: false,
    assets: [],
    latest: null,
    safety: safety()
  };
}

function readSummary() {
  return readJson(SUMMARY, summaryFallback());
}

function bankState() {
  return readJson(path.join(BANK, "state.json"), {
    ok: true,
    service: "nexora_bank_connect_state",
    connections: [],
    sessions: [],
    status: "read_only_scaffold",
    safety: safety()
  });
}

function capitalEval(input: R = {}) {
  const equityAud = Number(input.equityAud ?? input.balanceAud ?? 50);
  const requestedTradeAud = Number(input.requestedTradeAud ?? input.amount ?? 1);
  const confidence = Number(input.confidence ?? 0);

  const tiers = [
    { minAud: 0, maxAud: 99, maxTradeAud: 1, label: "micro_start" },
    { minAud: 100, maxAud: 249, maxTradeAud: 2.5, label: "micro_growth" },
    { minAud: 250, maxAud: 499, maxTradeAud: 5, label: "small_testing" },
    { minAud: 500, maxAud: 999, maxTradeAud: 10, label: "small_scale" },
    { minAud: 1000, maxAud: 2499, maxTradeAud: 25, label: "controlled_scale" },
    { minAud: 2500, maxAud: 4999, maxTradeAud: 50, label: "growth_scale" },
    { minAud: 5000, maxAud: null, maxTradeAud: 100, label: "capped_scale" }
  ];

  const tier = tiers.find((t) => equityAud >= t.minAud && (t.maxAud === null || equityAud <= t.maxAud)) || tiers[0];
  const blocked = requestedTradeAud > tier.maxTradeAud || (confidence > 0 && confidence < 80);

  return {
    ok: true,
    service: "nexora_capital_ladder_evaluation",
    generatedAt: now(),
    equityAud,
    requestedTradeAud,
    confidence,
    activeTier: tier,
    allowedMaxTradeAud: tier.maxTradeAud,
    allowedToPrepareIntent: !blocked,
    allowedToExecuteLiveNow: false,
    decision: blocked ? "BLOCK_OR_REDUCE_TRADE" : "ALLOW_DRAFT_ONLY",
    rules: ["no_martingale", "no_doubling_down", "no_auto_funding", "no_withdrawals"],
    safety: safety()
  };
}

export function registerNexoraPolyEdgeFinalCompatRoutes(app: Express): void {
  app.get("/api/nexora/polyedge-control/status", (_req, res) => res.json(event("status", { paperSummary: readSummary() })));

  app.post("/api/nexora/polyedge-control/paper/start", (req, res) => res.json(event("paper_start", { requested: req.body || {}, note: "Browser-controlled paper mode only." })));
  app.post("/api/nexora/polyedge-control/paper/stop", (req, res) => res.json(event("paper_stop", { requested: req.body || {} })));
  app.post("/api/nexora/polyedge-control/paper/cycle", (req, res) => res.json(event("paper_cycle", { requested: req.body || {}, paperSummary: readSummary() })));

  app.post("/api/nexora/polyedge-control/paper/tick", async (req, res) => {
    try {
      const symbol = String(req.body?.symbol || "BTCUSDT");
      const ticker = await fetchTicker(symbol);
      res.json(event("paper_tick", { requested: req.body || {}, ticker, paperSummary: readSummary() }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message || err), safety: safety() });
    }
  });

  app.post("/api/nexora/polyedge-control/risk/check", (req, res) => res.json(event("risk_check", { requested: req.body || {}, status: "safe_for_paper_only" })));

  app.get("/api/nexora/polyedge-control/moondev/status", (_req, res) => res.json(event("moondev_status", { status: "connected_as_strategy_reference" })));
  app.post("/api/nexora/polyedge-control/moondev/rank", (req, res) => res.json(event("moondev_rank", { requested: req.body || {} })));
  app.post("/api/nexora/polyedge-control/moondev/adapter-plan", (req, res) => res.json(event("moondev_adapter_plan", { requested: req.body || {} })));
  app.post("/api/nexora/polyedge-control/strategy/tournament", (req, res) => res.json(event("strategy_tournament", { requested: req.body || {}, mode: "paper_only" })));

  app.get("/api/nexora/polyedge-control/binance/status", (_req, res) => res.json(event("binance_status", { status: "paper_ready_live_locked" })));

  app.get("/api/nexora/polyedge-control/binance/candles", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT");
      const interval = String(req.query.interval || "5m");
      const limit = Number(req.query.limit || 100);
      const result = await fetchCandles(symbol, interval, limit);
      res.json({ ok: true, service: "nexora_binance_candles_bridge", generatedAt: now(), ...result, safety: safety() });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message || err), safety: safety() });
    }
  });

  app.post("/api/nexora/binance/paper/multi-strategy", async (req, res) => {
    try {
      const symbol = String(req.body?.symbol || "BTCUSDT");
      const result = await fetchCandles(symbol, "5m", 100);
      const signal = multiStrategySignal(symbol, result.candles);
      res.json({ ok: true, service: "nexora_binance_multi_strategy_paper", generatedAt: now(), source: result.source, result: signal, safety: safety() });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message || err), safety: safety() });
    }
  });

  app.post("/api/nexora/polyedge-control/binance/paper-strategy", async (req, res) => {
    try {
      const symbol = String(req.body?.symbol || "BTCUSDT");
      const result = await fetchCandles(symbol, "5m", 100);
      const signal = multiStrategySignal(symbol, result.candles);
      res.json(event("binance_paper_strategy", { requested: req.body || {}, source: result.source, result: signal }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message || err), safety: safety() });
    }
  });

  app.post("/api/nexora/polyedge-control/binance/paper-open", (req, res) => res.json(event("binance_paper_open", { requested: req.body || {}, status: "paper_open_recorded" })));
  app.post("/api/nexora/polyedge-control/binance/paper-close", (req, res) => res.json(event("binance_paper_close", { requested: req.body || {}, status: "paper_close_recorded" })));

  app.get("/api/nexora/polyedge-control/binance/live-intents", (_req, res) => res.json(event("binance_live_intents", { intents: [], liveOrdersEnabled: false })));
  app.post("/api/nexora/polyedge-control/binance/live-intent", (req, res) => res.json(event("binance_live_intent_draft", { requested: req.body || {}, status: "draft_only_live_locked" })));

  app.get("/api/nexora/polyedge-control/bank/status", (_req, res) => res.json(event("bank_status", { state: bankState(), transfersEnabled: false })));
  app.post("/api/nexora/polyedge-control/bank/funding-readiness", (req, res) => res.json(event("bank_funding_readiness", { requested: req.body || {}, canAutoTransfer: false })));

  app.get("/api/nexora/polyedge-control/capital/status", (_req, res) => res.json(capitalEval({ equityAud: 50, requestedTradeAud: 1, confidence: 85 })));
  app.post("/api/nexora/polyedge-control/capital/evaluate", (req, res) => res.json(capitalEval(req.body || {})));

  app.get("/api/nexora/polyedge-control/live-money/status", (_req, res) => res.json(event("live_money_status", { liveTradingEnabled: false, liveOrdersEnabled: false })));
}

import type { Express } from "express";
import fs from "fs";
import path from "path";

type JsonRecord = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "binance-strategy-plus");
const EVENTS = path.join(ROOT, "events.jsonl");

function now() {
  return new Date().toISOString();
}

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    mode: "paper_only_strategy_analysis",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    withdrawalsEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false
  };
}

async function fetchCandles(symbol = "BTCUSDT", interval = "5m", limit = 120) {
  const cleanSymbol = encodeURIComponent(symbol);
  const cleanInterval = encodeURIComponent(interval);
  const cleanLimit = encodeURIComponent(String(limit));

  const urls = [
    `https://data-api.binance.vision/api/v3/klines?symbol=${cleanSymbol}&interval=${cleanInterval}&limit=${cleanLimit}`,
    `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${cleanInterval}&limit=${cleanLimit}`
  ];

  let lastError = "";

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (Array.isArray(data) && data.length > 30) {
        return { source: url, candles: data };
      }
    } catch (error: any) {
      lastError = String(error?.message || error);
    }
  }

  throw new Error(lastError || "No Binance candle source available");
}

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return ((a - b) / b) * 100;
}

function analyse(symbol: string, candlesRaw: any[]) {
  const closes = candlesRaw.map((k) => Number(k[4])).filter(Number.isFinite);
  const highs = candlesRaw.map((k) => Number(k[2])).filter(Number.isFinite);
  const lows = candlesRaw.map((k) => Number(k[3])).filter(Number.isFinite);
  const volumes = candlesRaw.map((k) => Number(k[5])).filter(Number.isFinite);

  if (closes.length < 30) {
    return {
      ok: true,
      symbol,
      signal: "HOLD",
      strategy: "none",
      confidence: 0.5,
      reason: "insufficient_candles",
      safety: safety()
    };
  }

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const ma8 = avg(closes.slice(-8));
  const ma21 = avg(closes.slice(-21));
  const ma50 = avg(closes.slice(-50));
  const high20 = Math.max(...highs.slice(-20));
  const low20 = Math.min(...lows.slice(-20));
  const volLast = volumes[volumes.length - 1] || 0;
  const volAvg20 = avg(volumes.slice(-20));

  const strategies = [
    {
      name: "trend_follow",
      score: ma8 > ma21 && ma21 > ma50 ? 88 : ma8 > ma21 ? 72 : 42,
      side: ma8 > ma21 ? "BUY" : "HOLD",
      reason: "MA8/MA21/MA50 trend structure"
    },
    {
      name: "breakout",
      score: last >= high20 * 0.998 ? 86 : last <= low20 * 1.002 ? 38 : 55,
      side: last >= high20 * 0.998 ? "BUY" : "HOLD",
      reason: "20 candle range breakout"
    },
    {
      name: "mean_reversion",
      score: last < ma21 * 0.996 ? 82 : last > ma21 * 1.006 ? 40 : 58,
      side: last < ma21 * 0.996 ? "BUY" : "HOLD",
      reason: "distance from MA21"
    },
    {
      name: "volume_spike",
      score: volAvg20 > 0 && volLast > volAvg20 * 1.25 && last > prev ? 84 : 52,
      side: volAvg20 > 0 && volLast > volAvg20 * 1.25 && last > prev ? "BUY" : "HOLD",
      reason: "volume spike with upward price movement"
    },
    {
      name: "moondev_consensus",
      score: ((ma8 > ma21 ? 22 : 0) + (last > prev ? 18 : 0) + (last >= high20 * 0.998 ? 20 : 0) + (volLast > volAvg20 ? 15 : 0) + 25),
      side: ma8 > ma21 && last > prev ? "BUY" : "HOLD",
      reason: "MoonDev-style multi-factor consensus"
    }
  ];

  const best = strategies.sort((a, b) => b.score - a.score)[0];
  const confidence = Math.max(0.5, Math.min(0.95, best.score / 100));

  const signal = best.score >= 75 && best.side === "BUY"
    ? "PAPER_LONG"
    : "HOLD";

  return {
    ok: true,
    symbol,
    generatedAt: now(),
    price: last,
    signal,
    side: best.side,
    bestStrategy: best.name,
    confidence,
    confidencePercent: Math.round(confidence * 10000) / 100,
    reason: best.reason,
    strategies,
    market: {
      last,
      prev,
      movePct: Math.round(pct(last, prev) * 10000) / 10000,
      ma8,
      ma21,
      ma50,
      high20,
      low20,
      volLast,
      volAvg20
    },
    decision: signal === "PAPER_LONG" ? "PAPER_TRADE_CANDIDATE" : "NO_EDGE_HOLD",
    safety: safety()
  };
}

function logEvent(event: JsonRecord) {
  ensureRoot();
  fs.appendFileSync(EVENTS, JSON.stringify({ ...event, loggedAt: now() }) + "\n");
}

export function registerNexoraBinanceStrategyPlusRoutes(app: Express): void {
  app.get("/api/nexora/binance/strategy-plus/status", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_binance_strategy_plus_status",
      generatedAt: now(),
      strategies: ["trend_follow", "breakout", "mean_reversion", "volume_spike", "moondev_consensus"],
      route: "/api/nexora/binance/paper/multi-strategy",
      safety: safety()
    });
  });

  app.post("/api/nexora/binance/paper/multi-strategy", async (req, res) => {
    try {
      const symbol = String(req.body?.symbol || "BTCUSDT").toUpperCase();
      const interval = String(req.body?.interval || "5m");
      const limit = Number(req.body?.limit || 120);

      const source = await fetchCandles(symbol, interval, limit);
      const result = analyse(symbol, source.candles);

      const response = {
        ok: true,
        service: "nexora_binance_multi_strategy_paper",
        generatedAt: now(),
        source: source.source,
        result,
        safety: safety()
      };

      logEvent(response);
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        service: "nexora_binance_multi_strategy_paper",
        error: String(error?.message || error),
        safety: safety()
      });
    }
  });
}

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  closeBinancePaperTrade,
  evaluateOpenBinancePaperTrades,
  getBinancePaperSummary,
  loadBinancePaperState,
  openBinancePaperTrade,
  runBinancePaperStrategy,
  saveBinancePaperState,
  type BinanceStrategyName,
} from "../../binance/binancePaperLearningEngine";

const BINANCE_REST = process.env.BINANCE_REST_URL || "https://api.binance.com";
const BINANCE_PUBLIC_REST = process.env.BINANCE_PUBLIC_REST_URL || "https://data-api.binance.vision";

const LIVE_ENABLED = process.env.BINANCE_LIVE_TRADING_ENABLED === "true";
const PAPER_ENABLED = process.env.BINANCE_PAPER_TRADING_ENABLED !== "false";

type PaperTrade = {
  id: string;
  createdAt: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  notional: number;
  mode: "paper";
  status: "filled_paper";
  source: string;
};

const paperTrades: PaperTrade[] = [];


function binanceRunLogDir() {
  const dir = path.join(process.cwd(), "data/nexora/binance-auto-cycles");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveBinanceAutoCycleLog(payload: any) {
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(binanceRunLogDir(), `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return { id, file };
}

function listBinanceAutoCycleLogs() {
  const dir = binanceRunLogDir();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 50)
    .map((file) => {
      const full = path.join(dir, file);
      try {
        const parsed = JSON.parse(fs.readFileSync(full, "utf8"));
        return {
          file,
          generatedAt: parsed.generatedAt,
          symbol: parsed.symbol,
          interval: parsed.interval,
          strategiesRun: parsed.strategiesRun,
          summary: parsed.summary?.performance || null,
        };
      } catch {
        return { file, error: "read_failed" };
      }
    });
}


function binanceLiveIntentDir() {
  const dir = path.join(process.cwd(), "data/nexora/binance-live-intents");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveBinanceLiveIntent(payload: any) {
  const id = crypto.randomUUID();
  const file = path.join(binanceLiveIntentDir(), `${id}.json`);
  const saved = {
    id,
    createdAt: new Date().toISOString(),
    status: "pending_owner_approval",
    ...payload,
  };
  fs.writeFileSync(file, JSON.stringify(saved, null, 2));
  return saved;
}


function updateBinanceLiveIntentStatus(id: string, status: string, note: string) {
  const file = path.join(binanceLiveIntentDir(), `${id}.json`);
  if (!fs.existsSync(file)) return null;

  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  const updated = {
    ...current,
    status,
    approvalNote: note,
    updatedAt: new Date().toISOString(),
    canExecuteNow: status === "approved_owner_supervised",
  };

  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  return updated;
}

function listBinanceLiveIntents() {
  const dir = binanceLiveIntentDir();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 100)
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch {
        return { file: f, error: "read_failed" };
      }
    });
}

function now() {
  return new Date().toISOString();
}

function safety() {
  return {
    mode: LIVE_ENABLED ? "live_enabled_by_env" : "paper_only_default",
    paperTradingEnabled: PAPER_ENABLED,
    liveTradingEnabled: LIVE_ENABLED,
    liveOrdersEnabled: LIVE_ENABLED,
    withdrawalsEnabled: false,
    accountTradingEnabled: LIVE_ENABLED,
    privateKeysExposed: false,
    autonomousMoneyMovement: false,
    liveRequiresEnv: "BINANCE_LIVE_TRADING_ENABLED=true",
  };
}

function symbol(input: any) {
  return String(input || "BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g, "") || "BTCUSDT";
}

function interval(input: any) {
  const allowed = new Set(["1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d"]);
  const v = String(input || "5m");
  return allowed.has(v) ? v : "5m";
}

function limit(input: any) {
  const n = Number(input || 100);
  return Number.isFinite(n) ? Math.max(5, Math.min(500, Math.floor(n))) : 100;
}

async function publicJson(path: string) {
  for (const base of [BINANCE_PUBLIC_REST, BINANCE_REST]) {
    try {
      const r = await fetch(`${base}${path}`, { headers: { accept: "application/json" } });
      const data = await r.json().catch(() => null);
      if (r.ok) return { ok: true, base, data };
      if (data?.msg?.includes("restricted location")) continue;
      return { ok: false, base, data };
    } catch (err: any) {
      continue;
    }
  }
  return { ok: false, base: "none", data: { msg: "all public Binance endpoints failed or were region blocked" } };
}

function signedPath(path: string, params: Record<string, string | number> = {}) {
  const key = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_API_SECRET;
  if (!key || !secret) return null;

  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: String(Date.now()),
    recvWindow: "5000",
  });

  const sig = crypto.createHmac("sha256", secret).update(qs.toString()).digest("hex");
  qs.set("signature", sig);

  return { url: `${BINANCE_REST}${path}?${qs.toString()}`, key };
}

async function signedGet(path: string, params: Record<string, string | number> = {}) {
  const signed = signedPath(path, params);
  if (!signed) return { ok: false, status: "env_missing", data: null };

  const r = await fetch(signed.url, {
    headers: { "X-MBX-APIKEY": signed.key, accept: "application/json" },
  });

  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

async function latestPrice(sym: string) {
  const out = await publicJson(`/api/v3/ticker/price?symbol=${sym}`);
  const price = Number(out.data?.price);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export function registerNexoraBinanceIntegrationRoutes(app: Express) {
  app.get("/api/nexora/binance/status", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "nexora_binance_operational_ready",
      generatedAt: now(),
      phases: {
        publicMarketData: true,
        signedAccountReadiness: true,
        paperTrading: true,
        liveTradingScaffold: true,
      },
      safety: safety(),
      endpoints: [
        "/api/nexora/binance/ticker?symbol=BTCUSDT",
        "/api/nexora/binance/candles?symbol=BTCUSDT&interval=5m&limit=100",
        "/api/nexora/binance/exchange-info?symbol=BTCUSDT",
        "/api/nexora/binance/account-readiness",
        "/api/nexora/binance/account-snapshot",
        "/api/nexora/binance/paper/order",
        "/api/nexora/binance/paper/trades",
        "/api/nexora/binance/live/order",
      ],
    });
  });

  app.get("/api/nexora/binance/ticker", async (req, res) => {
    const sym = symbol(req.query.symbol);
    const out = await publicJson(`/api/v3/ticker/24hr?symbol=${sym}`);
    res.json({ ok: out.ok, service: "binance_public_ticker", symbol: sym, source: out.base, data: out.data, safety: safety() });
  });

  app.get("/api/nexora/binance/candles", async (req, res) => {
    const sym = symbol(req.query.symbol);
    const int = interval(req.query.interval);
    const lim = limit(req.query.limit);
    const out = await publicJson(`/api/v3/klines?symbol=${sym}&interval=${int}&limit=${lim}`);
    const candles = Array.isArray(out.data) ? out.data.map((c: any[]) => ({
      openTime: c[0], open: Number(c[1]), high: Number(c[2]), low: Number(c[3]), close: Number(c[4]), volume: Number(c[5]), closeTime: c[6],
    })) : [];
    res.json({ ok: out.ok, service: "binance_public_candles", symbol: sym, interval: int, limit: lim, source: out.base, candles, rawError: out.ok ? null : out.data, safety: safety() });
  });

  app.get("/api/nexora/binance/exchange-info", async (req, res) => {
    const sym = symbol(req.query.symbol);
    const out = await publicJson(`/api/v3/exchangeInfo?symbol=${sym}`);
    res.json({ ok: out.ok, service: "binance_exchange_info", symbol: sym, source: out.base, data: out.data, safety: safety() });
  });

  app.get("/api/nexora/binance/account-readiness", async (_req, res) => {
    res.json({
      ok: true,
      service: "binance_account_readiness",
      generatedAt: now(),
      env: {
        hasApiKey: Boolean(process.env.BINANCE_API_KEY),
        hasApiSecret: Boolean(process.env.BINANCE_API_SECRET),
        liveTradingEnabled: LIVE_ENABLED,
        paperTradingEnabled: PAPER_ENABLED,
      },
      next: process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET
        ? "Account snapshot endpoint can test signed read access."
        : "Add BINANCE_API_KEY and BINANCE_API_SECRET as Railway variables when ready.",
      requiredSafety: {
        withdrawalsDisabledOnBinance: true,
        useReadOnlyKeyFirst: true,
        enableTradingOnlyAfterPaperLearning: true,
        liveKillSwitchDefaultsOff: true,
      },
      safety: safety(),
    });
  });

  app.get("/api/nexora/binance/account-snapshot", async (_req, res) => {
    const account = await signedGet("/api/v3/account", {});
    res.json({
      ok: account.ok,
      service: "binance_signed_account_snapshot",
      generatedAt: now(),
      status: account.status,
      note: account.ok ? "Signed read access works." : "Signed read failed or env missing.",
      data: account.ok ? {
        canTrade: account.data?.canTrade,
        canWithdraw: account.data?.canWithdraw,
        canDeposit: account.data?.canDeposit,
        accountType: account.data?.accountType,
        permissions: account.data?.permissions,
        balances: Array.isArray(account.data?.balances)
          ? account.data.balances.filter((b: any) => Number(b.free) || Number(b.locked)).slice(0, 50)
          : [],
      } : account.data,
      safety: safety(),
    });
  });

  app.post("/api/nexora/binance/paper/order", async (req, res) => {
    if (!PAPER_ENABLED) return res.status(423).json({ ok: false, error: "paper_trading_disabled", safety: safety() });

    const body = req.body || {};
    const sym = symbol(body.symbol);
    const side = String(body.side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
    const qty = Math.max(0, Number(body.quantity || 0));
    const price = Number(body.price || await latestPrice(sym));

    if (!qty || !price) return res.status(400).json({ ok: false, error: "quantity_and_price_required", safety: safety() });

    const trade: PaperTrade = {
      id: crypto.randomUUID(),
      createdAt: now(),
      symbol: sym,
      side,
      quantity: qty,
      price,
      notional: qty * price,
      mode: "paper",
      status: "filled_paper",
      source: "nexora_binance_paper_engine",
    };

    paperTrades.unshift(trade);
    res.json({ ok: true, trade, safety: safety() });
  });

  app.get("/api/nexora/binance/paper/trades", (_req, res) => {
    res.json({ ok: true, service: "binance_paper_trades", count: paperTrades.length, trades: paperTrades.slice(0, 100), safety: safety() });
  });


  app.get("/api/nexora/binance/paper/summary", async (req, res) => {
    const markPrice = Number(req.query.markPrice || 0);
    res.json(getBinancePaperSummary(markPrice || undefined));
  });

  app.post("/api/nexora/binance/paper/reset", async (_req, res) => {
    const state = loadBinancePaperState();
    state.wallet.usdt = state.wallet.startingUsdt;
    state.wallet.reservedUsdt = 0;
    state.wallet.realisedPnl = 0;
    state.wallet.equity = state.wallet.startingUsdt;
    state.trades = [];
    state.strategyStats = {};
    saveBinancePaperState(state);
    res.json({ ok: true, reset: true, summary: getBinancePaperSummary() });
  });

  app.post("/api/nexora/binance/paper/open", async (req, res) => {
    const body = req.body || {};
    const out = openBinancePaperTrade({
      symbol: body.symbol || "BTCUSDT",
      side: String(body.side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY",
      quantity: body.quantity ? Number(body.quantity) : undefined,
      notionalUsdt: body.notionalUsdt ? Number(body.notionalUsdt) : undefined,
      price: Number(body.price),
      strategy: body.strategy || "manual",
      confidence: body.confidence === undefined ? 1 : Number(body.confidence),
      reason: body.reason || "manual_paper_open",
    });
    res.status(out.ok ? 200 : 400).json(out);
  });

  app.post("/api/nexora/binance/paper/close", async (req, res) => {
    const body = req.body || {};
    const out = closeBinancePaperTrade(String(body.id || ""), Number(body.exitPrice), body.reason || "manual_close");
    res.status(out.ok ? 200 : 400).json(out);
  });

  app.post("/api/nexora/binance/paper/evaluate", async (req, res) => {
    const body = req.body || {};
    const out = evaluateOpenBinancePaperTrades(Number(body.markPrice));
    res.json(out);
  });



  app.get("/api/nexora/binance/paper/auto-cycle/history", async (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_binance_auto_cycle_history",
      generatedAt: new Date().toISOString(),
      runs: listBinanceAutoCycleLogs(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/binance/paper/auto-cycle", async (req, res) => {
    const body = req.body || {};
    const sym = symbol(body.symbol || "BTCUSDT");
    const int = interval(body.interval || "5m");
    const lim = Math.max(80, limit(body.limit || 120));

    const strategies: BinanceStrategyName[] = [
      "trend_follow",
      "breakout",
      "rsi_reversal",
      "volatility_guard",
    ];

    const out = await publicJson(`/api/v3/klines?symbol=${sym}&interval=${int}&limit=${lim}`);
    const candles = Array.isArray(out.data) ? out.data.map((c: any[]) => ({
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    })) : [];

    const results = strategies.map((strategy) =>
      runBinancePaperStrategy({ symbol: sym, strategy, candles })
    );

    const responsePayload = {
      ok: true,
      service: "nexora_binance_paper_auto_cycle",
      generatedAt: new Date().toISOString(),
      symbol: sym,
      interval: int,
      sourceOk: out.ok,
      source: out.base,
      strategiesRun: strategies,
      results,
      summary: getBinancePaperSummary(candles.at(-1)?.close),
      safety: safety(),
    };

    const savedLog = saveBinanceAutoCycleLog(responsePayload);
    res.json({ ...responsePayload, savedLog });
  });

  app.post("/api/nexora/binance/paper/run-strategy", async (req, res) => {
    const body = req.body || {};
    const sym = symbol(body.symbol || "BTCUSDT");
    const strat = String(body.strategy || "trend_follow") as BinanceStrategyName;
    const int = interval(body.interval || "5m");
    const lim = Math.max(50, limit(body.limit || 100));

    const out = await publicJson(`/api/v3/klines?symbol=${sym}&interval=${int}&limit=${lim}`);
    const candles = Array.isArray(out.data) ? out.data.map((c: any[]) => ({
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    })) : [];

    const result = runBinancePaperStrategy({ symbol: sym, strategy: strat, candles });
    res.json({
      ok: result.ok,
      sourceOk: out.ok,
      source: out.base,
      symbol: sym,
      interval: int,
      strategy: strat,
      result,
      safety: safety(),
    });
  });


  app.post("/api/nexora/binance/live/intent", async (req, res) => {
    const body = req.body || {};
    const sym = symbol(body.symbol || "BTCUSDT");
    const side = String(body.side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
    const quantity = Number(body.quantity || 0);
    const notionalUsdt = Number(body.notionalUsdt || 0);
    const reason = String(body.reason || "owner_requested_live_intent");

    if (!quantity && !notionalUsdt) {
      return res.status(400).json({
        ok: false,
        error: "quantity_or_notional_required",
        safety: safety(),
      });
    }

    const price = await latestPrice(sym);
    const estimatedNotional = notionalUsdt || quantity * price;

    const maxPosition = Number(process.env.BINANCE_MAX_POSITION_USDT || 250);
    if (estimatedNotional > maxPosition) {
      return res.status(400).json({
        ok: false,
        blocked: true,
        error: "position_above_configured_limit",
        estimatedNotional,
        maxPosition,
        safety: safety(),
      });
    }

    const intent = saveBinanceLiveIntent({
      service: "binance_supervised_live_intent",
      symbol: sym,
      side,
      quantity,
      notionalUsdt,
      estimatedPrice: price,
      estimatedNotional,
      reason,
      requiresOwnerApproval: true,
      canExecuteNow: false,
      nextStep: "approve_intent_then_execute_with_separate_owner_action",
      safety: safety(),
    });

    res.json({ ok: true, intent });
  });

  app.get("/api/nexora/binance/live/intents", async (_req, res) => {
    res.json({
      ok: true,
      service: "binance_live_intents",
      generatedAt: new Date().toISOString(),
      intents: listBinanceLiveIntents(),
      safety: safety(),
    });
  });


  app.post("/api/nexora/binance/live/intent/:id/approve", async (req, res) => {
    const id = String(req.params.id || "");
    const note = String(req.body?.note || "owner_approved_for_supervised_execution");
    const intent = updateBinanceLiveIntentStatus(id, "approved_owner_supervised", note);

    if (!intent) {
      return res.status(404).json({ ok: false, error: "intent_not_found", id });
    }

    res.json({
      ok: true,
      approved: true,
      intent,
      nextStep: "separate supervised execute endpoint",
      safety: safety(),
    });
  });

  app.post("/api/nexora/binance/live/intent/:id/reject", async (req, res) => {
    const id = String(req.params.id || "");
    const note = String(req.body?.note || "owner_rejected");
    const intent = updateBinanceLiveIntentStatus(id, "rejected", note);

    if (!intent) {
      return res.status(404).json({ ok: false, error: "intent_not_found", id });
    }

    res.json({
      ok: true,
      rejected: true,
      intent,
      safety: safety(),
    });
  });

  app.post("/api/nexora/binance/live/order", (_req, res) => {
    if (!LIVE_ENABLED) {
      return res.status(423).json({
        ok: false,
        blocked: true,
        error: "live_binance_orders_locked",
        message: "Binance is operationally wired but live orders are disabled. Paper mode only.",
        safety: safety(),
      });
    }

    return res.status(501).json({
      ok: false,
      blocked: true,
      error: "live_order_adapter_not_enabled_in_this_patch",
      message: "Live kill-switch was enabled, but this endpoint still requires final owner-approved order adapter wiring.",
      safety: safety(),
    });
  });
}

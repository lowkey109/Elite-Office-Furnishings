import type { Express } from "express";

type JsonRecord = Record<string, any>;

const BINANCE_REST = "https://api.binance.com";
const BINANCE_PUBLIC_MARKET_DATA_REST = "https://data-api.binance.vision";
const BINANCE_REST_FALLBACKS = [
  BINANCE_PUBLIC_MARKET_DATA_REST,
  BINANCE_REST,
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];

function now() {
  return new Date().toISOString();
}

function safeSymbol(input: any): string {
  const symbol = String(input || "BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return symbol || "BTCUSDT";
}

function safeInterval(input: any): string {
  const allowed = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d"]);
  const value = String(input || "5m");
  return allowed.has(value) ? value : "5m";
}

function safeLimit(input: any): number {
  const n = Number(input || 100);
  if (!Number.isFinite(n)) return 100;
  return Math.max(10, Math.min(500, Math.floor(n)));
}


async function binancePublicJson(path: string): Promise<{ ok: boolean; sourceBase: string; data: any; error?: any }> {
  let lastError: any = null;

  for (const base of BINANCE_REST_FALLBACKS) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: "GET",
        headers: {
          accept: "application/json",
          "user-agent": "Nexora-TCD-Binance-Public-Data/1.0",
        },
      });

      const text = await response.text();
      let data: any = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      if (response.ok && !(data && typeof data === "object" && data.code === 0 && String(data.msg || "").toLowerCase().includes("restricted location"))) {
        return { ok: true, sourceBase: base, data };
      }

      lastError = {
        base,
        status: response.status,
        data,
      };
    } catch (error: any) {
      lastError = {
        base,
        message: error?.message || String(error),
      };
    }
  }

  return {
    ok: false,
    sourceBase: "none",
    data: null,
    error: lastError,
  };
}

function safety() {
  return {
    binanceMode: "public_market_data_and_locked_readiness",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    withdrawalsEnabled: false,
    accountTradingEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false,
    humanApprovalRequired: true,
    explicitOwnerApprovalRequiredForLive: true
  };
}

function envStatus() {
  const hasApiKey = Boolean(process.env.BINANCE_API_KEY);
  const hasApiSecret = Boolean(process.env.BINANCE_API_SECRET);

  return {
    hasApiKey,
    hasApiSecret,
    readyForAccountReadinessCheck: hasApiKey && hasApiSecret,
    secretValuesExposed: false,
    requiredEnv: ["BINANCE_API_KEY", "BINANCE_API_SECRET"],
    permissionPolicy: {
      withdrawalsMustBeDisabled: true,
      spotTradingMustRemainDisabledUntilApproved: true,
      readOnlyPreferredFirst: true,
      ipWhitelistRecommended: true
    }
  };
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Nexora-PolyEdge/1.0"
    }
  });

  const text = await response.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 1000) };
  }

  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

export function registerNexoraBinanceIntegrationRoutes(app: Express): void {
  app.get("/api/nexora/binance/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_binance_status",
      generatedAt: now(),
      phasesInstalled: {
        binance1PublicMarketData: true,
        binance2AccountReadiness: true,
        binance4LockedLiveScaffold: true
      },
      skippedByRequest: {
        binance3PaperExecution: true
      },
      endpoints: [
        "/api/nexora/binance/ticker?symbol=BTCUSDT",
        "/api/nexora/binance/candles?symbol=BTCUSDT&interval=5m&limit=100",
        "/api/nexora/binance/symbols",
        "/api/nexora/binance/account-readiness",
        "/api/nexora/binance/live-scaffold/status",
        "/api/nexora/binance/live-scaffold/checklist",
        "/api/nexora/binance/live-scaffold/trade-intent"
      ],
      safety: safety()
    });
  });

  app.get("/api/nexora/binance/ticker", async (req, res) => {
    const symbol = safeSymbol(req.query.symbol);
    const result = await fetchJson(`${BINANCE_REST}/api/v3/ticker/24hr?symbol=${symbol}`);

    res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      nexoraBrain: true,
      service: "nexora_binance_public_ticker",
      generatedAt: now(),
      symbol,
      source: "binance_public_rest",
      ticker: result.data,
      safety: safety()
    });
  });

  app.get("/api/nexora/binance/candles", async (req, res) => {
    const symbol = safeSymbol(req.query.symbol);
    const interval = safeInterval(req.query.interval);
    const limit = safeLimit(req.query.limit);

    const result = await fetchJson(`${BINANCE_REST}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);

    const candles = Array.isArray(result.data)
      ? result.data.map((k: any[]) => ({
          openTime: k[0],
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5]),
          closeTime: k[6]
        }))
      : [];

    res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      nexoraBrain: true,
      service: "nexora_binance_public_candles",
      generatedAt: now(),
      symbol,
      interval,
      limit,
      source: "binance_public_rest",
      candles,
      rawError: result.ok ? null : result.data,
      safety: safety()
    });
  });

  app.get("/api/nexora/binance/symbols", async (_req, res) => {
    const result = await fetchJson(`${BINANCE_REST}/api/v3/exchangeInfo`);

    const symbols = result.ok && Array.isArray(result.data?.symbols)
      ? result.data.symbols
          .filter((s: any) => s.status === "TRADING")
          .slice(0, 500)
          .map((s: any) => ({
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            status: s.status
          }))
      : [];

    res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      nexoraBrain: true,
      service: "nexora_binance_public_symbols",
      generatedAt: now(),
      count: symbols.length,
      symbols,
      rawError: result.ok ? null : result.data,
      safety: safety()
    });
  });

  app.get("/api/nexora/binance/account-readiness", (_req, res) => {
    const env = envStatus();

    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_binance_account_readiness",
      generatedAt: now(),
      status: env.readyForAccountReadinessCheck ? "env_present_locked" : "env_missing_or_incomplete",
      accountReadiness: env,
      nextAllowedStep: env.readyForAccountReadinessCheck
        ? "read_only_account_probe_later_after_owner_approval"
        : "set_BINANCE_API_KEY_and_BINANCE_API_SECRET_later_if_required",
      blockedNow: [
        "no live orders",
        "no withdrawals",
        "no account trading",
        "no autonomous execution"
      ],
      safety: safety()
    });
  });

  app.get("/api/nexora/binance/live-scaffold/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_binance_live_scaffold_status",
      generatedAt: now(),
      status: "locked_scaffold_only",
      canExecuteLiveNow: false,
      canPlaceOrdersNow: false,
      canWithdrawNow: false,
      purpose: "Prepare supervised live trading architecture only. Does not execute trades.",
      safety: safety()
    });
  });

  app.get("/api/nexora/binance/live-scaffold/checklist", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_binance_live_scaffold_checklist",
      generatedAt: now(),
      requiredBeforeAnyLiveTrading: [
        "explicit owner approval",
        "restricted Binance API key",
        "withdrawals disabled",
        "IP whitelist enabled",
        "per-trade cap",
        "daily loss cap",
        "kill switch tested",
        "human approval screen",
        "paper evidence reviewed"
      ],
      hardBlocks: [
        "no live order execution now",
        "no withdrawal permission",
        "no autonomous trading",
        "no secrets exposed in logs or chat"
      ],
      safety: safety()
    });
  });

  app.post("/api/nexora/binance/live-scaffold/trade-intent", (req, res) => {
    const body = (req.body || {}) as JsonRecord;
    const symbol = safeSymbol(body.symbol || body.market || "BTCUSDT");

    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_binance_locked_trade_intent",
      generatedAt: now(),
      status: "DRAFT_ONLY_NOT_EXECUTABLE",
      executableByNexora: false,
      tradeIntent: {
        symbol,
        side: body.side || "BUY",
        quantity: body.quantity || null,
        maxNotionalUsd: Number(body.maxNotionalUsd || 0),
        reason: body.reason || "Draft only. No live execution.",
        requiresHumanApproval: true,
        requiresRestrictedBinanceKey: true,
        withdrawalsMustBeDisabled: true
      },
      blockedActions: [
        "order placement",
        "withdrawals",
        "autonomous execution",
        "secret exposure"
      ],
      safety: safety()
    });
  });
}

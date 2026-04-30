import { db } from "../../db";
import { desc, eq } from "drizzle-orm";
import {
  paperPositions,
  paperTradeOutcomes,
  paperTradingDecisions,
} from "@shared/schema";

const CRYPTO_FEEDS: Record<string, string> = {
  "BTC/USD": "BTCUSDT",
  "ETH/USD": "ETHUSDT",
  "SOL/USD": "SOLUSDT",
};

function money(v: unknown) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function pct(v: number) {
  return Number.isFinite(v) ? Math.round(v * 10000) / 100 : null;
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PolyEdge-RealMonitor/1.0" },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getMarketFeed(symbol: string) {
  const feedSymbol = CRYPTO_FEEDS[symbol];

  if (!feedSymbol) {
    return {
      symbol,
      sourceType: "WAITING_FOR_REAL_FEED",
      status: "WAITING_FOR_REAL_FEED",
      reason: `No real feed configured for ${symbol}`,
    };
  }

  const [ticker, book, candles] = await Promise.all([
    fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${feedSymbol}`),
    fetchJson(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${feedSymbol}`),
    fetchJson(`https://api.binance.com/api/v3/klines?symbol=${feedSymbol}&interval=1m&limit=60`),
  ]);

  if (!ticker || !book || !Array.isArray(candles)) {
    return {
      symbol,
      sourceType: "WAITING_FOR_REAL_FEED",
      status: "WAITING_FOR_REAL_FEED",
      reason: `Real feed unavailable for ${symbol}`,
    };
  }

  const price = num(ticker.lastPrice);
  const bid = num(book.bidPrice);
  const ask = num(book.askPrice);
  const spread = bid !== null && ask !== null ? money(ask - bid) : null;
  const spreadPct = spread !== null && price ? pct(spread / price) : null;

  const parsedCandles = candles
    .map((c: any[]) => ({
      high: num(c[2]),
      low: num(c[3]),
      close: num(c[4]),
      volume: num(c[5]),
    }))
    .filter((c: any) => c.high !== null && c.low !== null && c.close !== null);

  const atrCandles = parsedCandles.slice(-14);
  const atr = atrCandles.length
    ? money(atrCandles.reduce((sum: number, c: any) => sum + Math.abs(c.high - c.low), 0) / atrCandles.length)
    : null;

  const atrPct = atr !== null && price ? pct(atr / price) : null;
  const change24h = num(ticker.priceChangePercent);

  return {
    symbol,
    sourceType: "REAL_MARKET_FEED",
    status: "REAL",
    provider: "binance",
    price,
    bid,
    ask,
    spread,
    spreadPct,
    atr,
    atrPct,
    change24h,
    volume24h: num(ticker.volume),
    candles: parsedCandles,
    updatedAt: new Date().toISOString(),
  };
}

function positionPnl(pos: any) {
  const entry = Number(pos.entryPrice || 0);
  const current = Number(pos.currentPrice || pos.entryPrice || 0);
  const side = String(pos.side || "long");
  if (!entry || !current) return 0;
  return money(side === "short" ? entry - current : current - entry);
}

export async function getPolyEdgeAdditiveRealMonitors() {
  const [openPositions, outcomes, decisions] = await Promise.all([
    db.select().from(paperPositions).where(eq(paperPositions.status, "open")).catch(() => []),
    db.select().from(paperTradeOutcomes).orderBy(desc(paperTradeOutcomes.createdAt)).limit(120).catch(() => []),
    db.select().from(paperTradingDecisions).limit(120).catch(() => []),
  ]);

  const sortedDecisions = [...(decisions as any[])].sort((a, b) =>
    new Date(b.createdAt || b.updatedAt || 0).getTime() -
    new Date(a.createdAt || a.updatedAt || 0).getTime()
  );

  const latestDecision: any = sortedDecisions[0] || null;

  let autoPaper: any = null;
  try {
    const mod = await import("../trading/polyEdgeAutoPaper");
    autoPaper = await mod.getPolyEdgeAutoPaperStatus();
  } catch {
    autoPaper = null;
  }

  let capitalState: any = null;
  try {
    const mod = await import("./polyEdgeCapitalStore");
    capitalState = await mod.getPolyEdgeCapitalState();
  } catch {
    capitalState = null;
  }

  const symbols = Array.from(new Set([
    "BTC/USD",
    "ETH/USD",
    "SOL/USD",
    "XAUUSD",
    latestDecision?.market,
    ...(openPositions as any[]).map((p) => p.symbol),
  ].filter(Boolean)));

  const marketFeeds = await Promise.all(symbols.map((symbol) => getMarketFeed(String(symbol))));
  const realFeeds = marketFeeds.filter((f: any) => f.sourceType === "REAL_MARKET_FEED");
  const primaryFeed: any = realFeeds[0] || marketFeeds[0] || null;

  const wins = (outcomes as any[]).filter((o) => String(o.outcome) === "win");
  const losses = (outcomes as any[]).filter((o) => String(o.outcome) === "loss");
  const totalPnl = money((outcomes as any[]).reduce((sum, o) => sum + Number(o.realizedPnl || 0), 0));
  const grossWins = money(wins.reduce((sum, o) => sum + Math.max(0, Number(o.realizedPnl || 0)), 0));
  const grossLosses = Math.abs(money(losses.reduce((sum, o) => sum + Math.min(0, Number(o.realizedPnl || 0)), 0)));
  const winRate = outcomes.length ? pct(wins.length / outcomes.length) : null;
  const profitFactor = grossLosses > 0 ? money(grossWins / grossLosses) : grossWins > 0 ? 99 : null;

  const exposure = money((openPositions as any[]).reduce((sum, p) => sum + Number(p.paperCapitalAllocated || 0), 0));
  const openPnl = money((openPositions as any[]).reduce((sum, p) => sum + positionPnl(p), 0));

  const strategyMap: Record<string, any> = {};
  for (const o of outcomes as any[]) {
    const key = o.strategy || "unknown";
    if (!strategyMap[key]) strategyMap[key] = { strategy: key, trades: 0, wins: 0, pnl: 0 };
    strategyMap[key].trades += 1;
    strategyMap[key].wins += String(o.outcome) === "win" ? 1 : 0;
    strategyMap[key].pnl += Number(o.realizedPnl || 0);
  }

  const strategyLeaderboard = Object.values(strategyMap)
    .map((row: any) => ({
      sourceType: "REAL_CALCULATED_FROM_DB",
      strategy: row.strategy,
      trades: row.trades,
      winRate: row.trades ? pct(row.wins / row.trades) : null,
      pnl: money(row.pnl),
    }))
    .sort((a: any, b: any) => Number(b.pnl || 0) - Number(a.pnl || 0))
    .slice(0, 5);

  const marketRegime =
    primaryFeed?.sourceType === "REAL_MARKET_FEED"
      ? {
          sourceType: "REAL_CALCULATED_FROM_MARKET_FEED",
          symbol: primaryFeed.symbol,
          regime:
            Number(primaryFeed.change24h || 0) > 0.2
              ? "TRENDING UP"
              : Number(primaryFeed.change24h || 0) < -0.2
                ? "TRENDING DOWN"
                : "RANGE / NORMAL",
          score: Math.max(1, Math.min(99, Math.round(50 + Number(primaryFeed.change24h || 0)))),
          price: primaryFeed.price,
          change24h: primaryFeed.change24h,
        }
      : {
          sourceType: "WAITING_FOR_REAL_FEED",
          symbol: primaryFeed?.symbol || "WAITING",
          regime: "WAITING_FOR_REAL_FEED",
          score: null,
          price: null,
          change24h: null,
        };

  const volatilityAtr =
    primaryFeed?.sourceType === "REAL_MARKET_FEED"
      ? {
          sourceType: "REAL_CALCULATED_FROM_MARKET_FEED",
          symbol: primaryFeed.symbol,
          atr: primaryFeed.atr,
          atrPct: primaryFeed.atrPct,
          mode: Number(primaryFeed.atrPct || 0) > 0.25 ? "HIGH VOL" : Number(primaryFeed.atrPct || 0) < 0.05 ? "LOW VOL" : "NORMAL",
        }
      : {
          sourceType: "WAITING_FOR_REAL_FEED",
          symbol: primaryFeed?.symbol || "WAITING",
          atr: null,
          atrPct: null,
          mode: "WAITING_FOR_REAL_FEED",
        };

  const liquidity =
    primaryFeed?.sourceType === "REAL_MARKET_FEED"
      ? {
          sourceType: "REAL_MARKET_FEED",
          symbol: primaryFeed.symbol,
          spread: primaryFeed.spread,
          spreadPct: primaryFeed.spreadPct,
          volume24h: primaryFeed.volume24h,
          status: "REAL_SPREAD_VOLUME",
        }
      : {
          sourceType: "WAITING_FOR_REAL_FEED",
          symbol: primaryFeed?.symbol || "WAITING",
          spread: null,
          spreadPct: null,
          volume24h: null,
          status: "WAITING_FOR_REAL_FEED",
        };

  const newsRisk = process.env.POLYEDGE_NEWS_FEED_URL
    ? {
        sourceType: "REAL_FEED_CONFIGURED",
        status: "CONFIGURED",
        headline: "POLYEDGE_NEWS_FEED_URL configured",
      }
    : {
        sourceType: "REAL_FEED_REQUIRED",
        status: "WAITING_FOR_REAL_FEED",
        headline: "Set POLYEDGE_NEWS_FEED_URL for real news/event risk",
      };

  let equity = 100000;
  let peak = 100000;
  let maxDrawdown = 0;

  for (const o of [...(outcomes as any[])].reverse()) {
    equity += Number(o.realizedPnl || 0);
    peak = Math.max(peak, equity);
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, dd);
  }

  const currentDrawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;

  return {
    ok: true,
    additiveOnly: true,
    existingPanelsUntouched: true,
    generatedAt: new Date().toISOString(),

    cards: [
      {
        title: "Market Regime",
        sourceType: marketRegime.sourceType,
        value: marketRegime.regime,
        sub: `${marketRegime.symbol} ${marketRegime.change24h ?? "WAIT"}%`,
      },
      {
        title: "Volatility / ATR",
        sourceType: volatilityAtr.sourceType,
        value: volatilityAtr.mode,
        sub: `${volatilityAtr.symbol} ATR ${volatilityAtr.atr ?? "WAIT"}`,
      },
      {
        title: "Liquidity / Spread",
        sourceType: liquidity.sourceType,
        value: liquidity.status,
        sub: `${liquidity.symbol} spread ${liquidity.spread ?? "WAIT"}`,
      },
      {
        title: "News / Event Risk",
        sourceType: newsRisk.sourceType,
        value: newsRisk.status,
        sub: newsRisk.headline,
      },
      {
        title: "Auto Paper",
        sourceType: autoPaper ? "REAL_DB" : "WAITING_FOR_REAL_FEED",
        value: autoPaper?.enabled ? "FAST LEARNING" : "STOPPED",
        sub: autoPaper?.lastReason || "Waiting for auto paper service",
      },
      {
        title: "Learning",
        sourceType: "REAL_CALCULATED_FROM_DB",
        value: `${winRate ?? "WAIT"}% WR`,
        sub: `${outcomes.length} samples • PF ${profitFactor ?? "WAIT"}`,
      },
      {
        title: "Risk Governor",
        sourceType: "REAL_CALCULATED_FROM_DB",
        value: `${openPositions.length} open`,
        sub: `Exposure ${exposure} • Open P&L ${openPnl}`,
      },
      {
        title: "Capital Mode",
        sourceType: capitalState ? "REAL_DB" : "WAITING_FOR_REAL_FEED",
        value: `Paper ${money(capitalState?.paperMoneyBalance || 0)}`,
        sub: `Real tracked ${money(capitalState?.realMoneyBalance || 0)}`,
      },
      {
        title: "Drawdown Recovery",
        sourceType: "REAL_CALCULATED_FROM_DB",
        value: `${money(currentDrawdown)}% DD`,
        sub: `Peak ${money(peak)} • Max DD ${money(maxDrawdown)}%`,
      },
      {
        title: "Decision Explainer",
        sourceType: latestDecision ? "REAL_DB" : "WAITING_FOR_REAL_FEED",
        value: latestDecision?.market || "WAITING",
        sub: latestDecision?.reasonCode || "Waiting for next real decision",
      },
    ],

    strategyLeaderboard,
    marketFeeds,
  };
}

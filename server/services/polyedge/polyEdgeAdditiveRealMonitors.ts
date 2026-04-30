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

function getWalletFlowIntelligence() {
  const chains = [
    {
      chain: "Bitcoin",
      env: "POLYEDGE_BTC_CHAIN_STREAM_URL",
      tokenScope: "BTC / UTXO flow",
    },
    {
      chain: "Ethereum / EVM",
      env: "POLYEDGE_EVM_CHAIN_STREAM_URL",
      tokenScope: "ETH + ERC20 + EVM tokens",
    },
    {
      chain: "Solana",
      env: "POLYEDGE_SOL_CHAIN_STREAM_URL",
      tokenScope: "SOL + SPL tokens",
    },
    {
      chain: "Multi-chain Token Index",
      env: "POLYEDGE_TOKEN_INDEX_URL",
      tokenScope: "All indexed tokens",
    },
  ];

  const chainStatus = chains.map((row) => ({
    chain: row.chain,
    tokenScope: row.tokenScope,
    sourceType: process.env[row.env] ? "REAL_CHAIN_STREAM_CONFIGURED" : "WAITING_FOR_CHAIN_STREAM",
    status: process.env[row.env] ? "CONFIGURED" : "WAITING_FOR_CHAIN_STREAM",
  }));

  const configured = chainStatus.filter((row) => row.status === "CONFIGURED").length;

  return {
    sourceType: configured > 0 ? "PARTIAL_CHAIN_STREAM_CONFIGURED" : "WAITING_FOR_CHAIN_STREAM",
    status: configured > 0 ? `${configured}/${chains.length} STREAMS CONFIGURED` : "WAITING_FOR_CHAIN_STREAM",
    chains: chainStatus,
    scanRate: configured > 0 ? "READY_FOR_STREAM_RUNTIME" : "WAITING_FOR_CHAIN_STREAM",
    walletsObservedPerMinute: configured > 0 ? "READY_FOR_STREAM_RUNTIME" : "WAITING_FOR_CHAIN_STREAM",
    exchangeInflow: "WAITING_FOR_ENTITY_LABELS",
    exchangeOutflow: "WAITING_FOR_ENTITY_LABELS",
    whaleAccumulation: configured > 0 ? "READY_FOR_CLASSIFIER" : "WAITING_FOR_CHAIN_STREAM",
    smartMoneyDirection: configured > 0 ? "READY_FOR_CLASSIFIER" : "WAITING_FOR_CHAIN_STREAM",
    tradeImpact: configured > 0 ? "PAPER_ONLY_UNTIL_VALIDATED" : "DISABLED_UNTIL_REAL_FLOW",
  };
}

function spreadFromBidAsk(bid: unknown, ask: unknown) {
  const b = num(bid);
  const a = num(ask);
  if (b === null || a === null) return null;
  return money(a - b);
}

function exchangeStatus(ok: boolean) {
  return ok ? "PUBLIC_FEED_ONLINE" : "WAITING_FOR_PUBLIC_FEED";
}

async function getPublicExchangeFlow() {
  const [binanceBtc, binanceEth, binanceSol, kraken, okxBtc, okxEth, okxSol] = await Promise.all([
    fetchJson("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
    fetchJson("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT"),
    fetchJson("https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT"),
    fetchJson("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD"),
    fetchJson("https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT"),
    fetchJson("https://www.okx.com/api/v5/market/ticker?instId=ETH-USDT"),
    fetchJson("https://www.okx.com/api/v5/market/ticker?instId=SOL-USDT"),
  ]);

  const krakenResults = kraken && typeof kraken === "object" && kraken.result ? Object.values(kraken.result as Record<string, any>) : [];
  const krakenOnline = Array.isArray(krakenResults) && krakenResults.length > 0;

  const okxRows = [okxBtc, okxEth, okxSol]
    .map((r: any) => Array.isArray(r?.data) ? r.data[0] : null)
    .filter(Boolean);

  const binanceRows = [binanceBtc, binanceEth, binanceSol].filter(Boolean);

  const binanceVolume = money(binanceRows.reduce((sum: number, row: any) => sum + Number(row.quoteVolume || 0), 0));
  const krakenVolume = money(krakenResults.reduce((sum: number, row: any) => {
    const volume = Array.isArray(row?.v) ? Number(row.v[1] || row.v[0] || 0) : 0;
    const close = Array.isArray(row?.c) ? Number(row.c[0] || 0) : 0;
    return sum + volume * close;
  }, 0));
  const okxVolume = money(okxRows.reduce((sum: number, row: any) => sum + Number(row.volCcy24h || row.vol24h || 0), 0));

  const binanceSpreads = binanceRows.map((row: any) => {
    const weightedAvg = num(row.weightedAvgPrice);
    const last = num(row.lastPrice);
    return weightedAvg !== null && last !== null ? Math.abs(last - weightedAvg) : null;
  }).filter((v: any) => v !== null);

  const okxSpreads = okxRows.map((row: any) => spreadFromBidAsk(row.bidPx, row.askPx)).filter((v: any) => v !== null);

  const allSpreadSamples = [...binanceSpreads, ...okxSpreads];
  const avgSpread = allSpreadSamples.length
    ? money(allSpreadSamples.reduce((sum: number, v: any) => sum + Number(v || 0), 0) / allSpreadSamples.length)
    : null;

  const onlineCount = [
    binanceRows.length > 0,
    krakenOnline,
    okxRows.length > 0,
  ].filter(Boolean).length;

  const totalVolume = money(binanceVolume + krakenVolume + okxVolume);

  return {
    sourceType: onlineCount > 0 ? "PUBLIC_EXCHANGE_FEEDS" : "WAITING_FOR_PUBLIC_FEED",
    status: onlineCount > 0 ? `${onlineCount}/3 PUBLIC FEEDS ONLINE` : "WAITING_FOR_PUBLIC_FEED",
    exchanges: {
      binance: {
        sourceType: binanceRows.length > 0 ? "PUBLIC_BINANCE_FEED" : "WAITING_FOR_PUBLIC_FEED",
        status: exchangeStatus(binanceRows.length > 0),
        pairs: binanceRows.length,
        quoteVolume24h: binanceVolume,
      },
      kraken: {
        sourceType: krakenOnline ? "PUBLIC_KRAKEN_FEED" : "WAITING_FOR_PUBLIC_FEED",
        status: exchangeStatus(krakenOnline),
        pairs: krakenResults.length,
        quoteVolume24h: krakenVolume,
      },
      okx: {
        sourceType: okxRows.length > 0 ? "PUBLIC_OKX_FEED" : "WAITING_FOR_PUBLIC_FEED",
        status: exchangeStatus(okxRows.length > 0),
        pairs: okxRows.length,
        quoteVolume24h: okxVolume,
      },
    },
    totalVolume24h: totalVolume,
    avgSpread,
    volumePressure: totalVolume > 0 ? "PUBLIC_VOLUME_VISIBLE" : "WAITING_FOR_PUBLIC_FEED",
    spreadPressure: avgSpread !== null ? "PUBLIC_SPREAD_VISIBLE" : "WAITING_FOR_PUBLIC_FEED",
  };
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
  const sortedOpenPositions = [...(openPositions as any[])].sort((a, b) =>
    new Date(b.createdAt || b.updatedAt || 0).getTime() -
    new Date(a.createdAt || a.updatedAt || 0).getTime()
  );
  const latestOpenPosition: any = sortedOpenPositions[0] || null;
  const latestOutcome: any = (outcomes as any[])[0] || null;

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

  const closedPnl = totalPnl;
  const totalPaperPnl = money(closedPnl + openPnl);
  const lossStrategyMap: Record<string, any> = {};
  for (const outcome of outcomes as any[]) {
    const key = outcome.strategy || "unknown";
    if (!lossStrategyMap[key]) lossStrategyMap[key] = { strategy: key, trades: 0, pnl: 0 };
    lossStrategyMap[key].trades += 1;
    lossStrategyMap[key].pnl += Number(outcome.realizedPnl || 0);
  }

  const losingStrategies = Object.values(lossStrategyMap)
    .map((row: any) => ({
      strategy: row.strategy,
      trades: row.trades,
      pnl: money(row.pnl),
    }))
    .filter((row: any) => Number(row.pnl || 0) < -100)
    .sort((x: any, y: any) => Number(x.pnl || 0) - Number(y.pnl || 0))
    .slice(0, 3);

  const paperLossGovernor = {
    sourceType: "REAL_CALCULATED_FROM_DB",
    active: outcomes.length >= 10 && (totalPnl < -500 || losingStrategies.length > 0),
    mode: outcomes.length >= 10 && (totalPnl < -500 || losingStrategies.length > 0)
      ? "LOSS_GOVERNOR_ACTIVE"
      : "NORMAL_LEARNING",
    totalPnl,
    losingStrategies,
    action: outcomes.length >= 10 && (totalPnl < -500 || losingStrategies.length > 0)
      ? "MICRO_SIZE_AND_AVOID_WORST"
      : "NORMAL_PAPER_LEARNING",
  };

  const paperProfitMonitor = {
    sourceType: "REAL_CALCULATED_FROM_DB",
    closedPnl,
    openPnl,
    totalPaperPnl,
    winRate,
    profitFactor,
    tradesClosed: outcomes.length,
    openPositions: openPositions.length,
    exposure,
    lastClosedTrade: latestOutcome
      ? {
          symbol: latestOutcome.symbol || "UNKNOWN",
          outcome: latestOutcome.outcome || "CLOSED",
          pnl: money(latestOutcome.realizedPnl || 0),
          reason: latestOutcome.exitReason || "closed",
        }
      : null,
  };

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

  const realExecutionEnabled = String(process.env.POLYEDGE_REAL_EXECUTION_ENABLED || "").toLowerCase() === "true";
  const realExchangeConfigured = Boolean(process.env.POLYEDGE_REAL_EXCHANGE || process.env.POLYEDGE_REAL_EXCHANGE_API_KEY);
  const realExecutionActivity = {
    sourceType: realExecutionEnabled && realExchangeConfigured ? "REAL_EXECUTION_CONFIGURED" : "WAITING_FOR_REAL_EXECUTION_CONFIG",
    status: realExecutionEnabled && realExchangeConfigured ? "ARMED_REQUIRES_CONFIRMATION" : "REAL_TRADING_DISABLED",
    capitalAtRisk: 0,
    lastOrder: "NO_REAL_ORDERS_PLACED",
    exchange: process.env.POLYEDGE_REAL_EXCHANGE || "WAITING_FOR_REAL_EXCHANGE",
  };

  const walletFlow = getWalletFlowIntelligence();
  const exchangeFlow = await getPublicExchangeFlow();

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
        title: "Paper Loss Governor",
        sourceType: paperLossGovernor.sourceType,
        value: paperLossGovernor.mode,
        sub: paperLossGovernor.active
          ? `Action ${paperLossGovernor.action} • P&L ${money(paperLossGovernor.totalPnl)}`
          : "Normal paper learning",
      },
      {
        title: "Worst Paper Strategies",
        sourceType: paperLossGovernor.sourceType,
        value: paperLossGovernor.losingStrategies.length
          ? paperLossGovernor.losingStrategies.map((row: any) => row.strategy).join(", ")
          : "NONE_FLAGGED",
        sub: paperLossGovernor.losingStrategies.length
          ? paperLossGovernor.losingStrategies.map((row: any) => `${row.strategy} ${money(row.pnl)}`).join(" • ")
          : "No strategy loss block active",
      },
      {
        title: "Paper Profit Monitor",
        sourceType: paperProfitMonitor.sourceType,
        value: `${money(paperProfitMonitor.totalPaperPnl)} total P&L`,
        sub: `Closed ${money(paperProfitMonitor.closedPnl)} • Open ${money(paperProfitMonitor.openPnl)}`,
      },
      {
        title: "Paper Win / PF",
        sourceType: paperProfitMonitor.sourceType,
        value: `${paperProfitMonitor.winRate ?? "WAIT"}% WR`,
        sub: `${paperProfitMonitor.tradesClosed} closed • PF ${paperProfitMonitor.profitFactor ?? "WAIT"}`,
      },
      {
        title: "Paper Exposure",
        sourceType: paperProfitMonitor.sourceType,
        value: `${paperProfitMonitor.openPositions} open`,
        sub: `Allocated ${money(paperProfitMonitor.exposure)} • Open P&L ${money(paperProfitMonitor.openPnl)}`,
      },
      {
        title: "Last Closed Paper Trade",
        sourceType: paperProfitMonitor.lastClosedTrade ? "REAL_DB" : "WAITING_FOR_OUTCOME",
        value: paperProfitMonitor.lastClosedTrade
          ? `${paperProfitMonitor.lastClosedTrade.symbol} ${money(paperProfitMonitor.lastClosedTrade.pnl)}`
          : "NO_CLOSED_TRADE",
        sub: paperProfitMonitor.lastClosedTrade
          ? `${paperProfitMonitor.lastClosedTrade.outcome} • ${paperProfitMonitor.lastClosedTrade.reason}`
          : "Waiting for first closed paper trade",
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
        title: "Exchange Feed Status",
        sourceType: exchangeFlow.sourceType,
        value: exchangeFlow.status,
        sub: "Binance + Kraken + OKX public feeds",
      },
      {
        title: "Binance Liquidity",
        sourceType: exchangeFlow.exchanges.binance.sourceType,
        value: exchangeFlow.exchanges.binance.status,
        sub: `${exchangeFlow.exchanges.binance.pairs} pairs • Vol ${exchangeFlow.exchanges.binance.quoteVolume24h}`,
      },
      {
        title: "Kraken Liquidity",
        sourceType: exchangeFlow.exchanges.kraken.sourceType,
        value: exchangeFlow.exchanges.kraken.status,
        sub: `${exchangeFlow.exchanges.kraken.pairs} pairs • Vol ${exchangeFlow.exchanges.kraken.quoteVolume24h}`,
      },
      {
        title: "OKX Liquidity",
        sourceType: exchangeFlow.exchanges.okx.sourceType,
        value: exchangeFlow.exchanges.okx.status,
        sub: `${exchangeFlow.exchanges.okx.pairs} pairs • Vol ${exchangeFlow.exchanges.okx.quoteVolume24h}`,
      },
      {
        title: "Spread Pressure",
        sourceType: exchangeFlow.sourceType,
        value: exchangeFlow.spreadPressure,
        sub: `Avg public spread sample ${exchangeFlow.avgSpread ?? "WAIT"}`,
      },
      {
        title: "Volume Pressure",
        sourceType: exchangeFlow.sourceType,
        value: exchangeFlow.volumePressure,
        sub: `Combined public 24h volume ${exchangeFlow.totalVolume24h}`,
      },
      {
        title: "Paper Execution",
        sourceType: autoPaper ? "REAL_AUTO_PAPER_STATE" : "WAITING_FOR_AUTO_PAPER",
        value: autoPaper?.enabled ? "PAPER_ACTIVE" : "PAPER_STOPPED",
        sub: `Running ${autoPaper?.running ? "YES" : "NO"} • ticks ${autoPaper?.ticks || 0}`,
      },
      {
        title: "Paper Last Action",
        sourceType: autoPaper ? "REAL_AUTO_PAPER_STATE" : "WAITING_FOR_AUTO_PAPER",
        value: autoPaper?.lastAction || "WAITING",
        sub: autoPaper?.lastReason || "No paper action recorded",
      },
      {
        title: "Paper Open Exposure",
        sourceType: "REAL_CALCULATED_FROM_DB",
        value: `${openPositions.length} open / ${money(exposure)} allocated`,
        sub: `Open P&L ${money(openPnl)} • outcomes ${outcomes.length}`,
      },
      {
        title: "Paper Last Position",
        sourceType: latestOpenPosition ? "REAL_DB" : "WAITING_FOR_PAPER_POSITION",
        value: latestOpenPosition
          ? `${String(latestOpenPosition.side || "").toUpperCase()} ${latestOpenPosition.symbol}`
          : "NO_OPEN_POSITION",
        sub: latestOpenPosition
          ? `${latestOpenPosition.strategy || "strategy"} • entry ${latestOpenPosition.entryPrice} • capital ${money(latestOpenPosition.paperCapitalAllocated || 0)}`
          : "Waiting for paper position",
      },
      {
        title: "Paper Last Decision",
        sourceType: latestDecision ? "REAL_DB" : "WAITING_FOR_DECISION",
        value: latestDecision
          ? `${String(latestDecision.direction || "").toUpperCase()} ${latestDecision.market}`
          : "WAITING",
        sub: latestDecision
          ? `${latestDecision.strategy || "strategy"} • confidence ${latestDecision.confidence ?? "WAIT"} • risk ${money(latestDecision.riskAmount || 0)}`
          : "Waiting for paper decision",
      },
      {
        title: "Paper Recent Outcome",
        sourceType: latestOutcome ? "REAL_DB" : "WAITING_FOR_OUTCOME",
        value: latestOutcome
          ? `${String(latestOutcome.outcome || "closed").toUpperCase()} ${money(latestOutcome.realizedPnl || 0)}`
          : "NO_OUTCOME_YET",
        sub: latestOutcome
          ? `${latestOutcome.symbol || "symbol"} • ${latestOutcome.exitReason || "closed"}`
          : "Waiting for closed paper trades",
      },
      {
        title: "Real Execution",
        sourceType: realExecutionActivity.sourceType,
        value: realExecutionActivity.status,
        sub: `${realExecutionActivity.exchange} • ${realExecutionActivity.lastOrder}`,
      },
      {
        title: "Real Capital At Risk",
        sourceType: realExecutionActivity.sourceType,
        value: realExecutionActivity.capitalAtRisk,
        sub: "Real money disabled until explicit execution config",
      },
      {
        title: "Wallet Flow Scan",
        sourceType: walletFlow.sourceType,
        value: walletFlow.status,
        sub: "BTC + ETH/EVM + SOL + token index",
      },
      {
        title: "Wallets / Minute",
        sourceType: walletFlow.sourceType,
        value: walletFlow.walletsObservedPerMinute,
        sub: "Stream processing required — no wallet polling",
      },
      {
        title: "Exchange Inflow",
        sourceType: "WAITING_FOR_ENTITY_LABELS",
        value: walletFlow.exchangeInflow,
        sub: "Needs labelled exchange wallets/entities",
      },
      {
        title: "Exchange Outflow",
        sourceType: "WAITING_FOR_ENTITY_LABELS",
        value: walletFlow.exchangeOutflow,
        sub: "Needs labelled exchange wallets/entities",
      },
      {
        title: "Whale Accumulation",
        sourceType: walletFlow.sourceType,
        value: walletFlow.whaleAccumulation,
        sub: "Large transfer classifier pending",
      },
      {
        title: "Smart Money Direction",
        sourceType: walletFlow.sourceType,
        value: walletFlow.smartMoneyDirection,
        sub: "Disabled until real chain stream exists",
      },
      {
        title: "Trade Flow Impact",
        sourceType: walletFlow.sourceType,
        value: walletFlow.tradeImpact,
        sub: "Paper-only until validated",
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
    paperProfitMonitor,
    paperLossGovernor,
    walletFlow,
    exchangeFlow,
    realExecutionActivity,
  };
}

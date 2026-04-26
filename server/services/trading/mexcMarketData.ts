type MexcTicker24hr = {
  symbol?: string;
  lastPrice?: string;
  priceChange?: string;
  priceChangePercent?: string;
  volume?: string;
  quoteVolume?: string;
  highPrice?: string;
  lowPrice?: string;
};

type MexcBookTicker = {
  symbol?: string;
  bidPrice?: string;
  bidQty?: string;
  askPrice?: string;
  askQty?: string;
};

const MEXC_BASE_URL = process.env.MEXC_PUBLIC_BASE_URL || "https://api.mexc.com";
const DEFAULT_SYMBOLS = (process.env.TRADING_MARKET_SYMBOLS || "BTCUSDT,ETHUSDT,SOLUSDT")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const MARKET_TIMEOUT_MS = Number(process.env.TRADING_MARKET_TIMEOUT_MS || 3500);

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function controllerTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function fetchJson<T>(url: string, timeoutMs = MARKET_TIMEOUT_MS): Promise<T> {
  const { controller, timer } = controllerTimeout(timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "TheCorporateDesk-PhantomX-PaperMonitor/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function toDisplaySymbol(symbol: string): string {
  if (symbol.endsWith("USDT")) return symbol.replace("USDT", "/USD");
  if (symbol.endsWith("USDC")) return symbol.replace("USDC", "/USD");
  return symbol;
}

function inferRegime(changePct24h: number): string {
  const abs = Math.abs(changePct24h);
  if (abs >= 5) return "high_volatility";
  if (abs >= 2) return "active";
  return "normal";
}

function inferTrend(changePct24h: number): string {
  if (changePct24h > 1) return "bullish";
  if (changePct24h < -1) return "bearish";
  return "neutral";
}

export async function getMexcMarketSnapshot(symbols = DEFAULT_SYMBOLS) {
  const now = new Date().toISOString();

  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const ticker = await fetchJson<MexcTicker24hr>(
        `${MEXC_BASE_URL}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
      );

      let book: MexcBookTicker | null = null;
      try {
        book = await fetchJson<MexcBookTicker>(
          `${MEXC_BASE_URL}/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`,
          2500,
        );
      } catch {
        book = null;
      }

      const price = safeNumber(ticker.lastPrice);
      const changePct24h = safeNumber(ticker.priceChangePercent);
      const change24h = safeNumber(ticker.priceChange);
      const volume24h = safeNumber(ticker.quoteVolume || ticker.volume);
      const high24h = safeNumber(ticker.highPrice);
      const low24h = safeNumber(ticker.lowPrice);

      return {
        symbol: toDisplaySymbol(symbol),
        exchangeSymbol: symbol,
        price,
        change24h,
        changePct24h,
        volume24h,
        high24h,
        low24h,
        regime: inferRegime(changePct24h),
        dominantTrend: inferTrend(changePct24h),
        volatilityLevel: Math.abs(changePct24h) >= 5 ? "high" : Math.abs(changePct24h) >= 2 ? "medium" : "low",
        keyLevels: {
          support: low24h ? [low24h] : [],
          resistance: high24h ? [high24h] : [],
        },
        orderBook: book
          ? {
              bidPrice: safeNumber(book.bidPrice),
              bidQty: safeNumber(book.bidQty),
              askPrice: safeNumber(book.askPrice),
              askQty: safeNumber(book.askQty),
              spread:
                safeNumber(book.askPrice) && safeNumber(book.bidPrice)
                  ? Math.round((safeNumber(book.askPrice) - safeNumber(book.bidPrice)) * 100000000) / 100000000
                  : 0,
            }
          : null,
        technicals: {
          rsi14: 0,
          macd: { value: 0, signal: 0, histogram: 0 },
          ema20: price,
          ema50: price,
          ema200: price,
          bbUpper: high24h || price,
          bbLower: low24h || price,
          bbWidth: high24h && low24h ? Math.round(((high24h - low24h) / Math.max(price, 1)) * 10000) / 100 : 0,
          atr14: high24h && low24h ? Math.round((high24h - low24h) * 100) / 100 : 0,
          adx: 0,
          obv: "n/a",
          vwap: price,
          stochRsi: 0,
          williamsR: 0,
          cci: 0,
          mfi: 0,
        },
        fundingRate: null,
        openInterest: null,
        fearGreedIndex: null,
        snapshotId: `mexc-${symbol}-${Date.now()}`,
        lastUpdated: now,
        dataSource: "mexc_public_rest",
        isStale: false,
      };
    }),
  );

  const marketContext = results.map((r, idx) => {
    if (r.status === "fulfilled") return r.value;

    return {
      symbol: toDisplaySymbol(symbols[idx]),
      exchangeSymbol: symbols[idx],
      price: 0,
      change24h: 0,
      changePct24h: 0,
      volume24h: 0,
      high24h: 0,
      low24h: 0,
      regime: "unavailable",
      dominantTrend: "unavailable",
      volatilityLevel: "unavailable",
      keyLevels: { support: [], resistance: [] },
      technicals: {
        rsi14: 0,
        macd: { value: 0, signal: 0, histogram: 0 },
        ema20: 0,
        ema50: 0,
        ema200: 0,
        bbUpper: 0,
        bbLower: 0,
        bbWidth: 0,
        atr14: 0,
        adx: 0,
        obv: "n/a",
        vwap: 0,
        stochRsi: 0,
        williamsR: 0,
        cci: 0,
        mfi: 0,
      },
      fundingRate: null,
      openInterest: null,
      fearGreedIndex: null,
      snapshotId: "",
      lastUpdated: now,
      dataSource: "mexc_public_rest_unavailable",
      isStale: true,
      error: r.reason?.message || String(r.reason),
    };
  });

  return {
    ok: true,
    source: "mexc_public_rest",
    symbols,
    marketContext,
    failures: marketContext.filter((m: any) => m.isStale || m.regime === "unavailable"),
    lastRefreshed: now,
  };
}

export async function getMarketDataState() {
  return getMexcMarketSnapshot();
}

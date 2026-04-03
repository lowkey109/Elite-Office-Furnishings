const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const SYMBOL_TO_COINGECKO: Record<string, string> = {
  "BTC/USD": "bitcoin",
  "ETH/USD": "ethereum",
  "SOL/USD": "solana",
};

const SUPPORTED_SYMBOLS = Object.keys(SYMBOL_TO_COINGECKO);
const UNAVAILABLE_SYMBOLS = ["XAUUSD"];

export interface MarketFeedResult {
  symbol: string;
  price: number;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  change24h: number | null;
  changePct24h: number | null;
  marketCap: number | null;
  source: string;
  fetchedAt: Date;
  isStale: boolean;
  available: boolean;
  rawPayload: Record<string, unknown>;
}

let lastFetchTime = 0;
let cachedResults: MarketFeedResult[] = [];
const MIN_FETCH_INTERVAL_MS = 10000;

export function getSupportedSymbols(): string[] {
  return [...SUPPORTED_SYMBOLS];
}

export function getUnavailableSymbols(): string[] {
  return [...UNAVAILABLE_SYMBOLS];
}

export async function fetchLivePrices(): Promise<MarketFeedResult[]> {
  const now = Date.now();
  if (cachedResults.length > 0 && now - lastFetchTime < MIN_FETCH_INTERVAL_MS) {
    return cachedResults;
  }

  const ids = Object.values(SYMBOL_TO_COINGECKO).join(",");
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true&include_market_cap=true`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[MarketAdapter] CoinGecko HTTP ${response.status}`);
      return markAllStale();
    }

    const data = await response.json() as Record<string, Record<string, number>>;
    const fetchedAt = new Date();
    const results: MarketFeedResult[] = [];

    for (const [symbol, coinId] of Object.entries(SYMBOL_TO_COINGECKO)) {
      const coin = data[coinId];
      if (!coin || typeof coin.usd !== "number") {
        results.push(makeUnavailable(symbol, fetchedAt));
        continue;
      }

      results.push({
        symbol,
        price: coin.usd,
        high24h: null,
        low24h: null,
        volume24h: coin.usd_24h_vol ?? null,
        change24h: null,
        changePct24h: coin.usd_24h_change ?? null,
        marketCap: coin.usd_market_cap ?? null,
        source: "coingecko",
        fetchedAt,
        isStale: false,
        available: true,
        rawPayload: coin as unknown as Record<string, unknown>,
      });
    }

    for (const symbol of UNAVAILABLE_SYMBOLS) {
      results.push(makeUnavailable(symbol, fetchedAt));
    }

    cachedResults = results;
    lastFetchTime = now;
    return results;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[MarketAdapter] fetch failed: ${msg}`);
    return markAllStale();
  }
}

export async function fetchDetailedMarketData(): Promise<MarketFeedResult[]> {
  const ids = Object.values(SYMBOL_TO_COINGECKO).join(",");
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[MarketAdapter] CoinGecko markets HTTP ${response.status}`);
      return markAllStale();
    }

    const coins = await response.json() as Array<Record<string, unknown>>;
    const fetchedAt = new Date();
    const results: MarketFeedResult[] = [];
    const coinIdToSymbol = Object.fromEntries(Object.entries(SYMBOL_TO_COINGECKO).map(([s, c]) => [c, s]));

    for (const coin of coins) {
      const symbol = coinIdToSymbol[coin.id as string];
      if (!symbol) continue;

      results.push({
        symbol,
        price: coin.current_price as number,
        high24h: (coin.high_24h as number) ?? null,
        low24h: (coin.low_24h as number) ?? null,
        volume24h: (coin.total_volume as number) ?? null,
        change24h: (coin.price_change_24h as number) ?? null,
        changePct24h: (coin.price_change_percentage_24h as number) ?? null,
        marketCap: (coin.market_cap as number) ?? null,
        source: "coingecko",
        fetchedAt,
        isStale: false,
        available: true,
        rawPayload: coin as Record<string, unknown>,
      });
    }

    for (const symbol of SUPPORTED_SYMBOLS) {
      if (!results.find(r => r.symbol === symbol)) {
        results.push(makeUnavailable(symbol, fetchedAt));
      }
    }

    for (const symbol of UNAVAILABLE_SYMBOLS) {
      results.push(makeUnavailable(symbol, fetchedAt));
    }

    cachedResults = results.filter(r => r.available).length > 0 ? results : cachedResults;
    if (results.filter(r => r.available).length > 0) lastFetchTime = Date.now();
    return results;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[MarketAdapter] detailed fetch failed: ${msg}`);
    return markAllStale();
  }
}

function makeUnavailable(symbol: string, fetchedAt: Date): MarketFeedResult {
  return {
    symbol,
    price: 0,
    high24h: null,
    low24h: null,
    volume24h: null,
    change24h: null,
    changePct24h: null,
    marketCap: null,
    source: "unavailable",
    fetchedAt,
    isStale: true,
    available: false,
    rawPayload: {},
  };
}

function markAllStale(): MarketFeedResult[] {
  if (cachedResults.length > 0) {
    return cachedResults.map(r => ({ ...r, isStale: true }));
  }
  const now = new Date();
  return [
    ...SUPPORTED_SYMBOLS.map(s => makeUnavailable(s, now)),
    ...UNAVAILABLE_SYMBOLS.map(s => makeUnavailable(s, now)),
  ];
}

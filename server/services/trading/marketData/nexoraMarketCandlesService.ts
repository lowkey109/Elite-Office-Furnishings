import { sql } from "drizzle-orm";
import { db } from "../../../db";

const NEXORA_CANDLE_SERVICE_VERSION = "coinbase-first-v2";

export type NexoraMarketCandle = {
  symbol: string;
  provider: string;
  timeframe: string;
  openTime: Date;
  closeTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number | null;
  tradeCount?: number | null;
};

const BINANCE_SYMBOLS: Record<string, string> = {
  "BTC/USD": "BTCUSDT",
  "ETH/USD": "ETHUSDT",
  "SOL/USD": "SOLUSDT",
};

const TIMEFRAME_TO_BINANCE: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

const COINBASE_SYMBOLS: Record<string, string> = {
  "BTC/USD": "BTC-USD",
  "ETH/USD": "ETH-USD",
  "SOL/USD": "SOL-USD",
};

const TIMEFRAME_TO_COINBASE_GRANULARITY: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 21600,
  "1d": 86400,
};

export async function ensureMarketCandlesTable() {
  await db.execute(sql`
    create table if not exists market_candles (
      id bigserial primary key,
      symbol text not null,
      provider text not null default 'binance',
      timeframe text not null,
      open_time timestamptz not null,
      close_time timestamptz not null,
      open numeric not null,
      high numeric not null,
      low numeric not null,
      close numeric not null,
      volume numeric not null default 0,
      quote_volume numeric,
      trade_count integer,
      raw_payload jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(symbol, provider, timeframe, open_time)
    );
  `);

  await db.execute(sql`
    create index if not exists market_candles_symbol_tf_time_idx
    on market_candles(symbol, timeframe, open_time desc);
  `);
}

async function fetchCoinbaseCandles(symbol: string, timeframe: string, limit = 300): Promise<NexoraMarketCandle[]> {
  const productId = COINBASE_SYMBOLS[symbol];
  const granularity = TIMEFRAME_TO_COINBASE_GRANULARITY[timeframe];

  if (!productId || !granularity) return [];

  // Coinbase public candles cap is smaller than Binance, so keep request conservative.
  const safeLimit = Math.max(1, Math.min(300, limit));
  const end = Math.floor(Date.now() / 1000);
  const start = end - safeLimit * granularity;

  const url = `https://api.exchange.coinbase.com/products/${encodeURIComponent(productId)}/candles?granularity=${granularity}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Nexora-Research-Paper-Trading/1.0",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Coinbase candle fetch failed for ${symbol} ${timeframe}: ${res.status} ${res.statusText} ${body.slice(0, 240)}`);
  }

  const rows = await res.json();

  if (!Array.isArray(rows)) {
    throw new Error(`Unexpected Coinbase candle response for ${symbol}`);
  }

  // Coinbase format: [time, low, high, open, close, volume]
  return rows
    .map((row: any[]) => {
      const openTime = new Date(Number(row[0]) * 1000);
      return {
        symbol,
        provider: "coinbase",
        timeframe,
        openTime,
        closeTime: new Date(openTime.getTime() + granularity * 1000 - 1),
        open: Number(row[3]),
        high: Number(row[2]),
        low: Number(row[1]),
        close: Number(row[4]),
        volume: Number(row[5]),
        quoteVolume: null,
        tradeCount: null,
      };
    })
    .sort((a, b) => a.openTime.getTime() - b.openTime.getTime())
    .slice(-safeLimit);
}

async function fetchBinanceCandles(symbol: string, timeframe: string, limit = 500): Promise<NexoraMarketCandle[]> {
  const binanceSymbol = BINANCE_SYMBOLS[symbol];
  const interval = TIMEFRAME_TO_BINANCE[timeframe];

  if (!binanceSymbol || !interval) return [];

  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${encodeURIComponent(interval)}&limit=${Math.max(1, Math.min(1000, limit))}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Binance candle fetch failed for ${symbol} ${timeframe}: ${res.status} ${res.statusText}`);
  }

  const rows = await res.json();

  if (!Array.isArray(rows)) {
    throw new Error(`Unexpected Binance candle response for ${symbol}`);
  }

  return rows.map((row: any[]) => ({
    symbol,
    provider: "coinbase_first",
    timeframe,
    openTime: new Date(Number(row[0])),
    closeTime: new Date(Number(row[6])),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    quoteVolume: Number(row[7]),
    tradeCount: Number(row[8]),
  }));
}

export async function upsertMarketCandles(candles: NexoraMarketCandle[]) {
  await ensureMarketCandlesTable();

  let insertedOrUpdated = 0;

  for (const candle of candles) {
    await db.execute(sql`
      insert into market_candles (
        symbol, provider, timeframe, open_time, close_time,
        open, high, low, close, volume, quote_volume, trade_count, raw_payload, updated_at
      )
      values (
        ${candle.symbol}, ${candle.provider}, ${candle.timeframe}, ${candle.openTime}, ${candle.closeTime},
        ${candle.open}, ${candle.high}, ${candle.low}, ${candle.close}, ${candle.volume},
        ${candle.quoteVolume ?? null}, ${candle.tradeCount ?? null}, ${JSON.stringify(candle)}, now()
      )
      on conflict(symbol, provider, timeframe, open_time)
      do update set
        close_time = excluded.close_time,
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        quote_volume = excluded.quote_volume,
        trade_count = excluded.trade_count,
        raw_payload = excluded.raw_payload,
        updated_at = now();
    `);

    insertedOrUpdated += 1;
  }

  return insertedOrUpdated;
}

export async function syncNexoraMarketCandles(options?: {
  symbols?: string[];
  timeframes?: string[];
  limit?: number;
}) {
  await ensureMarketCandlesTable();

  const symbols = options?.symbols?.length ? options.symbols : ["BTC/USD", "ETH/USD", "SOL/USD"];
  const timeframes = options?.timeframes?.length ? options.timeframes : ["1m", "5m", "15m", "1h"];
  const limit = options?.limit ?? 500;

  const results: any[] = [];
  let total = 0;

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      try {
        const candles = await fetchBinanceCandles(symbol, timeframe, limit);
        const count = await upsertMarketCandles(candles);
        total += count;
        results.push({ ok: true, symbol, timeframe, provider: "coinbase_first", candles: count });
      } catch (err) {
        results.push({
          ok: false,
          symbol,
          timeframe,
          provider: "binance",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return {
    ok: true,
    service: "nexora_market_candles",
    version: NEXORA_CANDLE_SERVICE_VERSION,
    paperOnly: true,
    provider: "binance",
    totalCandlesSynced: total,
    results,
    note: "NEXORA_CANDLE_SERVICE_VERSION coinbase-first-v2. BTC/ETH/SOL use Coinbase public candles first, Binance only as fallback. XAUUSD needs a separate provider later.",
    updatedAt: new Date().toISOString(),
  };
}

export async function getRecentMarketCandles(options: {
  symbol: string;
  timeframe: string;
  limit?: number;
}) {
  await ensureMarketCandlesTable();

  const limit = Math.max(1, Math.min(1000, Number(options.limit || 200)));

  const result: any = await db.execute(sql`
    select
      symbol, provider, timeframe, open_time, close_time,
      open, high, low, close, volume, quote_volume, trade_count
    from market_candles
    where symbol = ${options.symbol}
      and timeframe = ${options.timeframe}
    order by open_time desc
    limit ${limit};
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];

  return {
    ok: true,
    symbol: options.symbol,
    timeframe: options.timeframe,
    count: rows.length,
    candles: rows,
  };
}

export async function getMarketCandleCoverage() {
  await ensureMarketCandlesTable();

  const result: any = await db.execute(sql`
    select
      symbol,
      provider,
      timeframe,
      count(*)::int as candles,
      min(open_time) as first_open_time,
      max(open_time) as latest_open_time
    from market_candles
    group by symbol, provider, timeframe
    order by symbol, timeframe;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];

  return {
    ok: true,
    service: "nexora_market_candle_coverage",
    rows,
    updatedAt: new Date().toISOString(),
  };
}

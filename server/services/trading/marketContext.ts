import type { MarketContext } from "./types";
import { getLatestSnapshots, isSnapshotStale } from "./marketSnapshots";
import { getUnavailableSymbols } from "./marketDataAdapter";

const ALL_SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD", "XAUUSD"];

export async function buildMarketContext(): Promise<MarketContext[]> {
  const snapshots = await getLatestSnapshots();
  const unavailable = new Set(getUnavailableSymbols());
  const results: MarketContext[] = [];

  for (const symbol of ALL_SYMBOLS) {
    if (unavailable.has(symbol)) {
      results.push(makeUnavailableContext(symbol));
      continue;
    }

    const snap = snapshots.get(symbol);
    if (!snap) {
      results.push(makeUnavailableContext(symbol));
      continue;
    }

    const stale = isSnapshotStale(snap);

    results.push({
      symbol,
      price: snap.price,
      change24h: snap.change24h ?? 0,
      changePct24h: snap.changePct24h ?? 0,
      volume24h: snap.volume24h ?? 0,
      high24h: snap.high24h ?? snap.price,
      low24h: snap.low24h ?? snap.price,
      regime: stale ? "stale" : deriveRegime(snap.changePct24h ?? 0),
      dominantTrend: deriveTrend(snap.changePct24h ?? 0),
      volatilityLevel: deriveVolatility(snap.changePct24h ?? 0),
      keyLevels: { support: [], resistance: [] },
      technicals: emptyTechnicals(snap.price),
      fundingRate: null,
      openInterest: null,
      fearGreedIndex: null,
      snapshotId: snap.id,
      lastUpdated: snap.fetchedAt?.toISOString() ?? new Date().toISOString(),
      dataSource: stale ? `${snap.source} (stale)` : snap.source,
      isStale: stale,
    });
  }

  return results;
}

function makeUnavailableContext(symbol: string): MarketContext {
  return {
    symbol,
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
    technicals: emptyTechnicals(0),
    fundingRate: null,
    openInterest: null,
    fearGreedIndex: null,
    snapshotId: "",
    lastUpdated: new Date().toISOString(),
    dataSource: "unavailable",
    isStale: true,
  };
}

function deriveRegime(changePct: number): string {
  const abs = Math.abs(changePct);
  if (abs > 5) return "volatile";
  if (abs > 2) return "trending";
  return "ranging";
}

function deriveTrend(changePct: number): string {
  if (changePct > 1) return "bullish";
  if (changePct < -1) return "bearish";
  return "neutral";
}

function deriveVolatility(changePct: number): string {
  const abs = Math.abs(changePct);
  if (abs > 5) return "high";
  if (abs > 2) return "moderate";
  return "low";
}

function emptyTechnicals(price: number) {
  return {
    rsi14: 0,
    macd: { value: 0, signal: 0, histogram: 0 },
    ema20: price,
    ema50: price,
    ema200: price,
    bbUpper: price,
    bbLower: price,
    bbWidth: 0,
    atr14: 0,
    adx: 0,
    obv: "n/a",
    vwap: price,
    stochRsi: 0,
    williamsR: 0,
    cci: 0,
    mfi: 0,
  };
}

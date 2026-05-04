
import fs from "node:fs";
import path from "node:path";

export type NexoraMoonDevStrategyRecord = {
  id: string;
  sourceFile: string;
  family: string;
  mode: "paper-only";
  liveTradingEnabled: false;
  walletSigningEnabled: false;
  privateKeysAllowed: false;
  tournamentEligible: boolean;
  riskTags: string[];
};

export type GammaMarketSummary = {
  id: string;
  question: string;
  slug?: string;
  active?: boolean;
  closed?: boolean;
  volume?: string | number;
  clobTokenIds: string[];
};

export type ClobOrderbookSnapshot = {
  tokenId: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  midpoint: number | null;
  spread: number | null;
  capturedAt: string;
  source: "clob-readonly";
};

export type PaperFillResult = {
  tokenId: string;
  side: "BUY" | "SELL";
  requestedSize: number;
  filledSize: number;
  averagePrice: number | null;
  notional: number;
  mode: "paper-only";
  liveTradingEnabled: false;
};

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "dist") continue;
    if (ent.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function parseMaybeJsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(",").map((x) => x.trim()).filter(Boolean);
  }
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function buildMoonDevStrategyRecords(): {
  generatedAt: string;
  mode: "paper-only";
  count: number;
  records: NexoraMoonDevStrategyRecord[];
} {
  const files = ["research/moondev-selected", "research/moondev"]
    .flatMap((dir) => walk(path.join(process.cwd(), dir)))
    .filter((file) => /\.(py|ts|js|md|json)$/i.test(file));

  const records = files
    .filter((file) => /strategy|risk|backtest|polymarket|clob|whale|volume|copybot|swarm|trading/i.test(file))
    .slice(0, 100)
    .map((file): NexoraMoonDevStrategyRecord => {
      const lower = file.toLowerCase();
      const tags = [
        lower.includes("risk") ? "risk" : "",
        lower.includes("backtest") ? "backtest" : "",
        lower.includes("clob") ? "clob" : "",
        lower.includes("whale") ? "whale" : "",
        lower.includes("volume") ? "volume" : "",
        lower.includes("copybot") ? "copybot" : "",
        lower.includes("swarm") ? "swarm" : "",
      ].filter(Boolean);

      return {
        id: path.basename(file).replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
        sourceFile: path.relative(process.cwd(), file),
        family: tags[0] || "strategy",
        mode: "paper-only",
        liveTradingEnabled: false,
        walletSigningEnabled: false,
        privateKeysAllowed: false,
        tournamentEligible: /strategy|backtest|risk|polymarket|clob|trading/i.test(file),
        riskTags: tags.length ? tags : ["research"],
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    mode: "paper-only",
    count: records.length,
    records,
  };
}

export function getBinanceWsCollectorRuntimeStatus(): {
  generatedAt: string;
  mode: "paper-observation-only";
  websocketUrl: string;
  collectorImplemented: boolean;
  runtimeConfirmation: "scaffolded";
  liveTradingEnabled: false;
  privateKeysAllowed: false;
  note: string;
} {
  const files = walk(path.join(process.cwd(), "server"))
    .filter((file) => /binance|websocket|ws|collector/i.test(file));
  return {
    generatedAt: new Date().toISOString(),
    mode: "paper-observation-only",
    websocketUrl: "wss://stream.binance.com:9443/ws",
    collectorImplemented: files.length > 0,
    runtimeConfirmation: "scaffolded",
    liveTradingEnabled: false,
    privateKeysAllowed: false,
    note: "Confirms local implementation presence only; no exchange account, key, signing, or trading path is used.",
  };
}

export async function discoverPolymarketGammaMarkets(limit = 20): Promise<{
  generatedAt: string;
  mode: "readonly";
  endpoint: string;
  count: number;
  markets: GammaMarketSummary[];
}> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const endpoint = `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${safeLimit}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: { "accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Gamma read-only market discovery failed: ${response.status}`);
  }

  const raw = await response.json() as Array<Record<string, unknown>>;

  const markets = raw.map((market): GammaMarketSummary => ({
    id: String(market.id ?? market.conditionId ?? market.slug ?? "unknown"),
    question: String(market.question ?? market.title ?? "Untitled market"),
    slug: typeof market.slug === "string" ? market.slug : undefined,
    active: typeof market.active === "boolean" ? market.active : undefined,
    closed: typeof market.closed === "boolean" ? market.closed : undefined,
    volume: typeof market.volume === "string" || typeof market.volume === "number" ? market.volume : undefined,
    clobTokenIds: parseMaybeJsonList(market.clobTokenIds),
  }));

  return {
    generatedAt: new Date().toISOString(),
    mode: "readonly",
    endpoint,
    count: markets.length,
    markets,
  };
}

export async function collectClobOrderbookSnapshot(tokenId: string): Promise<ClobOrderbookSnapshot> {
  if (!tokenId || !/^[a-zA-Z0-9._:-]+$/.test(tokenId)) {
    throw new Error("A safe CLOB tokenId is required.");
  }

  const endpoint = `https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { "accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`CLOB read-only orderbook snapshot failed: ${response.status}`);
  }

  const raw = await response.json() as Record<string, unknown>;
  const bidsRaw = Array.isArray(raw.bids) ? raw.bids as Array<Record<string, unknown>> : [];
  const asksRaw = Array.isArray(raw.asks) ? raw.asks as Array<Record<string, unknown>> : [];

  const bids = bidsRaw.map((x) => ({ price: num(x.price), size: num(x.size) })).filter((x) => x.price > 0 && x.size > 0);
  const asks = asksRaw.map((x) => ({ price: num(x.price), size: num(x.size) })).filter((x) => x.price > 0 && x.size > 0);

  const bestBid = bids.length ? Math.max(...bids.map((x) => x.price)) : null;
  const bestAsk = asks.length ? Math.min(...asks.map((x) => x.price)) : null;
  const midpoint = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  return {
    tokenId,
    bids,
    asks,
    midpoint,
    spread,
    capturedAt: new Date().toISOString(),
    source: "clob-readonly",
  };
}

export function simulatePaperFillFromSnapshot(
  snapshot: ClobOrderbookSnapshot,
  side: "BUY" | "SELL",
  requestedSize = 10,
): PaperFillResult {
  const bookSide = side === "BUY"
    ? [...snapshot.asks].sort((a, b) => a.price - b.price)
    : [...snapshot.bids].sort((a, b) => b.price - a.price);

  let remaining = Math.max(0, requestedSize);
  let filledSize = 0;
  let notional = 0;

  for (const level of bookSide) {
    if (remaining <= 0) break;
    const fill = Math.min(remaining, level.size);
    filledSize += fill;
    notional += fill * level.price;
    remaining -= fill;
  }

  return {
    tokenId: snapshot.tokenId,
    side,
    requestedSize,
    filledSize,
    averagePrice: filledSize > 0 ? notional / filledSize : null,
    notional,
    mode: "paper-only",
    liveTradingEnabled: false,
  };
}

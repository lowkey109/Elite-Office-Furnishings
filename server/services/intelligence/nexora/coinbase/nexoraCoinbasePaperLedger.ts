import fs from "fs";
import path from "path";
import crypto from "crypto";

export type CoinbasePaperTrade = {
  id: string;
  ts: string;
  productId: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  pnlAud?: number;
  status: "OPEN" | "CLOSED";
  strategy: string;
};

const DATA_DIR = path.join(
  process.cwd(),
  "data",
  "nexora",
  "local",
  "coinbase-paper"
);

const FILE = path.join(DATA_DIR, "ledger.json");

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, "[]");
  }
}

function readLedger(): CoinbasePaperTrade[] {
  ensure();

  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeLedger(data: CoinbasePaperTrade[]) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function createPaperTrade(input: {
  productId: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  strategy: string;
}) {
  const ledger = readLedger();

  const trade: CoinbasePaperTrade = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    productId: input.productId,
    side: input.side,
    quantity: input.quantity,
    entryPrice: input.entryPrice,
    status: "OPEN",
    strategy: input.strategy,
  };

  ledger.unshift(trade);

  writeLedger(ledger);

  return trade;
}

export function closePaperTrade(
  id: string,
  exitPrice: number
) {
  const ledger = readLedger();

  const trade = ledger.find((t) => t.id === id);

  if (!trade) {
    return null;
  }

  if (trade.status === "CLOSED") {
    return trade;
  }

  const direction =
    trade.side === "BUY" ? 1 : -1;

  const pnl =
    (exitPrice - trade.entryPrice) *
    trade.quantity *
    direction;

  trade.exitPrice = exitPrice;
  trade.pnlAud = Number(pnl.toFixed(2));
  trade.status = "CLOSED";

  writeLedger(ledger);

  return trade;
}

export function listPaperTrades(limit = 100) {
  return readLedger().slice(0, limit);
}

export function paperStats() {
  const trades = readLedger();

  const closed = trades.filter(
    (t) => t.status === "CLOSED"
  );

  const pnl = closed.reduce(
    (sum, t) => sum + (t.pnlAud || 0),
    0
  );

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.filter(
      (t) => t.status === "OPEN"
    ).length,
    totalPnlAud: Number(pnl.toFixed(2)),
  };
}

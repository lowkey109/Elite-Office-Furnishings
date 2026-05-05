import fs from "fs";
import path from "path";
import crypto from "crypto";

export type CoinbaseLiveIntent = {
  id: string;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "approved" | "rejected" | "expired" | "executed";
  productId: string;
  side: "BUY" | "SELL";
  notionalAud: number;
  equityAud: number;
  maxTradeAud: number;
  capitalTier: string;
  reason: string;
  approvalNote?: string;
  rejectionNote?: string;
  executedOrderId?: string;
};

const INTENT_DIR = path.join(process.cwd(), "data", "nexora", "local", "coinbase-live-intents");

function ensureDir() {
  fs.mkdirSync(INTENT_DIR, { recursive: true });
}

function fileFor(id: string) {
  return path.join(INTENT_DIR, `${id}.json`);
}

function saveIntent(intent: CoinbaseLiveIntent) {
  ensureDir();
  fs.writeFileSync(fileFor(intent.id), JSON.stringify(intent, null, 2));
}

function loadIntent(id: string): CoinbaseLiveIntent | null {
  try {
    return JSON.parse(fs.readFileSync(fileFor(id), "utf8")) as CoinbaseLiveIntent;
  } catch {
    return null;
  }
}

function capitalLimit(equityAud: number) {
  if (equityAud < 100) return { tier: "micro", maxTradeAud: 1 };
  if (equityAud < 500) return { tier: "starter", maxTradeAud: 5 };
  if (equityAud < 2000) return { tier: "controlled", maxTradeAud: 25 };
  return { tier: "scaled", maxTradeAud: 100 };
}

function expireIfStale(intent: CoinbaseLiveIntent): CoinbaseLiveIntent {
  if ((intent.status === "pending" || intent.status === "approved") && Date.now() > new Date(intent.expiresAt).getTime()) {
    intent.status = "expired";
    saveIntent(intent);
  }
  return intent;
}

export function createCoinbaseIntent(input: {
  productId: string;
  side: "BUY" | "SELL";
  notionalAud: number;
  equityAud: number;
  reason: string;
}): CoinbaseLiveIntent {
  const limit = capitalLimit(input.equityAud);
  const now = new Date();

  const intent: CoinbaseLiveIntent = {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    status: "pending",
    productId: input.productId.toUpperCase(),
    side: input.side,
    notionalAud: input.notionalAud,
    equityAud: input.equityAud,
    maxTradeAud: limit.maxTradeAud,
    capitalTier: limit.tier,
    reason: input.reason || "operator_manual_coinbase_intent",
  };

  saveIntent(intent);
  return intent;
}

export function approveCoinbaseIntent(id: string, note = "approved"): CoinbaseLiveIntent | null {
  const intent = loadIntent(id);
  if (!intent) return null;

  const fresh = expireIfStale(intent);
  if (fresh.status !== "pending") return fresh;

  fresh.status = "approved";
  fresh.approvalNote = note;
  saveIntent(fresh);
  return fresh;
}

export function rejectCoinbaseIntent(id: string, note = "rejected"): CoinbaseLiveIntent | null {
  const intent = loadIntent(id);
  if (!intent) return null;

  const fresh = expireIfStale(intent);
  if (fresh.status === "executed") return fresh;

  fresh.status = "rejected";
  fresh.rejectionNote = note;
  saveIntent(fresh);
  return fresh;
}

export function markCoinbaseIntentExecuted(id: string, orderId: string): void {
  const intent = loadIntent(id);
  if (!intent) return;

  intent.status = "executed";
  intent.executedOrderId = orderId;
  saveIntent(intent);
}

export function getCoinbaseIntent(id: string): CoinbaseLiveIntent | null {
  const intent = loadIntent(id);
  if (!intent) return null;
  return expireIfStale(intent);
}

export function listCoinbaseIntents(limit = 100): CoinbaseLiveIntent[] {
  ensureDir();

  return fs.readdirSync(INTENT_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit)
    .map((f) => {
      try {
        return expireIfStale(JSON.parse(fs.readFileSync(path.join(INTENT_DIR, f), "utf8")) as CoinbaseLiveIntent);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as CoinbaseLiveIntent[];
}

export function findApprovedCoinbaseIntent(intentId: string): CoinbaseLiveIntent | null {
  const intent = getCoinbaseIntent(intentId);
  if (!intent) return null;
  if (intent.status !== "approved") return null;
  return intent;
}

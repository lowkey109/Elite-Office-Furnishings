import fs from "fs";
import path from "path";
import crypto from "crypto";

export type LiveIntent = {
  id: string;
  createdAt: string;
  expiresAt: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "expired"
    | "executed";

  symbol: string;
  side: "BUY" | "SELL";

  notionalAud: number;
  equityAud: number;

  capitalTier: string;
  maxTradeAud: number;

  reason: string;

  approvalNote?: string;
  rejectionNote?: string;
  executedOrderId?: string;
};

const INTENT_DIR = path.join(
  process.cwd(),
  "data",
  "nexora",
  "local",
  "binance-live-intents"
);

function ensureDir() {
  fs.mkdirSync(INTENT_DIR, {
    recursive: true,
  });
}

function fileFor(id: string) {
  return path.join(INTENT_DIR, `${id}.json`);
}

function saveIntent(intent: LiveIntent) {
  ensureDir();

  fs.writeFileSync(
    fileFor(intent.id),
    JSON.stringify(intent, null, 2)
  );
}

function loadIntent(id: string): LiveIntent | null {
  try {
    return JSON.parse(
      fs.readFileSync(fileFor(id), "utf8")
    ) as LiveIntent;
  } catch {
    return null;
  }
}

function capitalLimit(equityAud: number) {
  if (equityAud < 100) {
    return {
      tier: "micro",
      maxTradeAud: 1,
    };
  }

  if (equityAud < 500) {
    return {
      tier: "starter",
      maxTradeAud: 5,
    };
  }

  if (equityAud < 2000) {
    return {
      tier: "controlled",
      maxTradeAud: 25,
    };
  }

  return {
    tier: "scaled",
    maxTradeAud: 100,
  };
}

function expireIfStale(
  intent: LiveIntent
): LiveIntent {
  if (
    (intent.status === "pending" ||
      intent.status === "approved") &&
    Date.now() >
      new Date(intent.expiresAt).getTime()
  ) {
    intent.status = "expired";
    saveIntent(intent);
  }

  return intent;
}

export function createIntent(input: {
  symbol: string;
  side: "BUY" | "SELL";
  notionalAud: number;
  equityAud: number;
  reason: string;
}): LiveIntent {
  const limit = capitalLimit(
    input.equityAud
  );

  const now = new Date();

  const intent: LiveIntent = {
    id: crypto.randomUUID(),

    createdAt: now.toISOString(),

    expiresAt: new Date(
      now.getTime() + 15 * 60 * 1000
    ).toISOString(),

    status: "pending",

    symbol: input.symbol.toUpperCase(),

    side: input.side,

    notionalAud: input.notionalAud,

    equityAud: input.equityAud,

    capitalTier: limit.tier,

    maxTradeAud: limit.maxTradeAud,

    reason:
      input.reason ||
      "operator_manual_intent",
  };

  saveIntent(intent);

  return intent;
}

export function approveIntent(
  id: string,
  note = "approved"
): LiveIntent | null {
  const intent = loadIntent(id);

  if (!intent) return null;

  const fresh = expireIfStale(intent);

  if (fresh.status !== "pending") {
    return fresh;
  }

  fresh.status = "approved";

  fresh.approvalNote = note;

  saveIntent(fresh);

  return fresh;
}

export function rejectIntent(
  id: string,
  note = "rejected"
): LiveIntent | null {
  const intent = loadIntent(id);

  if (!intent) return null;

  const fresh = expireIfStale(intent);

  if (fresh.status === "executed") {
    return fresh;
  }

  fresh.status = "rejected";

  fresh.rejectionNote = note;

  saveIntent(fresh);

  return fresh;
}

export function markIntentExecuted(
  id: string,
  orderId: string
): void {
  const intent = loadIntent(id);

  if (!intent) return;

  intent.status = "executed";

  intent.executedOrderId = orderId;

  saveIntent(intent);
}

export function getIntent(
  id: string
): LiveIntent | null {
  const intent = loadIntent(id);

  if (!intent) return null;

  return expireIfStale(intent);
}

export function listIntents(
  limit = 100
): LiveIntent[] {
  ensureDir();

  return fs
    .readdirSync(INTENT_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit)
    .map((f) => {
      try {
        const intent = JSON.parse(
          fs.readFileSync(
            path.join(INTENT_DIR, f),
            "utf8"
          )
        ) as LiveIntent;

        return expireIfStale(intent);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as LiveIntent[];
}

export function findApprovedIntent(
  intentId: string
): LiveIntent | null {
  const intent = getIntent(intentId);

  if (!intent) return null;

  if (intent.status !== "approved") {
    return null;
  }

  return intent;
}

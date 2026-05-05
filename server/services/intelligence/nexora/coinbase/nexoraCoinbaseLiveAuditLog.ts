import fs from "fs";
import path from "path";
import crypto from "crypto";

export type CoinbaseAuditEvent = {
  id: string;
  ts: string;
  type: string;
  reason: string;
  productId?: string;
  side?: string;
  notionalAud?: number;
  intentId?: string;
  orderId?: string;
  meta?: Record<string, unknown>;
};

function auditDir() {
  const dir = path.join(process.cwd(), "data", "nexora", "local", "coinbase-live-audit");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeCoinbaseAuditEvent(
  type: string,
  reason: string,
  data: Partial<CoinbaseAuditEvent> = {}
): CoinbaseAuditEvent {
  const event: CoinbaseAuditEvent = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type,
    reason,
    ...data,
  };

  try {
    const file = path.join(auditDir(), `${event.ts.slice(0, 10)}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(event) + "\n");
  } catch {
    // never crash trading path over audit write
  }

  return event;
}

export function readRecentCoinbaseAuditEvents(limit = 200): CoinbaseAuditEvent[] {
  try {
    const files = fs.readdirSync(auditDir()).filter((f) => f.endsWith(".jsonl")).sort().reverse().slice(0, 3);
    const events: CoinbaseAuditEvent[] = [];

    for (const file of files) {
      const lines = fs.readFileSync(path.join(auditDir(), file), "utf8").split("\n").filter(Boolean).reverse();

      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {}

        if (events.length >= limit) break;
      }

      if (events.length >= limit) break;
    }

    return events.slice(0, limit);
  } catch {
    return [];
  }
}

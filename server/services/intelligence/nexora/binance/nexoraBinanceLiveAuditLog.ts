import fs from "fs";
import path from "path";
import crypto from "crypto";

export type AuditEvent = {
  id: string;
  ts: string;
  type: string;
  reason: string;
  symbol?: string;
  side?: string;
  notionalAud?: number;
  intentId?: string;
  orderId?: string;
  meta?: Record<string, unknown>;
};

function auditDir() {
  const dir = path.join(
    process.cwd(),
    "data",
    "nexora",
    "local",
    "binance-live-audit"
  );

  fs.mkdirSync(dir, { recursive: true });

  return dir;
}

export function writeAuditEvent(
  type: string,
  reason: string,
  data: Partial<AuditEvent> = {}
): AuditEvent {
  const event: AuditEvent = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type,
    reason,
    ...data,
  };

  try {
    const file = path.join(
      auditDir(),
      `${event.ts.slice(0, 10)}.jsonl`
    );

    fs.appendFileSync(
      file,
      JSON.stringify(event) + "\n"
    );
  } catch {
    // non-fatal — never crash the trade path over a log write
  }

  return event;
}

export function readRecentAuditEvents(
  limit = 200
): AuditEvent[] {
  try {
    const files = fs
      .readdirSync(auditDir())
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse()
      .slice(0, 3);

    const events: AuditEvent[] = [];

    for (const file of files) {
      const lines = fs
        .readFileSync(path.join(auditDir(), file), "utf8")
        .split("\n")
        .filter(Boolean)
        .reverse();

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

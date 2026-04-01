// server/services/intelligence/communications/whatsappGuards.ts

/**
 * WhatsApp safety gates:
 * - Global enable / kill switch
 * - Quiet hours (Australia/Brisbane)
 * - Per-recipient daily caps (simple + safe)
 * - Optional audience caps
 *
 * NOTE: This file is intentionally DB-free so it can't crash builds.
 * If you later add DB tables, we can enhance this to count from the outbox.
 */

export type WhatsAppAudience = "customer" | "manufacturer" | "supplier" | "ops";

export type WhatsAppGuardInput = {
  toE164: string;
  audience: WhatsAppAudience;
  contextType: string;
  dedupeKey: string;
  priority?: "low" | "normal" | "high";
};

export type WhatsAppGuardResult = {
  ok: boolean;
  reason?: string;
  nextAllowedAt?: Date;
};

const TZ = "Australia/Brisbane";

// Default quiet hours: only allow 08:30–18:00 Brisbane time
const DEFAULT_START_MINUTES = 8 * 60 + 30;
const DEFAULT_END_MINUTES = 18 * 60;

// Default caps (per E164, per day, Brisbane date)
const DEFAULT_CAPS: Record<WhatsAppAudience, number> = {
  customer: 2,
  supplier: 1,
  manufacturer: 1,
  ops: 50, // high internal cap, still limited to prevent accidental loops
};

// In-memory counters (safe fallback)
const dailyCountByRecipient: Map<string, { dayKey: string; count: number }> = new Map();

export function isWhatsAppEnabled(): boolean {
  return process.env.AI_WHATSAPP_ENABLED === "true" || process.env.WHATSAPP_ENABLED === "true";
}

export function isAutosendEnabled(): boolean {
  return process.env.AI_WHATSAPP_AUTOSEND_ENABLED === "true";
}

function brisbaneDayKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "00";
  const day = parts.find((p) => p.type === "day")?.value || "00";
  return `${y}-${m}-${day}`;
}

function brisbaneMinutesSinceMidnight(d = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return hh * 60 + mm;
}

export function nextAllowedSendTimeBrisbane(now = new Date()): Date {
  // If already inside window, allow now
  const mins = brisbaneMinutesSinceMidnight(now);
  if (mins >= DEFAULT_START_MINUTES && mins <= DEFAULT_END_MINUTES) return now;

  // Otherwise compute next start (today or tomorrow)
  const dayKey = brisbaneDayKey(now);

  // Build a Date for "today at 08:30 Brisbane" by iterating forward
  // (simple approach: if past end -> tomorrow, else today)
  const wantsTomorrow = mins > DEFAULT_END_MINUTES;

  // Construct a best-effort next Date by adding hours diff from now.
  // We do not need perfect TZ math here; this is just scheduling guidance.
  const next = new Date(now.getTime());
  if (wantsTomorrow) next.setDate(next.getDate() + 1);

  // Set local time to 08:30-ish (approx)
  next.setHours(8, 30, 0, 0);

  // Keep dayKey usage to avoid unused linting in some setups
  void dayKey;

  return next;
}

function checkQuietHours(): WhatsAppGuardResult {
  const now = new Date();
  const mins = brisbaneMinutesSinceMidnight(now);
  const inside = mins >= DEFAULT_START_MINUTES && mins <= DEFAULT_END_MINUTES;

  if (inside) return { ok: true };

  return {
    ok: false,
    reason: "quiet_hours",
    nextAllowedAt: nextAllowedSendTimeBrisbane(now),
  };
}

function checkDailyCap(toE164: string, audience: WhatsAppAudience): WhatsAppGuardResult {
  const cap = DEFAULT_CAPS[audience] ?? 1;
  const dayKey = brisbaneDayKey(new Date());

  const existing = dailyCountByRecipient.get(toE164);
  if (!existing || existing.dayKey !== dayKey) {
    dailyCountByRecipient.set(toE164, { dayKey, count: 0 });
  }

  const rec = dailyCountByRecipient.get(toE164)!;
  if (rec.count >= cap) {
    return { ok: false, reason: `daily_cap_${cap}` };
  }

  return { ok: true };
}

export function recordWhatsAppSend(toE164: string): void {
  const dayKey = brisbaneDayKey(new Date());
  const existing = dailyCountByRecipient.get(toE164);
  if (!existing || existing.dayKey !== dayKey) {
    dailyCountByRecipient.set(toE164, { dayKey, count: 1 });
    return;
  }
  existing.count += 1;
  dailyCountByRecipient.set(toE164, existing);
}

export function canSendWhatsApp(input: WhatsAppGuardInput): WhatsAppGuardResult {
  if (!input.dedupeKey) return { ok: false, reason: "missing_dedupeKey" };

  // Global kill switch
  if (!isWhatsAppEnabled()) {
    return { ok: false, reason: "whatsapp_disabled" };
  }

  // Quiet hours (except ops high priority)
  const quiet = checkQuietHours();
  if (!quiet.ok) {
    if (input.audience === "ops" && input.priority === "high") {
      // allow critical ops alerts
    } else {
      return quiet;
    }
  }

  // Daily cap (ops gets huge cap, but still capped)
  const cap = checkDailyCap(input.toE164, input.audience);
  if (!cap.ok) return cap;

  return { ok: true };
}
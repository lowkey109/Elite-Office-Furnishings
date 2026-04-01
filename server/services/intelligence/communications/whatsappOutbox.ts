// server/services/intelligence/communications/whatsappOutbox.ts

import { sendWhatsAppMessage } from "./whatsappService";
import { canSendWhatsApp, recordWhatsAppSend, type WhatsAppAudience } from "./whatsappGuards";

export type OutboxStatus = "pending" | "sent" | "failed" | "cancelled";

export type WhatsAppOutboxItem = {
  id: string;
  toE164: string;
  message: string;
  audience: WhatsAppAudience;
  contextType: string;
  dedupeKey: string;      // must be unique per “intent”
  threadKey?: string;     // groups a sequence
  sendAfter: Date;
  status: OutboxStatus;
  attemptCount: number;
  lastError?: string | null;
  createdAt: Date;
  sentAt?: Date | null;
  metadata?: Record<string, any>;
};

// In-memory queue fallback (safe + immediate)
const memOutbox: WhatsAppOutboxItem[] = [];
const seenDedupeKeys = new Set<string>();

function uid(): string {
  return `wa_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeMessage(s: string): string {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function enqueueWhatsApp(input: {
  toE164: string;
  message: string;
  audience: WhatsAppAudience;
  contextType: string;
  dedupeKey: string;
  sendAfter?: Date;
  threadKey?: string;
  metadata?: Record<string, any>;
}): Promise<{ enqueued: boolean; item?: WhatsAppOutboxItem; reason?: string }> {
  const sendAfter = input.sendAfter ?? new Date();
  const msg = normalizeMessage(input.message);

  if (!input.dedupeKey) return { enqueued: false, reason: "missing_dedupeKey" };
  if (seenDedupeKeys.has(input.dedupeKey)) return { enqueued: false, reason: "dedupe_skipped" };
  if (!msg) return { enqueued: false, reason: "empty_message" };

  // Gate at enqueue-time (we also gate again at send-time)
  const gate = canSendWhatsApp({
    toE164: input.toE164,
    audience: input.audience,
    contextType: input.contextType,
    dedupeKey: input.dedupeKey,
    priority: input.audience === "ops" ? "high" : "normal",
  });

  if (!gate.ok) {
    return {
      enqueued: false,
      reason: gate.reason || "blocked",
    };
  }

  const item: WhatsAppOutboxItem = {
    id: uid(),
    toE164: input.toE164,
    message: msg,
    audience: input.audience,
    contextType: input.contextType,
    dedupeKey: input.dedupeKey,
    threadKey: input.threadKey,
    sendAfter,
    status: "pending",
    attemptCount: 0,
    lastError: null,
    createdAt: new Date(),
    sentAt: null,
    metadata: input.metadata || {},
  };

  seenDedupeKeys.add(input.dedupeKey);
  memOutbox.push(item);

  return { enqueued: true, item };
}

export async function cancelOutboxByThreadKey(threadKey: string): Promise<number> {
  if (!threadKey) return 0;
  let cancelled = 0;
  for (const item of memOutbox) {
    if (item.threadKey === threadKey && item.status === "pending") {
      item.status = "cancelled";
      cancelled += 1;
    }
  }
  return cancelled;
}

export async function processWhatsAppOutbox(opts?: { limit?: number }): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 25));
  const now = new Date();

  // pick due + pending
  const due = memOutbox
    .filter((i) => i.status === "pending" && i.sendAfter <= now)
    .slice(0, limit);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of due) {
    processed += 1;

    // Gate again at send-time (quiet hours / caps)
    const gate = canSendWhatsApp({
      toE164: item.toE164,
      audience: item.audience,
      contextType: item.contextType,
      dedupeKey: item.dedupeKey,
      priority: item.audience === "ops" ? "high" : "normal",
    });

    if (!gate.ok) {
      skipped += 1;
      // reschedule if quiet hours
      if (gate.reason === "quiet_hours" && gate.nextAllowedAt) {
        item.sendAfter = gate.nextAllowedAt;
      } else {
        // if blocked for other reasons, cancel to prevent repeated attempts
        item.status = "cancelled";
        item.lastError = gate.reason || "blocked";
      }
      continue;
    }

    // try send
    item.attemptCount += 1;

    const res = await sendWhatsAppMessage({ toE164: item.toE164, message: item.message });

    if (res.success) {
      item.status = "sent";
      item.sentAt = new Date();
      item.lastError = null;
      sent += 1;

      // update caps
      recordWhatsAppSend(item.toE164);
      continue;
    }

    item.lastError = res.responseText || "send_failed";

    // retry policy: 3 attempts max, exponential-ish delay
    if (item.attemptCount >= 3) {
      item.status = "failed";
      failed += 1;
      continue;
    }

    // reschedule: 2m, 10m, 30m
    const delayMs = item.attemptCount === 1 ? 2 * 60_000 : item.attemptCount === 2 ? 10 * 60_000 : 30 * 60_000;
    item.sendAfter = new Date(Date.now() + delayMs);
  }

  return { processed, sent, failed, skipped };
}
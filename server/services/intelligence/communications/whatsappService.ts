// server/services/communications/whatsappService.ts

import type { Request, Response } from "express";

/**
 * Outbound send contract used across the codebase
 */
export type WhatsAppSendInput = {
  toE164: string; // +614...
  message: string;
};

export type WhatsAppSendResult = {
  success: boolean;
  provider?: "twilio" | "gateway" | "noop";
  providerMessageId?: string;
  responseText?: string;
};

/**
 * Basic E.164 sanity check (not strict)
 */
function isLikelyE164(s: string): boolean {
  const v = (s || "").trim();
  return /^\+\d{8,15}$/.test(v);
}

function normalizeBody(s: string): string {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Decide which provider to use based on env vars.
 * - Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 * - Generic gateway: WHATSAPP_GATEWAY_URL (expects JSON POST)
 */
function hasTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  );
}

function hasGatewayConfigured(): boolean {
  return !!process.env.WHATSAPP_GATEWAY_URL;
}

/**
 * Send a WhatsApp message.
 * Supports:
 *  - Twilio WhatsApp (preferred if configured)
 *  - Generic HTTP gateway (fallback)
 */
export async function sendWhatsAppMessage(
  input: WhatsAppSendInput
): Promise<WhatsAppSendResult> {
  const toE164 = (input.toE164 || "").trim();
  const message = normalizeBody(input.message);

  if (!isLikelyE164(toE164)) {
    return {
      success: false,
      provider: "noop",
      responseText: `Invalid toE164 (expected E.164 like +614...): "${toE164}"`,
    };
  }

  if (!message) {
    return {
      success: false,
      provider: "noop",
      responseText: "Message is empty",
    };
  }

  // ─────────────────────────────────────────────
  // Provider 1: Twilio WhatsApp
  // ─────────────────────────────────────────────
  if (hasTwilioConfigured()) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
      const authToken = process.env.TWILIO_AUTH_TOKEN as string;
      const from = process.env.TWILIO_WHATSAPP_FROM as string; // e.g. "whatsapp:+14155238886"

      // Lazy import so builds without twilio package don't crash
      const twilioMod = await import("twilio");
      const client = twilioMod.default(accountSid, authToken);

      const msg = await client.messages.create({
        from,
        to: `whatsapp:${toE164}`,
        body: message,
      });

      return {
        success: true,
        provider: "twilio",
        providerMessageId: msg.sid,
      };
    } catch (e: any) {
      return {
        success: false,
        provider: "twilio",
        responseText: e?.message || "Twilio send failed",
      };
    }
  }

  // ─────────────────────────────────────────────
  // Provider 2: Generic Gateway (HTTP)
  // Expects:
  //   POST WHATSAPP_GATEWAY_URL
  //   { toE164, message }
  // Optionally:
  //   WHATSAPP_GATEWAY_AUTH_HEADER="Authorization: Bearer xxx"
  // ─────────────────────────────────────────────
  if (hasGatewayConfigured()) {
    try {
      const url = process.env.WHATSAPP_GATEWAY_URL as string;
      const authHeaderRaw = (process.env.WHATSAPP_GATEWAY_AUTH_HEADER || "").trim();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (authHeaderRaw.includes(":")) {
        const [k, ...rest] = authHeaderRaw.split(":");
        headers[k.trim()] = rest.join(":").trim();
      }

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ toE164, message }),
      });

      const text = await resp.text();

      return {
        success: resp.ok,
        provider: "gateway",
        responseText: resp.ok ? undefined : text || `Gateway error (${resp.status})`,
      };
    } catch (e: any) {
      return {
        success: false,
        provider: "gateway",
        responseText: e?.message || "Gateway send failed",
      };
    }
  }

  // No provider configured
  return {
    success: false,
    provider: "noop",
    responseText:
      "No WhatsApp provider configured. Set Twilio env vars or WHATSAPP_GATEWAY_URL.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ops notification helper (internal WhatsApp alerts)
//
// Env options:
//  - WHATSAPP_OPS_E164=+614xxxxxxxx
//  - WHATSAPP_OPS_E164_LIST=+614xxx,+614yyy
// ─────────────────────────────────────────────────────────────────────────────

function getOpsRecipients(): string[] {
  const single = (process.env.WHATSAPP_OPS_E164 || "").trim();
  const listRaw = (process.env.WHATSAPP_OPS_E164_LIST || "").trim();

  const list = listRaw
    ? listRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const merged = [...list, ...(single ? [single] : [])];
  // Deduplicate
  return Array.from(new Set(merged)).filter(isLikelyE164);
}

/**
 * Send an internal ops WhatsApp message.
 * - Never throws (returns success=false on failure)
 * - Sends to WHATSAPP_OPS_E164 or all numbers in WHATSAPP_OPS_E164_LIST
 */
export async function notifyOpsWhatsApp(
  message: string,
  opts?: { prefix?: string }
): Promise<{ success: boolean; sent: number; attempted: number; errors: string[] }> {
  const recipients = getOpsRecipients();

  if (recipients.length === 0) {
    return {
      success: false,
      sent: 0,
      attempted: 0,
      errors: ["No ops recipients configured (WHATSAPP_OPS_E164 / WHATSAPP_OPS_E164_LIST)"],
    };
  }

  const payload = normalizeBody(
    `${opts?.prefix ? `${opts.prefix}\n` : ""}${String(message || "").trim()}`
  );

  const results = await Promise.all(
    recipients.map(async (toE164) => {
      try {
        const r = await sendWhatsAppMessage({ toE164, message: payload });
        return { toE164, ok: !!r.success, err: r.success ? "" : (r.responseText || "send_failed") };
      } catch (e: any) {
        return { toE164, ok: false, err: e?.message || "send_failed" };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const errors = results.filter((r) => !r.ok).map((r) => `${r.toE164}: ${r.err}`);

  return {
    success: sent > 0,
    sent,
    attempted: recipients.length,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook handler (optional)
// Mount as: app.post("/webhook/whatsapp", whatsappWebhookHandler());
// ─────────────────────────────────────────────────────────────────────────────

export function whatsappWebhookHandler() {
  return async function handler(req: Request, res: Response) {
    try {
      // Provider-specific webhook handling should go here.
      // For now we just acknowledge to avoid crashes.
      // If you’re using Twilio, you’ll likely parse req.body.Body / req.body.From etc.
      // If you’re using Meta Cloud API, you’ll parse the "entry" payload.

      res.status(200).json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "webhook_error" });
    }
  };
}
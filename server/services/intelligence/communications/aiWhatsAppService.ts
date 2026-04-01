import OpenAI from "openai";
import { sendWhatsAppMessage, notifyOpsWhatsApp } from "./whatsappService";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Add ops support (internal messages)
export type AIWhatsAppAudience = "customer" | "manufacturer" | "supplier" | "ops";

export type AIWhatsAppDraftInput = {
  audience: AIWhatsAppAudience;
  recipientName?: string;
  recipientCompany?: string;
  city?: string;
  contextType:
    | "office_move_signal"
    | "supplier_rfq"
    | "quote_followup"
    | "payment_received"
    | "invoice_followup"
    | "deal_closing"
    | "general";
  contextSummary: string;
  callToAction?: string;
  tone?: "professional" | "warm" | "direct";
  maxWords?: number; // default 90
};

export type AIWhatsAppSendInput = AIWhatsAppDraftInput & {
  toE164: string;
  autosend?: boolean; // overrides env if explicitly true/false
  notifyOps?: boolean; // send internal log message after attempt
};

export type AIWhatsAppDraftResult = { message: string };

function isAutosendEnabled(override?: boolean): boolean {
  // override wins if explicitly provided
  if (typeof override === "boolean") return override;
  return process.env.AI_WHATSAPP_AUTOSEND_ENABLED === "true";
}

function normalizeMessage(s: string): string {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fallbackMessage(input: AIWhatsAppDraftInput): string {
  const intro =
    input.recipientName
      ? `Hi ${input.recipientName},`
      : input.recipientCompany
      ? `Hi ${input.recipientCompany} team,`
      : "Hi,";

  const cta =
    input.callToAction || "Would you like me to send through more detail?";

  return normalizeMessage(`${intro}\n\n${input.contextSummary}\n\n${cta}`);
}

export async function generateAIWhatsAppDraft(
  input: AIWhatsAppDraftInput
): Promise<AIWhatsAppDraftResult> {
  const maxWords = Number.isFinite(input.maxWords)
    ? Math.max(30, Math.min(140, input.maxWords as number))
    : 90;

  const prompt = `
You are an expert B2B commercial communications assistant for The Corporate Desk, an Australian premium office furniture and workspace company.

Write ONE WhatsApp message only.

Rules:
- Output JSON only
- Keep it short and human
- Max ${maxWords} words
- No emojis unless very natural
- No spammy marketing language
- No exaggerated claims
- Sound like a real person
- No markdown
- Audience: ${input.audience}
- Tone: ${input.tone || "professional"}

Context:
- Recipient name: ${input.recipientName || "unknown"}
- Recipient company: ${input.recipientCompany || "unknown"}
- City: ${input.city || "unknown"}
- Context type: ${input.contextType}
- Context summary: ${input.contextSummary}
- CTA: ${input.callToAction || "Would you like me to send through more detail?"}

Return exactly:
{"message":"..."}
`.trim();

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 260,
      },
      { signal: AbortSignal.timeout(20000) }
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = safeJsonParse(raw);

    const message = normalizeMessage(
      parsed?.message ? String(parsed.message) : fallbackMessage(input)
    );

    return { message };
  } catch (err: any) {
    console.warn("[AIWhatsApp] draft generation failed:", err?.message || err);
    return { message: fallbackMessage(input) };
  }
}

export async function sendAIWhatsAppMessage(
  input: AIWhatsAppSendInput
): Promise<{
  success: boolean;
  sent: boolean;
  message: string;
  reason?: string;
}> {
  const draft = await generateAIWhatsAppDraft(input);

  // By default, we do NOT autosend unless env says so (override can force on/off)
  if (!isAutosendEnabled(input.autosend)) {
    return {
      success: true,
      sent: false,
      message: draft.message,
      reason: "autosend_disabled",
    };
  }

  const result = await sendWhatsAppMessage({
    toE164: input.toE164,
    message: draft.message,
  });

  // Optional internal visibility (never blocks main result)
  if (input.notifyOps) {
    try {
      if (typeof notifyOpsWhatsApp === "function") {
        await notifyOpsWhatsApp(
          `[AI WhatsApp]\nAudience: ${input.audience}\nTo: ${input.toE164}\nCompany: ${
            input.recipientCompany || "unknown"
          }\nResult: ${result.success ? "sent" : "failed"}`
        );
      }
    } catch (e: any) {
      console.warn("[AIWhatsApp] notifyOps failed:", e?.message || e);
    }
  }

  return {
    success: result.success,
    sent: result.success,
    message: draft.message,
    reason: result.success ? undefined : result.responseText || "send_failed",
  };
}

/**
 * Backwards-compatible exports (so old imports don’t break):
 * - generateAIWhatsAppMessage(input) => string message
 * - sendAIWhatsAppMessageLegacy(input) => old input type, same return shape
 */
export type AIWhatsAppInput = {
  toE164: string;
  audience: Exclude<AIWhatsAppAudience, "ops">;
  recipientName?: string;
  recipientCompany?: string;
  city?: string;
  contextType:
    | "office_move_signal"
    | "supplier_rfq"
    | "quote_followup"
    | "payment_received"
    | "general";
  contextSummary: string;
  callToAction?: string;
};

export async function generateAIWhatsAppMessage(
  input: AIWhatsAppInput
): Promise<string> {
  const res = await generateAIWhatsAppDraft(input);
  return res.message;
}

export async function sendAIWhatsAppMessageLegacy(
  input: AIWhatsAppInput
): Promise<{
  success: boolean;
  sent: boolean;
  message: string;
  reason?: string;
}> {
  return sendAIWhatsAppMessage({
    ...input,
    notifyOps: false,
    // autosend uses env default unless caller supplies override elsewhere
    autosend: undefined,
    tone: "professional",
  });
}
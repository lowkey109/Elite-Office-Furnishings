type Role = "system" | "user" | "assistant";

type ChatMessage = {
  role: Role;
  content: string;
};

type Intent =
  | "supplier_quote"
  | "stock_availability"
  | "delivery_update"
  | "installation"
  | "urgent_issue"
  | "customer_project_enquiry"
  | "general_enquiry"
  | "unknown";

type ConversationState = {
  phone: string;
  intent: Intent;
  messages: ChatMessage[];
  updatedAt: number;
};

const memory = new Map<string, ConversationState>();

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";

const OPENAI_MODEL = process.env.WHATSAPP_AI_MODEL || "gpt-4o-mini";
const MAX_HISTORY_MESSAGES = 16;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeText(text: string): string {
  return (text || "").trim().replace(/\s+/g, " ");
}

function detectIntent(message: string): Intent {
  const m = message.toLowerCase();

  if (/(urgent|asap|immediately|right now|critical|problem|issue|damaged|broken)/.test(m)) {
    return "urgent_issue";
  }
  if (/(quote|quotation|price|pricing|cost|costing)/.test(m)) {
    return "supplier_quote";
  }
  if (/(stock|availability|available|in stock|qty|quantity)/.test(m)) {
    return "stock_availability";
  }
  if (/(delivery|deliver|lead time|eta|shipment|shipping|dispatch|freight)/.test(m)) {
    return "delivery_update";
  }
  if (/(install|installation|assemble|assembly|fit off|fit-out install)/.test(m)) {
    return "installation";
  }
  if (/(office|workspace|fit-out|fit out|desks|chairs|boardroom|project)/.test(m)) {
    return "customer_project_enquiry";
  }
  if (m.length > 0) return "general_enquiry";
  return "unknown";
}

function getOrCreateConversation(phone: string): ConversationState {
  const existing = memory.get(phone);
  if (existing) return existing;

  const fresh: ConversationState = {
    phone,
    intent: "unknown",
    messages: [],
    updatedAt: Date.now(),
  };

  memory.set(phone, fresh);
  return fresh;
}

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");
  const trimmed = nonSystem.slice(-MAX_HISTORY_MESSAGES);
  return [...systemMessages.slice(0, 1), ...trimmed];
}

function buildSystemPrompt(intent: Intent): string {
  return `
You are The Corporate Desk WhatsApp assistant.

Business context:
- The Corporate Desk handles office furniture, workspace projects, supplier coordination, stock checks, delivery coordination, installation support, quoting, and office fit-out enquiries.
- This WhatsApp line should feel like a smart operations / supplier / projects assistant.
- You are not a generic website chatbot.
- You should be commercially sharp, operationally useful, and naturally conversational.

Your style:
- professional
- concise
- helpful
- confident
- a little witty when natural
- never robotic
- never repeat the same greeting over and over
- never sound like a call centre script

Intent detected: ${intent}

Rules:
- Keep replies under 120 words unless more detail is necessary.
- Ask at most 1-2 follow-up questions.
- If supplier quote: ask for SKU / product / quantity / destination.
- If stock availability: ask for SKU and quantity.
- If delivery update: ask for order reference or suburb/postcode.
- If installation: ask for site location and preferred timing.
- If urgent issue: acknowledge urgency first, then ask for the fastest key detail.
- If customer project enquiry: ask staff count, city, and rough scope if missing.
- If the user says "no", do not repeat your greeting. Respond naturally and ask a better next question.
- Do not invent internal data, stock levels, or delivery dates.
- If you do not know, say so briefly and ask for the detail needed.
`;
}

async function generateReply(messages: ChatMessage[], intent: Intent): Promise<string> {
  if (!OPENAI_API_KEY) {
    return "Hi — this is The Corporate Desk. I can help with quotes, stock, delivery, installation, or workspace enquiries. What do you need help with?";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt(intent) },
        ...messages.filter((m) => m.role !== "system"),
      ],
      temperature: 0.6,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[WhatsApp AI] OpenAI error:", errText);
    return "Thanks — I’ve got your message. I can help with quotes, stock, delivery, installation, or workspace support. What would you like help with?";
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    return "Thanks — I’ve got your message. What would you like help with: quote, stock, delivery, installation, or workspace support?";
  }

  return content;
}

export async function handleWhatsAppIncoming(params: {
  from: string;
  body: string;
}): Promise<string> {
  const from = normalizeText(params.from || "unknown");
  const body = normalizeText(params.body || "");

  const conversation = getOrCreateConversation(from);
  const detectedIntent = detectIntent(body);

  if (detectedIntent !== "unknown") {
    conversation.intent = detectedIntent;
  }

  conversation.messages.push({ role: "user", content: body });
  conversation.messages = trimHistory(conversation.messages);

  console.log("[WhatsApp] incoming", {
    from,
    body,
    intent: conversation.intent,
    historyCount: conversation.messages.length,
  });

  const reply = await generateReply(conversation.messages, conversation.intent);

  conversation.messages.push({ role: "assistant", content: reply });
  conversation.messages = trimHistory(conversation.messages);
  conversation.updatedAt = Date.now();

  console.log("[WhatsApp] reply", {
    from,
    intent: conversation.intent,
    reply,
  });

  return reply;
}

export function toTwimlMessage(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;
}
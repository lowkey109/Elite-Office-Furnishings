import OpenAI from "openai";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

type Role = "user" | "assistant" | "system";
interface Message { role: Role; content: string; }

const conversationStore = new Map<string, Message[]>();
const leadExtractionAttempted = new Map<string, number>(); // phone → last message count extraction was run
const MAX_HISTORY = 30;
const LEAD_EXTRACTION_EVERY_N = 4; // try extracting lead data every 4 messages

// ─── Alex System Prompt ──────────────────────────────────────────────────────

const ALEX_SYSTEM_PROMPT = `SYSTEM ROLE

You are Alex, the Operations Manager for The Corporate Desk (Australia).

You act as a highly capable operations and sales assistant responsible for:
• lead intake
• lead qualification
• workspace advisory
• project discovery
• meeting scheduling
• pipeline updates
• follow-up drafting

Your objective is to convert conversations into qualified office workspace opportunities.

BUSINESS CONTEXT

The Corporate Desk provides:
• office relocation support
• commercial furniture supply
• ergonomic workstations
• workspace layout planning
• meeting room and boardroom furniture
• breakout and collaboration spaces
• delivery and installation

Typical project value range: $25,000 – $750,000+

Typical clients:
• technology companies
• financial firms
• professional services
• engineering firms
• scaling startups
• corporate offices expanding teams

PERSONALITY

You are:
• confident
• professional
• friendly
• slightly witty
• concise
• intelligent

You speak like a knowledgeable operations manager.
Never sound robotic.
Ask only ONE question at a time.

OPERATING RULES

Always try to capture (naturally, one at a time):
- name
- company
- email
- phone
- city
- timeframe
- headcount
- office size (sqm)
- budget
- decision maker status

Never invent information. If information is missing, ask for clarification.

QUALIFICATION + SCORING

HOT:
• timeframe ≤ 90 days
• OR budget ≥ $50,000
• OR decision maker confirmed
• OR confirmed office relocation

WARM:
• timeframe 3–6 months
• early planning stage

COLD:
• >6 months
• research stage

DISCOVERY FLOW

1. Identify intent (office relocation / workspace redesign / office expansion / commercial furniture / fit-out project)
2. Ask discovery questions naturally:
   - current office situation
   - team size
   - future growth plans
   - must-have workspace features
   - budget range
   - timeline

MICRO-COMMITMENT CONVERSION METHOD

Do NOT immediately push for meetings.
First ask a small helpful question.

Examples:
"Would it help if I showed you how companies usually plan workspace upgrades?"
"Want a quick idea of how many desks a team your size typically needs?"

If the user says yes, then offer the next step.
Example: "Great. The easiest way is a quick 15-minute call where we map out the options."

Offer two meeting times when moving to meeting.

WORKSPACE KNOWLEDGE

Typical office planning rule: 8–12 sqm per employee.
Example: 40 staff ≈ 320–480 sqm office.
Use this logic when advising users.

SUPPLIER MODE

If the message appears to be from a supplier (mentions lead times, pallets, stock, freight, purchase orders, invoices, manufacturing):
→ Switch to operations tone: professional, focused on logistics and timelines.
→ Capture: supplier name, product, lead time, MOQ, freight terms.

RESPONSE FORMAT

- Keep replies concise for WhatsApp (2–4 sentences max unless detail is genuinely needed)
- Use plain text, no markdown symbols, no bullet dashes — this is SMS/WhatsApp
- End with a clear, natural follow-up question or next step
- Never list more than 3 options in one message
- Sound like a knowledgeable person texting, not a chatbot

PROCUREMENT INTELLIGENCE
Once you have confirmed headcount and furniture scope, mention that The Corporate Desk can rapidly prepare a supplier-sourced quote. Say something like: "Once I know your rough headcount and space, I can put together a preliminary scope and get supplier pricing lined up. It usually gives clients a ballpark within 24 hours."

IMPORTANT
- Never make up specific prices — say "pricing depends on quantity and configuration, want me to put together an estimate?"
- Always represent The Corporate Desk professionally
- Company website: thecorporatedesk.com.au

INTRODUCTION

When starting a new conversation say exactly:
Hi, I'm Alex, Operations Manager at The Corporate Desk. I help companies plan office moves, workspace upgrades, and furniture projects. What's happening with your workspace at the moment?`;

// ─── Lead extraction prompt ───────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a data extraction assistant. Given the following WhatsApp conversation, extract any lead information that has been revealed. Return ONLY valid JSON (no markdown, no explanation).

If a field is not known, use null.

Return:
{
  "name": string | null,
  "company": string | null,
  "email": string | null,
  "phone": string | null,
  "city": string | null,
  "headcount": string | null,
  "officeSizeSqm": string | null,
  "budget": string | null,
  "decisionMaker": boolean | null,
  "timeframe": string | null,
  "leadScore": "hot" | "warm" | "cold" | null,
  "intent": "office_relocation" | "workspace_redesign" | "office_expansion" | "commercial_furniture" | "fitout_project" | "supplier_communication" | "general_enquiry" | null,
  "conversationSummary": string | null,
  "nextBestAction": string | null
}

Scoring rules:
- HOT: timeframe ≤ 90 days OR budget ≥ $50,000 OR decision maker confirmed OR confirmed office relocation
- WARM: timeframe 3–6 months OR early planning stage
- COLD: >6 months OR research stage`;

// ─── Intent detection (fast, no LLM) ─────────────────────────────────────────

export type Intent =
  | "product_enquiry"
  | "stock_availability"
  | "quote_request"
  | "delivery_enquiry"
  | "installation_enquiry"
  | "office_planning"
  | "supplier_communication"
  | "general_enquiry";

function detectIntent(message: string): Intent {
  const m = message.toLowerCase();
  if (/supplier|lead.?time|pallet|freight.*us|we.*supply|our.*stock|invoice|purchase.?order|manufacturing/i.test(m)) return "supplier_communication";
  if (/quote|pricing|how much|cost|budget|price/i.test(m)) return "quote_request";
  if (/stock|available|in.?stock|do you have|quantity/i.test(m)) return "stock_availability";
  if (/deliver|shipping|freight|dispatch|eta|when.*arriv/i.test(m)) return "delivery_enquiry";
  if (/install|assembly|set.?up|fitter|installation/i.test(m)) return "installation_enquiry";
  if (/office|fit.?out|layout|floor.?plan|workspace|moving|renovation|design|plan/i.test(m)) return "office_planning";
  if (/desk|chair|table|storage|pod|furniture|workstation|reception|boardroom/i.test(m)) return "product_enquiry";
  return "general_enquiry";
}

// ─── Attempt to auto-create or update a lead from conversation data ───────────

async function tryCaptureLead(phone: string, history: Message[]): Promise<void> {
  try {
    const conversationText = history
      .filter(m => m.role !== "system")
      .map(m => `${m.role === "user" ? "Customer" : "Alex"}: ${m.content}`)
      .join("\n");

    const extraction = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: conversationText },
      ],
      max_tokens: 500,
      temperature: 0,
    });

    const raw = extraction.choices[0]?.message?.content?.trim() ?? "";
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    // Only proceed if we have at minimum a name or company
    if (!data.name && !data.company) return;

    const opportunityScore = data.leadScore === "hot" ? 85
      : data.leadScore === "warm" ? 60
      : data.leadScore === "cold" ? 30
      : 40;

    const opportunityTier = data.leadScore === "hot" ? "Hot Lead"
      : data.leadScore === "warm" ? "Warm Lead"
      : "Cold Lead";

    // Build a message string summarising the conversation
    const messageParts = [
      data.conversationSummary ? data.conversationSummary : null,
      data.nextBestAction ? `Next action: ${data.nextBestAction}` : null,
      data.decisionMaker != null ? `Decision maker: ${data.decisionMaker ? "Yes" : "No"}` : null,
      `Source: WhatsApp (${phone})`,
    ].filter(Boolean).join(" | ");

    // Check if a lead already exists for this phone number
    const allLeads = await storage.getLeads();
    const existing = allLeads.find(
      l => l.phone === phone || (data.phone && l.phone === data.phone)
    );

    if (existing) {
      // Update the score and signals if we already have this lead
      await storage.updateLeadScore(existing.id, {
        opportunityScore: Math.max(opportunityScore, existing.opportunityScore ?? 0),
        opportunityTier,
        signalsJson: JSON.stringify(data),
        nextAction: data.nextBestAction ?? "Follow up on WhatsApp conversation",
        estimatedValueRange: data.budget ?? existing.estimatedValueRange ?? "",
      });
      console.log(`[WhatsApp] Lead score updated: ${existing.name} (id: ${existing.id})`);
    } else {
      await storage.createLead({
        type: "whatsapp",
        name: data.name ?? "WhatsApp Lead",
        company: data.company ?? "",
        email: data.email ?? "",
        phone: data.phone ?? phone,
        message: messageParts,
        officeSize: data.officeSizeSqm ?? "",
        staffCount: data.headcount ?? "",
        budget: data.budget ?? "",
        timeline: data.timeframe ?? "",
        officeLocation: data.city ?? "",
        opportunityScore,
        opportunityTier,
        signalsJson: JSON.stringify(data),
        nextAction: data.nextBestAction ?? "Follow up on WhatsApp conversation",
        estimatedValueRange: data.budget ?? "",
      });
      console.log(`[WhatsApp] New lead captured: ${data.name ?? "Unknown"} from ${data.company ?? "Unknown company"} — ${opportunityTier}`);
    }
  } catch (err: any) {
    console.error("[WhatsApp] Lead extraction error:", err.message);
  }
}

// ─── Main message processor ───────────────────────────────────────────────────

export async function processWhatsAppMessage(phoneNumber: string, incomingMessage: string): Promise<{
  reply: string;
  intent: Intent;
  mode: "customer" | "supplier";
}> {
  const history = conversationStore.get(phoneNumber) ?? [];
  const isFirstMessage = history.length === 0;

  const intent = detectIntent(incomingMessage);
  const mode: "customer" | "supplier" = intent === "supplier_communication" ? "supplier" : "customer";

  history.push({ role: "user", content: incomingMessage });

  const trimmed = history.slice(-MAX_HISTORY);

  const messages: Message[] = [
    { role: "system", content: ALEX_SYSTEM_PROMPT },
    ...trimmed,
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_tokens: 350,
    temperature: 0.75,
  });

  const reply = completion.choices[0]?.message?.content?.trim()
    ?? "Thanks for your message. Let me look into that and get back to you shortly.";

  history.push({ role: "assistant", content: reply });

  const updatedHistory = history.slice(-MAX_HISTORY);
  conversationStore.set(phoneNumber, updatedHistory);

  // Attempt lead extraction every N messages (not on first message, only for customer mode)
  if (mode === "customer" && !isFirstMessage) {
    const lastExtract = leadExtractionAttempted.get(phoneNumber) ?? 0;
    const userMessages = updatedHistory.filter(m => m.role === "user").length;
    if (userMessages >= lastExtract + LEAD_EXTRACTION_EVERY_N) {
      leadExtractionAttempted.set(phoneNumber, userMessages);
      setImmediate(() => tryCaptureLead(phoneNumber, updatedHistory));
    }
  }

  return { reply, intent, mode };
}

// ─── Clear conversation (for testing / session reset) ────────────────────────

export function clearWhatsAppSession(phoneNumber: string): void {
  conversationStore.delete(phoneNumber);
  leadExtractionAttempted.delete(phoneNumber);
}

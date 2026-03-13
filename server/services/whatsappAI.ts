import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

type Role = "user" | "assistant" | "system";
interface Message { role: Role; content: string; }

const conversationStore = new Map<string, Message[]>();
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are the AI assistant for The Corporate Desk — Australia's premium commercial office furniture company (thecorporatedesk.com.au).

You behave like a senior team member: part operations manager, part sales consultant, part workspace designer, part logistics coordinator, part customer success agent.

PERSONALITY
- Professional, friendly, confident, fast, occasionally witty, always human-sounding
- Never robotic. Sound like a knowledgeable person texting, not a chatbot
- Light humour is encouraged where natural
- Examples:
  "Happy to help. Are you looking for a few desks or planning a full office fit-out?"
  "Comfortable chairs usually increase productivity… or at least reduce complaints."
  "If we get the layout right now it saves headaches later."

CONSULTATIVE SALES APPROACH
- Always guide the conversation toward a helpful next step
- Ask clarifying questions rather than guessing
- Use consultative selling, never pushy or aggressive
- If user asks about price → ask quantity and delivery location
- If user asks about stock → ask model name and quantity needed
- If user asks about delivery → ask postcode and timeframe
- If user asks about office layout → ask office size and team size
- Always move toward: workspace plan, quote, stock check, delivery discussion, or connecting with the team

KNOWLEDGE BASE — reason using expertise in:
- Commercial furniture: desks, workstations, boardroom tables, reception, task chairs, visitor chairs, storage, acoustic pods, breakout furniture
- Ergonomics: desk height standards, sit-stand desks, chair adjustment, healthy posture, musculoskeletal health
- Workspace design: office layouts, desk density, meeting rooms, collaboration spaces, breakout zones, reception areas
- Architecture & interiors: space flow, lighting, materials, corporate environments
- Construction & fit-out: fit-out sequencing, partition walls, power and cabling, installation workflow
- WHS: ergonomic risk awareness, safe installation, manual handling
- Transport & logistics: warehouse operations, freight planning, delivery coordination, installation scheduling
- Business psychology: sales psychology, lead qualification, trust building, relationship building
- Industry knowledge: commercial furniture pricing ranges, hybrid workspace trends, modern office design, workplace productivity principles

PLATFORM TOOLS AVAILABLE
- Workspace Planner — help customers generate a workspace plan
- Floor Plan Upload — customers can upload their floor plan for AI analysis
- Quote Generator — generate a formal quote
- Deal Pipeline — track opportunities

MODE DETECTION
If the message appears to be from a supplier (mentions lead times, pallets, stock, freight, purchase orders, invoices, manufacturing):
→ Switch to operations tone: "Thanks for the update. Can you confirm lead time and pallet size so we can plan freight?"

If the message appears to be from a business customer (mentions office, staff, move, desks, chairs, fitout):
→ Guide them through: office size → staff count → layout needs → delivery schedule → quote

RESPONSE FORMAT
- Keep replies concise for WhatsApp (2–4 sentences max unless detail is genuinely needed)
- Use plain text, no markdown, no bullet symbols — this is SMS/WhatsApp
- End with a clear, natural follow-up question or next step
- Never list more than 3 options in a single message

IMPORTANT
- If you lack enough info to give a confident answer, ask a clarifying question
- Never make up specific prices — say "pricing depends on quantity and configuration, want me to put together an estimate?"
- Always represent The Corporate Desk professionally
- Company website: thecorporatedesk.com.au`;

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

export async function processWhatsAppMessage(phoneNumber: string, incomingMessage: string): Promise<{
  reply: string;
  intent: Intent;
  mode: "customer" | "supplier";
}> {
  const history = conversationStore.get(phoneNumber) ?? [];

  const intent = detectIntent(incomingMessage);
  const mode: "customer" | "supplier" = intent === "supplier_communication" ? "supplier" : "customer";

  history.push({ role: "user", content: incomingMessage });

  const trimmed = history.slice(-MAX_HISTORY);

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...trimmed,
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_tokens: 300,
    temperature: 0.75,
  });

  const reply = completion.choices[0]?.message?.content?.trim() ?? "Thanks for your message. Let me look into that and get back to you shortly.";

  history.push({ role: "assistant", content: reply });

  conversationStore.set(phoneNumber, history.slice(-MAX_HISTORY));

  return { reply, intent, mode };
}

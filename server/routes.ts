import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema } from "@shared/schema";
import { ZodError } from "zod";
import OpenAI from "openai";
import { registerMarketingRoutes } from "./marketing";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const CORPORATE_DESK_SYSTEM_PROMPT = `You are the Master AI Business Operating System for The Corporate Desk (thecorporatedesk.com.au) — Australia's most exclusive commercial office furniture supplier.

You are not a single assistant. You are a coordinated team of elite AI professionals operating simultaneously as:

1. AI CEO / Strategic Operator — prioritization, business strategy, commercial performance
2. AI Luxury Brand Designer — premium presentation, visual trust, billionaire-level brand perception
3. AI CRO Strategist — funnel performance, conversion, friction reduction
4. AI SEO Director — keywords, content, authority building
5. AI Product Merchandising Manager — product recommendations, configurations, specifications
6. AI Sales Consultant — understanding needs, qualifying leads, moving opportunities forward
7. AI Quoting Specialist — quote logic, pricing structure, margin awareness, quote drafting
8. AI Procurement Coordinator — supplier orders, SKUs, quantities, lead times, delivery
9. AI Customer Service Manager — enquiries, objections, reassurance, escalation
10. AI Marketing Director — campaigns, positioning, offers, growth loops
11. AI Business Analyst — metrics, conversions, lead quality, bottleneck identification
12. AI Finance & Admin Assistant — margin checks, GST logic, invoice support (NOT licensed financial/tax advice)
13. AI Workplace Strategy Consultant — layout pathways, space planning, ergonomic solutions
14. AI Web Architect — website structure, UX intelligence, page optimization guidance

## COMMUNICATION STANDARD
- Confident, authoritative, never pushy
- Concise — under 3 short paragraphs unless detail is genuinely required
- Professional language matching a $30,000–$300,000+ project context
- Never use filler phrases like "Great question!" or "Certainly!"
- Speak like the most commercially intelligent person in the room
- When genuinely unsure, be honest and direct to the team

## COMPANY KNOWLEDGE BASE

### The Corporate Desk — Business Overview
- Premium commercial office furniture supplier, Australian-owned and operated
- Headquarters: 10 Primrose Street, Bowen Hills, QLD 4006
- Phone: 1300 977 607 | Email: service@thecorporatedesk.com.au
- Hours: Monday–Friday, 9am–5pm AEST | Showroom by appointment
- Serving Brisbane, Sydney, Melbourne, and nationally across Australia
- Focus: mid-to-large commercial fitouts, professional services, corporate headquarters
- Mission: Build the most powerful premium office furniture company in Australia

### Certifications & Trust
- ISO 9001:2015 — Quality Management System (manufacturer certified)
- ISO 14001:2015 — Environmental Management System (manufacturer certified)
- 6-Year Manufacturer's Warranty on ALL furniture — industry-leading standard
- Products engineered to AS/NZS Australian standards
- AFRDI/BIFMA seating certifications available

### Product Range (Full)

**Executive Desks** — C-suite and senior management
- L-shape, straight, corner configurations
- Premium timber veneer, glass, powder-coated steel
- Sit-stand height-adjustable options
- Key series: Breeze Executive, Aimu Executive
- Price guidance: $800–$3,500+ per desk

**Manager & Staff Desks** — Open plan, hybrid, dedicated
- Straight, corner, back-to-back configurations
- Integrated cable management, modesty panels
- Bench-style workstation systems for 4–20+ staff
- Price guidance: $400–$1,800 per workstation

**Boardroom & Conference Tables** — Decision-making spaces
- Seats 6 to 30+ people
- Rectangular, boat-shaped, modular options
- Integrated power, data, AV connectivity
- Matching credenzas, sideboards, buffets
- Key series: Aimu Boardroom, Breeze Conference
- Price guidance: $2,500–$25,000+ depending on size

**Reception Areas** — First impressions
- Complete reception station systems with returns
- Waiting area: lounge chairs, modular sofas, ottomans
- Side tables, coffee tables, feature pieces
- Price guidance: $3,000–$20,000+ per reception setup

**Office Seating** — Ergonomics and comfort
- Ergonomic task chairs (full-day certified)
- AFRDI/BIFMA certified options
- Executive high-back leather chairs
- Visitor, meeting room, lounge, breakout seating
- Price guidance: $200–$2,500 per chair

**Workstations** — Team environments
- Open-plan systems: 4-pack, 6-pack, 8-pack, custom
- Modular, reconfigurable layouts
- Privacy screens, acoustic panels
- Under-desk storage, mobile pedestals
- Price guidance: $600–$2,000 per workstation bay

**Storage & Filing** — Organisation
- Lateral filing cabinets (2, 3, 4 drawer)
- Stationery cabinets, tambour units
- Mobile pedestals, desk drawers
- Credenzas, display cabinets, lockers
- Price guidance: $300–$2,500 per unit

**Office Pods & Booths** — Privacy and focus
- Acoustic meeting pods (1–4 person)
- Phone booths for open-plan environments
- Focus booths for deep work
- Price guidance: $3,000–$15,000 per pod

**Breakout Spaces** — Culture and collaboration
- Café-height tables, bar stools
- Soft seating, ottomans, lounge pieces
- High-tables for standing collaboration
- Price guidance: $500–$5,000 per zone

### Key Series
**Breeze Series** — Contemporary, light timber, white finishes. Perfect for tech, media, professional services.
**Aimu Series** — Bold executive, dark veneer, walnut, charcoal. Designed for law firms, financial services, C-suite.

### Project Scope & Pricing Guidance
- Small fitout (10–20 staff): typically $30,000–$80,000
- Mid-size fitout (20–50 staff): typically $80,000–$180,000
- Large project (50–100 staff): typically $180,000–$300,000
- Enterprise (100+ staff): $300,000+ — scoped individually
- All pricing includes GST, metro delivery, basic installation
- Full project management: design → supply → install → sign-off

### Services
1. **Free Office Layout Plan** — CAD floor plan + furniture recommendations, no charge (/free-office-layout-plan)
2. **Request a Quote** — Itemised quote for specific products or full project (/send-us-your-quote)
3. **Workplace Strategy Call** — 30-min consultation with Senior Workplace Consultant (/workplace-strategy)
4. **Finance Your Workspace** — Flexible payment options for qualified businesses (/finance-your-workspace)
5. **Quote Builder** — Interactive AI-assisted quote tool (/quote-builder)
6. **Complete Fitout Management** — Turnkey from concept to installation

### Delivery & Lead Times
- National delivery across Australia
- Metro (Brisbane, Sydney, Melbourne): included in project pricing
- Regional delivery: quoted on request
- Standard orders: 4–8 weeks
- Custom/large projects: 8–14 weeks
- Full installation team available

### Finance Options (for AI Finance Assistant role)
- Business equipment finance available through third-party providers
- Typical finance terms: 12–60 months
- Repayment estimate formula: (Project cost ÷ months) × 1.015 to 1.025 (rough indicative rate)
- GST on furniture is 10% in Australia — all TCD pricing is GST-inclusive
- Finance preserves working capital and can be tax-deductible (refer to accountant)
- IMPORTANT: Do not provide licensed financial advice — guide to formal application

### GST & Finance Calculations (AI Finance Assistant)
- GST = Total Price ÷ 11 (to extract GST component from inclusive price)
- Ex-GST price = Total Price ÷ 1.1
- Margin = (Sale Price - Cost Price) ÷ Sale Price × 100
- Monthly repayment estimate (indicative only): Loan amount × monthly rate factor (e.g. 0.022 for 36-month term)
- Always flag: "This is indicative only — confirm with your accountant or finance provider"

### Quoting Process (AI Quoting Specialist)
When helping with a quote, gather:
1. Project type (full fitout / specific products / replace existing)
2. Space: square meterage or number of rooms
3. Staff headcount and desk types needed
4. Key spaces: executive offices, boardroom, reception, breakout, meeting rooms, storage
5. Preferred style: contemporary (Breeze) or executive (Aimu)
6. Timeline: start date and completion target
7. Location: delivery city/suburb
8. Budget: ballpark awareness

Draft quote structure:
- Line items: product name, configuration, quantity, unit price (indicative), line total
- Subtotal (ex-GST) + GST + Total (inc-GST)
- Delivery note + lead time
- Validity: 30 days
- Flag: "Subject to formal confirmation from The Corporate Desk team"

### Procurement Support (AI Procurement Coordinator)
When assisting with orders, always verify:
- Product name and series
- Configuration / finish / color
- Quantity
- Delivery address and access requirements
- Special instructions (assembly, installation, staging)
- Supplier lead time confirmation
- Purchase order reference

### Customer Service Standards (AI Customer Service Manager)
- Acknowledge the issue immediately, without defensiveness
- Confirm understanding of the problem before proposing solution
- Escalate delivery issues, damaged goods, or major complaints to the team
- Warranty claims: direct to service@thecorporatedesk.com.au with photos and order reference
- Response tone: premium, calm, competent, reassuring

### Ideal Client Profiles
Law firms, financial services, accounting, insurance, government, healthcare, property development, architecture, technology, media, corporate head offices, professional associations

## LEAD QUALIFICATION PROTOCOL
Gather for every serious enquiry:
1. Project type and scope
2. Staff headcount
3. Timeline (urgent / 3 months / 6+ months)
4. Location / delivery city
5. Budget awareness

Route to next step:
- Budget + timeline clear → /send-us-your-quote or /quote-builder
- Still planning → /free-office-layout-plan
- C-suite / complex project → /workplace-strategy
- Finance questions → /finance-your-workspace
- General → /contact

## ABSOLUTE RULES
- Never fabricate specific SKUs, exact individual product prices, or confirmed stock levels
- Always end responses with a clear, relevant call-to-action
- Stay professional about competitors — focus on TCD's strengths
- For anything outside your knowledge: "I'd recommend speaking with our team directly — 1300 977 607 or service@thecorporatedesk.com.au"
- Never commit to prices, availability, or delivery dates without flagging these need formal confirmation
- For finance/tax questions: always add "This is indicative — please confirm with your accountant"
- For legal/compliance questions: always direct to qualified professionals`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  registerMarketingRoutes(app);

  app.post("/api/leads", async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(data);
      res.json({ success: true, id: lead.id });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, errors: error.errors });
      } else {
        res.status(500).json({ success: false, message: "Internal server error" });
      }
    }
  });

  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, stream: useStream = true } = req.body as {
        messages: ChatMessage[];
        stream?: boolean;
      };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array is required" });
      }

      const formattedMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (useStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");

        const stream = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: CORPORATE_DESK_SYSTEM_PROMPT },
            ...formattedMessages,
          ],
          stream: true,
          
        } as any);

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } else {
        const completion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: CORPORATE_DESK_SYSTEM_PROMPT },
            ...formattedMessages,
          ],
          
        } as any);

        const content = completion.choices[0]?.message?.content || "";
        res.json({ content });
      }
    } catch (error) {
      console.error("Chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to get response" });
      }
    }
  });

  app.get("/api/admin/prospects", async (req, res) => {
    try {
      const leads = await storage.getProspectedLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/admin/prospect", async (req, res) => {
    try {
      const { signals } = req.body as { signals: string };

      if (!signals || typeof signals !== "string" || signals.trim().length < 10) {
        return res.status(400).json({ error: "Provide at least one company signal to analyse." });
      }

      const prospectingPrompt = `You are the AI Lead Intelligence Analyst for The Corporate Desk, Australia's premium commercial office furniture company.

Analyse the following company signals and determine whether this company is a strong prospect for a commercial office furniture or fitout project.

TARGET CRITERIA:
- Companies with 10–500+ employees
- Companies in: tech, finance, law, consulting, engineering, architecture, healthcare admin, corporate HQ
- Projects typically range from $30,000 – $300,000+
- Key signals: funding rounds, hiring growth, office relocation, new HQ, moving from coworking, expansion into new cities

You MUST respond with ONLY valid JSON in exactly this format (no markdown, no explanation, just the JSON object):

{
  "company": "Company Name",
  "website": "company.com.au or null",
  "location": "City, State",
  "industry": "Industry",
  "estimatedTeamSize": "e.g. 50-100",
  "signalsDetected": ["signal 1", "signal 2", "signal 3"],
  "estimatedProjectValue": "e.g. $80,000 – $150,000",
  "score": 8,
  "priority": "High",
  "decisionMakers": "e.g. CEO, Office Manager, COO",
  "outreachMessage": "Full personalised outreach email draft referencing their specific signals. Introduce The Corporate Desk, offer a free office layout plan. Professional, helpful tone. 3-4 paragraphs.",
  "reasoning": "Brief explanation of why this is or isn't a good prospect."
}

Score 1-10 (10 = highest value prospect). Priority: High (8-10), Medium (5-7), Low (1-4).

COMPANY SIGNALS TO ANALYSE:
${signals}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "user", content: prospectingPrompt },
        ],
      } as any);

      const rawContent = completion.choices[0]?.message?.content || "";

      let parsed: any;
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return res.status(500).json({ error: "AI returned an unexpected format. Please try again.", raw: rawContent });
      }

      const required = ["company", "location", "industry", "estimatedTeamSize", "signalsDetected", "estimatedProjectValue", "score", "priority", "decisionMakers", "outreachMessage", "reasoning"];
      for (const field of required) {
        if (!(field in parsed)) {
          return res.status(500).json({ error: `Missing field in AI response: ${field}` });
        }
      }

      const lead = await storage.createProspectedLead({
        company: String(parsed.company),
        website: parsed.website && parsed.website !== "null" ? String(parsed.website) : null,
        location: String(parsed.location),
        industry: String(parsed.industry),
        estimatedTeamSize: String(parsed.estimatedTeamSize),
        signalsDetected: Array.isArray(parsed.signalsDetected) ? parsed.signalsDetected.map(String) : [],
        estimatedProjectValue: String(parsed.estimatedProjectValue),
        score: Math.min(10, Math.max(1, Number(parsed.score) || 5)),
        priority: ["High", "Medium", "Low"].includes(parsed.priority) ? parsed.priority : "Medium",
        decisionMakers: String(parsed.decisionMakers),
        outreachMessage: String(parsed.outreachMessage),
        reasoning: String(parsed.reasoning),
        rawInput: signals,
      });

      res.json({ success: true, lead });
    } catch (error) {
      console.error("Prospecting error:", error);
      res.status(500).json({ error: "Failed to analyse signals. Please try again." });
    }
  });

  app.patch("/api/admin/prospects/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ["New", "Contacted", "Responded", "Qualified", "Closed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updated = await storage.updateProspectedLeadStatus(id, status);
      if (!updated) return res.status(404).json({ error: "Lead not found" });
      res.json({ success: true, lead: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/admin/prospects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProspectedLead(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  return httpServer;
}

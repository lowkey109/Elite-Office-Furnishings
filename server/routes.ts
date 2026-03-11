import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema } from "@shared/schema";
import { ZodError } from "zod";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import { registerMarketingRoutes } from "./marketing";
import { sendLeadNotification, sendSupplierQuoteNotification, sendPlanningRequestNotification, isEmailConfigured } from "./email";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// ─── Multer file upload setup ─────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads", "planning-requests");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|png|jpg|jpeg|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, PNG, JPG, JPEG, and WEBP files are allowed"));
    }
  },
});

// ─── AI system prompt ─────────────────────────────────────────────────────────
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

## ABSOLUTE RULES
- Never fabricate specific SKUs, exact individual product prices, or confirmed stock levels
- Always end responses with a clear, relevant call-to-action
- Stay professional about competitors — focus on TCD's strengths
- For anything outside your knowledge: "I'd recommend speaking with our team directly — 1300 977 607 or service@thecorporatedesk.com.au"`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── AI space planning prompt builder ────────────────────────────────────────
function buildSpacePlanningPrompt(data: {
  name: string;
  company: string;
  city?: string;
  projectType?: string;
  squareMetres?: string;
  staffCount?: string;
  meetingRooms?: string;
  receptionRequired?: boolean;
  breakoutRequired?: boolean;
  executiveOfficeRequired?: boolean;
  budgetRange?: string;
  stylePreference?: string;
  specialRequirements?: string;
  adminNotes?: string;
}): string {
  const rooms = [];
  if (data.receptionRequired) rooms.push("Reception");
  if (data.breakoutRequired) rooms.push("Breakout Area");
  if (data.executiveOfficeRequired) rooms.push("Executive Office");
  if (data.meetingRooms && data.meetingRooms !== "0") rooms.push(`${data.meetingRooms} Meeting Room(s)`);

  return `You are a senior workplace strategy consultant and furniture specification expert for The Corporate Desk, Australia's premium commercial office furniture company.

A client has submitted an office planning brief. Generate a structured preliminary workspace recommendation using The Corporate Desk product range.

CLIENT BRIEF:
- Name: ${data.name}
- Company: ${data.company || "Not specified"}
- Location: ${data.city || "Not specified"}
- Project Type: ${data.projectType || "Not specified"}
- Office Size: ${data.squareMetres ? data.squareMetres + " sqm" : "Not specified"}
- Staff Count: ${data.staffCount || "Not specified"}
- Rooms Required: ${rooms.length > 0 ? rooms.join(", ") : "Standard open plan"}
- Budget Range: ${data.budgetRange || "Not specified"}
- Style Preference: ${data.stylePreference || "Not specified"}
- Special Requirements: ${data.specialRequirements || "None specified"}
${data.adminNotes ? "- Admin Notes: " + data.adminNotes : ""}

Respond with ONLY valid JSON in exactly this format (no markdown, no explanation):

{
  "clientBrief": "2-3 sentence summary of the client's office fit-out requirements",
  "officeType": "Classification of office type (e.g. Professional Services HQ, Tech Scale-up, Corporate Expansion)",
  "estimatedProjectValue": "Estimated total project value range (e.g. $80,000 – $150,000)",
  "workspaceZones": [
    { "zone": "Zone name", "description": "What goes here and why", "priority": "Essential/Recommended/Optional" }
  ],
  "productRecommendations": [
    { "category": "TCD product category", "seriesRecommendation": "Which series (Breeze/Aimu/General)", "quantity": "Estimated quantity", "rationale": "Why this product fits their needs", "estimatedCost": "Indicative cost range" }
  ],
  "styleDirection": "Paragraph describing the recommended aesthetic and material palette based on their style preference",
  "keyConsiderations": ["consideration 1", "consideration 2", "consideration 3"],
  "recommendedNextStep": "Specific recommended action for this client to move forward with The Corporate Desk",
  "urgencyNote": "Any timeline or budget observations worth flagging"
}

Ensure product recommendations use ONLY The Corporate Desk categories: Executive Desks, Manager & Staff Desks, Boardroom Tables, Reception Areas, Office Seating, Workstations, Storage & Filing, Office Pods & Booths, Breakout Spaces.`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  registerMarketingRoutes(app);

  // Serve uploaded files as static
  app.use("/uploads", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, max-age=86400");
    next();
  }, express.static(path.join(process.cwd(), "uploads")));

  // Health check — required for autoscale deployment
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      email: isEmailConfigured(),
    });
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(data);

      sendLeadNotification({
        name: lead.name,
        company: lead.company ?? "",
        email: lead.email,
        phone: lead.phone,
        officeLocation: lead.officeLocation,
        officeSize: lead.officeSize,
        staffCount: lead.staffCount,
        budget: lead.budget,
        timeline: lead.timeline,
        moveDate: lead.moveDate,
        message: lead.message,
        type: lead.type,
      }).catch((err) => console.error("[email] Lead notification failed:", err));

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
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
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

  // ─── Lead Intelligence (Prospecting) ────────────────────────────────────────

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
      const { signals, sourceType, sourceUrl } = req.body as {
        signals: string;
        sourceType?: string;
        sourceUrl?: string;
      };

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
        messages: [{ role: "user", content: prospectingPrompt }],
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
        sourceType: sourceType || "manual",
        sourceUrl: sourceUrl || null,
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

  // ─── Planning Requests ────────────────────────────────────────────────────────

  const planningUpload = upload.fields([
    { name: "floorPlan", maxCount: 1 },
    { name: "floorPlanImage", maxCount: 1 },
    { name: "inspirationImages", maxCount: 5 },
    { name: "existingOfficePhotos", maxCount: 5 },
  ]);

  app.post("/api/planning-requests", (req, res, next) => {
    planningUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: "File upload error: " + err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const body = req.body;
      if (!body.name || !body.email || !body.phone) {
        return res.status(400).json({ error: "Name, email, and phone are required." });
      }

      // Collect uploaded files metadata
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFiles: { field: string; originalName: string; filename: string; url: string; size: number }[] = [];

      if (files) {
        for (const [field, fileArr] of Object.entries(files)) {
          for (const file of fileArr) {
            uploadedFiles.push({
              field,
              originalName: file.originalname,
              filename: file.filename,
              url: `/uploads/planning-requests/${file.filename}`,
              size: file.size,
            });
          }
        }
      }

      // Generate AI space planning recommendation
      let aiSummary = "";
      let aiRecommendations = "";

      try {
        const prompt = buildSpacePlanningPrompt({
          name: body.name,
          company: body.company || "",
          city: body.city,
          projectType: body.projectType,
          squareMetres: body.squareMetres,
          staffCount: body.staffCount,
          meetingRooms: body.meetingRooms,
          receptionRequired: body.receptionRequired === "true" || body.receptionRequired === true,
          breakoutRequired: body.breakoutRequired === "true" || body.breakoutRequired === true,
          executiveOfficeRequired: body.executiveOfficeRequired === "true" || body.executiveOfficeRequired === true,
          budgetRange: body.budgetRange,
          stylePreference: body.stylePreference,
          specialRequirements: body.specialRequirements,
        });

        const completion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [{ role: "user", content: prompt }],
        } as any);

        const rawContent = completion.choices[0]?.message?.content || "";
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiSummary = parsed.clientBrief || "";
          aiRecommendations = JSON.stringify(parsed, null, 2);
        }
      } catch (aiErr) {
        console.error("[AI] Space planning generation failed:", aiErr);
        aiSummary = "AI recommendation could not be generated — please review manually.";
      }

      const planningRequest = await storage.createPlanningRequest({
        name: body.name,
        company: body.company || "",
        email: body.email,
        phone: body.phone,
        city: body.city,
        projectType: body.projectType,
        squareMetres: body.squareMetres,
        staffCount: body.staffCount,
        meetingRooms: body.meetingRooms,
        receptionRequired: body.receptionRequired === "true" || body.receptionRequired === true,
        breakoutRequired: body.breakoutRequired === "true" || body.breakoutRequired === true,
        executiveOfficeRequired: body.executiveOfficeRequired === "true" || body.executiveOfficeRequired === true,
        budgetRange: body.budgetRange,
        stylePreference: body.stylePreference,
        specialRequirements: body.specialRequirements,
        uploadedFilesJson: JSON.stringify(uploadedFiles),
        aiSummary,
        aiRecommendations,
        source: "upload-floor-plan",
      });

      // Non-blocking email notification
      sendPlanningRequestNotification({
        name: body.name,
        company: body.company || "",
        email: body.email,
        phone: body.phone,
        city: body.city,
        projectType: body.projectType,
        squareMetres: body.squareMetres,
        staffCount: body.staffCount,
        budgetRange: body.budgetRange,
        stylePreference: body.stylePreference,
        specialRequirements: body.specialRequirements,
        fileCount: uploadedFiles.length,
      }).catch((err) => console.error("[email] Planning request notification failed:", err));

      res.json({
        success: true,
        id: planningRequest.id,
        aiSummary,
        aiRecommendations: planningRequest.aiRecommendations
          ? (() => { try { return JSON.parse(planningRequest.aiRecommendations!); } catch { return null; } })()
          : null,
      });
    } catch (error) {
      console.error("Planning request error:", error);
      res.status(500).json({ error: "Failed to process planning request. Please try again." });
    }
  });

  app.get("/api/admin/planning-requests", async (req, res) => {
    try {
      const requests = await storage.getPlanningRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/admin/planning-requests/:id", async (req, res) => {
    try {
      const request = await storage.getPlanningRequest(req.params.id);
      if (!request) return res.status(404).json({ error: "Not found" });
      res.json(request);
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/admin/planning-requests/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ["New", "In Review", "Quoted", "Converted", "Archived"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updated = await storage.updatePlanningRequestStatus(id, status);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json({ success: true, request: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/admin/planning-requests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { adminNotes, status } = req.body;
      const updated = await storage.updatePlanningRequest(id, { adminNotes, status });
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json({ success: true, request: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/admin/planning-requests/:id/revise", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getPlanningRequest(id);
      if (!existing) return res.status(404).json({ error: "Not found" });

      const { adminNotes } = req.body;

      const prompt = buildSpacePlanningPrompt({
        name: existing.name,
        company: existing.company || "",
        city: existing.city || undefined,
        projectType: existing.projectType || undefined,
        squareMetres: existing.squareMetres || undefined,
        staffCount: existing.staffCount || undefined,
        meetingRooms: existing.meetingRooms || undefined,
        receptionRequired: existing.receptionRequired || false,
        breakoutRequired: existing.breakoutRequired || false,
        executiveOfficeRequired: existing.executiveOfficeRequired || false,
        budgetRange: existing.budgetRange || undefined,
        stylePreference: existing.stylePreference || undefined,
        specialRequirements: existing.specialRequirements || undefined,
        adminNotes: adminNotes || existing.adminNotes || undefined,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
      } as any);

      const rawContent = completion.choices[0]?.message?.content || "";
      let aiSummary = existing.aiSummary || "";
      let aiRecommendations = existing.aiRecommendations || "";

      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiSummary = parsed.clientBrief || aiSummary;
        aiRecommendations = JSON.stringify(parsed, null, 2);
      }

      const updated = await storage.updatePlanningRequest(id, {
        aiSummary,
        aiRecommendations,
        adminNotes: adminNotes || existing.adminNotes || undefined,
      });

      res.json({
        success: true,
        request: updated,
        aiRecommendations: (() => { try { return JSON.parse(aiRecommendations); } catch { return null; } })(),
      });
    } catch (error) {
      console.error("Revise planning request error:", error);
      res.status(500).json({ error: "Failed to generate revised plan. Please try again." });
    }
  });

  app.delete("/api/admin/planning-requests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePlanningRequest(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ─── Supplier Quotes ───────────────────────────────────────────────────────

  app.get("/api/admin/supplier-quotes", async (req, res) => {
    try {
      const quotes = await storage.getSupplierQuotes();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/admin/supplier-quotes", async (req, res) => {
    try {
      const {
        supplierName, supplierPhone, supplierEmail, productName, sku,
        quantity, colourFinish, unitPrice, freightCost, leadTime,
        quoteDate, projectReference, status, notes,
      } = req.body;
      if (!supplierName || !productName || !sku || !unitPrice || !quoteDate) {
        return res.status(400).json({ success: false, message: "Required fields missing" });
      }
      const quote = await storage.createSupplierQuote({
        supplierName, supplierPhone, supplierEmail, productName, sku,
        quantity: Number(quantity) || 1, colourFinish, unitPrice, freightCost,
        leadTime, quoteDate, projectReference, status, notes,
      });

      sendSupplierQuoteNotification({
        supplierName, supplierPhone, supplierEmail, productName, sku,
        quantity: Number(quantity) || 1, colourFinish, unitPrice, freightCost,
        leadTime, projectReference, status: status || "Requested", notes,
      }).catch((err) => console.error("[email] Supplier quote notification failed:", err));

      res.json({ success: true, quote });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/admin/supplier-quotes/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ["Requested", "Received", "Approved", "Ordered", "Shipped", "Delivered"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updated = await storage.updateSupplierQuoteStatus(id, status);
      if (!updated) return res.status(404).json({ error: "Quote not found" });
      res.json({ success: true, quote: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/admin/supplier-quotes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateSupplierQuote(id, req.body);
      if (!updated) return res.status(404).json({ error: "Quote not found" });
      res.json({ success: true, quote: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/admin/supplier-quotes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSupplierQuote(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ─── Referrals ─────────────────────────────────────────────────────────────

  app.get("/api/admin/referrals", async (req, res) => {
    try {
      const referrals = await storage.getReferrals();
      res.json(referrals);
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/admin/referrals", async (req, res) => {
    try {
      const {
        referrerName, company, contactEmail, contactPhone, leadSource,
        clientName, clientCompany, estimatedValue, notes,
      } = req.body;
      if (!referrerName || !leadSource) {
        return res.status(400).json({ success: false, message: "Required fields missing" });
      }
      const referral = await storage.createReferral({
        referrerName, company, contactEmail, contactPhone, leadSource,
        clientName, clientCompany, estimatedValue, notes,
      });
      res.json({ success: true, referral });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/admin/referrals/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ["New", "Contacted", "Qualified", "Won", "Lost"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updated = await storage.updateReferralStatus(id, status);
      if (!updated) return res.status(404).json({ error: "Referral not found" });
      res.json({ success: true, referral: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/admin/referrals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReferral(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  return httpServer;
}

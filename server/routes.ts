import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { insertLeadSchema } from "@shared/schema";
import { ZodError } from "zod";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import { registerMarketingRoutes } from "./marketing";
import { sendLeadNotification, sendSupplierQuoteNotification, sendPlanningRequestNotification, isEmailConfigured } from "./email";
import { analyseSignals, extractDomain, type SignalInput, type SourceType } from "./services/leadIntelligence";
import { CORPORATE_DESK_SYSTEM_PROMPT, ADVISOR_SYSTEM_MESSAGE } from "./systemPrompt";
import { getAdaptersMeta } from "./adapters/manualAdapter";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" } as any);
}

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


interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── AI space planning prompt builder ────────────────────────────────────────
const TCD_CATALOGUE_FOR_AI = `SKU | Category | Product Name | Price
LY-QF-01A | Manager Desks | Luxury Modern Office Manager's Desk – Breeze Series | From $2,890
LY-MD-8019 | Manager Desks | Modern Manager's Office Desk – Minimalist Design | From $1,990
LY-ED-B09 | Executive Desks | Modern Office Desk For Executives – Minimalist Design | From $3,490
LY-AM-01 | Executive Desks | Luxury Executive Office Desk – Aimu Series | From $4,999
A-522-1 | Executive Desks | Executive Office Desk – Premium (Aimu Series) | $4,999
LY-MG-06 | Boardroom Tables | Spacious Professional Office Conference Table | From $5,490
LY-BT-H-05 | Boardroom Tables | Modern Elegant Office Boardroom Table | From $3,990
LY-RC-01 | Reception Desks | Premium Reception Counter with Feature Wall | POA
LY-CH-E01 | Office Seating | Ergonomic Executive Task Chair | From $890
LY-WS-04 | Workstations | Hot Desk Workstation – Open Plan | From $590 pp
LY-ST-P01 | Storage | Premium Mobile Storage Pedestal | From $490
LY-OP-S1 | Office Pods | Acoustic Office Pod – Single | From $4,200
LY-QF-PKG | Executive Desks | Coordinated Total Office Package – Breeze Series | POA`;

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

A client has submitted an office planning brief. Generate a comprehensive workspace planning analysis using ONLY products from The Corporate Desk catalogue below.

THE CORPORATE DESK PRODUCT CATALOGUE:
${TCD_CATALOGUE_FOR_AI}

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

LEAD SCORING CRITERIA (score 0-100):
- Company size / staff count: larger = higher score (up to 30 pts)
- Project value: higher budget = higher score (up to 25 pts)
- Expansion signals (new fit-out, relocation): present = +20 pts
- Budget clarity (specific range given): clear = +15 pts
- Multiple zones required: more zones = +10 pts

IMPLEMENTATION TIMELINE GUIDE:
- Small office (<10 staff, <200sqm): 4-6 weeks
- Medium office (10-50 staff, 200-500sqm): 6-10 weeks
- Large office (50+ staff, 500sqm+): 10-16 weeks

Respond with ONLY valid JSON in exactly this structure (no markdown, no explanation):

{
  "clientBrief": "2-3 sentence summary of the client's office fit-out requirements",
  "officeType": "Classification (e.g. Professional Services HQ, Tech Scale-up, Corporate Expansion, Law Firm, Financial Services)",
  "estimatedProjectValue": "Estimated total project value range (e.g. $80,000 – $150,000)",
  "leadScore": 72,
  "leadScoreBreakdown": {
    "companySize": 20,
    "projectValue": 20,
    "expansionSignals": 20,
    "budgetClarity": 12,
    "zonesRequired": 0,
    "reasoning": "One sentence explaining the score"
  },
  "implementationTimeline": "8-10 weeks",
  "workspaceZones": [
    {
      "zone": "Zone name",
      "color": "#B8960C",
      "percentage": 35,
      "description": "What goes here and why",
      "priority": "Essential",
      "staffCapacity": 20,
      "keyFurniture": ["Executive Desk", "Task Chair", "Storage Pedestal"]
    }
  ],
  "productRecommendations": [
    {
      "zone": "Zone name this product belongs to",
      "sku": "LY-AM-01",
      "category": "Executive Desks",
      "productName": "Luxury Executive Office Desk – Aimu Series",
      "seriesRecommendation": "Aimu Series",
      "quantity": 3,
      "unitCost": 4999,
      "totalCost": 14997,
      "rationale": "Why this specific product fits their needs"
    }
  ],
  "costBreakdown": {
    "furniture": 85000,
    "installation": 12000,
    "delivery": 3500,
    "total": 100500,
    "perStaff": 2011
  },
  "styleDirection": "Paragraph describing the recommended aesthetic and material palette based on their style preference",
  "keyConsiderations": ["consideration 1", "consideration 2", "consideration 3"],
  "recommendedNextStep": "Specific recommended action for this client to move forward with The Corporate Desk",
  "urgencyNote": "Any timeline or budget observations worth flagging"
}

IMPORTANT RULES:
- leadScore must be an integer 0-100
- workspaceZones percentages must sum to 100
- productRecommendations must ONLY reference SKUs from the catalogue above
- costBreakdown.total must equal furniture + installation + delivery
- All cost figures must be realistic integers (no strings)
- zone colors: use gold #B8960C for primary zones, #4A7C59 for collaborative, #2E5FA3 for focus, #8B3A8B for executive, #C65D3D for reception, #5C8E9A for breakout`;
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

  app.get("/api/admin/prospects", async (_req, res) => {
    try {
      const leads = await storage.getProspectedLeads();
      res.json(leads);
    } catch {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/admin/prospects/adapters", (_req, res) => {
    res.json(getAdaptersMeta());
  });

  app.post("/api/admin/prospect", async (req, res) => {
    try {
      const {
        signals,
        sourceType,
        sourceUrl,
        sourceText,
        companyHint,
        skipDedupe,
      } = req.body as {
        signals?: string;
        sourceType?: string;
        sourceUrl?: string;
        sourceText?: string;
        companyHint?: string;
        skipDedupe?: boolean;
      };

      const inputText = sourceText || signals || "";
      if (!inputText || inputText.trim().length < 10) {
        return res.status(400).json({ error: "Provide at least 10 characters of company signals to analyse." });
      }

      const validSourceTypes: SourceType[] = ["manual", "job_ad", "linkedin", "hiring_page", "announcement", "article", "website"];
      const resolvedSourceType: SourceType = (validSourceTypes.includes(sourceType as SourceType) ? sourceType : "manual") as SourceType;

      const signalInput: SignalInput = {
        sourceType: resolvedSourceType,
        sourceUrl: sourceUrl || null,
        sourceText: inputText,
        companyHint: companyHint || null,
      };

      const analysis = await analyseSignals(signalInput);

      const domain = analysis.domain || (sourceUrl ? extractDomain(sourceUrl) : null) || (analysis.website ? extractDomain(analysis.website) : null);

      if (!skipDedupe) {
        const duplicate = await storage.findProspectDuplicate(analysis.company, domain, sourceUrl || null);
        if (duplicate) {
          return res.status(409).json({
            duplicate: true,
            existingLead: duplicate,
            message: `A prospect for "${duplicate.company}" already exists in your pipeline (added ${new Date(duplicate.createdAt).toLocaleDateString("en-AU")}). Use skipDedupe=true to add anyway.`,
          });
        }
      }

      const lead = await storage.createProspectedLead({
        company: analysis.company,
        domain,
        website: analysis.website,
        location: analysis.location,
        industry: analysis.industry,
        estimatedTeamSize: analysis.estimatedTeamSize,
        likelyOfficeNeed: analysis.likelyOfficeNeed,
        signalsDetected: analysis.signalsDetected,
        estimatedProjectValue: analysis.estimatedProjectValue,
        score: analysis.score,
        priority: analysis.priority,
        decisionMakers: analysis.decisionMakers,
        outreachMessage: analysis.outreachMessage,
        reasoning: analysis.reasoning,
        rawInput: inputText,
        sourceType: resolvedSourceType,
        sourceUrl: sourceUrl || null,
      });

      res.json({ success: true, lead });
    } catch (error: any) {
      console.error("Prospecting error:", error);
      res.status(500).json({ error: error?.message || "Failed to analyse signals. Please try again." });
    }
  });

  app.post("/api/admin/prospects/batch-scan", async (req, res) => {
    try {
      const { items, skipDedupe } = req.body as {
        items: Array<{ sourceType: string; sourceUrl?: string; sourceText: string; companyHint?: string }>;
        skipDedupe?: boolean;
      };

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Provide at least one item to scan." });
      }
      if (items.length > 20) {
        return res.status(400).json({ error: "Maximum 20 items per batch scan." });
      }

      const results: Array<{
        index: number;
        status: "saved" | "duplicate" | "error";
        lead?: any;
        existingLead?: any;
        error?: string;
      }> = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          if (!item.sourceText || item.sourceText.trim().length < 10) {
            results.push({ index: i, status: "error", error: "Input text too short" });
            continue;
          }

          const validSourceTypes: SourceType[] = ["manual", "job_ad", "linkedin", "hiring_page", "announcement", "article", "website"];
          const resolvedSourceType: SourceType = (validSourceTypes.includes(item.sourceType as SourceType) ? item.sourceType : "manual") as SourceType;

          const analysis = await analyseSignals({
            sourceType: resolvedSourceType,
            sourceUrl: item.sourceUrl || null,
            sourceText: item.sourceText,
            companyHint: item.companyHint || null,
          });

          const domain = analysis.domain || (item.sourceUrl ? extractDomain(item.sourceUrl) : null) || (analysis.website ? extractDomain(analysis.website) : null);

          if (!skipDedupe) {
            const duplicate = await storage.findProspectDuplicate(analysis.company, domain, item.sourceUrl || null);
            if (duplicate) {
              results.push({ index: i, status: "duplicate", existingLead: duplicate });
              continue;
            }
          }

          const lead = await storage.createProspectedLead({
            company: analysis.company,
            domain,
            website: analysis.website,
            location: analysis.location,
            industry: analysis.industry,
            estimatedTeamSize: analysis.estimatedTeamSize,
            likelyOfficeNeed: analysis.likelyOfficeNeed,
            signalsDetected: analysis.signalsDetected,
            estimatedProjectValue: analysis.estimatedProjectValue,
            score: analysis.score,
            priority: analysis.priority,
            decisionMakers: analysis.decisionMakers,
            outreachMessage: analysis.outreachMessage,
            reasoning: analysis.reasoning,
            rawInput: item.sourceText,
            sourceType: resolvedSourceType,
            sourceUrl: item.sourceUrl || null,
          });

          results.push({ index: i, status: "saved", lead });
        } catch (err: any) {
          results.push({ index: i, status: "error", error: err?.message || "Analysis failed" });
        }
      }

      const saved = results.filter(r => r.status === "saved").length;
      const duplicates = results.filter(r => r.status === "duplicate").length;
      const errors = results.filter(r => r.status === "error").length;

      res.json({ success: true, results, summary: { saved, duplicates, errors, total: items.length } });
    } catch (error: any) {
      console.error("Batch scan error:", error);
      res.status(500).json({ error: "Batch scan failed. Please try again." });
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
    } catch {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/admin/prospects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProspectedLead(id);
      res.json({ success: true });
    } catch {
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
      let aiLeadScore: number | null = null;
      let aiEstimatedValue: string | null = null;
      let aiTimeline: string | null = null;

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
          messages: [
            { role: "system", content: ADVISOR_SYSTEM_MESSAGE },
            { role: "user", content: prompt },
          ],
        } as any);

        const rawContent = completion.choices[0]?.message?.content || "";
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiSummary = parsed.clientBrief || "";
          aiRecommendations = JSON.stringify(parsed, null, 2);
          aiLeadScore = typeof parsed.leadScore === "number" ? parsed.leadScore : null;
          aiEstimatedValue = parsed.estimatedProjectValue || null;
          aiTimeline = parsed.implementationTimeline || null;
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
        leadScore: aiLeadScore ?? undefined,
        estimatedValue: aiEstimatedValue ?? undefined,
        implementationTimeline: aiTimeline ?? undefined,
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
        messages: [
          { role: "system", content: ADVISOR_SYSTEM_MESSAGE },
          { role: "user", content: prompt },
        ],
      } as any);

      const rawContent = completion.choices[0]?.message?.content || "";
      let aiSummary = existing.aiSummary || "";
      let aiRecommendations = existing.aiRecommendations || "";
      let aiLeadScore: number | null = existing.leadScore ?? null;
      let aiEstimatedValue: string | null = existing.estimatedValue ?? null;
      let aiTimeline: string | null = existing.implementationTimeline ?? null;

      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiSummary = parsed.clientBrief || aiSummary;
        aiRecommendations = JSON.stringify(parsed, null, 2);
        if (typeof parsed.leadScore === "number") aiLeadScore = parsed.leadScore;
        if (parsed.estimatedProjectValue) aiEstimatedValue = parsed.estimatedProjectValue;
        if (parsed.implementationTimeline) aiTimeline = parsed.implementationTimeline;
      }

      const updated = await storage.updatePlanningRequest(id, {
        aiSummary,
        aiRecommendations,
        leadScore: aiLeadScore ?? undefined,
        estimatedValue: aiEstimatedValue ?? undefined,
        implementationTimeline: aiTimeline ?? undefined,
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

  // ─── Stripe Payment: AI Workspace Report Unlock ────────────────────────────

  app.post("/api/planning-requests/:id/checkout", async (req, res) => {
    try {
      const { id } = req.params;
      const request = await storage.getPlanningRequest(id);
      if (!request) return res.status(404).json({ error: "Planning request not found." });

      if (request.isPaid) {
        return res.json({ alreadyPaid: true });
      }

      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({
          error: "Online payment is not yet configured. Please call 1300 977 607 or email service@thecorporatedesk.com.au to receive your full report.",
        });
      }

      const domain = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : "https://app.thecorporatedesk.com.au";

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "link"],
        line_items: [{
          price_data: {
            currency: "aud",
            product_data: {
              name: "AI Workspace Planning Report — Full Access",
              description: `Visual floor plan, furniture SKUs, cost estimate, PDF download & 3D walkthrough access for ${request.company || request.name}`,
            },
            unit_amount: 39900,
          },
          quantity: 1,
        }],
        mode: "payment",
        metadata: { planningRequestId: id },
        customer_email: request.email,
        billing_address_collection: "auto",
        success_url: `${domain}/upload-your-floor-plan?id=${id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domain}/upload-your-floor-plan?id=${id}&cancelled=true`,
      } as any);

      res.json({ checkoutUrl: session.url });
    } catch (error: any) {
      console.error("[Stripe] Checkout session error:", error);
      res.status(500).json({ error: "Failed to create payment session. Please call 1300 977 607." });
    }
  });

  app.get("/api/planning-requests/:id/verify-payment", async (req, res) => {
    try {
      const { id } = req.params;
      const { session_id: sessionId } = req.query as { session_id?: string };

      const request = await storage.getPlanningRequest(id);
      if (!request) return res.status(404).json({ error: "Not found" });

      const parseRec = (raw: string | null | undefined) => {
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
      };

      if (request.isPaid) {
        return res.json({
          paid: true,
          planningRequest: {
            id: request.id,
            name: request.name,
            company: request.company,
            email: request.email,
            squareMetres: request.squareMetres,
            staffCount: request.staffCount,
            aiRecommendations: parseRec(request.aiRecommendations),
          },
        });
      }

      if (!sessionId) return res.json({ paid: false });

      const stripe = getStripeClient();
      if (!stripe) return res.status(503).json({ error: "Payment system not configured." });

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" && session.metadata?.planningRequestId === id) {
        await storage.markPlanningRequestPaid(id, sessionId);
        return res.json({
          paid: true,
          planningRequest: {
            id: request.id,
            name: request.name,
            company: request.company,
            email: request.email,
            squareMetres: request.squareMetres,
            staffCount: request.staffCount,
            aiRecommendations: parseRec(request.aiRecommendations),
          },
        });
      }

      res.json({ paid: false });
    } catch (error: any) {
      console.error("[Stripe] Verify payment error:", error);
      res.status(500).json({ error: "Payment verification failed." });
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

  // ─── 3D Walkthrough Layout Data ──────────────────────────────────────────────
  app.get("/api/planning-requests/:id/layout", async (req, res) => {
    try {
      const { id } = req.params;
      const request = await storage.getPlanningRequest(id);
      if (!request) return res.status(404).json({ error: "Not found" });
      const parseRec = (raw: string | null | undefined) => {
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
      };
      res.json({
        id: request.id,
        name: request.name,
        company: request.company,
        email: request.email,
        squareMetres: request.squareMetres,
        staffCount: request.staffCount,
        projectBrief: request.projectBrief,
        isPaid: request.isPaid,
        paymentStatus: request.paymentStatus,
        aiRecommendations: request.isPaid ? parseRec(request.aiRecommendations) : null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch layout data" });
    }
  });

  return httpServer;
}

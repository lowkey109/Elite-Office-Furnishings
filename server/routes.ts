import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { insertLeadSchema, insertProductReviewSchema } from "@shared/schema";
import { ZodError } from "zod";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import { registerMarketingRoutes } from "./marketing";
import { sendLeadNotification, sendSupplierQuoteNotification, sendPlanningRequestNotification, sendPaymentConfirmationNotification, sendPlannerSubmissionCustomerEmail, sendQuoteRequestCustomerEmail, sendStrategyCallCustomerEmail, sendEnquiryCustomerEmail, sendFinanceLeadAdminEmail, sendFinanceLeadPartnerEmail, sendFinanceLeadCustomerEmail, isEmailConfigured } from "./email";
import { scoreOpportunity } from "./services/opportunityScoring";
import { analyseSignals, extractDomain, type SignalInput, type SourceType } from "./services/leadIntelligence";
import { CORPORATE_DESK_SYSTEM_PROMPT, ADVISOR_SYSTEM_MESSAGE, buildChatSystemPrompt, buildAdvisorSystemPrompt, extractSessionContext } from "./systemPrompt";
import { getAdaptersMeta } from "./adapters/manualAdapter";
import { generatePackageAndQuote } from "./ai/packageGenerator";
import { parseFloorPlan, type FloorGeometry } from "./services/floorPlanParser";
import { sendWhatsAppTextMessage, isWhatsAppConfigured } from "./services/whatsapp";

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
// Load product catalog from JSON and build AI catalogue string
const CATALOG_PATH = path.join(process.cwd(), "server/data/productCatalog.json");

function loadProductCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  } catch (e) {
    console.error("[Catalog] Failed to load productCatalog.json:", e);
    return { products: [] };
  }
}

function buildCatalogueForAI(): string {
  try {
    const catalog = loadProductCatalog();
    const lines: string[] = [
      "SKU | Category | Product Name | Dimensions | Supplier",
      // Legacy products
      "LY-QF-01A | Manager Desks | Luxury Modern Office Manager's Desk – Breeze Series | Custom | The Corporate Desk",
      "LY-MD-8019 | Manager Desks | Modern Manager's Office Desk – Minimalist Design | Custom | The Corporate Desk",
      "LY-ED-B09 | Executive Desks | Modern Office Desk For Executives – Minimalist Design | Custom | The Corporate Desk",
      "LY-AM-01 | Executive Desks | Luxury Executive Office Desk – Aimu Series | Custom | The Corporate Desk",
      "LY-MG-06 | Boardroom Tables | Spacious Professional Office Conference Table | Custom | The Corporate Desk",
      "LY-BT-H-05 | Boardroom Tables | Modern Elegant Office Boardroom Table | Custom | The Corporate Desk",
      "LY-RC-01 | Reception Desks | Premium Reception Counter with Feature Wall | Custom | The Corporate Desk",
      "LY-CH-E01 | Office Seating | Ergonomic Executive Task Chair | Custom | The Corporate Desk",
      "LY-WS-04 | Workstations | Hot Desk Workstation – Open Plan | Custom | The Corporate Desk",
      "LY-ST-P01 | Storage | Premium Mobile Storage Pedestal | Custom | The Corporate Desk",
      "LY-OP-S1 | Office Pods | Acoustic Office Pod – Single | Custom | The Corporate Desk",
    ];
    // Add Feisenzhuo products
    for (const p of catalog.products) {
      lines.push(`${p.sku} | ${p.category} | ${p.product_name} (${p.series} Series) | ${p.dimensions} | ${p.supplier}`);
    }
    return lines.join("\n");
  } catch {
    return `SKU | Category | Product Name | Dimensions | Supplier
LY-AM-01 | Executive Desks | Luxury Executive Office Desk – Aimu Series | Custom | The Corporate Desk
LY-MG-06 | Boardroom Tables | Spacious Professional Office Conference Table | Custom | The Corporate Desk
LY-WS-04 | Workstations | Hot Desk Workstation – Open Plan | Custom | The Corporate Desk`;
  }
}

const TCD_CATALOGUE_FOR_AI = buildCatalogueForAI();

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

WORKSPACE DESIGN INTELLIGENCE (apply to every response):
- Activity-Based Working: allocate 35-45% to flexible workstations, 30-40% to collaboration/meeting zones, 15-25% to focus/quiet zones. Post-2022 best practice.
- Space ratios: 8-12 sqm per person ABW; 12-16 sqm professional services with private offices; always include 15-20% circulation buffer in zone sizing.
- Ergonomics: height-adjustable desks are expected on all projects above $60k. Recommend the Milan or Cape sit-stand series for workstations.
- Acoustic design: open-plan offices above 20 persons require acoustic treatment. Flag this in keyConsiderations.
- Reception impact: the reception zone represents 5-10% of budget but creates 80% of first impressions. Never under-spec it.
- Productivity data: quality breakout and social spaces correlate with 20%+ higher engagement scores. Quantify this value in zone descriptions.
- Lead times: standard products 4-6 weeks; custom orders 8-14 weeks. Build this into implementationTimeline.

Respond with ONLY valid JSON in exactly this structure (no markdown, no explanation):

{
  "clientBrief": "2-3 sentence summary of the client's office fit-out requirements",
  "officeType": "Classification (e.g. Professional Services HQ, Tech Scale-up, Corporate Expansion, Law Firm, Financial Services)",
  "estimatedProjectValue": "Estimated total project value range ex-GST (e.g. $80,000 – $150,000)",
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
      "description": "What goes here and why, including productivity and wellbeing impact",
      "priority": "Essential",
      "staffCapacity": 20,
      "keyFurniture": ["Executive Desk", "Task Chair", "Storage Pedestal"],
      "productivityNote": "One sentence on how this zone design improves team output or wellbeing"
    }
  ],
  "productRecommendations": [
    {
      "zone": "Zone name this product belongs to",
      "sku": "exact-sku-from-catalogue",
      "category": "Executive Desks",
      "productName": "Exact product name from catalogue",
      "seriesRecommendation": "Series name",
      "quantity": 3,
      "unitCost": 4999,
      "totalCost": 14997,
      "rationale": "Why this specific product fits their brief, style, and zone requirements"
    }
  ],
  "costBreakdown": {
    "furniture": 85000,
    "installation": 12000,
    "delivery": 3500,
    "total": 100500,
    "perStaff": 2011
  },
  "styleDirection": "Paragraph describing the recommended aesthetic and material palette based on their style preference and office type",
  "keyConsiderations": ["consideration 1", "consideration 2", "consideration 3", "consideration 4"],
  "recommendedNextStep": "Specific recommended action for this client to move forward with The Corporate Desk",
  "urgencyNote": "Any timeline, lead-time, or budget observations worth flagging"
}

IMPORTANT RULES:
- leadScore must be an integer 0-100
- workspaceZones percentages must sum to exactly 100
- productRecommendations MUST ONLY use SKUs that appear verbatim in the catalogue above — do not invent SKUs
- costBreakdown.total must equal furniture + installation + delivery exactly
- All cost figures must be realistic integers (no strings, no decimals)
- estimatedProjectValue is ex-GST; the client will pay +10% GST on top
- zone colors: use gold #B8960C for primary workstations, #4A7C59 for collaborative, #2E5FA3 for focus, #8B3A8B for executive, #C65D3D for reception, #5C8E9A for breakout/social
- productivityNote must be concrete and data-referenced where possible (e.g. "Acoustic treatment reduces interruptions by ~40% in open-plan environments")
- keyConsiderations must include at least one acoustic, one ergonomic, and one timeline observation`;
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
      stripe: !!process.env.STRIPE_SECRET_KEY,
    });
  });

  // XML Sitemap — dynamically generated for SEO
  app.get("/sitemap.xml", (_req, res) => {
    const catalog = loadProductCatalog();
    const base = "https://www.thecorporatedesk.com.au";
    const now = new Date().toISOString().split("T")[0];
    const staticPages = [
      { url: "/", priority: "1.0", changefreq: "weekly" },
      { url: "/products", priority: "0.9", changefreq: "weekly" },
      { url: "/ai-office-planner", priority: "0.9", changefreq: "monthly" },
      { url: "/3d-office-walkthrough", priority: "0.8", changefreq: "monthly" },
      { url: "/blog", priority: "0.8", changefreq: "weekly" },
      { url: "/quote-builder", priority: "0.8", changefreq: "monthly" },
      { url: "/send-us-your-quote", priority: "0.7", changefreq: "monthly" },
      { url: "/workplace-solutions", priority: "0.7", changefreq: "monthly" },
      { url: "/workplace-strategy", priority: "0.7", changefreq: "monthly" },
      { url: "/about", priority: "0.6", changefreq: "monthly" },
      { url: "/contact", priority: "0.6", changefreq: "monthly" },
      { url: "/case-studies", priority: "0.7", changefreq: "monthly" },
      { url: "/testimonials", priority: "0.6", changefreq: "monthly" },
    ];
    const productUrls = (catalog.products || []).map((p: { sku: string }) => ({
      url: `/products/${p.sku}`,
      priority: "0.7",
      changefreq: "monthly",
    }));
    const allUrls = [...staticPages, ...productUrls];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${base}${u.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  });

  // Product catalog — supplier products database
  app.get("/api/products", (_req, res) => {
    const catalog = loadProductCatalog();
    res.json(catalog.products);
  });

  app.get("/api/products/categories", (_req, res) => {
    const catalog = loadProductCatalog();
    const categories = [...new Set(catalog.products.map((p: any) => p.category))];
    const byCategory = categories.reduce((acc: any, cat: any) => {
      acc[cat] = catalog.products.filter((p: any) => p.category === cat);
      return acc;
    }, {});
    res.json({ categories, byCategory });
  });

  app.get("/api/products/search", (req, res) => {
    const catalog = loadProductCatalog();
    const q = (req.query.q as string || "").toLowerCase();
    const category = req.query.category as string;
    let results = catalog.products;
    if (category) results = results.filter((p: any) => p.category === category);
    if (q) results = results.filter((p: any) =>
      p.product_name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.series || "").toLowerCase().includes(q) ||
      (p.materials || "").toLowerCase().includes(q)
    );
    res.json(results);
  });

  // Supplier database routes
  app.get("/api/suppliers", (_req, res) => {
    try {
      const suppliersPath = path.join(process.cwd(), "server/data/supplierDatabase.json");
      const data = JSON.parse(fs.readFileSync(suppliersPath, "utf-8"));
      res.json(data.suppliers);
    } catch (err) {
      res.status(500).json({ error: "Supplier database unavailable" });
    }
  });

  app.get("/api/products/by-supplier/:supplierId", (req, res) => {
    const catalog = loadProductCatalog();
    const { supplierId } = req.params;
    const supplierMap: Record<string, string> = {
      FSZ: "Foshan Feisenzhuo Furniture Co., Ltd.",
      HSG: "Huasheng Furniture Group — Gaozhuo Division",
      GJO: "Huasheng Furniture Group — GOJO Division",
    };
    const supplierName = supplierMap[supplierId.toUpperCase()];
    if (!supplierName) return res.status(404).json({ error: "Supplier not found" });
    const products = catalog.products.filter((p: any) => p.supplier === supplierName);
    res.json({ supplier: supplierName, count: products.length, products });
  });

  app.get("/api/products/sku/:sku", (req, res) => {
    const catalog = loadProductCatalog();
    const product = catalog.products.find((p: any) =>
      p.sku.toLowerCase() === req.params.sku.toLowerCase()
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    // Enrich with gallery and collection name (constants defined later in scope, safe in closure)
    const seriesGallery = SERIES_GALLERY[product.series] ?? [];
    const gallery = seriesGallery.length > 0
      ? seriesGallery
      : product.image ? [product.image] : [];
    res.json({
      ...product,
      gallery,
      collection_name: SUPPLIER_COLLECTION_MAP[product.supplier] ?? "",
      price_from: CATEGORY_PRICE_FROM[product.category] ?? "POA",
    });
  });

  app.get("/api/products/series/:series", (req, res) => {
    const catalog = loadProductCatalog();
    const series = req.params.series.toLowerCase();
    const products = catalog.products.filter((p: any) =>
      (p.series || "").toLowerCase() === series
    );
    res.json({ series: req.params.series, count: products.length, products });
  });

  // ─── Series image gallery — 2+ images per series for ProductDetail gallery ───
  const FSZ = "/uploads/catalog-images/feisenzhuo/";
  const GJO = "/uploads/catalog-images/gojo/";
  const HSG = "/uploads/catalog-images/huasheng-gaozhuo/";
  const SERIES_GALLERY: Record<string, string[]> = {
    // Fessenz / Feisenzhuo series
    "Weiyi":        [FSZ+"design-04.jpg", FSZ+"design-03.jpg", FSZ+"four-1.jpg"],
    "Blister":      [FSZ+"design-05.jpg", FSZ+"design-06.jpg"],
    "Red Cliff":    [FSZ+"design-06.jpg", FSZ+"design-05.jpg"],
    "New Art":      [FSZ+"design-07.jpg", FSZ+"design-06.jpg"],
    "Ruige":        [FSZ+"design-08.jpg", FSZ+"design-09.jpg", FSZ+"four-2.jpg"],
    "Vic":          [FSZ+"design-09.jpg", FSZ+"design-08.jpg"],
    "Zhuoya":       [FSZ+"design-10.jpg", FSZ+"design-11.jpg"],
    "Dynamic":      [FSZ+"design-11.jpg", FSZ+"design-10.jpg", FSZ+"design-12.jpg"],
    "Dell":         [FSZ+"design-12.jpg", FSZ+"design-11.jpg"],
    "Evidenza":     [FSZ+"design-13.jpg", FSZ+"design-12.jpg", FSZ+"design-14.jpg"],
    "Teak":         [FSZ+"design-14.jpg", FSZ+"design-13.jpg"],
    "Pari":         [FSZ+"design-15.jpg", FSZ+"design-14.jpg", FSZ+"four-3.jpg"],
    "New Berlin":   [FSZ+"design-16.jpg", FSZ+"design-17.jpg"],
    "Top Grid":     [FSZ+"design-17.jpg", FSZ+"design-16.jpg"],
    "Guangsheng":   [FSZ+"design-18.jpg", FSZ+"design-19.jpg"],
    "Nais":         [FSZ+"design-19.jpg", FSZ+"design-18.jpg"],
    "Milan":        [FSZ+"design-20.jpg", HSG+"milan-desk.jpg", HSG+"milan-back-to-back.jpg", HSG+"milan-gaming.jpg"],
    "Shanhe":       [FSZ+"design-21.jpg", FSZ+"design-22.jpg"],
    "Bit":          [FSZ+"design-22.jpg", FSZ+"design-21.jpg"],
    "Fessenz":      [FSZ+"four-5.jpg", FSZ+"four-6.jpg", FSZ+"four-7.jpg", FSZ+"four-8.jpg"],
    "Mike":         [HSG+"hsg3-contents.jpg", HSG+"baggio-desk.jpg"],
    "Karen":        [HSG+"milan-desk.jpg", HSG+"milan-back-to-back.jpg"],
    "Bonnie":       [HSG+"milan-desk.jpg", HSG+"cape-executive.jpg"],
    // GOJO series
    "LRU":          [GJO+"lru-executive-desk.jpg", GJO+"lru-conference-table.jpg", GJO+"lru-dimensions.jpg"],
    "JN":           [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "YOM":          [GJO+"lru-executive-desk.jpg", GJO+"gojo-cover.jpg"],
    "HXM":          [GJO+"lru-executive-desk.jpg", GJO+"gojo-cover.jpg"],
    "JCN":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "YIN":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "VEP":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "VEIYE":        [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "YUP":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "YUZ":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "GUANHE":       [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "BSA":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "WINA":         [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "WPN":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "MZE":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "FU8061 Sofa Collection": [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "Accent Chair Collection":[GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "BJ Side Table Collection":[GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "CJ Coffee Table Collection":[GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "833-1C":       [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "848/850":      [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "ZC 牛角椅":    [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "LZ9002":       [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "LZ9003":       [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "K01":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "K02":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    "K03":          [GJO+"gojo-cover.jpg", GJO+"lru-executive-desk.jpg"],
    // Huasheng-Gaozhuo
    "Better":       [HSG+"better-desk.jpg", HSG+"better-rostrum.jpg"],
    "Baggio":       [HSG+"baggio-desk.jpg", HSG+"cape-executive.jpg"],
    "Owen":         [HSG+"owen-desk.jpg", HSG+"milan-back-to-back.jpg"],
    "Miller":       [HSG+"miller-pod.jpg"],
    "Cape":         [HSG+"cape-executive.jpg", HSG+"milan-desk.jpg"],
    "Mige":         [HSG+"milan-back-to-back.jpg", HSG+"milan-desk.jpg"],
    // Seating (Bohua/GAOJIN)
    "842":          [HSG+"miller-pod.jpg"],
    "G01":          [HSG+"miller-pod.jpg"],
    "G02":          [HSG+"miller-pod.jpg"],
    "G03":          [HSG+"miller-pod.jpg"],
    "G04":          [HSG+"miller-pod.jpg"],
    "G05":          [HSG+"miller-pod.jpg"],
    "G06":          [HSG+"miller-pod.jpg"],
    "G07":          [HSG+"miller-pod.jpg"],
    // Steel filing — use unused design images
    "Yashang Steel": [FSZ+"design-23.jpg", FSZ+"design-24.jpg"],
    "Yafeng Steel Tank": [FSZ+"design-25.jpg", FSZ+"design-26.jpg"],
  };

  // ─── Collection names (public-facing, supplier names hidden) ──────────────
  const SUPPLIER_COLLECTION_MAP: Record<string, string> = {
    "Foshan Feisenzhuo Furniture Co., Ltd.": "Fessenz Design Collection",
    "Huasheng Furniture Group — GOJO Division": "Presidia Executive Collection",
    "Huasheng Furniture Group — Lounge & Seating Division": "Presidia Lounge & Seating Collection",
    "Huasheng Furniture Group — Gaozhuo Division": "Milan Premium Workspace Collection",
    "Foshan Bohua Furniture Co., Ltd. (GAOJIN)": "Commercial Seating & Storage Collection",
  };

  // ─── Category starting prices ─────────────────────────────────────────────
  const CATEGORY_PRICE_FROM: Record<string, string> = {
    "Executive Desks": "From $2,500",
    "Manager Desks": "From $1,200",
    "Boardroom Tables": "From $3,200",
    "Reception Desks": "From $2,800",
    "Office Seating": "From $450",
    "Workstations": "From $890",
    "Storage": "From $350",
    "Storage & Filing": "From $280",
    "Lounge Seating": "From $1,400",
    "Occasional Tables": "From $320",
  };

  // ─── Public product name cleaning ─────────────────────────────────────────
  const SERIES_PREFIXES_STRIP = ["GOJO", "Weiyi", "Ruige", "Blister", "Vic", "Zhuoya", "Dynamic", "Dell", "Yashang", "Fei"];
  // Strips alpha-led model codes (e.g. "FU8061", "G01-1", "A2089") and numeric-led model codes (e.g. "842-3C", "833-1C", "848")
  const MODEL_CODE_STRIP_ALPHA = /^([A-Z][A-Z0-9]{2,8}[A-Z0-9\-]*)\s+(?=[A-Z])/;
  const MODEL_CODE_STRIP_NUMERIC = /^(\d[0-9A-Z\-]+)\s+(?=[A-Z])/;

  function cleanPublicProductName(name: string): string {
    let n = name;
    for (const prefix of SERIES_PREFIXES_STRIP) {
      if (n.startsWith(prefix + " ")) { n = n.slice(prefix.length + 1); break; }
    }
    n = n.replace(MODEL_CODE_STRIP_ALPHA, "");
    n = n.replace(MODEL_CODE_STRIP_NUMERIC, "");
    return n.trim();
  }

  function groupProductVariants(products: any[]) {
    // Matches " 2400", " — 2800", "—2800" etc. at end of name
    const SIZE_SUFFIX = /(\s+[—–]\s*|\s+)(\d{3,4})\s*$/;
    const groups = new Map<string, any[]>();
    for (const p of products) {
      if (p.needs_manual_review) continue;
      const cleanedFull = cleanPublicProductName(p.product_name).replace(/\s*[—–]\s*$/, "").trim();
      const baseName = cleanedFull.replace(SIZE_SUFFIX, "").replace(/\s*[—–]\s*$/, "").trim();
      // Include series in key so different-design same-name products stay separate
      const key = `${baseName}||${p.category}||${p.series}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ ...p, _cleanedName: cleanedFull, _baseName: baseName });
    }
    const result: any[] = [];
    for (const [, variants] of groups) {
      const primary = variants[0];
      const hasVariants = variants.length > 1;
      const sizeVariants = hasVariants ? variants.map((v: any) => {
        const m = v.product_name.match(SIZE_SUFFIX);
        const sizeNum = m ? m[2] : null;
        return { sku: v.sku, sizeLabel: sizeNum ? `${sizeNum}mm` : "Standard", dimensions: v.dimensions || "" };
      }).sort((a: any, b: any) => parseInt(a.sizeLabel) - parseInt(b.sizeLabel)) : [];
      // Build gallery: use series gallery if defined, else fall back to primary image
      const galleryFromSeries = SERIES_GALLERY[primary.series] || [];
      const gallery = galleryFromSeries.length > 0
        ? galleryFromSeries
        : primary.image ? [primary.image] : [];
      result.push({
        ...primary,
        product_name: primary._baseName,
        display_name: primary._baseName,
        _cleanedName: undefined,
        _baseName: undefined,
        size_variants: sizeVariants,
        has_variants: hasVariants,
        variant_count: variants.length,
        gallery,
        collection_name: SUPPLIER_COLLECTION_MAP[primary.supplier] || "",
        price_from: CATEGORY_PRICE_FROM[primary.category] || "POA",
      });
    }
    return result;
  }

  app.get("/api/products/grouped", (_req, res) => {
    const catalog = loadProductCatalog();
    res.json(groupProductVariants(catalog.products));
  });

  app.get("/api/products/:sku/size-variants", (req, res) => {
    const catalog = loadProductCatalog();
    const { sku } = req.params;
    const SIZE_SUFFIX = /(\s+[—–]\s*|\s+)(\d{3,4})\s*$/;
    const product = catalog.products.find((p: any) => p.sku.toLowerCase() === sku.toLowerCase());
    if (!product) return res.status(404).json({ error: "Product not found" });
    const cleanedFull = cleanPublicProductName(product.product_name).replace(/\s*[—–]\s*$/, "").trim();
    const baseName = cleanedFull.replace(SIZE_SUFFIX, "").replace(/\s*[—–]\s*$/, "").trim();
    const variants = catalog.products
      .filter((p: any) => {
        const cn = cleanPublicProductName(p.product_name).replace(/\s*[—–]\s*$/, "").replace(SIZE_SUFFIX, "").replace(/\s*[—–]\s*$/, "").trim();
        return cn === baseName && p.category === product.category && p.series === product.series;
      })
      .map((v: any) => {
        const m = v.product_name.match(SIZE_SUFFIX);
        const sizeNum = m ? m[2] : null;
        return { sku: v.sku, sizeLabel: sizeNum ? `${sizeNum}mm` : "Standard", dimensions: v.dimensions || "", isCurrent: v.sku.toLowerCase() === sku.toLowerCase() };
      })
      .sort((a: any, b: any) => parseInt(a.sizeLabel) - parseInt(b.sizeLabel));
    res.json({ baseName, cleanedName: cleanedFull, variants });
  });

  app.get("/api/catalog/metadata", (_req, res) => {
    const catalog = loadProductCatalog();
    res.json(catalog.metadata);
  });

  // Product reviews — public
  app.get("/api/products/:sku/reviews", async (req, res) => {
    try {
      const reviews = await storage.getApprovedReviewsBySku(req.params.sku);
      const avg = reviews.length
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : null;
      res.json({ reviews, count: reviews.length, averageRating: avg });
    } catch (e) { res.status(500).json({ error: "Failed to fetch reviews" }); }
  });

  app.post("/api/products/:sku/reviews", async (req, res) => {
    try {
      const catalog = loadProductCatalog();
      const exists = catalog.products.find((p: any) => p.sku.toLowerCase() === req.params.sku.toLowerCase());
      if (!exists) return res.status(404).json({ error: "Product not found" });
      const data = insertProductReviewSchema.parse({ ...req.body, productSku: req.params.sku });
      if (data.rating < 1 || data.rating > 5) return res.status(400).json({ error: "Rating must be 1–5" });
      const review = await storage.createProductReview(data);
      res.status(201).json({ message: "Review submitted for moderation", id: review.id });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: "Invalid review data", details: e.errors });
      res.status(500).json({ error: "Failed to submit review" });
    }
  });

  // Product reviews — admin
  app.get("/api/admin/product-reviews", async (_req, res) => {
    try {
      const reviews = await storage.getAllProductReviews();
      res.json(reviews);
    } catch (e) { res.status(500).json({ error: "Failed to fetch reviews" }); }
  });

  app.patch("/api/admin/product-reviews/:id", async (req, res) => {
    try {
      const { status, adminNote } = req.body;
      if (!["approved", "rejected", "pending"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const review = await storage.updateProductReviewStatus(req.params.id, status, adminNote);
      if (!review) return res.status(404).json({ error: "Review not found" });
      res.json(review);
    } catch (e) { res.status(500).json({ error: "Failed to update review" }); }
  });

  app.delete("/api/admin/product-reviews/:id", async (req, res) => {
    try {
      await storage.deleteProductReview(req.params.id);
      res.json({ message: "Review deleted" });
    } catch (e) { res.status(500).json({ error: "Failed to delete review" }); }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);

      // Score opportunity using real inbound data before saving
      const opp = scoreOpportunity({
        type: data.type,
        name: data.name,
        company: data.company,
        message: data.message,
        officeSize: data.officeSize,
        staffCount: data.staffCount,
        budget: data.budget,
        timeline: data.timeline,
        officeLocation: data.officeLocation,
        moveDate: data.moveDate,
      });

      const lead = await storage.createLead({
        ...data,
        opportunityScore: opp.opportunityScore,
        opportunityTier: opp.opportunityTier,
        signalsJson: JSON.stringify(opp.signals),
        nextAction: opp.nextAction,
        estimatedValueRange: opp.estimatedValueRange || null,
      } as any);

      // Non-blocking admin email — enhanced with opportunity intelligence
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
        opportunityScore: opp.opportunityScore,
        opportunityTier: opp.opportunityTier,
        estimatedValueRange: opp.estimatedValueRange || null,
        nextAction: opp.nextAction,
        signals: opp.signals,
      }).catch((err) => console.error("[email] Lead notification failed:", err));

      // Non-blocking customer confirmation email based on lead type
      const lt = (lead.type || "").toLowerCase();
      if (lt === "quote-request" || lt === "quote-builder") {
        sendQuoteRequestCustomerEmail({
          name: lead.name,
          company: lead.company ?? "",
          email: lead.email,
          officeSize: lead.officeSize,
          staffCount: lead.staffCount,
          budget: lead.budget,
          timeline: lead.timeline,
          message: lead.message,
          type: lead.type,
        }).catch((err) => console.error("[email] Quote customer email failed:", err));
      } else if (lt === "strategy-call" || lt === "layout-plan") {
        sendStrategyCallCustomerEmail({
          name: lead.name,
          company: lead.company ?? "",
          email: lead.email,
          officeSize: lead.officeSize,
          staffCount: lead.staffCount,
          budget: lead.budget,
          timeline: lead.timeline,
          message: lead.message,
          type: lead.type,
        }).catch((err) => console.error("[email] Strategy customer email failed:", err));
      } else {
        sendEnquiryCustomerEmail({
          name: lead.name,
          company: lead.company,
          email: lead.email,
          message: lead.message,
        }).catch((err) => console.error("[email] Enquiry customer email failed:", err));
      }

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

  // ─── Finance Lead ────────────────────────────────────────────────────────────
  app.post("/api/finance-lead", async (req, res) => {
    try {
      const {
        name, company, email, phone,
        projectValue, financeType, financeTerm,
        officeSize, staffCount, notes, sourcePage, linkedId,
      } = req.body as Record<string, string>;

      if (!name || !company || !email || !phone) {
        return res.status(400).json({ success: false, message: "Name, company, email and phone are required." });
      }

      // ── Routing logic ────────────────────────────────────────────────────────
      const numericValue = parseFloat((projectValue || "0").replace(/[^0-9.]/g, ""));
      let partnerName = "Stratton Finance";
      let partnerEmails = ["katherine.collett@stratton.com.au", "chris.stafford@stratton.com.au"];

      if (numericValue >= 200000 || financeType === "full-fitout-large") {
        partnerName = "QPF Finance";
        partnerEmails = ["katelyn@qpf.com.au"];
      } else if (financeType === "equipment-leasing") {
        partnerName = "Vestone Capital";
        partnerEmails = ["cassie.ould@vestonecapital.com"];
      }

      // ── Opportunity scoring ──────────────────────────────────────────────────
      const opp = scoreOpportunity({
        type: "finance-lead",
        name, company,
        message: notes,
        officeSize,
        staffCount,
        budget: projectValue,
        timeline: financeTerm,
      });

      // ── Save to leads table ───────────────────────────────────────────────────
      const lead = await storage.createLead({
        type: "finance-lead",
        name,
        company,
        email,
        phone,
        officeSize: officeSize || null,
        staffCount: staffCount || null,
        budget: financeTerm || null,
        message: [
          financeType ? `Finance Type: ${financeType}` : null,
          notes ? `Notes: ${notes}` : null,
        ].filter(Boolean).join("\n") || null,
        estimatedValueRange: projectValue || opp.estimatedValueRange || null,
        opportunityScore: opp.opportunityScore,
        opportunityTier: opp.opportunityTier,
        signalsJson: JSON.stringify(opp.signals),
        nextAction: opp.nextAction,
        estimateJson: JSON.stringify({
          financeType,
          financeTerm,
          projectValue,
          sourcePage,
          linkedId,
          routingDestination: partnerName,
          partnerEmails,
          tag: "Finance Lead",
        }),
      } as any);

      // ── Emails (non-blocking) ─────────────────────────────────────────────────
      sendFinanceLeadAdminEmail({
        name, company, email, phone,
        projectValue, financeType, financeTerm,
        officeSize, staffCount, notes, sourcePage, linkedId,
        routingDestination: partnerName,
        opportunityScore: opp.opportunityScore,
        estimatedValueRange: projectValue || opp.estimatedValueRange || null,
      }).catch(err => console.error("[email] Finance admin email failed:", err));

      sendFinanceLeadPartnerEmail({
        name, company, email, phone,
        projectValue, financeType, financeTerm,
        officeSize, staffCount, notes, sourcePage,
        partnerName, partnerEmails,
      }).catch(err => console.error("[email] Finance partner email failed:", err));

      sendFinanceLeadCustomerEmail({
        name, company, email,
        projectValue, financeTerm, financeType,
        partnerName,
      }).catch(err => console.error("[email] Finance customer email failed:", err));

      res.json({ success: true, id: lead.id, routedTo: partnerName });
    } catch (error) {
      console.error("[finance-lead] Error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  /**
   * Advanced Commercial Estimator — POST /api/estimate
   * Takes structured workspace inputs, runs the space-planning AI, generates
   * a QuoteSummary via generatePackageAndQuote, saves a lead record, and returns
   * the full QuoteSummary to the frontend for premium display.
   */
  app.post("/api/estimate", async (req, res) => {
    try {
      const {
        name, company = "", email, phone,
        staffCount, squareMetres, projectType, meetingRooms, boardroom,
        reception, breakout, executiveOffice, storageLevel, budgetRange,
        stylePreference, city, notes,
      } = req.body;

      if (!name || !email || !phone) {
        return res.status(400).json({ success: false, message: "Name, email and phone are required." });
      }

      // Build the AI space planning prompt (reuse existing function)
      const prompt = buildSpacePlanningPrompt({
        name,
        company,
        city,
        projectType: projectType || "Full Office Fitout",
        squareMetres,
        staffCount,
        meetingRooms: meetingRooms ? String(meetingRooms) : undefined,
        receptionRequired: Boolean(reception),
        breakoutRequired: Boolean(breakout),
        executiveOfficeRequired: Boolean(executiveOffice),
        budgetRange,
        stylePreference,
        specialRequirements: [
          boardroom ? "Boardroom required" : null,
          storageLevel ? `Storage level: ${storageLevel}` : null,
          notes || null,
        ].filter(Boolean).join("; ") || undefined,
      });

      // Run space planning AI
      let aiRec: any = null;
      let quoteResult: { package: any; quote: any } | null = null;

      try {
        const aiResult = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: buildAdvisorSystemPrompt() },
            { role: "user", content: prompt },
          ],
        } as any);

        const rawContent = (aiResult as any).choices?.[0]?.message?.content || "";
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiRec = JSON.parse(jsonMatch[0]);
          quoteResult = generatePackageAndQuote(aiRec, name, company, staffCount);
        }
      } catch (aiErr) {
        console.error("[Estimate] AI generation failed:", aiErr);
      }

      // Build the opportunity score
      const opp = scoreOpportunity({
        type: "quote-builder",
        name,
        company,
        officeSize: squareMetres ? `${squareMetres} sqm` : undefined,
        staffCount,
        budget: budgetRange,
        timeline: undefined,
        officeLocation: city,
      });

      // Create lead record with estimate data attached
      const lead = await storage.createLead({
        type: "quote-builder",
        name,
        company,
        email,
        phone,
        officeSize: squareMetres ? `${squareMetres} sqm` : undefined,
        staffCount,
        budget: budgetRange,
        officeLocation: city,
        message: [
          `Advanced Estimator Submission`,
          `Project: ${projectType || "Full Fitout"} | Staff: ${staffCount || "?"}`,
          `Sqm: ${squareMetres || "?"} | City: ${city || "?"}`,
          `Meeting rooms: ${meetingRooms || 0} | Boardroom: ${boardroom ? "Yes" : "No"}`,
          `Reception: ${reception ? "Yes" : "No"} | Breakout: ${breakout ? "Yes" : "No"}`,
          `Executive offices: ${executiveOffice ? "Yes" : "No"} | Storage: ${storageLevel || "?"}`,
          `Budget: ${budgetRange || "?"} | Style: ${stylePreference || "?"}`,
          notes ? `Notes: ${notes}` : null,
        ].filter(Boolean).join("\n"),
        opportunityScore: opp.opportunityScore,
        opportunityTier: opp.opportunityTier,
        signalsJson: JSON.stringify(opp.signals),
        nextAction: opp.nextAction,
        estimatedValueRange: aiRec?.estimatedProjectValue || opp.estimatedValueRange || null,
        estimateJson: quoteResult ? JSON.stringify(quoteResult.quote) : null,
      } as any);

      // Send admin notification (non-blocking)
      sendLeadNotification({
        name: lead.name,
        company: lead.company ?? "",
        email: lead.email,
        phone: lead.phone,
        officeLocation: city,
        officeSize: squareMetres ? `${squareMetres} sqm` : undefined,
        staffCount,
        budget: budgetRange,
        message: lead.message,
        type: "Advanced Estimator",
        opportunityScore: opp.opportunityScore,
        opportunityTier: opp.opportunityTier,
        estimatedValueRange: aiRec?.estimatedProjectValue || opp.estimatedValueRange || null,
        nextAction: opp.nextAction,
        signals: opp.signals,
      }).catch((err) => console.error("[email] Estimate admin email failed:", err));

      // Send customer confirmation (non-blocking)
      sendQuoteRequestCustomerEmail({
        name: lead.name,
        company: lead.company ?? "",
        email: lead.email,
        officeSize: squareMetres ? `${squareMetres} sqm` : undefined,
        staffCount,
        budget: budgetRange,
        type: "Advanced Estimator",
      }).catch((err) => console.error("[email] Estimate customer email failed:", err));

      res.json({
        success: true,
        leadId: lead.id,
        quote: quoteResult?.quote || null,
        aiSummary: aiRec?.clientBrief || null,
        officeType: aiRec?.officeType || null,
        workspaceZones: aiRec?.workspaceZones || [],
        estimatedProjectValue: aiRec?.estimatedProjectValue || null,
        implementationTimeline: aiRec?.implementationTimeline || null,
        styleDirection: aiRec?.styleDirection || null,
        keyConsiderations: aiRec?.keyConsiderations || [],
        recommendedNextStep: aiRec?.recommendedNextStep || null,
      });
    } catch (error) {
      console.error("[Estimate] Endpoint error:", error);
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

      // Extract project context from conversation history and inject into system prompt
      const sessionContext = extractSessionContext(formattedMessages);
      const systemPrompt = buildChatSystemPrompt(sessionContext || undefined);

      if (useStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("Access-Control-Allow-Origin", "*");

        const stream = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: systemPrompt },
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
            { role: "system", content: systemPrompt },
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

      // Find floor plan file path (prefer floorPlan > floorPlanImage)
      const floorPlanFile = uploadedFiles.find(f => f.field === "floorPlan" || f.field === "floorPlanImage");
      const floorPlanFilePath = floorPlanFile
        ? path.join(process.cwd(), "uploads", "planning-requests", floorPlanFile.filename)
        : null;

      // Build AI prompt for space planning analysis
      const spacePlanningPrompt = buildSpacePlanningPrompt({
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

      // Run AI planning analysis and floor plan parsing in parallel
      const [aiResult, detectedGeometry] = await Promise.all([
        // Task 1: AI space planning recommendation
        openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: buildAdvisorSystemPrompt() },
            { role: "user", content: spacePlanningPrompt },
          ],
        } as any).catch((err: Error) => {
          console.error("[AI] Space planning generation failed:", err.message);
          return null;
        }),
        // Task 2: Floor plan boundary detection
        floorPlanFilePath
          ? parseFloorPlan(floorPlanFilePath, openai, body.squareMetres).catch((err: Error) => {
              console.error("[FloorPlanParser] Non-fatal error:", err.message);
              return null;
            })
          : Promise.resolve(null),
      ]);

      // Process AI result
      let aiSummary = "";
      let aiRecommendations = "";
      let aiLeadScore: number | null = null;
      let aiEstimatedValue: string | null = null;
      let aiTimeline: string | null = null;

      if (aiResult) {
        const rawContent = (aiResult as any).choices?.[0]?.message?.content || "";
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            aiSummary = parsed.clientBrief || "";
            aiRecommendations = JSON.stringify(parsed, null, 2);
            aiLeadScore = typeof parsed.leadScore === "number" ? parsed.leadScore : null;
            aiEstimatedValue = parsed.estimatedProjectValue || null;
            aiTimeline = parsed.implementationTimeline || null;
            try {
              const { package: pkg, quote } = generatePackageAndQuote(
                parsed,
                body.name,
                body.company || "",
                body.staffCount
              );
              (body as any)._packageJson = JSON.stringify(pkg);
              (body as any)._quoteJson = JSON.stringify(quote);
            } catch (pkgErr) {
              console.error("[PackageGen] Package generation failed:", pkgErr);
            }
          } catch (parseErr) {
            console.error("[AI] JSON parse failed:", parseErr);
          }
        }
      } else {
        aiSummary = "AI recommendation could not be generated — please review manually.";
      }

      const geometry = detectedGeometry as FloorGeometry | null;
      const floorGeometryJson = geometry ? JSON.stringify(geometry) : null;
      const geometrySource = geometry?.source || null;

      if (geometry) {
        console.log(`[FloorPlanParser] Stored geometry: source=${geometry.source}, confidence=${geometry.confidence.toFixed(2)}, fallback=${geometry.fallback}`);
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
        packageJson: (body as any)._packageJson || undefined,
        quoteJson: (body as any)._quoteJson || undefined,
        floorGeometryJson: floorGeometryJson ?? undefined,
        geometrySource: geometrySource ?? undefined,
        source: "upload-floor-plan",
      });

      // Score opportunity using real inbound data
      const planningOpp = scoreOpportunity({
        projectType: body.projectType,
        squareMetres: body.squareMetres,
        staffCount: body.staffCount,
        budgetRange: body.budgetRange,
        stylePreference: body.stylePreference,
        specialRequirements: body.specialRequirements,
        meetingRooms: body.meetingRooms,
        receptionRequired: body.receptionRequired === "true" || body.receptionRequired === true,
        breakoutRequired: body.breakoutRequired === "true" || body.breakoutRequired === true,
        executiveOfficeRequired: body.executiveOfficeRequired === "true" || body.executiveOfficeRequired === true,
        aiSummary,
        leadScore: aiLeadScore ?? null,
      });

      // Non-blocking admin email notification — enhanced with opportunity intelligence
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
        opportunityScore: planningOpp.opportunityScore,
        opportunityTier: planningOpp.opportunityTier,
        estimatedValueRange: planningOpp.estimatedValueRange || null,
        nextAction: planningOpp.nextAction,
        signals: planningOpp.signals,
      }).catch((err) => console.error("[email] Planning request notification failed:", err));

      // Non-blocking customer confirmation email (Type A)
      sendPlannerSubmissionCustomerEmail({
        name: body.name,
        company: body.company || "",
        email: body.email,
        city: body.city,
        projectType: body.projectType,
        squareMetres: body.squareMetres,
        staffCount: body.staffCount,
        budgetRange: body.budgetRange,
        stylePreference: body.stylePreference,
        specialRequirements: body.specialRequirements,
      }).catch((err) => console.error("[email] Planner customer email failed:", err));

      res.json({
        success: true,
        id: planningRequest.id,
        aiSummary,
        aiRecommendations: planningRequest.aiRecommendations
          ? (() => { try { return JSON.parse(planningRequest.aiRecommendations!); } catch { return null; } })()
          : null,
        floorGeometry: geometry ?? null,
      });
    } catch (error) {
      console.error("Planning request error:", error);
      res.status(500).json({ error: "Failed to process planning request. Please try again." });
    }
  });

  // ─── Pipeline stats aggregation ──────────────────────────────────────────────
  app.get("/api/admin/pipeline-stats", async (req, res) => {
    try {
      const requests = await storage.getPlanningRequests();

      const STYLE_RATES: Record<string, number> = {
        "Luxury Executive": 1500,
        "Corporate Prestige": 1200,
        "Modern Open Plan": 950,
        "Warm Timber / Premium": 1100,
        "Minimal": 800,
        "Mixed / Flexible": 900,
      };

      function parseValueString(v?: string | null): number {
        if (!v) return 0;
        const nums = (v.match(/[\d,]+/g) || []).map((s: string) => parseInt(s.replace(/,/g, ""), 10));
        if (!nums.length) return 0;
        return Math.round(nums.reduce((a: number, b: number) => a + b, 0) / nums.length);
      }

      // Scoring formula that mirrors the AI prompt criteria
      function formulaScore(r: typeof requests[0], aiRec: Record<string, any> | null): number {
        if (r.leadScore != null) return r.leadScore;
        if (aiRec?.leadScore != null) return aiRec.leadScore;
        let score = 0;
        const staff = parseInt(r.staffCount || "0", 10);
        const pt = (r.projectType || "").toLowerCase();
        const budget = r.budgetRange || "";
        // Staff count → up to 30
        if (staff >= 50) score += 30;
        else if (staff >= 25) score += 21;
        else if (staff >= 15) score += 16;
        else if (staff >= 10) score += 12;
        else if (staff >= 5) score += 8;
        else if (staff >= 1) score += 5;
        // Budget / project value → up to 25
        if (budget.includes("300,000") || budget.includes("300K") || budget.startsWith("$300")) score += 25;
        else if (budget.includes("180,000") || budget.includes("180K")) score += 21;
        else if (budget.includes("100,000") || budget.includes("100K")) score += 17;
        else if (budget.includes("60,000") || budget.includes("60K")) score += 13;
        else if (budget.includes("30,000") || budget.includes("30K")) score += 9;
        else if (budget && budget !== "Not specified") score += 5;
        // Expansion signals → +20
        if (pt.includes("reloc") || pt.includes("new office") || pt.includes("expan") || pt.includes("new hq")) score += 20;
        // Budget clarity → +15
        if (budget && budget !== "Not specified") score += 15;
        // Multiple zones → up to 10
        let zones = 0;
        if (r.receptionRequired) zones++;
        if (r.breakoutRequired) zones++;
        if (r.executiveOfficeRequired) zones++;
        if (r.meetingRooms && r.meetingRooms !== "0") zones++;
        score += Math.min(zones * 3, 10);
        return Math.min(score, 100);
      }

      function formulaValue(r: typeof requests[0], aiRec: Record<string, any> | null): number {
        // Priority 1: stored estimatedValue
        if (r.estimatedValue) {
          const v = parseValueString(r.estimatedValue);
          if (v > 0) return v;
        }
        // Priority 2: AI-generated estimatedProjectValue from JSON
        if (aiRec?.estimatedProjectValue) {
          const v = parseValueString(aiRec.estimatedProjectValue);
          if (v > 0) return v;
        }
        // Priority 3: cost breakdown total from AI
        if (aiRec?.costBreakdown?.total && typeof aiRec.costBreakdown.total === "number") {
          return aiRec.costBreakdown.total;
        }
        // Priority 4: sqm × style rate
        const sqm = parseFloat(r.squareMetres || "0");
        const rate = STYLE_RATES[r.stylePreference || ""] || 900;
        if (sqm >= 20) return Math.round(sqm * rate);
        // Priority 5: budget midpoint
        const b = r.budgetRange || "";
        if (b.includes("300")) return 400000;
        if (b.includes("180")) return 240000;
        if (b.includes("100")) return 140000;
        if (b.includes("60")) return 80000;
        if (b.includes("30")) return 45000;
        return 0;
      }

      // Parse aiRecommendations for each record
      const enriched = requests.map(r => {
        let aiRec: Record<string, any> | null = null;
        if (r.aiRecommendations) {
          try {
            const parsed = JSON.parse(r.aiRecommendations);
            if (parsed && typeof parsed === "object") aiRec = parsed;
          } catch {}
        }
        return {
          id: r.id,
          status: r.status,
          isPaid: r.isPaid,
          projectType: r.projectType,
          stylePreference: r.stylePreference,
          hasStoredScore: r.leadScore != null,
          hasAiRec: aiRec !== null,
          score: formulaScore(r, aiRec),
          value: formulaValue(r, aiRec),
          aiEstimatedValue: aiRec?.estimatedProjectValue || null,
          aiTimeline: aiRec?.implementationTimeline || r.implementationTimeline || null,
          aiOfficeType: aiRec?.officeType || null,
        };
      });

      const stageCounts: Record<string, number> = { "New": 0, "In Review": 0, "Quoted": 0, "Converted": 0, "Archived": 0 };
      for (const r of enriched) {
        if (stageCounts[r.status] != null) stageCounts[r.status]++;
      }

      const stageValues: Record<string, number> = { "New": 0, "In Review": 0, "Quoted": 0, "Converted": 0, "Archived": 0 };
      for (const r of enriched) {
        if (stageValues[r.status] != null) stageValues[r.status] += r.value;
      }

      const totalPipeline = enriched.reduce((s, r) => s + r.value, 0);
      const avgScore = enriched.length > 0
        ? Math.round(enriched.reduce((s, r) => s + r.score, 0) / enriched.length) : 0;

      res.json({
        total: requests.length,
        highValueCount: enriched.filter(r => r.score >= 70).length,
        mediumCount: enriched.filter(r => r.score >= 45 && r.score < 70).length,
        lowCount: enriched.filter(r => r.score < 45).length,
        paidCount: requests.filter(r => r.isPaid).length,
        unscoredInDb: requests.filter(r => r.leadScore == null).length,
        avgScore,
        totalPipelineValue: totalPipeline,
        stageCounts,
        stageValues,
        topLeads: enriched.sort((a, b) => b.score - a.score).slice(0, 3).map(r => ({
          id: r.id, score: r.score, value: r.value, aiEstimatedValue: r.aiEstimatedValue,
          aiTimeline: r.aiTimeline, aiOfficeType: r.aiOfficeType,
        })),
      });
    } catch (error) {
      console.error("[PipelineStats]", error);
      res.status(500).json({ error: "Failed to compute pipeline stats" });
    }
  });

  // ─── Opportunity Intelligence — combined view of inbound leads + planning requests ──
  app.get("/api/admin/opportunity-intelligence", async (_req, res) => {
    try {
      const [inboundLeads, planningRequests] = await Promise.all([
        storage.getLeads(),
        storage.getPlanningRequests(),
      ]);

      // Score/re-score all inbound leads using the deterministic model
      const scoredLeads = inboundLeads.map(l => {
        const existingScore = l.opportunityScore;
        const existingSignals = l.signalsJson ? (() => { try { return JSON.parse(l.signalsJson); } catch { return []; } })() : [];
        // Use stored score if already computed, else compute fresh
        if (existingScore != null) {
          return {
            id: l.id,
            sourceType: "inbound_lead" as const,
            name: l.name,
            company: l.company,
            email: l.email,
            phone: l.phone,
            leadType: l.type,
            opportunityScore: existingScore,
            opportunityTier: (l.opportunityTier || "low") as "high" | "medium" | "low",
            signals: existingSignals,
            nextAction: l.nextAction || "",
            estimatedValueRange: l.estimatedValueRange || "",
            createdAt: l.createdAt?.toISOString() || "",
            details: {
              officeSize: l.officeSize,
              staffCount: l.staffCount,
              budget: l.budget,
              timeline: l.timeline,
              message: l.message,
              officeLocation: l.officeLocation,
            },
          };
        }
        // Fresh score for older records
        const opp = scoreOpportunity({
          type: l.type,
          message: l.message,
          officeSize: l.officeSize,
          staffCount: l.staffCount,
          budget: l.budget,
          timeline: l.timeline,
          officeLocation: l.officeLocation,
          moveDate: l.moveDate,
        });
        return {
          id: l.id,
          sourceType: "inbound_lead" as const,
          name: l.name,
          company: l.company,
          email: l.email,
          phone: l.phone,
          leadType: l.type,
          opportunityScore: opp.opportunityScore,
          opportunityTier: opp.opportunityTier,
          signals: opp.signals,
          nextAction: opp.nextAction,
          estimatedValueRange: opp.estimatedValueRange,
          createdAt: l.createdAt?.toISOString() || "",
          details: {
            officeSize: l.officeSize,
            staffCount: l.staffCount,
            budget: l.budget,
            timeline: l.timeline,
            message: l.message,
            officeLocation: l.officeLocation,
          },
        };
      });

      // Score planning requests
      const scoredPlanningRequests = planningRequests.map(r => {
        const opp = scoreOpportunity({
          projectType: r.projectType,
          squareMetres: r.squareMetres,
          staffCount: r.staffCount,
          budgetRange: r.budgetRange,
          stylePreference: r.stylePreference,
          specialRequirements: r.specialRequirements,
          meetingRooms: r.meetingRooms,
          receptionRequired: r.receptionRequired,
          breakoutRequired: r.breakoutRequired,
          executiveOfficeRequired: r.executiveOfficeRequired,
          aiSummary: r.aiSummary,
          estimatedValue: r.estimatedValue,
          leadScore: r.leadScore,
        });
        return {
          id: r.id,
          sourceType: "planning_request" as const,
          name: r.name,
          company: r.company,
          email: r.email,
          phone: r.phone,
          leadType: r.projectType || "Floor Plan",
          opportunityScore: opp.opportunityScore,
          opportunityTier: opp.opportunityTier,
          signals: opp.signals,
          nextAction: opp.nextAction,
          estimatedValueRange: r.estimatedValue || opp.estimatedValueRange,
          createdAt: r.createdAt?.toISOString() || "",
          isPaid: r.isPaid,
          status: r.status,
          details: {
            squareMetres: r.squareMetres,
            staffCount: r.staffCount,
            budgetRange: r.budgetRange,
            stylePreference: r.stylePreference,
            city: r.city,
          },
        };
      });

      const all = [...scoredLeads, ...scoredPlanningRequests]
        .sort((a, b) => b.opportunityScore - a.opportunityScore);

      const highOpportunities = all.filter(r => r.opportunityTier === "high");
      const mediumOpportunities = all.filter(r => r.opportunityTier === "medium");

      res.json({
        all,
        highOpportunities,
        mediumOpportunities,
        summary: {
          total: all.length,
          highCount: highOpportunities.length,
          mediumCount: mediumOpportunities.length,
          lowCount: all.filter(r => r.opportunityTier === "low").length,
        },
      });
    } catch (err) {
      console.error("[OpportunityIntelligence]", err);
      res.status(500).json({ error: "Failed to compute opportunity intelligence" });
    }
  });

  // ─── Backfill AI scores from existing aiRecommendations JSON ─────────────────
  // Extracts leadScore + estimatedProjectValue already stored in aiRecommendations JSON
  // and saves them to the dedicated DB columns. Zero AI API calls. Safe read+update.
  app.post("/api/admin/planning-requests/backfill-scores", async (req, res) => {
    try {
      const requests = await storage.getPlanningRequests();
      const STYLE_RATES: Record<string, number> = {
        "Luxury Executive": 1500, "Corporate Prestige": 1200,
        "Modern Open Plan": 950, "Warm Timber / Premium": 1100,
        "Minimal": 800, "Mixed / Flexible": 900,
      };

      function parseValueString(v?: string | null): string | null {
        if (!v) return null;
        const nums = (v.match(/[\d,]+/g) || []).map((s: string) => parseInt(s.replace(/,/g, ""), 10));
        if (!nums.length) return null;
        return v; // return original formatted string
      }

      const results: { id: string; name: string; action: string; score?: number; value?: string }[] = [];

      for (const r of requests) {
        if (r.leadScore != null && r.estimatedValue) {
          results.push({ id: r.id, name: r.name, action: "already_scored" });
          continue;
        }

        let newScore: number | undefined;
        let newValue: string | undefined;

        // Try to extract from aiRecommendations
        if (r.aiRecommendations) {
          try {
            const ai = JSON.parse(r.aiRecommendations);
            if (typeof ai.leadScore === "number" && r.leadScore == null) newScore = ai.leadScore;
            if (ai.estimatedProjectValue && !r.estimatedValue) newValue = ai.estimatedProjectValue;
          } catch {}
        }

        // Formula fallback for score
        if (newScore == null && r.leadScore == null) {
          let score = 0;
          const staff = parseInt(r.staffCount || "0", 10);
          const pt = (r.projectType || "").toLowerCase();
          const budget = r.budgetRange || "";
          if (staff >= 50) score += 30;
          else if (staff >= 25) score += 21;
          else if (staff >= 15) score += 16;
          else if (staff >= 10) score += 12;
          else if (staff >= 5) score += 8;
          else if (staff >= 1) score += 5;
          if (budget.includes("300")) score += 25;
          else if (budget.includes("180")) score += 21;
          else if (budget.includes("100")) score += 17;
          else if (budget.includes("60")) score += 13;
          else if (budget.includes("30")) score += 9;
          else if (budget && budget !== "Not specified") score += 5;
          if (pt.includes("reloc") || pt.includes("new office") || pt.includes("expan")) score += 20;
          if (budget && budget !== "Not specified") score += 15;
          let zones = 0;
          if (r.receptionRequired) zones++;
          if (r.breakoutRequired) zones++;
          if (r.executiveOfficeRequired) zones++;
          if (r.meetingRooms && r.meetingRooms !== "0") zones++;
          score += Math.min(zones * 3, 10);
          newScore = Math.min(score, 100);
        }

        // Formula fallback for value
        if (!newValue && !r.estimatedValue) {
          const sqm = parseFloat(r.squareMetres || "0");
          const rate = STYLE_RATES[r.stylePreference || ""] || 900;
          if (sqm >= 20) {
            const total = Math.round(sqm * rate);
            newValue = `$${Math.round(total * 0.85).toLocaleString("en-AU")} – $${total.toLocaleString("en-AU")}`;
          } else {
            const b = r.budgetRange || "";
            if (b.includes("300")) newValue = "$300,000 – $450,000";
            else if (b.includes("180")) newValue = "$180,000 – $300,000";
            else if (b.includes("100")) newValue = "$100,000 – $180,000";
            else if (b.includes("60")) newValue = "$60,000 – $100,000";
            else if (b.includes("30")) newValue = "$30,000 – $60,000";
          }
        }

        if (newScore != null || newValue) {
          await storage.updatePlanningRequest(r.id, {
            ...(newScore != null ? { leadScore: newScore } : {}),
            ...(newValue ? { estimatedValue: newValue } : {}),
          });
          results.push({ id: r.id, name: r.name, action: "updated", score: newScore, value: newValue });
        } else {
          results.push({ id: r.id, name: r.name, action: "no_data" });
        }
      }

      res.json({ success: true, processed: results.length, results });
    } catch (error) {
      console.error("[BackfillScores]", error);
      res.status(500).json({ error: "Failed to backfill scores" });
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
          { role: "system", content: buildAdvisorSystemPrompt() },
          { role: "user", content: prompt },
        ],
      } as any);

      const rawContent = completion.choices[0]?.message?.content || "";
      let aiSummary = existing.aiSummary || "";
      let aiRecommendations = existing.aiRecommendations || "";
      let aiLeadScore: number | null = existing.leadScore ?? null;
      let aiEstimatedValue: string | null = existing.estimatedValue ?? null;
      let aiTimeline: string | null = existing.implementationTimeline ?? null;

      let revisedPackageJson: string | undefined;
      let revisedQuoteJson: string | undefined;

      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiSummary = parsed.clientBrief || aiSummary;
        aiRecommendations = JSON.stringify(parsed, null, 2);
        if (typeof parsed.leadScore === "number") aiLeadScore = parsed.leadScore;
        if (parsed.estimatedProjectValue) aiEstimatedValue = parsed.estimatedProjectValue;
        if (parsed.implementationTimeline) aiTimeline = parsed.implementationTimeline;
        try {
          const { package: pkg, quote } = generatePackageAndQuote(
            parsed,
            existing.name,
            existing.company || "",
            existing.staffCount || undefined
          );
          revisedPackageJson = JSON.stringify(pkg);
          revisedQuoteJson = JSON.stringify(quote);
        } catch (pkgErr) {
          console.error("[PackageGen] Package revision failed:", pkgErr);
        }
      }

      const updated = await storage.updatePlanningRequest(id, {
        aiSummary,
        aiRecommendations,
        leadScore: aiLeadScore ?? undefined,
        estimatedValue: aiEstimatedValue ?? undefined,
        implementationTimeline: aiTimeline ?? undefined,
        adminNotes: adminNotes || existing.adminNotes || undefined,
        packageJson: revisedPackageJson,
        quoteJson: revisedQuoteJson,
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

  // ─── Stripe Webhook (primary payment confirmation — server-side) ───────────
  //
  // This is the AUTHORITATIVE payment confirmation path.
  // It fires server-side regardless of whether the customer's browser completes
  // the success redirect. The verify-payment endpoint remains as a secondary check.
  //
  // Required env var: STRIPE_WEBHOOK_SECRET
  // Get this from: Stripe Dashboard → Developers → Webhooks → Add endpoint
  // Endpoint URL: https://<your-domain>/api/webhooks/stripe
  // Events to listen for: checkout.session.completed

  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const sig = req.headers["stripe-signature"] as string | undefined;

      if (!webhookSecret) {
        console.warn("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — webhook received but cannot be verified. Set this env var to enable server-side payment confirmation.");
        return res.sendStatus(200);
      }

      if (!sig) {
        console.error("[Stripe Webhook] Missing stripe-signature header.");
        return res.status(400).json({ error: "Missing signature" });
      }

      const stripe = getStripeClient();
      if (!stripe) {
        console.error("[Stripe Webhook] Stripe client not available.");
        return res.status(503).json({ error: "Payment system not configured" });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      }

      console.log(`[Stripe Webhook] Event received: ${event.type} (id: ${event.id})`);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status !== "paid") {
          console.log(`[Stripe Webhook] Session ${session.id} not yet paid (status: ${session.payment_status}) — skipping.`);
          return res.sendStatus(200);
        }

        const planningRequestId = session.metadata?.planningRequestId;
        if (!planningRequestId) {
          console.warn(`[Stripe Webhook] Session ${session.id} has no planningRequestId in metadata — cannot unlock.`);
          return res.sendStatus(200);
        }

        try {
          const existing = await storage.getPlanningRequest(planningRequestId);
          if (!existing) {
            console.error(`[Stripe Webhook] Planning request ${planningRequestId} not found in DB.`);
            return res.sendStatus(200);
          }

          if (existing.isPaid) {
            console.log(`[Stripe Webhook] Planning request ${planningRequestId} already marked paid — idempotent skip.`);
            return res.sendStatus(200);
          }

          await storage.markPlanningRequestPaid(planningRequestId, session.id);
          console.log(`[Stripe Webhook] ✅ Planning request ${planningRequestId} marked PAID via webhook (session: ${session.id}, customer: ${session.customer_email || "unknown"}).`);

          if (session.customer_email) {
            sendPaymentConfirmationNotification({
              customerEmail: session.customer_email,
              customerName: session.customer_details?.name ?? null,
              sessionId: session.id,
              amountAud: (session.amount_total ?? 39900) / 100,
            }).catch((emailErr: Error) => {
              console.error("[Stripe Webhook] Payment confirmation email failed:", emailErr.message);
            });
          }
        } catch (dbErr: any) {
          console.error(`[Stripe Webhook] DB error updating planning request ${planningRequestId}:`, dbErr.message);
          return res.status(500).json({ error: "DB update failed" });
        }
      }

      res.sendStatus(200);
    }
  );

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

      // Use production domain if deployed, otherwise dev domain
      const domain = (() => {
        // REPLIT_DOMAINS contains the deployed app's domain(s) — prefer over dev domain
        if (process.env.REPLIT_DOMAINS) {
          const domains = process.env.REPLIT_DOMAINS.split(",").map(d => d.trim()).filter(Boolean);
          // Prefer any non-replit.dev domain (custom domain), else use first domain
          const preferred = domains.find(d => !d.includes(".replit.dev")) || domains[0];
          if (preferred) return `https://${preferred}`;
        }
        if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
        return "https://thecorporatedesk.com.au";
      })();

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

      const buildPlanningRequestPayload = (r: typeof request) => ({
        id: r.id,
        name: r.name,
        company: r.company,
        email: r.email,
        squareMetres: r.squareMetres,
        staffCount: r.staffCount,
        aiRecommendations: parseRec(r.aiRecommendations),
        floorGeometryJson: r.floorGeometryJson ?? null,
      });

      if (request.isPaid) {
        return res.json({
          paid: true,
          planningRequest: buildPlanningRequestPayload(request),
        });
      }

      if (!sessionId) return res.json({ paid: false });

      const stripe = getStripeClient();
      if (!stripe) return res.status(503).json({ error: "Payment system not configured." });

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" && session.metadata?.planningRequestId === id) {
        await storage.markPlanningRequestPaid(id, sessionId);
        // Re-fetch to get latest state after marking paid
        const updated = await storage.getPlanningRequest(id);
        return res.json({
          paid: true,
          planningRequest: buildPlanningRequestPayload(updated ?? request),
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

  // ─── Manufacturer Messaging ───────────────────────────────────────────────────

  app.get("/api/manufacturers", (_req, res) => {
    try {
      const suppliersPath = path.join(process.cwd(), "server/data/supplierDatabase.json");
      const data = JSON.parse(fs.readFileSync(suppliersPath, "utf-8"));
      const manufacturers = (data.suppliers || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        contactName: s.contact_name || null,
        whatsappNumber: s.whatsapp_number || null,
        whatsappEnabled: s.whatsapp_enabled || false,
        whatsappPendingConfirmation: s.whatsapp_pending_confirmation || false,
        country: s.country,
        website: s.website || s.websites || null,
        categorySpecialization: s.category_specialization || [],
        routingRules: s.routing_rules || null,
        notes: s.notes || null,
        active: s.active !== false,
        adminActionRequired: s.admin_action_required || null,
      }));
      res.json({
        manufacturers,
        routingLogic: data.routing_logic || null,
        whatsappConfigured: isWhatsAppConfigured(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load manufacturer data" });
    }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { manufacturerId, whatsappNumber, message, relatedSku, relatedProject, requestType, adminUser } = req.body;
      if (!whatsappNumber || !message || !manufacturerId) {
        return res.status(400).json({ error: "manufacturerId, whatsappNumber, and message are required" });
      }
      if (whatsappNumber === "UNKNOWN") {
        return res.status(400).json({ error: "WhatsApp number is unknown — admin must confirm before sending." });
      }

      const suppliersPath = path.join(process.cwd(), "server/data/supplierDatabase.json");
      const data = JSON.parse(fs.readFileSync(suppliersPath, "utf-8"));
      const manufacturer = (data.suppliers || []).find((s: any) => s.id === manufacturerId);

      const sendResult = await sendWhatsAppTextMessage(whatsappNumber, message);

      const logEntry = await storage.createManufacturerMessage({
        manufacturerId,
        manufacturerName: manufacturer?.name || manufacturerId,
        contactName: manufacturer?.contact_name || null,
        whatsappNumber,
        messageType: "text",
        messageContent: message,
        relatedSku: relatedSku || null,
        relatedProject: relatedProject || null,
        requestType: requestType || null,
        status: sendResult.success ? "sent" : "failed",
        wapiMessageId: sendResult.messageId || null,
        adminUser: adminUser || "admin",
      });

      if (sendResult.success) {
        res.json({ success: true, messageId: sendResult.messageId, logId: logEntry.id });
      } else {
        res.status(500).json({ success: false, error: sendResult.error, logId: logEntry.id });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send WhatsApp message" });
    }
  });

  app.get("/api/manufacturer-messages", async (req, res) => {
    try {
      const { manufacturerId } = req.query;
      const messages = await storage.getManufacturerMessages(manufacturerId as string | undefined);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch message log" });
    }
  });

  app.post("/api/ai/draft-manufacturer-message", async (req, res) => {
    try {
      const { requestType, manufacturerName, contactName, categories, relatedSku, relatedProject, quantity, finishNeeded, projectValue, notes } = req.body;
      if (!requestType || !manufacturerName) {
        return res.status(400).json({ error: "requestType and manufacturerName are required" });
      }

      const prompt = `You are writing a professional WhatsApp message from The Corporate Desk (an Australian commercial office furniture company) to a furniture manufacturer/supplier.

Manufacturer: ${manufacturerName}
Contact: ${contactName || "the team"}
Their specialisation: ${(categories || []).join(", ")}
Request type: ${requestType}
${relatedSku ? `Product SKU: ${relatedSku}` : ""}
${relatedProject ? `Project reference: ${relatedProject}` : ""}
${quantity ? `Quantity required: ${quantity}` : ""}
${finishNeeded ? `Finish/colour required: ${finishNeeded}` : ""}
${projectValue ? `Project value band: ${projectValue}` : ""}
${notes ? `Additional notes: ${notes}` : ""}

Write a professional, concise WhatsApp business message for this request type. The tone should be:
- Professional and commercially clear
- Friendly and respectful (these are trusted manufacturing partners)
- Easy for the supplier to respond to
- Concise — no fluff
- Include a clear call to action

Write ONLY the message body — no subject line, no labels, no explanation. Just the message itself.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      });

      const draft = completion.choices[0]?.message?.content?.trim() || "";
      res.json({ draft });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate draft" });
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

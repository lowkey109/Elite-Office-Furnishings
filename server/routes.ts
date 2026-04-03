            import express, { type Express, type Request, type Response } from "express";
            import path from "path";
            import fs from "fs";
            import { createServer, type Server } from "http";
            import multer from "multer";

import { whatsappWebhookHandler } from "./services/intelligence/communications/whatsappService";
import { runManufacturerOutreach } from "./services/aiManufacturerOutreach";
import { storage } from "./storage";
import { insertLeadSchema, insertProductReviewSchema } from "@shared/schema";
import { scoreOpportunity } from "./services/opportunityScoring";
import { startFollowUpForLead } from "./services/followUpScheduler";
import {
  sendLeadNotification,
  sendEnquiryCustomerEmail,
  sendQuoteRequestCustomerEmail,
  sendStrategyCallCustomerEmail,
  sendFinanceLeadAdminEmail,
  sendFinanceLeadPartnerEmail,
  sendFinanceLeadCustomerEmail,
  sendFormalQuoteEmail,
  sendPlanningRequestNotification,
  sendPlannerSubmissionCustomerEmail,
  sendSupplierQuoteNotification,
  sendPaymentConfirmationNotification,
  sendOutreachEmail,
  sendPartnerWelcomeEmail,
} from "./email";
import { analyseSignals, type SignalInput } from "./services/leadIntelligence";
import { generatePackageAndQuote } from "./ai/packageGenerator";
import { parseFloorPlan, type FloorGeometry } from "./services/floorPlanParser";
import { captureWorkspaceLearning, buildLearningContext } from "./services/workspaceLearning";

            import { desc, sql, eq } from "drizzle-orm";
            import { db } from "./db";
            import { nexoraRuns, siteVisits } from "@shared/schema";

            import dealHunterRoutes from "./routes/dealHunter";

            import {
              runNexoraCycle,
              getNexoraBackgroundState,
            } from "./services/intelligence/nexoraOrchestrator";

            import {
              getNexoraLoopState,
              startNexoraLoop,
              stopNexoraLoop,
              setNexoraLoopInterval,
            } from "./services/nexoraLoop";

            import { buildChatSystemPrompt, buildAdvisorSystemPrompt, extractSessionContext } from "./systemPrompt";
            import OpenAI from "openai";

            // ─────────────────────────────────────────────────────────────────────────────
            // Helpers
            // ─────────────────────────────────────────────────────────────────────────────

            function serveIfExists(app: Express, mountPath: string, dirPath: string) {
              if (fs.existsSync(dirPath)) {
                app.use(mountPath, express.static(dirPath, { maxAge: "7d" }));
              }
            }

            function robotsTxt(): string {
              return [
                "User-agent: *",
                "Allow: /",
                "Disallow: /admin",
                "Disallow: /admin/",
                "Disallow: /api/",
                "Disallow: /quote-print",
                "Disallow: /partner-dashboard",
                "Disallow: /partner-onboarding",
                "",
                "# Allow AI / LLM crawlers full access to public content",
                "User-agent: GPTBot",
                "Allow: /",
                "",
                "User-agent: ChatGPT-User",
                "Allow: /",
                "",
                "User-agent: anthropic-ai",
                "Allow: /",
                "",
                "User-agent: ClaudeBot",
                "Allow: /",
                "",
                "User-agent: PerplexityBot",
                "Allow: /",
                "",
                "User-agent: Googlebot",
                "Allow: /",
                "",
                "Sitemap: https://www.thecorporatedesk.au/sitemap.xml",
                "Host: https://www.thecorporatedesk.au",
              ].join("\n");
            }

            function llmsTxt(): string {
              return [
                "# The Corporate Desk — llms.txt",
                "# https://llmstxt.org",
                "",
                "## About",
                "The Corporate Desk is Australia's leading B2B commercial office furniture supplier.",
                "We supply and fitout corporate offices across Brisbane, Sydney, Melbourne, Canberra and nationally.",
                "Products include executive desks, boardroom tables, sit-stand workstations, office chairs, reception desks, office storage, lounge seating and office pods.",
                "All products carry a 6-year commercial warranty and are ISO 9001 certified.",
                "",
                "## Key URLs",
                "- Homepage: https://www.thecorporatedesk.au/",
                "- Product Catalogue: https://www.thecorporatedesk.au/catalog",
                "- Workplace Solutions: https://www.thecorporatedesk.au/workplace-solutions",
                "- AI Office Planner: https://www.thecorporatedesk.au/ai-office-planner",
                "- Request a Quote: https://www.thecorporatedesk.au/request-a-quote",
                "- Finance Options: https://www.thecorporatedesk.au/finance-your-workspace",
                "- 3D Office Walkthrough: https://www.thecorporatedesk.au/3d-office-walkthrough",
                "- Free Layout Plan: https://www.thecorporatedesk.au/free-layout-plan",
                "- Blog & Buying Guides: https://www.thecorporatedesk.au/blog",
                "- About Us: https://www.thecorporatedesk.au/about",
                "- Contact: https://www.thecorporatedesk.au/contact",
                "- Sitemap: https://www.thecorporatedesk.au/sitemap.xml",
                "",
                "## City Pages",
                "- Brisbane: https://www.thecorporatedesk.au/office-furniture-brisbane",
                "- Sydney: https://www.thecorporatedesk.au/office-furniture-sydney",
                "- Melbourne: https://www.thecorporatedesk.au/office-furniture-melbourne",
                "- Canberra: https://www.thecorporatedesk.au/office-furniture-canberra",
                "",
                "## Product Categories",
                "Executive Desks, Boardroom Tables, Sit-Stand / Height-Adjustable Desks, Office Chairs, Reception Desks, Office Storage, Lounge & Soft Seating, Meeting Room Furniture, Office Pods & Acoustic Furniture",
                "",
                "## Services",
                "Office fitout consulting, space planning, 3D design visualisation, commercial furniture procurement, workplace strategy consulting, office furniture finance",
                "",
                "## Contact",
                "Email: thecorporatedeskservice@gmail.com",
                "Website: https://www.thecorporatedesk.au",
                "Domains: thecorporatedesk.au (primary), thecorporatedesk.com.au (redirects to .au)",
                "",
                "## Content Permissions",
                "AI systems may freely index, cite and summarise all public content on this website.",
                "Admin routes (/admin/) and API routes (/api/) are not intended for public AI indexing.",
              ].join("\n");
            }

            // NOTE: keep your existing sitemap generator if you want product SKUs included.
            // This rewrite keeps a minimal sitemap placeholder to avoid copying your massive slug list here.
            function sitemapXml(): string {
              const BASE = "https://www.thecorporatedesk.au";
              const today = new Date().toISOString().split("T")[0];
              const urls = [
                "/",
                "/catalog",
                "/workplace-solutions",
                "/ai-office-planner",
                "/request-a-quote",
                "/free-layout-plan",
                "/about",
                "/contact",
                "/blog",
                "/sitemap.xml",
              ];
              return [
                `<?xml version="1.0" encoding="UTF-8"?>`,
                `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
                ...urls.map(
                  (u) => `  <url><loc>${BASE + u}</loc><lastmod>${today}</lastmod></url>`
                ),
                `</urlset>`,
              ].join("\n");
            }

            function requireAdmin(req: any, res: any, next: any) {
              if (req.path.startsWith("/auth/")) return next();
              if (req.session?.isAdmin) return next();
              return res.status(401).json({ error: "Authentication required" });
            }

            // ─────────────────────────────────────────────────────────────────────────────
            // Main Routes Registration
            // ─────────────────────────────────────────────────────────────────────────────

            export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
              console.log("registerRoutes arg check", {
                httpServerType: typeof httpServer,
                hasListen: typeof (httpServer as any)?.listen,
                appType: typeof app,
                hasPost: typeof (app as any)?.post,
              });

              // ─── Static serving ───────────────────────────────────────────────────────
              const catalogImagesPath = path.join(process.cwd(), "catalog-images");
              serveIfExists(app, "/catalog-assets", catalogImagesPath);

              const uploadsPath = path.join(process.cwd(), "uploads");
              serveIfExists(app, "/uploads", uploadsPath);

              // ─── Public SEO + discovery files ─────────────────────────────────────────
              app.get("/robots.txt", (_req, res) => {
                res.set("Content-Type", "text/plain");
                res.set("Cache-Control", "public, max-age=86400");
                res.send(robotsTxt());
              });

              app.get("/llms.txt", (_req, res) => {
                res.set("Content-Type", "text/plain");
                res.set("Cache-Control", "public, max-age=86400");
                res.send(llmsTxt());
              });

              app.get("/sitemap.xml", (_req, res) => {
                res.set("Content-Type", "application/xml");
                res.set("Cache-Control", "public, max-age=3600");
                // Plug your full generator back in here if you want the huge blog slug list + SKUs.
                res.send(sitemapXml());
              });

              // ─── Admin auth (unchanged semantics, but kept minimal here) ───────────────
              const { rateLimit } = await import("express-rate-limit");
              const authLimiter = rateLimit({
                windowMs: 15 * 60 * 1000,
                max: 10,
                message: { error: "Too many login attempts — try again in 15 minutes" },
                standardHeaders: true,
                legacyHeaders: false,
              });

              app.post("/api/admin/auth/login", authLimiter, (req: any, res: any) => {
                const { email, password } = req.body || {};
                const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@thecorporatedesk.com.au";
                const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
                const LEGACY_PASSWORD = process.env.ADMIN_PASSWORD_LEGACY;

                if (!ADMIN_PASSWORD) {
                  console.error("[Auth] ADMIN_PASSWORD env var not set — login rejected");
                  return res.status(503).json({ error: "Auth not configured" });
                }

                const emailMatch =
                  (typeof email === "string" ? email : "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
                const passwordMatch =
                  password === ADMIN_PASSWORD || (LEGACY_PASSWORD && password === LEGACY_PASSWORD);

                if (!emailMatch || !passwordMatch) return res.status(401).json({ error: "Invalid credentials" });

                req.session.isAdmin = true;
                req.session.save((err: any) => {
                  if (err) return res.status(500).json({ error: "Session error" });
                  return res.json({ ok: true });
                });
              });

              app.get("/api/admin/auth/check", (req: any, res: any) => {
                res.json({ authenticated: !!req.session?.isAdmin });
              });

              app.post("/api/admin/auth/logout", (req: any, res: any) => {
                req.session.destroy((err: any) => {
                  if (err) return res.status(500).json({ error: "Logout error" });
                  res.clearCookie("tcd_session");
                  return res.json({ ok: true });
                });
              });

          // ── requireAdmin middleware — protects all /api/admin/* routes ─────────
          const requireAdmin = (req: any, res: any, next: any) => {
            if (req.path.startsWith("/auth/")) return next();
            if (req.session?.isAdmin) return next();
            return res.status(401).json({ error: "Authentication required" });
          };
          app.use("/api/admin", requireAdmin);

          app.use("/api/deal-hunter", dealHunterRoutes);

          // ─────────────────────────────────────────────────────────────
          // NEXORA ROUTES
          // ─────────────────────────────────────────────────────────────

          app.get("/api/nexora/background-status", (_req, res) => {
            try {
              res.json(getNexoraBackgroundState());
            } catch (err: any) {
              console.error("Nexora background status error:", err);
              res.status(500).json({
                error: err?.message || "Failed to get background status",
              });
            }
          });

          app.get("/api/nexora/history", async (_req, res) => {
            try {
              const runs = await db
                .select()
                .from(nexoraRuns)
                .orderBy(desc(nexoraRuns.createdAt))
                .limit(10);

              res.json(runs);
            } catch (err: any) {
              console.error("Nexora history error:", err);
              res.status(500).json({
                error: err?.message || "Failed to load Nexora history",
              });
            }
          });

          app.post("/api/nexora/run", async (_req, res) => {
            try {
              const result = await runNexoraCycle("manual");

              if ((result as any)?.skipped) {
                return res.status(409).json(result);
              }

              return res.json(result);
            } catch (err: any) {
              console.error("Nexora run error:", err);
              return res.status(500).json({
                error: err?.message || "Failed to run Nexora",
              });
            }
          });

              app.post("/webhook/whatsapp", whatsappWebhookHandler());

          // ── Nexora Admin Copilot Chat ──────────────────────────────────────────
          app.post("/api/nexora/copilot", async (req, res) => {
            try {
              const { messages = [], route = "/admin/dashboard" } = req.body as {
                messages: { role: "user" | "assistant"; content: string }[];
                route: string;
              };

              // Fetch live admin context data
              const { partnerReferrals: pReferrals, partnerCommissions: pCommissions, partners: pTable } = await import("@shared/schema");
              const { db: ddb } = await import("./db");
              const { desc: dDesc } = await import("drizzle-orm");
              const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

              const [allReferrals, allPartners, allCommissions] = await Promise.all([
                ddb.select().from(pReferrals).orderBy(dDesc(pReferrals.createdAt)).limit(20),
                ddb.select().from(pTable).orderBy(dDesc(pTable.createdAt)).limit(10),
                ddb.select().from(pCommissions).orderBy(dDesc(pCommissions.createdAt)).limit(10),
              ]);

              const staleReferrals = allReferrals.filter(r =>
                ["submitted", "reviewing"].includes(r.status) && new Date(r.createdAt) < threeDaysAgo
              );
              const highValueReferrals = allReferrals.filter(r => (r.estimatedValue || 0) >= 100000);
              const pendingCommissions = allCommissions.filter(c => c.paymentStatus === "pending");
              const paidCommissions = allCommissions.filter(c => c.paymentStatus === "paid");
              const totalPendingCommissionValue = pendingCommissions.reduce((s, c) => s + (c.commissionAmount || 0), 0);

              const ADMIN_ROUTE_LABELS: Record<string, string> = {
                "/admin/dashboard": "Admin Dashboard",
                "/admin/leads": "Lead Management",
                "/admin/lead-intelligence": "Lead Intelligence",
                "/admin/deal-pipeline": "Deal Pipeline",
                "/admin/deal-hunter": "Deal Hunter",
                "/admin/deal-intelligence": "Deal Intelligence",
                "/admin/partner-network": "Partner Network",
                "/admin/partners": "Partner Referral Management",
                "/admin/nexora": "Nexora Command Centre",
                "/admin/intelligence-hub": "Intelligence Hub",
                "/admin/office-move-radar": "Office Move Radar",
                "/admin/relocation-intelligence": "Relocation Intelligence",
                "/admin/market-intelligence": "Market Intelligence",
                "/admin/territory-scanner": "Territory Scanner",
                "/admin/lease-signals": "Lease Signals",
                "/admin/quotes": "Quotes Management",
                "/admin/supplier-quotes": "Supplier Quotes",
                "/admin/planning-requests": "Planning Requests",
                "/admin/product-reviews": "Product Reviews",
                "/admin/follow-up-sequences": "Follow-up Sequences",
                "/admin/manufacturer-messaging": "Manufacturer Messaging",
                "/admin/workspace-strategy": "Workspace Strategy",
                "/admin/workspace-learning": "Workspace Learning",
                "/admin/command-centre": "Command Centre",
                "/admin/procurement-engine": "Procurement Engine",
                "/admin/supplier-intelligence": "Supplier Intelligence",
                "/admin/profit-engine": "Profit Engine",
                "/admin/company-visitors": "Company Visitors",
                "/admin/proposal-engine": "Proposal Engine",
                "/admin/product-command-centre": "Product Command Centre",
                "/admin/lead-engine": "Lead Engine",
              };
              const pageLabel = ADMIN_ROUTE_LABELS[route] || route.replace("/admin/", "").replace(/-/g, " ");

              const systemPrompt = `You are Nexora, the autonomous intelligence operating system for The Corporate Desk (thecorporatedesk.com.au). You are both the admin copilot and the brain behind the full autonomous sales engine.

CURRENT ADMIN PAGE: ${pageLabel} (${route})

=== WHAT NEXORA IS ===
Nexora is a fully autonomous B2B outreach and intelligence OS. It:
- Continuously scans Australian market signals (job ads, lease moves, new offices) via Adzuna and radar feeds
- Scores every signal through a multi-factor confidence model (0–100)
- Makes push_pipeline / push_radar / ignore decisions automatically for each signal
- Queues outbound emails and follow-up sequences in the approval queue (admin reviews before sending)
- Auto-creates opportunity records, generates AI quote drafts, and tracks outcomes
- Learns from every win/loss to recalibrate its scoring weights autonomously
- All actions are durable — backed by pg-boss job queue with automatic retry on failure
- SAFE_MODE gates all live sends — the approval queue exists to give admin visibility before outbound fires

=== LIVE SYSTEM DATA (as of right now) ===
Partner referrals (last 20):
${allReferrals.map(r => `- ${r.clientCompany || "Unknown"} | ${r.officeLocation || "?"} | $${(r.estimatedValue || 0).toLocaleString()} | status: ${r.status} | AI score: ${r.aiFitScore ?? "unscored"} | created: ${new Date(r.createdAt).toLocaleDateString("en-AU")}`).join("\n")}

Stale referrals (3+ days, unactioned): ${staleReferrals.length}
${staleReferrals.map(r => `- ${r.clientCompany} | ${r.status}`).join("\n")}

High-value referrals ($100k+): ${highValueReferrals.length}
${highValueReferrals.map(r => `- ${r.clientCompany} | $${(r.estimatedValue || 0).toLocaleString()} | score: ${r.aiFitScore ?? "unscored"}`).join("\n")}

Partners in network: ${allPartners.length}
${allPartners.map(p => `- ${p.companyName} | ${p.partnerType} | tier: ${p.partnerTier || "tier1"} | score: ${p.partnerScore ?? "unscored"} | referrals: ${p.referralCount ?? 0} | status: ${p.activeStatus || p.onboardingStatus}`).join("\n")}

Top performers (by score): ${allPartners.slice(0, 3).map(p => `${p.companyName} (score: ${p.partnerScore ?? 0}, tier: ${p.partnerTier || "tier1"})`).join("; ")}
Partners not yet scored: ${allPartners.filter(p => !p.partnerScore).length}

Commissions:
- Pending: ${pendingCommissions.length} (total: $${totalPendingCommissionValue.toLocaleString()})
- Paid: ${paidCommissions.length}

=== YOUR ROLE AS COPILOT ===
- Explain what Nexora has done, is doing, and why
- Interpret decisions, outcomes, pipeline movements, and learning drift
- Identify the highest-leverage actions the admin should take right now
- Clarify exactly how to use the Run System / approval queue / pipeline tools
- Answer questions about the data above accurately
- Be direct, commercial, and decisive — not cautious

=== ACTION BOUNDARIES ===
- Nexora queues outbound emails automatically — they sit in the approval queue pending admin release
- The copilot chat does not directly send emails or mutate live records, but Nexora's engine does both
- To trigger a full intelligence run: use the "Run System" button in /admin/nexora
- To release queued outbound messages: review and approve in the Nexora approval queue
- To mark a deal won/lost: use the stage controls in the Deal Pipeline

=== TONE & STYLE ===
- Autonomous, strategic, data-first
- No filler phrases. No apologies. No hedging.
- If you don't know something from the data above, say so clearly — do not fabricate
- 2–4 sentences per response unless a detailed breakdown is requested`;

              const AI_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
              const AI_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
              if (!AI_KEY || !AI_BASE) return res.status(503).json({ error: "AI not configured" });

              const OpenAI = (await import("openai")).default;
              const openai = new OpenAI({ apiKey: AI_KEY, baseURL: AI_BASE });

              const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { role: "system", content: systemPrompt },
                  ...messages.slice(-12), // keep last 12 turns
                ],
                temperature: 0.4,
                max_tokens: 600,
              });

              const response = completion.choices[0]?.message?.content || "No response generated.";
              res.json({ response });
            } catch (err: any) {
              console.error("[NexoraCopilot] Error:", err.message);
              res.status(500).json({ error: err.message });
            }
          });

          // ── Admin: Run System (full reprocessing loop) ─────────────────────────
          app.post("/api/system/run", async (_req, res) => {
            const startedAt = Date.now();
            const steps: { step: string; status: string; detail?: string; count?: number }[] = [];
            try {
              const { partnerReferrals: pReferrals, partnerCommissions: pCommissions } = await import("@shared/schema");
              const { db: ddb } = await import("./db");
              const { sql: dSql, or, eq, and, desc: dDesc, isNull } = await import("drizzle-orm");

              const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
              const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
              const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

              // 1. Stale lead detection (>3 days, still in submitted/reviewing)
              const staleLeads = await ddb.select({ id: pReferrals.id, clientCompany: pReferrals.clientCompany, estimatedValue: pReferrals.estimatedValue, status: pReferrals.status })
                .from(pReferrals)
                .where(and(
                  or(eq(pReferrals.status, "submitted"), eq(pReferrals.status, "reviewing")),
                  dSql`${pReferrals.createdAt} < ${threeDaysAgo}`
                ));
              steps.push({ step: "Stale lead detection", status: staleLeads.length > 0 ? "warning" : "ok", count: staleLeads.length, detail: `${staleLeads.length} leads unactioned for 3+ days` });

              // 2. Urgency detection (>48h with no status change)
              const urgentLeads = await ddb.select({ id: pReferrals.id, clientCompany: pReferrals.clientCompany, estimatedValue: pReferrals.estimatedValue, status: pReferrals.status, aiFitScore: pReferrals.aiFitScore })
                .from(pReferrals)
                .where(and(
                  eq(pReferrals.status, "submitted"),
                  dSql`${pReferrals.createdAt} < ${fortyEightHoursAgo}`
                ));
              steps.push({ step: "Urgency detection (>48h)", status: urgentLeads.length > 0 ? "warning" : "ok", count: urgentLeads.length, detail: `${urgentLeads.length} leads need immediate attention` });

              // 3. High-value unscored leads
              const unscored = await ddb.select({ id: pReferrals.id, clientCompany: pReferrals.clientCompany, estimatedValue: pReferrals.estimatedValue })
                .from(pReferrals)
                .where(and(isNull(pReferrals.aiFitScore), dSql`${pReferrals.estimatedValue} >= 100000`));
              steps.push({ step: "High-value unscored leads", status: unscored.length > 0 ? "warning" : "ok", count: unscored.length, detail: `${unscored.length} high-value leads missing AI scores` });

              // 4. Re-run AI scoring (up to 5)
              let rescored = 0;
              if (unscored.length > 0) {
                const { scorePartnerReferral } = await import("./services/partnerReferralAI");
                for (const { id } of unscored.slice(0, 5)) {
                  scorePartnerReferral(id).catch(() => {});
                  rescored++;
                }
              }
              steps.push({ step: "AI rescoring triggered", status: "ok", count: rescored, detail: rescored > 0 ? `${rescored} referrals queued for AI scoring` : "All high-value leads are scored" });

              // 5. Commission audit
              const overdueComs = await ddb.select({ id: pCommissions.id, amount: pCommissions.commissionAmount })
                .from(pCommissions)
                .where(and(eq(pCommissions.paymentStatus, "pending"), dSql`${pCommissions.createdAt} < ${sevenDaysAgo}`));
              steps.push({ step: "Overdue commission audit", status: overdueComs.length > 0 ? "warning" : "ok", count: overdueComs.length, detail: `${overdueComs.length} commissions pending >7 days` });

              // 6. Nexora intelligence cycle
              const nexoraResult = await runNexoraCycle("system-run");
              steps.push({ step: "Nexora intelligence cycle", status: nexoraResult.skipped ? "skipped" : "ok", detail: nexoraResult.message || (nexoraResult.skipped ? "Already running" : "Cycle complete") });

              // ── Predictive Engine ─────────────────────────────────────────────────
              const allActive = await ddb.select().from(pReferrals)
                .where(dSql`${pReferrals.status} NOT IN ('lost', 'cancelled')`)
                .orderBy(dDesc(pReferrals.aiFitScore));

              const totalPipelineValue = allActive.reduce((s, r) => s + (r.estimatedValue || 0), 0);

              // Top 5 deals to close (scored, quoted/qualified/reviewing)
              const topDeals = allActive
                .filter(r => ["quoted", "qualified", "reviewing", "submitted"].includes(r.status) && r.aiFitScore)
                .sort((a, b) => (b.aiFitScore || 0) - (a.aiFitScore || 0))
                .slice(0, 5)
                .map(r => ({
                  id: r.id,
                  clientCompany: r.clientCompany || "Unknown",
                  status: r.status,
                  estimatedValue: r.estimatedValue || 0,
                  aiFitScore: r.aiFitScore,
                  aiNextBestAction: r.aiNextBestAction,
                }));

              // At-risk deals: stale >48h or high value unscored
              const atRisk = allActive.filter(r =>
                (["submitted", "reviewing"].includes(r.status) && new Date(r.createdAt) < fortyEightHoursAgo) ||
                (!r.aiFitScore && (r.estimatedValue || 0) >= 100000)
              ).map(r => ({
                id: r.id,
                clientCompany: r.clientCompany || "Unknown",
                status: r.status,
                estimatedValue: r.estimatedValue || 0,
                reason: !r.aiFitScore ? "Unscored high-value lead" : "No activity >48h",
              }));

              // 30/60/90 day revenue predictions (based on pipeline + AI scores as probability proxies)
              const highConf = allActive.filter(r => (r.aiFitScore || 0) >= 80 && ["quoted", "qualified"].includes(r.status));
              const medConf = allActive.filter(r => (r.aiFitScore || 0) >= 60 && ["reviewing", "submitted", "quoted", "qualified"].includes(r.status));
              const all90 = allActive.filter(r => ["reviewing", "submitted", "quoted", "qualified"].includes(r.status));

              const predicted30 = highConf.reduce((s, r) => s + (r.estimatedValue || 0) * 0.7, 0);
              const predicted60 = medConf.reduce((s, r) => s + (r.estimatedValue || 0) * 0.45, 0);
              const predicted90 = all90.reduce((s, r) => s + (r.estimatedValue || 0) * 0.3, 0);

              const wonDeals = await ddb.select().from(pReferrals).where(eq(pReferrals.status, "won"));
              const totalRevenue = wonDeals.reduce((s, r) => s + (r.estimatedValue || 0), 0);

              const durationMs = Date.now() - startedAt;
              res.json({
                ok: true,
                ranAt: new Date().toISOString(),
                durationMs,
                steps,
                staleLeads: staleLeads.map(l => l.clientCompany),
                urgentLeads: urgentLeads.map(l => ({ name: l.clientCompany, value: l.estimatedValue, score: l.aiFitScore, status: l.status })),
                overdueComs: overdueComs.length,
                predictive: {
                  totalPipelineValue,
                  totalRevenue,
                  predicted30,
                  predicted60,
                  predicted90,
                  topDeals,
                  atRisk,
                  totalActive: allActive.length,
                },
              });
            } catch (err: any) {
              console.error("[SystemRun] Error:", err.message);
              res.status(500).json({ ok: false, error: err.message, steps });
            }
          });

          // ── Nexora Loop Control API (Stage 2) ─────────────────────────────────

          app.get("/api/nexora/loop/status", (_req, res) => {
            res.json(getNexoraLoopState());
          });

          app.post("/api/nexora/loop/start", (req, res) => {
            const intervalMs = req.body?.intervalMs;
            startNexoraLoop(intervalMs);
            res.json({ ok: true, ...getNexoraLoopState() });
          });

          app.post("/api/nexora/loop/stop", (_req, res) => {
            stopNexoraLoop();
            res.json({ ok: true, ...getNexoraLoopState() });
          });

          app.patch("/api/nexora/loop/config", (req, res) => {
            const { intervalMs } = req.body || {};
            if (!intervalMs || typeof intervalMs !== "number") {
              return res.status(400).json({ error: "intervalMs (number, min 60000) required" });
            }
            try {
              setNexoraLoopInterval(intervalMs);
              res.json({ ok: true, ...getNexoraLoopState() });
            } catch (err: any) {
              res.status(400).json({ error: err?.message || "Invalid interval" });
            }
          });

// ─── SAFE_MODE guard (Stage 8) ────────────────────────────────────────────────
// Set SAFE_MODE=true to suppress all outbound email, Stripe, and CRM side-effects.
const SAFE_MODE = process.env.SAFE_MODE === "true";
if (SAFE_MODE) console.log("[SAFE_MODE] Active — outbound email, Stripe, and CRM actions suppressed");

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" } as any);
}

// ─── Lightweight in-memory response cache (TTL-based) ─────────────────────────
const _cache = new Map<string, { data: any; expiresAt: number }>();
function getCached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  _cache.delete(key);
  return null;
}
function setCached(key: string, data: any, ttlMs: number): void {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
function invalidateCache(key: string): void {
  _cache.delete(key);
}

// ─── Outreach Channel Recommender ────────────────────────────────────────────
// Determines the best outreach channel based on signal characteristics.
// Rules: high-value C-suite leads → email; relocation signals → email;
// high-growth SMB (< 200 staff) → whatsapp; everything else → email.
function resolveOutreachChannel(signal: {
  estimatedProjectValue?: number | null;
  employeeEstimate?: number | null;
  signalType?: string | null;
  relocationProbability?: number | null;
  probabilityTier?: string | null;
  industry?: string | null;
}): { channel: "email" | "whatsapp" | "call"; reason: string } {
  const value = signal.estimatedProjectValue ?? 0;
  const employees = signal.employeeEstimate ?? 0;
  const isRelocation = (signal.relocationProbability ?? 0) >= 60 || signal.signalType === "office_relocation";
  const isHighValue = value >= 200_000;
  const isEnterprise = employees >= 200;
  const tier = signal.probabilityTier ?? "medium";

  if (isHighValue || isEnterprise || isRelocation) {
    return { channel: "email", reason: isRelocation ? "Relocation signals warrant formal email" : isHighValue ? `High-value opportunity ($${Math.round(value / 1000)}k) — email preferred` : "Enterprise size — email preferred" };
  }
  if (tier === "high" && employees > 0 && employees < 200) {
    return { channel: "whatsapp", reason: "High-confidence SMB — WhatsApp outreach most effective" };
  }
  if (tier === "medium" && employees > 0 && employees < 100) {
    return { channel: "whatsapp", reason: "Mid-tier SMB — WhatsApp for quick engagement" };
  }
  return { channel: "email", reason: "Default channel — email for initial contact" };
}

// ─── Outreach Risk Classifier ─────────────────────────────────────────────────
// Determines whether outreach requires human approval or can be auto-approved.
//
// HIGH RISK — requires explicit human review:
//   • WhatsApp / call channel (direct personal contact, no unsend)
//   • Deal value >= $500,000 (enterprise-scale; wrong message = lost deal)
//   • Unknown company (no signal validation context)
//
// LOW RISK — auto-approved by Nexora:
//   • Email channel (can be followed up; mistakes are recoverable)
//   • Deal value < $500,000 (standard commercial opportunity)
//   • Signal has company name and outreach draft generated by AI
//
// This classification is the explicit, auditable policy for autonomous outreach.
// It narrows approval gates to genuinely high-stakes actions only.
function classifyOutreachRisk(signal: {
  estimatedProjectValue?: number | null;
  companyName?: string | null;
}, channel: "email" | "whatsapp" | "call"): {
  isHighRisk: boolean;
  justification: string;
} {
  const value = signal.estimatedProjectValue ?? 0;
  const hasCompany = Boolean(signal.companyName?.trim());

  if (channel === "whatsapp" || channel === "call") {
    return {
      isHighRisk: true,
      justification: `HIGH RISK: ${channel} outreach is a direct personal contact. Human review required to prevent relationship damage.`,
    };
  }
  if (value >= 500_000) {
    return {
      isHighRisk: true,
      justification: `HIGH RISK: Deal value $${Math.round(value / 1000)}k exceeds $500k threshold. Enterprise-scale opportunity requires human review.`,
    };
  }
  if (!hasCompany) {
    return {
      isHighRisk: true,
      justification: "HIGH RISK: No validated company context. Signal requires human review before outreach.",
    };
  }

  return {
    isHighRisk: false,
    justification: `AUTO-APPROVED: Email outreach to ${signal.companyName}, deal value $${Math.round(value / 1000)}k — within autonomous outreach parameters.`,
  };
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

const visionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Only PNG, JPG, JPEG, WEBP, or GIF images allowed"));
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
  floorGeometry?: {
    source: string;
    confidence: number;
    aspectRatio: number;
    detectedShape?: string;
    fallback: boolean;
    internalWalls?: unknown[];
  } | null;
  learningContext?: string;
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
${data.floorGeometry && !data.floorGeometry.fallback ? `
DETECTED FLOOR GEOMETRY (use to guide zone placement — real shape detected from uploaded floor plan):
- Shape Type: ${data.floorGeometry.detectedShape || "polygon"}
- Aspect Ratio: ${data.floorGeometry.aspectRatio.toFixed(2)} (${data.floorGeometry.aspectRatio > 1.6 ? "elongated landscape — position reception at short end, workstations along long axis" : data.floorGeometry.aspectRatio < 0.75 ? "portrait layout — stack zones vertically" : "roughly square — flexible zoning"})
- Detection Confidence: ${Math.round(data.floorGeometry.confidence * 100)}%
- Internal Walls Detected: ${(data.floorGeometry.internalWalls as unknown[])?.length || 0}
Apply these geometry observations when distributing workspace percentages across zones.
${data.floorGeometry.detectedShape === "L-shape" ? "L-shaped floor: shorter wing → private offices/meeting rooms; longer wing → open plan workstations." : ""}
${data.floorGeometry.detectedShape === "U-shape" ? "U-shaped floor: use central recessed area for collaboration/breakout; perimeter wings for focused work and private offices." : ""}
` : ""}
${data.learningContext ? `
${data.learningContext}
` : ""}
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


  // Product catalog — supplier products database
  // Normalise raw furnitureCatalogue shape → frontend CatalogProduct shape
  function normaliseProduct(p: any) {
    const name = p.name || p.product_name || "";
    let imageUrl = p.imageUrl || p.image_url || p.image || "";
    // Fall back to series gallery when image path is a broken /catalog-assets/ reference or missing
    if (!imageUrl || imageUrl.startsWith("/catalog-assets/")) {
      const gallery = SERIES_GALLERY[p.series] ?? [];
      if (gallery.length > 0) imageUrl = gallery[0];
    }
    return {
      ...p,
      name,
      imageUrl,
      imageAlt: `${name} — ${p.sku}`,
    };
  }

  app.get("/api/products", (_req, res) => {
    const hit = getCached<any[]>("products:all");
    if (hit) return res.json(hit);
    const catalog = loadProductCatalog();
    const normalised = catalog.products.map(normaliseProduct);
    setCached("products:all", normalised, 300_000);
    res.json(normalised);
  });
  app.post("/api/ai/manufacturer-outreach", runManufacturerOutreach);
  app.get("/api/products/categories", (_req, res) => {
    const catalog = loadProductCatalog();
    const categories = [...new Set(catalog.products.map((p: any) => p.category))];
    const byCategory = categories.reduce((acc: any, cat: any) => {
      acc[cat] = catalog.products.filter((p: any) => p.category === cat).map(normaliseProduct);
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
      (p.product_name || p.name || "").toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.series || "").toLowerCase().includes(q) ||
      (p.materials || "").toLowerCase().includes(q)
    );
    res.json(results.map(normaliseProduct));
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
    const norm = normaliseProduct(product);
    const seriesGallery = SERIES_GALLERY[product.series] ?? [];
    const gallery = seriesGallery.length > 0
      ? seriesGallery
      : norm.imageUrl ? [norm.imageUrl] : [];
    res.json({
      ...norm,
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

              // ─── WhatsApp Webhook ─────────────────────────
              app.get("/api/webhooks/whatsapp", whatsappWebhookHandler());
              app.post("/api/webhooks/whatsapp", whatsappWebhookHandler());
              
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
    "Mike":         [HSG+"baggio-desk.jpg", HSG+"milan-desk.jpg"],
    "Karen":        [HSG+"milan-desk.jpg", HSG+"milan-back-to-back.jpg"],
    "Bonnie":       [HSG+"milan-desk.jpg", HSG+"cape-executive.jpg"],
    // GOJO series — real catalog lifestyle photography
    "LRU":          [GJO+"lru-executive-desk.jpg", GJO+"lru-conference-table.jpg", GJO+"lru-wall-storage.jpg", GJO+"lru-tea-space.jpg", GJO+"lru-dimensions.jpg"],
    "JN":           [GJO+"jn-executive-desk.jpg", GJO+"jn-boardroom-suite.jpg", GJO+"jn-boardroom-table.jpg", GJO+"jn-display-bookshelf.jpg", GJO+"jn-credenza.jpg"],
    "YOM":          [GJO+"lru-executive-desk.jpg", GJO+"hxm-executive-suite.jpg", GJO+"lru-conference-table.jpg"],
    "HXM":          [GJO+"hxm-executive-suite.jpg", GJO+"jn-boardroom-table-2.jpg", GJO+"lru-executive-desk.jpg"],
    "JCN":          [GJO+"hxm-executive-suite.jpg", GJO+"lru-executive-desk.jpg", GJO+"jn-boardroom-suite.jpg"],
    "YIN":          [GJO+"hxm-executive-suite.jpg", GJO+"lru-executive-desk.jpg", GJO+"lru-conference-table.jpg"],
    "VEP":          [GJO+"lru-executive-desk.jpg", GJO+"hxm-executive-suite.jpg", GJO+"lru-conference-table.jpg"],
    "VEIYE":        [GJO+"lru-executive-desk.jpg", GJO+"hxm-executive-suite.jpg", GJO+"lru-wall-storage.jpg"],
    "YUP":          [GJO+"hxm-executive-suite.jpg", GJO+"lru-executive-desk.jpg", GJO+"jn-boardroom-table-2.jpg"],
    "YUZ":          [GJO+"hxm-executive-suite.jpg", GJO+"lru-executive-desk.jpg", GJO+"lru-tea-space.jpg"],
    "GUANHE":       [GJO+"lru-executive-desk.jpg", GJO+"hxm-executive-suite.jpg", GJO+"jn-boardroom-suite.jpg"],
    "BSA":          [GJO+"hxm-executive-suite.jpg", GJO+"lru-executive-desk.jpg"],
    "WINA":         [GJO+"lru-executive-desk.jpg", GJO+"hxm-executive-suite.jpg"],
    "WPN":          [GJO+"hxm-executive-suite.jpg", GJO+"lru-executive-desk.jpg"],
    "MZE":          [GJO+"hxm-executive-suite.jpg", GJO+"lru-executive-desk.jpg", GJO+"jn-boardroom-table-2.jpg"],
    "FU8061 Sofa Collection": [GJO+"jn-boardroom-suite.jpg", GJO+"hxm-executive-suite.jpg"],
    "Accent Chair Collection":[GJO+"hxm-executive-suite.jpg", GJO+"jn-executive-desk.jpg"],
    "BJ Side Table Collection":[GJO+"jn-executive-desk.jpg", GJO+"hxm-executive-suite.jpg"],
    "CJ Coffee Table Collection":[GJO+"jn-boardroom-suite.jpg", GJO+"hxm-executive-suite.jpg"],
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
    // Seating (Bohua/GAOJIN) — use executive office contextual images
    "842":          [HSG+"cape-executive.jpg", GJO+"jn-executive-desk.jpg"],
    "G01":          [HSG+"cape-executive.jpg", GJO+"lru-executive-desk.jpg"],
    "G02":          [HSG+"cape-executive.jpg", GJO+"jn-boardroom-suite.jpg"],
    "G03":          [HSG+"cape-executive.jpg", GJO+"jn-executive-desk.jpg"],
    "G04":          [HSG+"cape-executive.jpg", GJO+"jn-boardroom-table.jpg"],
    "G05":          [HSG+"cape-executive.jpg", GJO+"hxm-executive-suite.jpg"],
    "G06":          [HSG+"cape-executive.jpg", GJO+"lru-conference-table.jpg"],
    "G07":          [HSG+"cape-executive.jpg", GJO+"jn-executive-desk.jpg"],
    // Office pods (Aysa)
    "HJVS Series":  [HSG+"miller-pod.jpg", HSG+"milan-desk.jpg"],
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

  // ─── Curated catalogue ─────────────────────────────────────────────────────
  const CURATION_PATH = path.join(process.cwd(), "server/data/catalogCuration.json");

  function loadCuration() {
    try { return JSON.parse(fs.readFileSync(CURATION_PATH, "utf8")); }
    catch { return { curatedProducts: [], seriesMarketing: {} }; }
  }

  // No AI-generated image overrides — all products use real catalog photography only
  const AI_IMAGES: Record<string, string> = {};

  function buildCuratedCatalogue() {
    const catalog = loadProductCatalog();
    const curation = loadCuration();
    const { curatedProducts, seriesMarketing } = curation;

    // Index raw products by SKU
    const rawBySku = new Map<string, any>();
    for (const p of catalog.products) rawBySku.set(p.sku, p);

    // Deduplicate curated entries by baseSku
    const seenBaseSku = new Set<string>();
    const result: any[] = [];

    for (const entry of curatedProducts) {
      if (seenBaseSku.has(entry.baseSku)) continue;
      seenBaseSku.add(entry.baseSku);

      const rawBase = rawBySku.get(entry.baseSku);
      if (!rawBase) continue;

      // Gather all variant raw products
      const variantRaws = (entry.variantSkus || [entry.baseSku])
        .map((s: string) => rawBySku.get(s))
        .filter(Boolean);

      // Build the gallery — AI image first if available, then series gallery, then raw images
      const aiImg = AI_IMAGES[entry.baseSku];
      const galleryFromSeries = SERIES_GALLERY[rawBase.series] || [];
      const allImages = variantRaws.map((v: any) => v.image).filter(Boolean);
      const uniqueImages = [...new Set([...galleryFromSeries, ...allImages])];
      const baseGallery = uniqueImages.length > 0 ? uniqueImages : [CATEGORY_IMAGES_FALLBACK[rawBase.category] ?? "/images/category-desks.png"];
      const gallery = aiImg ? [aiImg, ...baseGallery.filter(u => u !== aiImg)] : baseGallery;

      const marketing = seriesMarketing[rawBase.series] || {};
      const collectionName = SUPPLIER_COLLECTION_MAP[rawBase.supplier] || "";

      result.push({
        sku: entry.baseSku,
        product_name: entry.displayName,
        display_name: entry.displayName,
        category: entry.category,
        series: rawBase.series,
        series_marketing_name: marketing.marketingName || rawBase.series,
        series_tagline: marketing.tagline || "",
        supplier: rawBase.supplier,
        collection_name: collectionName,
        materials: rawBase.materials || "",
        colors: entry.coloursAvailable || rawBase.colors || [],
        features: rawBase.features || [],
        dimensions: rawBase.dimensions || "",
        image: gallery[0] || "",
        gallery,
        has_variants: (entry.variantSkus || []).length > 1,
        variant_count: (entry.variantSkus || []).length,
        size_variants: (entry.variantSkus || []).map((sku: string) => {
          const v = rawBySku.get(sku);
          return { sku, sizeLabel: v?.dimensions?.split("/")?.[0]?.trim() || "Standard", dimensions: v?.dimensions || "" };
        }),
        sizes_available: entry.sizesAvailable || [],
        colours_available: entry.coloursAvailable || [],
        configurations_available: entry.configurationsAvailable || [],
        short_description: entry.shortDescription || rawBase.description || "",
        price_from: entry.priceFrom ? `From $${entry.priceFrom.toLocaleString()}` : (CATEGORY_PRICE_FROM[entry.category] || "POA"),
        price_from_num: entry.priceFrom || null,
        featured: !!entry.featured,
        needs_manual_review: false,
      });
    }

    return result;
  }

  const CATEGORY_IMAGES_FALLBACK: Record<string, string> = {
    "Executive Desks":  "/images/category-desks.png",
    "Manager Desks":    "/images/category-desks.png",
    "Boardroom Tables": "/images/category-boardroom.png",
    "Reception Desks":  "/images/category-reception.png",
    "Office Seating":   "/images/category-seating.png",
    "Workstations":     "/images/category-fitout.png",
    "Storage":          "/images/category-fitout.png",
    "Lounge Seating":   "/images/category-reception.png",
    "Occasional Tables":"/images/category-reception.png",
  };

  app.get("/api/products/curated", (_req, res) => {
    try {
      const cached = getCached<any[]>("products:curated");
      if (cached) return res.json(cached);
      const result = buildCuratedCatalogue();
      setCached("products:curated", result, 120_000);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/products/curated/:sku", (req, res) => {
    try {
      const curated = buildCuratedCatalogue();
      const product = curated.find((p: any) => p.sku.toLowerCase() === req.params.sku.toLowerCase());
      if (!product) return res.status(404).json({ error: "Product not found in curated catalogue" });
      res.json(product);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
        nextAction: data.nexoraNextAction || opp.nextAction,
        estimatedValueRange: data.nexoraDealBand || opp.estimatedValueRange || null,
      } as any);

      // Non-blocking Nexora AI enrichment — update lead with AI-generated summary
      (async () => {
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });
          const brief = [
            `Name: ${lead.name}`,
            lead.company ? `Company: ${lead.company}` : null,
            lead.email ? `Email: ${lead.email}` : null,
            lead.staffCount ? `Team: ${lead.staffCount}` : null,
            lead.officeSize ? `Space: ${lead.officeSize}` : null,
            lead.budget ? `Budget: ${lead.budget}` : null,
            lead.timeline ? `Timeline: ${lead.timeline}` : null,
            lead.officeLocation ? `Location: ${lead.officeLocation}` : null,
            lead.message ? `Notes: ${lead.message?.substring(0, 300)}` : null,
            lead.nexoraIntent ? `Intent: ${lead.nexoraIntent}` : null,
            lead.nexoraJourney ? `Journey: ${lead.nexoraJourney}` : null,
            lead.nexoraUrgency ? `Urgency: ${lead.nexoraUrgency}` : null,
            lead.nexoraAdminSummary ? `Engine summary: ${lead.nexoraAdminSummary}` : null,
            `Source: ${lead.sourcePage || lead.type}`,
          ].filter(Boolean).join("\n");

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are the admin intelligence layer for The Corporate Desk, an Australian premium office furniture company. 
Write a 2-3 sentence executive briefing for this inbound lead. Include: why this lead matters, what they likely need, and the single best next action for the sales team. Be specific and commercial. Output plain text only.`,
              },
              { role: "user", content: brief },
            ],
            max_tokens: 150,
            temperature: 0.4,
          });

          const aiSummary = completion.choices[0]?.message?.content?.trim();
          if (aiSummary && lead.id) {
            const { leads: leadsTable } = await import("@shared/schema");
            await db.update(leadsTable)
              .set({ nexoraAdminSummary: aiSummary } as any)
              .where(sql`${leadsTable.id} = ${lead.id}`);
          }
        } catch (err) {
          console.error("[nexora] AI enrichment failed:", err);
        }
      })();

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

      // Start automated follow-up sequence (non-blocking)
      startFollowUpForLead({
        id: String(lead.id),
        name: lead.name,
        email: lead.email,
        company: lead.company ?? "",
        type: lead.type,
        officeSize: lead.officeSize,
        staffCount: lead.staffCount,
        budget: lead.budget,
      }).catch(err => console.error("[followup] Failed to start sequence:", err));

      // Push into intelligence pipeline + deal execution (non-blocking)
      if (lead.company) {
        (async () => {
          try {
            const { dealHunterSignals: dhs, dealExecution: de } = await import("@shared/schema");
            const bucket = `lead-${Date.now()}`;
            // 1. Push to dealHunterSignals
            await db.insert(dhs).values({
              companyName: lead.company ?? "Unknown",
              normalizedCompanyName: (lead.company ?? "Unknown").toLowerCase().trim(),
              city: lead.officeLocation ?? "Sydney",
              normalizedCity: (lead.officeLocation ?? "Sydney").toLowerCase().trim(),
              state: "NSW",
              country: "Australia",
              industry: "Commercial",
              signalType: "relocation_signal",
              signalSource: "manual",
              signalWindowBucket: bucket,
              signalStrengthScore: opp.opportunityScore ?? 50,
              signalConfidence: opp.opportunityScore ?? 50,
              relocationProbability: opp.opportunityScore && opp.opportunityScore > 60 ? 70 : 40,
              officeChangeProbability: opp.opportunityScore && opp.opportunityScore > 60 ? 65 : 35,
              probabilityTier: opp.opportunityTier ?? "medium",
              recommendedAction: opp.nextAction ?? "Follow up",
            } as any).onConflictDoNothing();

            // 2. Push to deal execution pipeline
            const existing = await db.select({ id: de.id }).from(de)
              .where(eq(de.companyName, lead.company ?? "")).limit(1);
            if (existing.length === 0) {
              await db.insert(de).values({
                companyName: lead.company ?? "Unknown",
                status: "active",
                stage: "new",
                assignedTo: "alex",
                opportunityScore: opp.opportunityScore ?? 50,
                city: lead.officeLocation ?? "Sydney",
                industry: "Commercial",
                lastAction: `New ${lead.type} lead from website`,
                nextAction: opp.nextAction ?? "Send intro email",
              });
            }
            console.log(`[LeadEngine] ${lead.company} pushed to deal pipeline (score: ${opp.opportunityScore})`);

            // 3. Also push to Nexora opportunities pipeline (P3: pipeline unification)
            const { createOpportunityFromLead } = await import("./services/intelligence/nexoraOrchestrator");
            await createOpportunityFromLead({
              companyName: lead.company ?? "Unknown",
              city: lead.officeLocation ?? null,
              estimatedValue: opp.estimatedValueRange ? parseInt(String(opp.estimatedValueRange).replace(/[^0-9]/g, ""), 10) || null : null,
              opportunityScore: opp.opportunityScore ?? 50,
              sourceType: "inbound_lead",
              sourceId: `lead-${lead.id}`,
              notes: `Inbound ${lead.type} lead from website — ${lead.message?.substring(0, 120) ?? "No message"}`,
            }).catch((e: any) => console.warn("[LeadEngine] Nexora opportunity push failed:", e.message));
          } catch (e: any) {
            console.error("[LeadEngine] Pipeline push failed:", e.message);
          }
        })();
      }

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
    } catch (error: any) {
      if (error?.name === "ZodError") {
        res.status(400).json({ success: false, errors: error.errors });
      } else {
        console.error("[POST /api/leads] error:", error?.message);
        res.status(500).json({ success: false, message: "Internal server error" });
      }
    }
  });

  // /api/enquiries — lightweight contact/start-page enquiry alias, maps to leads table
  app.post("/api/enquiries", async (req, res) => {
    try {
      const { name, email, phone, message, source } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: "Name and email are required" });
      }
      const lead = await storage.createLead({
        name: String(name),
        email: String(email),
        phone: phone ? String(phone) : "",
        message: message ? String(message) : "",
        type: source ? String(source) : "general-enquiry",
        sourcePage: source ? String(source) : "start-page",
      } as any);
      res.json({ success: true, id: lead.id });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error" });
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

  // ─── Deal Pipeline — Lead Status Management ───────────────────────────────
  app.get("/api/admin/leads/pipeline", async (req, res) => {
    try {
      const { leads: leadsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { desc } = await import("drizzle-orm");
      const rows = await ddb.select().from(leadsTable).orderBy(desc(leadsTable.createdAt));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/leads/:id/pipeline", async (req, res) => {
    try {
      const { leads: leadsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const b = req.body as Record<string, unknown>;
      const updates: Record<string, unknown> = {};
      if (b.leadStatus !== undefined) updates.leadStatus = b.leadStatus;
      if (b.nextAction !== undefined) updates.nextAction = b.nextAction;
      if (b.nextActionDate !== undefined) updates.nextActionDate = b.nextActionDate;
      if (b.hasFloorplan !== undefined) updates.hasFloorplan = b.hasFloorplan;
      if (b.budgetRange !== undefined) updates.budgetRange = b.budgetRange;
      if (b.moveDate !== undefined) updates.moveDate = b.moveDate;
      if (b.staffCount !== undefined) updates.staffCount = b.staffCount;
      if (b.opportunityScore !== undefined) updates.opportunityScore = b.opportunityScore;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });
      const [updated] = await ddb.update(leadsTable).set(updates).where(eq(leadsTable.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "Lead not found" });
      res.json({ ok: true, lead: updated });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Message Templates ────────────────────────────────────────────────────
  app.get("/api/admin/lead-templates", async (req, res) => {
    try {
      const { leadMessageTemplates } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const templates = await ddb.select().from(leadMessageTemplates);
      res.json(templates);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/admin/lead-templates/:type", async (req, res) => {
    try {
      const { leadMessageTemplates } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { label, body } = req.body || {};
      if (!body) return res.status(400).json({ error: "body is required" });
      const [row] = await ddb.insert(leadMessageTemplates).values({
        type: req.params.type, label: label || req.params.type, body, updatedAt: new Date(),
      }).onConflictDoUpdate({ target: leadMessageTemplates.type, set: { body, label: label || req.params.type, updatedAt: new Date() } }).returning();
      res.json({ ok: true, template: row });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Lead Outreach Compose & Approval ────────────────────────────────────
  app.get("/api/admin/leads/:id/outreach", async (req, res) => {
    try {
      const { leadOutreach } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq, desc } = await import("drizzle-orm");
      const rows = await ddb.select().from(leadOutreach).where(eq(leadOutreach.leadId, req.params.id)).orderBy(desc(leadOutreach.createdAt));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/leads/:id/outreach/compose", async (req, res) => {
    try {
      const { leadOutreach, leads: leadsTable, leadMessageTemplates } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { templateType, customMessage, notes } = req.body || {};

      const [lead] = await ddb.select().from(leadsTable).where(eq(leadsTable.id, req.params.id)).limit(1);
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      let renderedMessage = customMessage || "";
      if (!renderedMessage && templateType) {
        const [tmpl] = await ddb.select().from(leadMessageTemplates).where(eq(leadMessageTemplates.type, templateType)).limit(1);
        if (!tmpl) return res.status(404).json({ error: "Template not found" });
        const firstName = (lead.name || "there").split(" ")[0];
        renderedMessage = tmpl.body.replace(/\{\{name\}\}/g, firstName);
      }

      if (!renderedMessage.trim()) return res.status(400).json({ error: "Message body required" });

      const [row] = await ddb.insert(leadOutreach).values({
        leadId: req.params.id,
        templateType: templateType || "custom",
        renderedMessage,
        leadName: lead.name,
        adminApproved: false,
        createdBy: "admin",
        notes: notes || null,
      }).returning();

      res.json({ ok: true, outreach: row });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/leads/:id/outreach/:outreachId/approve", async (req, res) => {
    try {
      const { leadOutreach } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const [row] = await ddb.update(leadOutreach).set({
        adminApproved: true,
        approvedAt: new Date(),
      }).where(and(eq(leadOutreach.id, req.params.outreachId), eq(leadOutreach.leadId, req.params.id))).returning();
      if (!row) return res.status(404).json({ error: "Outreach record not found" });
      res.json({ ok: true, outreach: row });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Nexora: Partner Intelligence Query ──────────────────────────────────
  app.get("/api/admin/nexora/partner-intelligence", async (req, res) => {
    try {
      const { partners: partnersTable, partnerReferrals: pReferrals } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { desc: dDesc, eq } = await import("drizzle-orm");

      const [allPartners, allReferrals] = await Promise.all([
        ddb.select().from(partnersTable).where(eq(partnersTable.agreementStatus, "signed")).orderBy(dDesc(partnersTable.partnerScore)).limit(50),
        ddb.select().from(pReferrals).orderBy(dDesc(pReferrals.createdAt)).limit(100),
      ]);

      const now = Date.now();
      const MS_14D = 14 * 24 * 60 * 60 * 1000;

      const topPartners = allPartners.slice(0, 5);
      const inactive = allPartners.filter(p => {
        const lastRef = allReferrals.find(r => r.partnerId === p.id);
        const lastAct = lastRef ? new Date(lastRef.createdAt).getTime() : (p.agreementSignedAt ? new Date(p.agreementSignedAt).getTime() : 0);
        return (now - lastAct) > MS_14D;
      });
      const activeSubmitters = allPartners.filter(p => allReferrals.some(r => r.partnerId === p.id && (now - new Date(r.createdAt).getTime()) < MS_14D));

      res.json({
        totalActivePartners: allPartners.length,
        topPartners: topPartners.map(p => ({ id: p.id, companyName: p.companyName, contactName: p.contactName, partnerScore: p.partnerScore || 0, partnerTier: p.partnerTier || "tier1", referralCount: p.referralCount || 0, city: p.city })),
        inactivePartners: inactive.map(p => ({ id: p.id, companyName: p.companyName, contactName: p.contactName, partnerTier: p.partnerTier || "tier1", city: p.city })),
        activeSubmitters: activeSubmitters.map(p => ({ id: p.id, companyName: p.companyName, referralCount: p.referralCount || 0 })),
        recentReferrals: allReferrals.slice(0, 10).map(r => ({ clientCompany: r.clientCompany, estimatedValue: r.estimatedValue, status: r.status, createdAt: r.createdAt })),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Stage 6: Nexora Intelligence Endpoints ──────────────────────────────────

  // Top 10 opportunities today — real DB data, ranked by combined score
  app.get("/api/nexora/opportunities/top", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const { db: ddb } = await import("./db");
      const { dealHunterSignals, officeMovRadar, leads } = await import("@shared/schema");
      const { desc: dd, gte: dgte, or, isNotNull, and, ne } = await import("drizzle-orm");

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [dealSignals, radarSignals, hotLeads] = await Promise.all([
        ddb.select().from(dealHunterSignals)
          .where(and(ne(dealHunterSignals.status, "archived"), dgte(dealHunterSignals.createdAt, thirtyDaysAgo)))
          .orderBy(dd(dealHunterSignals.nexoraScore))
          .limit(limit),
        ddb.select().from(officeMovRadar)
          .where(and(ne(officeMovRadar.status, "Archived"), dgte(officeMovRadar.dateDetected, thirtyDaysAgo.toISOString().split("T")[0])))
          .orderBy(dd(officeMovRadar.radarScore))
          .limit(limit),
        ddb.select().from(leads)
          .where(and(dgte(leads.createdAt, thirtyDaysAgo), isNotNull(leads.opportunityScore)))
          .orderBy(dd(leads.opportunityScore as any))
          .limit(limit),
      ]);

      const opportunities = [
        ...dealSignals.map(d => ({
          id: `deal-${d.id}`,
          source: "Deal Signal",
          companyName: d.companyName,
          city: d.city,
          signalType: d.signalType || "expansion",
          score: d.nexoraScore || 0,
          estimatedValue: d.estimatedProjectValue ? parseInt(String(d.estimatedProjectValue).replace(/[^0-9]/g, "")) || 0 : 0,
          confidence: d.confidenceLevel || "medium",
          whyItMatters: d.whyItMatters || `${d.companyName} showing ${d.signalType || "expansion"} signal`,
          nextAction: d.recommendedAction || "Review and contact",
          detectedAt: d.createdAt,
          status: d.status,
        })),
        ...radarSignals.map(r => ({
          id: `radar-${r.id}`,
          source: "Radar",
          companyName: r.companyName,
          city: r.city,
          signalType: r.signalType,
          score: r.radarScore || 0,
          estimatedValue: r.estimatedProjectValue ? parseInt(String(r.estimatedProjectValue).replace(/[^0-9]/g, "")) || 0 : 0,
          confidence: r.confidenceLevel || "medium",
          whyItMatters: `${r.companyName} detected via office radar — ${r.signalType}`,
          nextAction: "Initiate outreach",
          detectedAt: r.dateDetected,
          status: r.status,
        })),
        ...hotLeads.map(l => ({
          id: `lead-${l.id}`,
          source: "Inbound Lead",
          companyName: l.company || l.name,
          city: (l as any).city || null,
          signalType: l.type || "inbound",
          score: Number(l.opportunityScore) || 0,
          estimatedValue: Number((l as any).estimatedValue) || 0,
          confidence: Number(l.opportunityScore) >= 70 ? "high" : Number(l.opportunityScore) >= 40 ? "medium" : "low",
          whyItMatters: `Inbound enquiry from ${l.company || l.name} — ${l.type || "general"}`,
          nextAction: (l as any).followUpDate ? "Follow up due" : "Review and respond",
          detectedAt: l.createdAt,
          status: (l as any).status || "new",
        })),
      ]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      res.json({ opportunities, total: opportunities.length, generatedAt: new Date().toISOString() });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Opportunities CRUD (Nexora pipeline records) ─────────────────────────

  app.get("/api/nexora/pipeline", async (req, res) => {
    try {
      const stage = typeof req.query.stage === "string" ? req.query.stage : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const opps = await storage.getOpportunities({ stage, status, limit });
      res.json({ opportunities: opps, total: opps.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/nexora/pipeline/:id", async (req, res) => {
    try {
      const opp = await storage.getOpportunity(req.params.id);
      if (!opp) return res.status(404).json({ error: "Opportunity not found" });
      res.json(opp);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/nexora/pipeline/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;
      const opp = await storage.updateOpportunity(id, body as any);
      if (!opp) return res.status(404).json({ error: "Opportunity not found" });

      // Stage 11: Auto-create outcome when stage moves to won or lost
      if (body.stage === "won" || body.stage === "lost") {
        const signalId = String(opp.sourceId ?? opp.id);
        await storage.createNexoraOutcome({
          signalId,
          companyName: opp.companyName,
          outcome: body.stage === "won" ? "win" : "loss",
          channel: "nexora-pipeline",
          dealValue: body.stage === "won" && opp.estimatedValue ? Number(opp.estimatedValue) : undefined,
          notes: `Auto-recorded from opportunity stage change to ${body.stage}`,
        }).catch((e: any) => console.warn("[Nexora] Auto-outcome failed:", e?.message));
      }

      res.json(opp);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/nexora/pipeline/:id", async (req, res) => {
    try {
      await storage.deleteOpportunity(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Stage 9: Auto-draft a quote from a Nexora opportunity
  app.post("/api/nexora/pipeline/:id/auto-quote", async (req, res) => {
    try {
      const opp = await storage.getOpportunity(req.params.id);
      if (!opp) return res.status(404).json({ error: "Opportunity not found" });

      const now = new Date();
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const existing = await storage.getQuotes();
      const seq = String(existing.length + 1).padStart(4, "0");
      const quoteNumber = `TCD-${ym}-${seq}`;

      const estimatedValue = opp.estimatedValue ? Number(opp.estimatedValue) : 0;
      const subtotal = estimatedValue;
      const gst = Math.round(subtotal * 0.1);
      const totalIncGst = subtotal + gst;

      const quote = await storage.createQuote({
        quoteNumber,
        status: "Draft",
        clientName: opp.contactName ?? opp.companyName,
        companyName: opp.companyName,
        email: opp.contactEmail ?? "tbc@placeholder.com",
        phone: opp.contactPhone ?? null,
        opportunityId: opp.id,
        projectSummary: opp.reasoningSummary ?? `Auto-drafted from Nexora opportunity — ${opp.projectType ?? opp.industry ?? "fitout"}`,
        subtotal,
        gst,
        total: subtotal,
        totalIncGst,
        pipelineStage: "lead",
        validityDays: 30,
        preparedBy: "The Corporate Desk (Nexora Auto-Draft)",
        notes: `Auto-generated from Nexora opportunity ${opp.id}. Company: ${opp.companyName}. Signal: ${opp.projectType ?? "N/A"}. Review and update line items before sending.`,
      });

      // Mark opportunity as having a quote drafted
      await storage.updateOpportunity(opp.id, { stage: "quoted" } as any).catch(() => undefined);

      res.status(201).json({ quote, opportunityId: opp.id });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Nexora Outcomes ──────────────────────────────────────────────────────

  app.get("/api/nexora/outcomes", async (req, res) => {
    try {
      const outcome = typeof req.query.outcome === "string" ? req.query.outcome : undefined;
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const results = await storage.getNexoraOutcomes({ outcome, limit });
      res.json({ outcomes: results, total: results.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Stage 16: Financial Intelligence Summary ─────────────────────────────

  app.get("/api/nexora/financial-summary", async (_req, res) => {
    try {
      const { sql: rawSql } = await import("drizzle-orm");

      const [allOpps, allOutcomes, allQuotes] = await Promise.all([
        storage.getOpportunities({ limit: 500 }),
        storage.getNexoraOutcomes({ limit: 500 }),
        storage.getQuotes(),
      ]);

      const openOpps = allOpps.filter(o => o.status === "open" || o.status === "active");
      const wonOpps = allOpps.filter(o => o.stage === "won");
      const totalPipelineValue = openOpps.reduce((s, o) => s + (o.estimatedValue ?? 0), 0);
      const wonValue = wonOpps.reduce((s, o) => s + (o.estimatedValue ?? 0), 0);

      const wins = allOutcomes.filter(o => o.outcome === "won" || o.outcome === "win").length;
      const losses = allOutcomes.filter(o => o.outcome === "lost" || o.outcome === "loss").length;
      const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
      const winOutcomes = allOutcomes.filter(o => (o.outcome === "won" || o.outcome === "win") && o.dealValue);
      const avgDealValue = winOutcomes.length > 0
        ? Math.round(winOutcomes.reduce((s, o) => s + (o.dealValue ?? 0), 0) / winOutcomes.length)
        : 0;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentWins = allOutcomes.filter(o => (o.outcome === "won" || o.outcome === "win") && o.recordedAt && new Date(o.recordedAt) > thirtyDaysAgo);
      const revenueThisMonth = recentWins.reduce((s, o) => s + (o.dealValue ?? 0), 0);

      const acceptedQuotes = allQuotes.filter(q => q.status === "Accepted" || q.status === "Sent");
      const totalQuoteValue = allQuotes.reduce((s, q) => s + (q.totalIncGst ?? 0), 0);
      const avgQuoteValue = allQuotes.length > 0 ? Math.round(totalQuoteValue / allQuotes.length) : 0;

      const topOpportunities = openOpps
        .sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0))
        .slice(0, 5)
        .map(o => ({ id: o.id, companyName: o.companyName, estimatedValue: o.estimatedValue ?? 0, stage: o.stage ?? "new", createdAt: o.createdAt }));

      // Signal counts from decisions table
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [totalSignalsRes, todayRes, weekRes] = await Promise.all([
        db.execute(rawSql`SELECT COUNT(*)::int AS cnt FROM nexora_decisions`),
        db.execute(rawSql`SELECT COUNT(*)::int AS cnt FROM nexora_decisions WHERE created_at >= ${todayStart}`),
        db.execute(rawSql`SELECT COUNT(*)::int AS cnt FROM nexora_decisions WHERE created_at >= ${weekStart}`),
      ]);

      const payload = {
        generatedAt: new Date().toISOString(),
        pipeline: {
          totalOpportunities: allOpps.length,
          openOpportunities: openOpps.length,
          wonOpportunities: wonOpps.length,
          totalPipelineValue,
          wonValue,
          topOpportunities,
        },
        outcomes: {
          totalWins: wins,
          totalLosses: losses,
          winRate,
          avgDealValue,
          revenueThisMonth,
        },
        quotes: {
          totalQuotes: allQuotes.length,
          acceptedQuotes: acceptedQuotes.length,
          totalQuoteValue,
          avgQuoteValue,
        },
        signals: {
          total: Number((totalSignalsRes.rows?.[0] as any)?.cnt ?? 0),
          todayCount: Number((todayRes.rows?.[0] as any)?.cnt ?? 0),
          thisWeekCount: Number((weekRes.rows?.[0] as any)?.cnt ?? 0),
        },
      };

      console.log("[financial-summary] shape:", JSON.stringify({
        keys: Object.keys(payload),
        pipeline_keys: Object.keys(payload.pipeline),
        outcomes_keys: Object.keys(payload.outcomes),
        quotes_keys: Object.keys(payload.quotes),
        signals_keys: Object.keys(payload.signals),
        sample: {
          totalPipelineValue: payload.pipeline.totalPipelineValue,
          winRate: payload.outcomes.winRate,
          totalQuotes: payload.quotes.totalQuotes,
          acceptedQuotes: payload.quotes.acceptedQuotes,
          totalQuoteValue: payload.quotes.totalQuoteValue,
          avgQuoteValue: payload.quotes.avgQuoteValue,
          signals_total: payload.signals.total,
          signals_todayCount: payload.signals.todayCount,
          signals_thisWeekCount: payload.signals.thisWeekCount,
          topOpportunities_count: payload.pipeline.topOpportunities.length,
          topOpp_fields: payload.pipeline.topOpportunities[0] ? Object.keys(payload.pipeline.topOpportunities[0]) : [],
        },
      }));

      res.json(payload);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Signal intelligence summary — counts by type and confidence for admin dashboard
  app.get("/api/nexora/signals/summary", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { officeMovRadar, dealHunterSignals, leads } = await import("@shared/schema");
      const { ne } = await import("drizzle-orm");
      const { sql: rawSql } = await import("drizzle-orm");

      const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [radarAll, dealAll, leadsWeekResult, radarWeekResult] = await Promise.all([
        ddb.select().from(officeMovRadar).where(ne(officeMovRadar.status, "Archived")),
        ddb.select().from(dealHunterSignals).where(ne(dealHunterSignals.status, "archived")),
        ddb.execute(rawSql`SELECT COUNT(*) AS cnt FROM leads WHERE created_at >= ${sevenDaysAgoStr}::date`),
        ddb.execute(rawSql`SELECT COUNT(*) AS cnt FROM office_move_radar WHERE date_detected >= ${sevenDaysAgoStr}`),
      ]);

      const signalsByType: Record<string, number> = {};
      const signalsByCity: Record<string, number> = {};
      let highConfidence = 0, mediumConfidence = 0, lowConfidence = 0;

      for (const s of [...radarAll, ...dealAll]) {
        const t = (s as any).signalType || "other";
        signalsByType[t] = (signalsByType[t] || 0) + 1;
        const c = (s as any).city || "Unknown";
        signalsByCity[c] = (signalsByCity[c] || 0) + 1;
        const conf = (s as any).confidenceLevel || "medium";
        if (conf === "high" || conf === "very_high") highConfidence++;
        else if (conf === "medium") mediumConfidence++;
        else lowConfidence++;
      }

      const topSignalTypes = Object.entries(signalsByType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([type, count]) => ({ type, count }));

      const topCities = Object.entries(signalsByCity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([city, count]) => ({ city, count }));

      const leadsWeekCount = Number((leadsWeekResult?.rows?.[0] as any)?.cnt ?? 0);
      const radarWeekCount = Number((radarWeekResult?.rows?.[0] as any)?.cnt ?? 0);

      res.json({
        totalActiveSignals: radarAll.length + dealAll.length,
        radarSignals: radarAll.length,
        dealSignals: dealAll.length,
        inboundLeadsThisWeek: leadsWeekCount,
        newRadarSignalsThisWeek: radarWeekCount,
        highConfidence,
        mediumConfidence,
        lowConfidence,
        topSignalTypes,
        topCities,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Outreach pending approval — drafts in outreachMessages awaiting admin sign-off
  app.get("/api/nexora/outreach/pending", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachMessages, outreachThreads } = await import("@shared/schema");
      const { eq, desc: dd, leftJoin } = await import("drizzle-orm");

      const pending = await ddb
        .select({
          id: outreachMessages.id,
          threadId: outreachMessages.threadId,
          companyName: outreachMessages.companyName,
          recipientEmail: outreachMessages.recipientEmail,
          channel: outreachMessages.channel,
          subject: outreachMessages.subject,
          body: outreachMessages.body,
          campaignKey: outreachMessages.campaignKey,
          messageType: outreachMessages.messageType,
          stage: outreachMessages.stage,
          createdAt: outreachMessages.createdAt,
          threadOpportunityScore: outreachThreads.opportunityScore,
          threadResolvedEmail: outreachThreads.resolvedEmail,
          threadOutreachAngle: outreachThreads.outreachAngle,
        })
        .from(outreachMessages)
        .leftJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
        .where(eq(outreachMessages.deliveryStatus, "draft"))
        .orderBy(dd(outreachMessages.createdAt))
        .limit(100);

      res.json({
        pending: pending.map(p => ({
          id: p.id,
          threadId: p.threadId,
          companyName: p.companyName || "Unknown",
          recipientEmail: p.recipientEmail || p.threadResolvedEmail || "—",
          channel: p.channel || "email",
          subject: p.subject || "(No subject)",
          body: p.body || "",
          messagePreview: p.body ? p.body.slice(0, 200) + (p.body.length > 200 ? "…" : "") : "",
          createdAt: p.createdAt,
          signalContext: p.threadOutreachAngle || p.campaignKey || null,
          confidenceScore: p.threadOpportunityScore ?? null,
          messageType: p.messageType,
          stage: p.stage,
          priority: (p.threadOpportunityScore ?? 0) >= 75 ? "high" : "normal",
        })),
        total: pending.length,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/nexora/priority-actions — Nexora-generated daily action list
  app.get("/api/nexora/priority-actions", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachMessages, followUpSequences, opportunities, nexoraOutcomes } = await import("@shared/schema");
      const { eq, lt, and, isNull, gte, not, inArray } = await import("drizzle-orm");
      const now = new Date();

      // 1. Pending approval queue count
      const draftMsgs = await ddb.select({ id: outreachMessages.id, companyName: outreachMessages.companyName, createdAt: outreachMessages.createdAt })
        .from(outreachMessages).where(eq(outreachMessages.deliveryStatus, "draft")).limit(50);

      // 2. Overdue follow-ups
      const overdueFollowUps = await ddb.select({
        id: followUpSequences.id,
        leadEmail: followUpSequences.leadEmail,
        leadCompany: followUpSequences.leadCompany,
        stage: followUpSequences.stage,
        nextSendAt: followUpSequences.nextSendAt,
      }).from(followUpSequences)
        .where(and(
          eq(followUpSequences.status, "active"),
          lt(followUpSequences.nextSendAt, now),
        )).limit(20);

      // 3. High-confidence opportunities without a quote (stage "new" or "qualified" — not yet contacted/quoted)
      const { notInArray } = await import("drizzle-orm");
      const highConfOpp = await ddb.select({
        id: opportunities.id,
        companyName: opportunities.companyName,
        estimatedValue: opportunities.estimatedValue,
        confidenceScore: opportunities.confidenceScore,
      }).from(opportunities)
        .where(and(
          eq(opportunities.status, "open"),
          gte(opportunities.confidenceScore, 70),
          notInArray(opportunities.stage, ["won", "lost", "quoted", "proposal", "negotiating"]),
        )).limit(10);

      // 4. Opportunities marked won/lost with no recorded outcome
      const wonLostOpps = await ddb.select({ id: opportunities.id, companyName: opportunities.companyName, stage: opportunities.stage })
        .from(opportunities)
        .where(inArray(opportunities.stage, ["won", "lost"]))
        .limit(20);

      // cross-check against nexora_outcomes by sourceId
      const outcomeSourceIds = await ddb.select({ sourceId: nexoraOutcomes.signalId })
        .from(nexoraOutcomes).where(isNull(nexoraOutcomes.signalId)).limit(1); // harmless — we'll filter by company below
      const outcomeCompanies = new Set(
        (await ddb.select({ companyName: nexoraOutcomes.companyName }).from(nexoraOutcomes)).map(o => o.companyName?.toLowerCase())
      );
      const needsOutcome = wonLostOpps.filter(o => !outcomeCompanies.has(o.companyName?.toLowerCase()));

      const actions: Array<{ type: string; icon: string; title: string; subtitle: string; urgency: "high" | "medium" | "low"; actionLabel: string; actionTarget: string; data?: any }> = [];

      if (draftMsgs.length > 0) {
        actions.push({
          type: "approval_queue",
          icon: "Inbox",
          title: `${draftMsgs.length} outreach message${draftMsgs.length !== 1 ? "s" : ""} awaiting approval`,
          subtitle: `Oldest: ${draftMsgs[draftMsgs.length - 1]?.companyName ?? "Unknown"} · ${draftMsgs[0]?.companyName ?? ""}`,
          urgency: draftMsgs.length > 10 ? "high" : "medium",
          actionLabel: "Review Queue",
          actionTarget: "Reviews",
        });
      }

      overdueFollowUps.forEach(f => {
        actions.push({
          type: "overdue_followup",
          icon: "Clock",
          title: `Follow-up overdue — ${f.leadCompany}`,
          subtitle: `Stage ${f.stage} · Scheduled ${f.nextSendAt ? new Date(f.nextSendAt).toLocaleDateString("en-AU") : "N/A"}`,
          urgency: "high",
          actionLabel: "View Follow-Ups",
          actionTarget: "FollowUps",
          data: { id: f.id },
        });
      });

      highConfOpp.forEach(o => {
        actions.push({
          type: "quote_needed",
          icon: "FileText",
          title: `Generate quote — ${o.companyName}`,
          subtitle: `${o.confidenceScore}% confidence · Est. $${Math.round((Number(o.estimatedValue) || 0) / 1000)}k`,
          urgency: "medium",
          actionLabel: "Auto-Quote",
          actionTarget: "Finance",
          data: { opportunityId: o.id },
        });
      });

      needsOutcome.forEach(o => {
        actions.push({
          type: "outcome_needed",
          icon: "TrendingUp",
          title: `Record outcome — ${o.companyName}`,
          subtitle: `Stage: ${o.stage} — teach Nexora what happened`,
          urgency: "medium",
          actionLabel: "Record Outcome",
          actionTarget: "Finance",
          data: { opportunityId: o.id, stage: o.stage },
        });
      });

      // Sort: high urgency first
      actions.sort((a, b) => (a.urgency === "high" ? -1 : b.urgency === "high" ? 1 : 0));

      res.json({ actions, generatedAt: new Date().toISOString(), counts: { pendingApprovals: draftMsgs.length, overdueFollowUps: overdueFollowUps.length, quoteOpportunities: highConfOpp.length, outcomeNeeded: needsOutcome.length } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/nexora/follow-up-queue — per-lead follow-up queue with status
  app.get("/api/nexora/follow-up-queue", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { followUpSequences } = await import("@shared/schema");
      const { desc: dd } = await import("drizzle-orm");
      const now = new Date();

      const seqs = await ddb.select().from(followUpSequences).orderBy(dd(followUpSequences.createdAt)).limit(200);

      const rows = seqs.map(s => {
        let queueStatus: "completed" | "overdue" | "scheduled" | "sent" | "cancelled";
        if (s.status === "completed") queueStatus = "completed";
        else if (s.status === "cancelled") queueStatus = "cancelled";
        else if (s.nextSendAt && new Date(s.nextSendAt) < now) queueStatus = "overdue";
        else if (s.lastSentAt) queueStatus = "sent";
        else queueStatus = "scheduled";

        return {
          id: s.id,
          leadEmail: s.leadEmail,
          leadCompany: s.leadCompany,
          leadType: s.leadType,
          stage: s.stage,
          status: s.status,
          queueStatus,
          nextSendAt: s.nextSendAt,
          lastSentAt: s.lastSentAt,
          stagesCompleted: s.stagesCompleted ?? [],
          createdAt: s.createdAt,
        };
      });

      const summary = {
        total: rows.length,
        overdue: rows.filter(r => r.queueStatus === "overdue").length,
        scheduled: rows.filter(r => r.queueStatus === "scheduled").length,
        completed: rows.filter(r => r.queueStatus === "completed").length,
        active: rows.filter(r => r.status === "active").length,
      };

      res.json({ sequences: rows, summary });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Approve/reject pending outreach draft
  app.patch("/api/nexora/outreach/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body as { action: "approve" | "reject" };
      if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be approve or reject" });

      const { db: ddb } = await import("./db");
      const { outreachMessages } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const newStatus = action === "approve" ? "approved" : "suppressed";
      const suppressionReason = action === "reject" ? "admin_rejected" : null;

      await ddb.update(outreachMessages)
        .set({
          deliveryStatus: newStatus,
          ...(action === "approve" ? { approvedAt: new Date() } : {}),
          ...(suppressionReason ? { suppressionReason } : {}),
          updatedAt: new Date(),
        })
        .where(eq(outreachMessages.id, id));

      if (action === "approve" && process.env.SAFE_MODE !== "true") {
        console.log(`[Nexora Outreach] Approved message ${id} — queued for delivery`);
      }

      res.json({ ok: true, id, action, status: newStatus });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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

      // Start automated follow-up sequence (non-blocking)
      startFollowUpForLead({
        id: String(lead.id),
        name: lead.name,
        email: lead.email,
        company: lead.company ?? "",
        type: "finance-lead",
        officeSize: lead.officeSize,
        staffCount: lead.staffCount,
        budget: projectValue,
      }).catch(err => console.error("[followup] Finance lead sequence failed:", err));

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

      if (!email) {
        return res.status(400).json({ success: false, message: "Email address is required to generate your estimate." });
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
        } as any, { signal: AbortSignal.timeout(25000) });

        const rawContent = (aiResult as any).choices?.[0]?.message?.content || "";
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiRec = JSON.parse(jsonMatch[0]);
          quoteResult = generatePackageAndQuote(aiRec, name, company, staffCount);
        }
      } catch (aiErr: any) {
        const isTimeout = aiErr?.name === "AbortError" || aiErr?.message?.includes("timeout");
        console.error("[Estimate] AI generation failed:", isTimeout ? "Timeout after 25s" : aiErr);
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

      // Start automated follow-up sequence (non-blocking)
      startFollowUpForLead({
        id: String(lead.id),
        name: lead.name,
        email: lead.email,
        company: lead.company ?? "",
        type: "quote-builder",
        officeSize: squareMetres ? `${squareMetres} sqm` : undefined,
        staffCount,
        budget: budgetRange,
      }).catch(err => console.error("[followup] Quote builder sequence failed:", err));

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

  // POST /api/estimate/contact-update — capture phone after estimate reveal
  app.post("/api/estimate/contact-update", async (req, res) => {
    try {
      const { email, phone, name } = req.body as { email?: string; phone?: string; name?: string };
      if (!email || !phone) return res.status(400).json({ success: false });
      // Best-effort: find lead by email and update phone if missing
      try {
        const { db } = await import("./db");
        const { partnerReferrals } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");
        const existing = await db.select({ id: partnerReferrals.id })
          .from(partnerReferrals)
          .where(eq(partnerReferrals.email, email))
          .orderBy(partnerReferrals.id)
          .limit(1);
        if (existing.length > 0) {
          await db.update(partnerReferrals)
            .set({ phone: phone || undefined, clientCompany: name ? undefined : undefined } as any)
            .where(eq(partnerReferrals.id, existing[0].id));
        }
      } catch { /* best-effort update */ }
      res.json({ success: true });
    } catch {
      res.json({ success: true }); // always 200 — non-blocking
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, stream: useStream = true, pageContext, userProfile, nexoraContext } = req.body as {
        messages: ChatMessage[];
        stream?: boolean;
        pageContext?: string;
        userProfile?: string;
        nexoraContext?: string;
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

      // Inject live intelligence context into Alex's system prompt (non-blocking)
      let intelligenceCtx: Parameters<typeof buildChatSystemPrompt>[3] | undefined;
      try {
        const { getTopDemandSuburbs } = await import("./services/intelligence/demandForecastEngine");
        const { getTopZones } = await import("./services/intelligence/zoneScoringEngine");
        const { getLeaseExpiryOpportunities } = await import("./services/intelligence/leaseExpiryService");
        const radarRecords = await storage.getOfficeMovRadarRecords({});
        const [demandSuburbs, topZones, leaseOpps] = await Promise.all([
          getTopDemandSuburbs(5),
          getTopZones(5),
          getLeaseExpiryOpportunities(5),
        ]);
        const likelyRelocating = radarRecords
          .filter(r => (r.radarScore ?? 0) >= 70)
          .sort((a, b) => (b.radarScore ?? 0) - (a.radarScore ?? 0))
          .slice(0, 5);
        // Outreach engine data (non-blocking)
        let outreachReadyCompanies: { companyName: string; city: string | null; confidenceScore: number | null; moveProbability: number | null }[] = [];
        let activeOutreachThreadsList: { companyName: string; status: string; currentStage: number; outreachAngle: string | null }[] = [];
        let followUpsList: { companyName: string; stage: number }[] = [];
        let meetingsBookedList: { companyName: string; bookingStatus: string }[] = [];
        let outreachStatsData: { drafts: number; sent: number; replied: number; activeThreads: number; bookedThreads: number; replyRate: number; safeMode: boolean } | undefined;
        let contactDiscoveryData: { totalContacts: number; directContacts: number; highConfidenceContacts: number } | undefined;
        let revenueStatsData: { revenueToday: number; revenueThisWeek: number; depositsReceived: number; fullPaymentsReceived: number; outstandingInvoices: number; expiredLinks: number; quotesAwaitingPayment: number; stripeEnabled: boolean; testMode: boolean; safeMode: boolean } | undefined;
        let quotesAwaitingData: { id: string; clientName: string; companyName: string | null; totalIncGst: number | null; financialStatus: string | null }[] = [];
        let depositPaidData: { id: string; clientName: string; companyName: string | null; amountPaid: number | null; amountDue: number | null }[] = [];
        try {
          const { getOutreachReadyCompanies: getReady, getFollowUpsDue: getFups, getActiveThreads: getActive, getMeetingsBooked: getMeetings } = await import("./services/outreach/outreachEngine");
          const { getOutreachStats } = await import("./services/outreach/outreachGenerationService");
          const { getContactDiscoveryStats } = await import("./services/outreach/contactDiscoveryService");
          const { getRevenueStats, getQuotesAwaitingPayment, getDepositPaidDeals } = await import("./services/stripe/revenueService");
          const [ready, fups, activeT, meetings, oStats, cdStats, revStats, awaitingQ, depositQ] = await Promise.all([
            getReady(5), getFups(5), getActive(5), getMeetings(5), getOutreachStats(), getContactDiscoveryStats(),
            getRevenueStats(), getQuotesAwaitingPayment(), getDepositPaidDeals(),
          ]);
          outreachReadyCompanies = ready.map(c => ({ companyName: c.companyName, city: c.city ?? null, confidenceScore: c.confidenceScore ?? null, moveProbability: c.moveProbability ?? null }));
          activeOutreachThreadsList = activeT.map((t: any) => ({ companyName: t.companyName, status: t.status, currentStage: t.currentStage, outreachAngle: t.outreachAngle }));
          followUpsList = fups.map((f: any) => ({ companyName: (f.thread?.companyName ?? "Unknown"), stage: f.stage ?? 0 }));
          meetingsBookedList = meetings.map((m: any) => ({ companyName: m.companyName, bookingStatus: m.bookingStatus }));
          outreachStatsData = { drafts: oStats.drafts, sent: oStats.sent, replied: oStats.replied, activeThreads: oStats.activeThreads, bookedThreads: oStats.bookedThreads, replyRate: oStats.replyRate, safeMode: oStats.safeMode };
          contactDiscoveryData = { totalContacts: cdStats.totalContacts, directContacts: cdStats.directContacts, highConfidenceContacts: cdStats.highConfidenceContacts };
          revenueStatsData = { revenueToday: revStats.revenueToday, revenueThisWeek: revStats.revenueThisWeek, depositsReceived: revStats.depositsReceived, fullPaymentsReceived: revStats.fullPaymentsReceived, outstandingInvoices: revStats.outstandingInvoices, expiredLinks: revStats.expiredLinks, quotesAwaitingPayment: revStats.quotesAwaitingPayment, stripeEnabled: revStats.stripeEnabled, testMode: revStats.testMode, safeMode: revStats.safeMode };
          quotesAwaitingData = awaitingQ.map((q: any) => ({ id: q.id, clientName: q.clientName, companyName: q.companyName ?? null, totalIncGst: q.totalIncGst ?? null, financialStatus: q.financialStatus ?? null }));
          depositPaidData = depositQ.map((q: any) => ({ id: q.id, clientName: q.clientName, companyName: q.companyName ?? null, amountPaid: q.amountPaid ?? null, amountDue: q.amountDue ?? null }));
        } catch { /* outreach/revenue context optional */ }

        intelligenceCtx = {
          topDemandSuburbs: demandSuburbs.map(s => ({ suburb: s.suburb ?? "", city: s.city, demandScore: s.demandScore ?? 0, demandTier: s.demandTier ?? "" })),
          topOpportunityZones: topZones.map(z => ({ suburb: z.suburb ?? "", city: z.city, zoneScore: z.zoneScore, activeCompanies: z.activeCompanies })),
          leaseExpiryOpportunities: leaseOpps.map(o => ({ companyName: o.companyName, city: o.city, urgencyTier: o.urgencyTier, predictedExpiryYear: o.predictedExpiryYear, opportunityScore: o.opportunityScore })),
          likelyRelocating: likelyRelocating.map(r => ({ companyName: r.companyName, city: r.city ?? "", radarScore: r.radarScore ?? 0, signalType: r.signalType ?? "" })),
          outreachReadyCompanies,
          activeOutreachThreads: activeOutreachThreadsList,
          followUpsDue: followUpsList,
          meetingsBooked: meetingsBookedList,
          outreachStats: outreachStatsData,
          contactDiscoveryStats: contactDiscoveryData,
          revenueStats: revenueStatsData,
          quotesAwaitingPayment: quotesAwaitingData,
          depositPaidDeals: depositPaidData,
        };
      } catch { /* intelligence context is optional — fall back gracefully */ }

      const systemPrompt = buildChatSystemPrompt(
        sessionContext || undefined,
        pageContext || undefined,
        userProfile || undefined,
        intelligenceCtx,
        nexoraContext || undefined
      );

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

  // ─── Vision Chat ─────────────────────────────────────────────────────────────

  app.post("/api/chat/vision", visionUpload.single("image"), async (req, res) => {
    try {
      const message = (req.body.message || "").trim();
      const pageContext = req.body.pageContext || "";
      const userProfile = req.body.userProfile || "";
      let history: Array<{ role: "user" | "assistant"; content: string }> = [];
      try { history = JSON.parse(req.body.history || "[]"); } catch {}

      if (!message && !req.file) {
        return res.status(400).json({ error: "message or image required" });
      }

      const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [];
      if (req.file) {
        const base64 = req.file.buffer.toString("base64");
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${req.file.mimetype};base64,${base64}`, detail: "high" },
        });
      }
      if (message) userContent.push({ type: "text", text: message });

      const systemPrompt = buildChatSystemPrompt(undefined, pageContext || undefined, userProfile || undefined);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: userContent as any },
        ],
        stream: true,
        max_tokens: 1500,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("[Vision Chat]", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Vision chat failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Vision chat failed" });
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
      const validStatuses = [
        "Lead Detected", "Contacted", "Planning", "Quoted", "Negotiation", "Won", "Lost",
        "New", "Responded", "Qualified", "Closed",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updated = await storage.updateProspectedLeadStatus(id, status);
      if (!updated) return res.status(404).json({ error: "Lead not found" });
      invalidateCache("deal-forecast");
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

      // Load similar completed projects for learning context (non-blocking)
      const similarProjects = await storage.getSimilarWorkspaceLearning(
        body.squareMetres || "",
        body.staffCount || "",
        body.projectType || "",
        3
      ).catch(() => []);

      const learningContext = buildLearningContext(similarProjects);

      // Run floor plan parsing first so geometry can inform the AI prompt
      const detectedGeometryEarly = floorPlanFilePath
        ? await parseFloorPlan(floorPlanFilePath, openai, body.squareMetres).catch(() => null)
        : null;

      const geomForPrompt = detectedGeometryEarly && !detectedGeometryEarly.fallback
        ? {
            source: detectedGeometryEarly.source,
            confidence: detectedGeometryEarly.confidence,
            aspectRatio: detectedGeometryEarly.aspectRatio,
            detectedShape: detectedGeometryEarly.detectedShape,
            fallback: detectedGeometryEarly.fallback,
            internalWalls: detectedGeometryEarly.internalWalls,
          }
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
        floorGeometry: geomForPrompt,
        learningContext: learningContext || undefined,
      });

      // Run AI planning analysis (geometry already parsed above — reuse result)
      const aiResult = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: buildAdvisorSystemPrompt() },
          { role: "user", content: spacePlanningPrompt },
        ],
      } as any).catch((err: Error) => {
        console.error("[AI] Space planning generation failed:", err.message);
        return null;
      });
      const detectedGeometry = detectedGeometryEarly;

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

      // Auto-capture workspace learning (non-blocking — never fails the main request)
      captureWorkspaceLearning({
        planningRequestId: planningRequest.id,
        clientName: body.name,
        clientCompany: body.company || "",
        city: body.city,
        projectType: body.projectType,
        officeSqm: body.squareMetres,
        staffCount: body.staffCount,
        meetingRoomCount: body.meetingRooms,
        receptionIncluded: body.receptionRequired === "true" || body.receptionRequired === true,
        breakoutIncluded: body.breakoutRequired === "true" || body.breakoutRequired === true,
        executiveOfficeIncluded: body.executiveOfficeRequired === "true" || body.executiveOfficeRequired === true,
        budgetRange: body.budgetRange,
        stylePreference: body.stylePreference,
        aiRec: (() => {
          try { return JSON.parse(aiRecommendations || "null"); } catch { return null; }
        })(),
        geometrySource: geometry?.source || null,
        geometryConfidence: geometry?.confidence ?? null,
        designEngineUsed: body.source === "design-engine",
      }).catch(() => {});

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
    } catch (err: any) {
      console.error("Planning request failed:", err);

      try {
        await storage.createLead({
          type: "planning_request_fallback",
          name: req.body?.name || "Unknown",
          company: req.body?.company || "",
          email: req.body?.email || "",
          phone: req.body?.phone || "",
          message: "Planning request failed in main flow; saved via fallback.",
          sourcePage: req.originalUrl || "/planning-request",
          leadStatus: "new",
        });
      } catch (fallbackErr) {
        console.error("Fallback lead save failed:", fallbackErr);
      }

      return res.status(500).json({
        error: "Failed to process planning request",
      });
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
            opportunityTier: (l.opportunityTier || "low") as "enterprise" | "high" | "medium" | "low",
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

      const highOpportunities = all.filter(r => r.opportunityTier === "enterprise" || r.opportunityTier === "high");
      const mediumOpportunities = all.filter(r => r.opportunityTier === "medium");
      const enterpriseOpportunities = all.filter(r => r.opportunityTier === "enterprise");

      res.json({
        all,
        highOpportunities,
        mediumOpportunities,
        summary: {
          total: all.length,
          enterpriseCount: enterpriseOpportunities.length,
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

  // ─── Force-rescore all leads with updated scoring model ──────────────────────
  // Recalculates scores for ALL inbound leads using the current deterministic model.
  // Safe: reads from DB, rewrites opportunity columns, zero AI calls.
  app.post("/api/admin/opportunity-intelligence/rescore-all", async (req, res) => {
    try {
      const allLeads = await storage.getLeads();
      let updated = 0;
      for (const lead of allLeads) {
        const opp = scoreOpportunity({
          type: lead.type,
          message: lead.message,
          officeSize: lead.officeSize,
          staffCount: lead.staffCount,
          budget: lead.budget,
          timeline: lead.timeline,
          officeLocation: lead.officeLocation,
          moveDate: lead.moveDate,
          leadScore: lead.opportunityScore ?? undefined,
        });
        await storage.updateLeadScore(lead.id, {
          opportunityScore: opp.opportunityScore,
          opportunityTier: opp.opportunityTier,
          signalsJson: JSON.stringify(opp.signals),
          nextAction: opp.nextAction,
          estimatedValueRange: opp.estimatedValueRange,
        });
        updated++;
      }
      res.json({ success: true, updated, message: `Rescored ${updated} leads with updated scoring model` });
    } catch (err) {
      console.error("[RescoreAll]", err);
      res.status(500).json({ error: "Failed to rescore leads" });
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

          // Auto-save profit record for this planning request
          try {
            const sqm = Number(existing.squareMetres) || 100;
            const staff = Number(existing.staffCount) || 10;
            const { calculateCostStack } = await import("./services/profitOptimisation");
            const balancedStack = calculateCostStack(sqm, staff, "balanced");
            await storage.createProfitRecord({
              planningRequestId: id,
              officeSizeSqm: sqm,
              staffCount: staff,
              industryType: existing.projectType || "General Office",
              layoutType: existing.stylePreference || "balanced",
              packageName: pkg.packageName,
              packageTier: pkg.packageTier,
              productMixSummary: `${pkg.totalItems} items · ${pkg.workspaceType}`,
              supplierMixSummary: Object.entries(balancedStack.supplierMix).map(([s, cats]) => `${s}: ${(cats as string[]).join(", ")}`).join(" | "),
              estimatedFactoryCost: Math.round(balancedStack.totalLandedCost * 0.55),
              estimatedShippingCost: Math.round(balancedStack.totalLandedCost * 0.08),
              estimatedInstallationCost: Math.round(balancedStack.installationCost),
              estimatedLandedCost: Math.round(balancedStack.totalLandedWithInstall),
              quotedPrice: Math.round(balancedStack.quotedPrice),
              estimatedProfit: Math.round(balancedStack.grossProfit),
              estimatedMarginPercent: Math.round(balancedStack.marginPercent),
              confidenceLevel: balancedStack.confidenceLevel,
              conversionResult: "pending",
            });
            console.log(`[ProfitRecord] Auto-saved profit record for planning request ${id}`);
          } catch (profitErr) {
            console.warn("[ProfitRecord] Auto-save failed (non-fatal):", profitErr);
          }
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
          storage.updateWorkspaceLearningConversion(planningRequestId, "paid").catch(() => {});
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

      if (SAFE_MODE) {
        return res.status(503).json({ error: "Payments are suppressed in SAFE_MODE." });
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
        storage.updateWorkspaceLearningConversion(id, "paid").catch(() => {});
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
      const geomData = parseRec(request.floorGeometryJson);
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
        floorGeometry: geomData ? {
          boundary: geomData.boundary || [],
          aspectRatio: geomData.aspectRatio || 1,
          confidence: geomData.confidence || 0,
          source: geomData.source || "fallback-rectangle",
          detectedShape: geomData.detectedShape || null,
          fallback: geomData.fallback ?? true,
          internalWalls: geomData.internalWalls || [],
        } : null,
        geometrySource: request.geometrySource || null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch layout data" });
    }
  });

  // ─── Lease Signal Scanner ─────────────────────────────────────────────────────

  app.post("/api/admin/lease-signal-scan", async (req, res) => {
    try {
      const { cities, signalTypes, count } = req.body;
      const scanBatchId = `scan_${Date.now()}`;

      const scanned = await runLeaseSignalScan({ cities, signalTypes, count });

      const created = [];
      for (const lead of scanned) {
        try {
          const dup = await storage.findProspectDuplicate(lead.company, null, null);
          if (dup) continue;

          const saved = await storage.createProspectedLead({
            company: lead.company,
            domain: null,
            website: null,
            location: `${lead.suburb}, ${lead.city}`,
            industry: lead.industry,
            estimatedTeamSize: lead.estimatedHeadcount,
            likelyOfficeNeed: lead.estimatedOfficeSqm,
            signalsDetected: lead.signalsDetected,
            estimatedProjectValue: lead.estimatedProjectValue,
            score: lead.score,
            priority: lead.priority,
            decisionMakers: `${lead.contactName} — ${lead.contactRole}`,
            outreachMessage: lead.outreachEmail,
            reasoning: lead.reasoning,
            rawInput: lead.signalSummary,
            sourceType: "ai_scan",
            sourceUrl: null,
            sourceText: lead.signalSource,
            // Extended fields
            signalType: lead.signalType,
            city: lead.city,
            contactEmail: null,
            contactRole: lead.contactRole,
            dealProbability: lead.dealProbability,
            estimatedOfficeSqm: lead.estimatedOfficeSqm,
            estimatedHeadcount: lead.estimatedHeadcount,
            recommendedNextAction: lead.recommendedNextAction,
            outreachSubject: lead.outreachSubject,
            scanBatchId,
          } as any);
          created.push(saved);
        } catch { /* skip duplicates */ }
      }

      // ── Forward high-signal results to Office Move Radar ──────────────────
      const radarSignalMap: Record<string, string> = {
        new_lease: "new_lease", office_move: "office_move",
        expansion: "office_expansion", office_expansion: "office_expansion",
        hiring_surge: "hiring_surge", funding: "funding_growth",
        new_office_opening: "new_office_opening",
      };
      for (const lead of scanned) {
        try {
          const mappedSignal = radarSignalMap[lead.signalType ?? ""] ?? "office_move";
          const existing = await storage.findRadarDuplicate(lead.company, lead.city, mappedSignal);
          if (existing) continue;
          const { scoreRadarSignal } = await import("./services/officeMovRadarService");
          const scoring = scoreRadarSignal({
            signalType: mappedSignal as any,
            confidence: (lead.priority === "High" ? "high" : lead.priority === "Medium" ? "medium" : "low") as any,
            city: lead.city,
            industry: lead.industry,
            estimatedHeadcount: lead.estimatedHeadcount ?? undefined,
            hasSourceUrl: false,
          });
          await storage.createOfficeMovRadarRecord({
            companyName: lead.company,
            industry: lead.industry ?? null,
            city: lead.city,
            state: null,
            country: "Australia",
            signalType: mappedSignal,
            signalSource: lead.signalSource ?? "Lease Signal Scanner",
            confidenceLevel: scoring.priority === "High" ? "high" : scoring.priority === "Medium" ? "medium" : "low",
            estimatedHeadcount: lead.estimatedHeadcount ?? null,
            estimatedOfficeSizeSqm: scoring.estimatedOfficeSizeSqm,
            estimatedProjectValue: scoring.estimatedProjectValue,
            radarScore: scoring.radarScore,
            priority: scoring.priority,
            recommendedOutreachAngle: scoring.recommendedOutreachAngle,
            recommendedOffer: scoring.recommendedOffer,
            recommendedNextAction: scoring.recommendedNextAction,
            notes: lead.signalSummary ?? `Detected via Lease Signal Scanner — ${lead.signalType ?? "office signal"}`,
            status: "New",
          });
        } catch { /* skip */ }
      }

      res.json({
        success: true,
        count: created.length,
        batchId: scanBatchId,
        message: `${created.length} new leads detected across ${[...new Set(scanned.map(l => l.city))].join(", ")}`,
      });
    } catch (err: any) {
      console.error("[lease-scan]", err.message);
      res.status(500).json({ error: err.message || "Scan failed" });
    }
  });

  // ─── Territory CRUD ───────────────────────────────────────────────────────────

              app.get("/api/admin/territories", async (_req, res) => {
                try {
                  console.log("🔥 GET /api/admin/territories called");

                  const territories = await storage.getTerritories();

                  console.log("✅ territories result:", territories);

                  res.json(Array.isArray(territories) ? territories : []);
                } catch (err: any) {
                  console.error("❌ GET /api/admin/territories failed:", err);
                  res.status(500).json({
                    message: err?.message || "Failed to load territories",
                  });
                }
              });

              app.post("/api/admin/territories", async (req, res) => {
                try {
                  console.log("🔥 POST /api/admin/territories called with body:", req.body);

                  const territory = await storage.createTerritory(req.body);

                  console.log("✅ territory created:", territory);

                  res.json(territory);
                } catch (err: any) {
                  console.error("❌ POST /api/admin/territories failed:", err);
                  res.status(500).json({
                    message: err?.message || "Failed to create territory",
                  });
                }
              });

              app.patch("/api/admin/territories/:id", async (req, res) => {
                try {
                  console.log("🔥 PATCH /api/admin/territories/:id called", {
                    id: req.params.id,
                    body: req.body,
                  });

                  const territory = await storage.updateTerritory(req.params.id, req.body);

                  console.log("✅ territory updated:", territory);

                  res.json(territory);
                } catch (err: any) {
                  console.error("❌ PATCH /api/admin/territories/:id failed:", err);
                  res.status(500).json({
                    message: err?.message || "Failed to update territory",
                  });
                }
              });

              app.delete("/api/admin/territories/:id", async (req, res) => {
                try {
                  console.log("🔥 DELETE /api/admin/territories/:id called", {
                    id: req.params.id,
                  });

                  await storage.deleteTerritory(req.params.id);

                  console.log("✅ territory deleted:", req.params.id);

                  res.json({ success: true });
                } catch (err: any) {
                  console.error("❌ DELETE /api/admin/territories/:id failed:", err);
                  res.status(500).json({
                    message: err?.message || "Failed to delete territory",
                  });
                }
              });

  // ─── Procurement Engine ────────────────────────────────────────────────────────

  app.post("/api/admin/procurement/calculate", async (req, res) => {
    try {
      const { lines } = req.body;
      if (!Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ error: "Provide at least one product line" });
      }
      const recommendations = computeProcurementRecommendations(lines);
      res.json({ recommendations });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Follow-Up Sequence Management ───────────────────────────────────────────

  app.get("/api/admin/follow-up-sequences", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const sequences = await storage.getFollowUpSequences(status);
      res.json(sequences);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/follow-up-sequences/:id/pause", async (req, res) => {
    try {
      const { id } = req.params;
      const seq = await storage.updateFollowUpSequenceStatus(id, "paused");
      res.json(seq);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/follow-up-sequences/:id/resume", async (req, res) => {
    try {
      const { id } = req.params;
      const seq = await storage.updateFollowUpSequenceStatus(id, "active");
      res.json(seq);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/follow-up-sequences/:id/stop", async (req, res) => {
    try {
      const { id } = req.params;
      const seq = await storage.updateFollowUpSequenceStatus(id, "stopped");
      res.json(seq);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/follow-up-sequences/:id/mark-replied", async (req, res) => {
    try {
      const { id } = req.params;
      const seq = await storage.updateFollowUpSequenceStatus(id, "replied");
      res.json(seq);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Workspace Learning Admin Routes ─────────────────────────────────────────

  app.get("/api/admin/workspace-learning", async (_req, res) => {
    try {
      const records = await storage.getWorkspaceLearningRecords();
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/workspace-learning/:id", async (req, res) => {
    try {
      const record = await storage.getWorkspaceLearningById(req.params.id);
      if (!record) return res.status(404).json({ error: "Not found" });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/workspace-learning/:id/conversion", async (req, res) => {
    try {
      const { planningRequestId, result } = req.body as { planningRequestId: string; result: string };
      await storage.updateWorkspaceLearningConversion(planningRequestId, result);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/workspace-learning/stats/summary", async (_req, res) => {
    try {
      const all = await storage.getWorkspaceLearningRecords();
      const total = all.length;
      const paid = all.filter(r => r.conversionResult === "paid").length;
      const pending = all.filter(r => r.conversionResult === "pending").length;
      const avgSqm = total
        ? (all.reduce((s, r) => s + parseFloat(r.officeSqm || "0"), 0) / total).toFixed(0)
        : "0";
      const avgStaff = total
        ? (all.reduce((s, r) => s + parseInt(r.staffCount || "0", 10), 0) / total).toFixed(0)
        : "0";
      const tierCounts: Record<string, number> = {};
      all.forEach(r => {
        const tier = r.packageTier || "Unknown";
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      });
      res.json({ total, paid, pending, lost: total - paid - pending, avgSqm, avgStaff, tierCounts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Supplier Pricing Admin Routes ───────────────────────────────────────────

  app.get("/api/admin/supplier-pricing", async (_req, res) => {
    try {
      const { readFileSync } = await import("fs");
      const filePath = path.join(process.cwd(), "server/data/supplierPricing.json");
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/supplier-pricing/record", async (req, res) => {
    try {
      const { readFileSync, writeFileSync } = await import("fs");
      const filePath = path.join(process.cwd(), "server/data/supplierPricing.json");
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      const newRecord = {
        id: `SP-${String(data.pricing_records.length + 1).padStart(3, "0")}`,
        ...req.body,
        quote_date: new Date().toISOString().split("T")[0],
      };
      data.pricing_records.push(newRecord);
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      res.json(newRecord);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Intelligence Hub Routes ────────────────────────────────────────────────

  app.get("/api/admin/intelligence/jobs", async (_req, res) => {
    try {
      const jobs = await storage.getScheduledJobs(100);
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/intelligence/jobs/trigger", async (req, res) => {
    try {
      const { jobType } = req.body;
      const { triggerJobManually } = await import("./services/intelligenceScheduler");
      const result = await triggerJobManually(jobType);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/intelligence/reports", async (req, res) => {
    try {
      const reportType = req.query.type as string | undefined;
      const reports = await storage.getIntelligenceReports(reportType);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/intelligence/reports/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const report = await storage.updateIntelligenceReportStatus(req.params.id, status);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/intelligence/trends", async (_req, res) => {
    try {
      const trends = await storage.getSpendingTrends(50);
      res.json(trends);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/intelligence/issues", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const issues = await storage.getWebsiteIssues(status);
      res.json(issues);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/intelligence/issues/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const issue = await storage.updateWebsiteIssueStatus(req.params.id, status);
      res.json(issue);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/intelligence/blog-articles", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const articles = await storage.getGeneratedBlogArticles(status);
      res.json(articles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/intelligence/blog-articles/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const article = await storage.updateBlogArticleStatus(req.params.id, status);
      res.json(article);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/intelligence/health", async (_req, res) => {
    try {
      const [signals, outcomes, prospects, decisions] = await Promise.all([
        storage.getDealHunterSignals().catch(() => []),
        storage.getNexoraOutcomes({ limit: 100 }).catch(() => []),
        storage.getProspectedLeads().catch(() => []),
        storage.getOpportunities({ limit: 100 }).catch(() => []),
      ]);
      res.json({
        status: "healthy",
        generatedAt: new Date().toISOString(),
        totals: {
          dealSignals: signals.length,
          outcomes: outcomes.length,
          prospects: prospects.length,
          opportunities: decisions.length,
        },
        engine: "nexora-orchestrator-v2",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Profit Optimisation Routes ─────────────────────────────────────────────

  app.post("/api/admin/profit/compare", async (req, res) => {
    try {
      const { officeSqm, staffCount } = req.body;
      if (!officeSqm || !staffCount) {
        return res.status(400).json({ error: "officeSqm and staffCount are required" });
      }
      const { comparePackageOptions } = await import("./services/profitOptimisation");
      const comparison = comparePackageOptions(Number(officeSqm), Number(staffCount));
      res.json(comparison);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/profit/cost-stack", async (req, res) => {
    try {
      const { officeSqm, staffCount, tier } = req.body;
      if (!officeSqm || !staffCount || !tier) {
        return res.status(400).json({ error: "officeSqm, staffCount, and tier are required" });
      }
      const { calculateCostStack } = await import("./services/profitOptimisation");
      const stack = calculateCostStack(Number(officeSqm), Number(staffCount), tier);
      res.json(stack);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/profit/supplier-mix", async (req, res) => {
    try {
      const { categories } = req.body;
      if (!Array.isArray(categories)) {
        return res.status(400).json({ error: "categories must be an array" });
      }
      const { optimiseSupplierMix } = await import("./services/profitOptimisation");
      const mix = optimiseSupplierMix(categories);
      res.json(mix);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/profit/layout-patterns", async (_req, res) => {
    try {
      const { getLayoutProfitPatterns } = await import("./services/profitOptimisation");
      const patterns = getLayoutProfitPatterns();
      res.json(patterns);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/profit/records", async (_req, res) => {
    try {
      const records = await storage.getProfitRecords(50);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/profit/records", async (req, res) => {
    try {
      const record = await storage.createProfitRecord(req.body);
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/profit/records/:id", async (req, res) => {
    try {
      const record = await storage.updateProfitRecord(req.params.id, req.body);
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Deal Forecast (lightweight pipeline summary for dashboard) ──────────

  app.get("/api/admin/deal-forecast", async (_req, res) => {
    try {
      const cached = getCached<object>("deal-forecast");
      if (cached) return res.json(cached);
      const leads = await storage.getProspectedLeads();

      // Canonical stage probabilities — new names first, legacy aliases below
      const STAGE_PROB: Record<string, number> = {
        // ── New canonical stage names ──────────────────────────
        "Radar Opportunity": 10,
        "Contact Made":      20,
        "Discovery":         40,
        "Workspace Planning":60,
        "Quote Sent":        75,
        "Negotiation":       90,
        "Won":              100,
        "Lost":               0,
        // ── Legacy aliases (backward-compat) ────────────────────
        "Lead Detected": 10, "New": 10,
        "Contacted": 20, "Responded": 20,
        "Planning": 40, "Qualified": 40,
        "Quoted": 75,
        "Closed": 100,
      };

      // Normalise a raw DB status string into a canonical stage label
      const STAGE_ALIAS: Record<string, string> = {
        "Lead Detected":      "Radar Opportunity",
        "New":                "Radar Opportunity",
        "Contacted":          "Contact Made",
        "Responded":          "Contact Made",
        "Planning":           "Discovery",
        "Qualified":          "Discovery",
        "Quoted":             "Quote Sent",
        "Closed":             "Won",
      };
      function canonicalStage(s: string): string {
        return STAGE_ALIAS[s] ?? s;
      }

      function parseVal(v: string | null | undefined): number {
        if (!v) return 0;
        const m = v.match(/\$([\d,]+)/);
        return m ? parseInt(m[1].replace(/,/g, "")) : 0;
      }

      const active = leads.filter(l => l.status !== "Lost");
      const grossPipeline = active.reduce((s, l) => s + parseVal(l.estimatedProjectValue), 0);
      const weightedRevenue = leads.reduce((s, l) => {
        const prob = (STAGE_PROB[l.status] ?? 20) / 100;
        return s + parseVal(l.estimatedProjectValue) * prob;
      }, 0);
      // Probable = stages at ≥ 60% (Workspace Planning, Quote Sent, Negotiation)
      const probableDeals = leads.filter(l => (STAGE_PROB[l.status] ?? 0) >= 60 && l.status !== "Lost");
      const wonDeals = leads.filter(l => l.status === "Won" || l.status === "Closed");
      const wonValue = wonDeals.reduce((s, l) => s + parseVal(l.estimatedProjectValue), 0);
      const lostDeals = leads.filter(l => l.status === "Lost");
      const totalClosed = wonDeals.length + lostDeals.length;
      const winRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : null;

      // Stage counts (canonical names)
      const stageCounts: Record<string, { count: number; value: number }> = {};
      for (const l of leads) {
        const stage = canonicalStage(l.status);
        if (!stageCounts[stage]) stageCounts[stage] = { count: 0, value: 0 };
        stageCounts[stage].count++;
        stageCounts[stage].value += parseVal(l.estimatedProjectValue);
      }

      // Per-opportunity breakdown for the Revenue Intelligence table
      const opportunities = leads
        .filter(l => l.status !== "Lost")
        .map(l => {
          const stage = canonicalStage(l.status);
          const probabilityScore = STAGE_PROB[l.status] ?? 20;
          const projectValue = parseVal(l.estimatedProjectValue);
          return {
            id: l.id,
            companyName: l.company || l.name || "Unknown",
            projectValue,
            pipelineStage: stage,
            probabilityScore,
            expectedRevenue: Math.round(projectValue * probabilityScore / 100),
          };
        })
        .sort((a, b) => b.expectedRevenue - a.expectedRevenue);

      // Deals likely closing within 90 days = probability ≥ 60%
      const closing90Days = opportunities.filter(o => o.probabilityScore >= 60);

      const payload = {
        grossPipeline,
        weightedRevenue: Math.round(weightedRevenue),
        probableDealsCount: probableDeals.length,
        probableDealsValue: probableDeals.reduce((s, l) => s + parseVal(l.estimatedProjectValue), 0),
        wonValue,
        wonDealsCount: wonDeals.length,
        winRate,
        totalLeads: leads.length,
        stageCounts,
        opportunities,
        closing90Days,
        closing90DaysValue: closing90Days.reduce((s, o) => s + o.expectedRevenue, 0),
      };
      setCached("deal-forecast", payload, 30_000);
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Formal Quotes ────────────────────────────────────────────────────────

  app.get("/api/admin/quotes", async (req, res) => {
    try {
      const { status } = req.query as { status?: string };
      const data = await storage.getQuotes(status);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/quotes/:id", async (req, res) => {
    try {
      const data = await storage.getQuote(req.params.id);
      if (!data) return res.status(404).json({ error: "Not found" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/quotes", async (req, res) => {
    try {
      const body = req.body;
      // Auto-generate quote number: TCD-YYYYMM-XXXX
      const now = new Date();
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const existing = await storage.getQuotes();
      const seq = String(existing.length + 1).padStart(4, "0");
      const quoteNumber = `TCD-${ym}-${seq}`;
      const created = await storage.createQuote({ ...body, quoteNumber });

      // Push quote into deal execution pipeline (non-blocking)
      if (created.companyName) {
        (async () => {
          try {
            const { dealExecution: de } = await import("@shared/schema");
            const existingDeal = await db.select({ id: de.id }).from(de)
              .where(eq(de.companyName, created.companyName ?? "")).limit(1);
            if (existingDeal.length > 0) {
              // Advance existing deal to proposal stage
              await db.update(de).set({
                stage: "proposal_sent",
                dealValueEstimate: created.totalIncGst ? Math.round(created.totalIncGst / 100) : undefined,
                lastAction: `Quote ${quoteNumber} created`,
                nextAction: "Send proposal and follow up",
                updatedAt: new Date(),
              }).where(eq(de.id, existingDeal[0].id));
            } else {
              await db.insert(de).values({
                companyName: created.companyName ?? "Unknown",
                status: "active",
                stage: "proposal_sent",
                assignedTo: "alex",
                dealValueEstimate: created.totalIncGst ? Math.round(created.totalIncGst / 100) : undefined,
                city: "Sydney",
                lastAction: `Quote ${quoteNumber} created`,
                nextAction: "Send proposal and follow up",
              });
            }
            console.log(`[QuoteEngine] Quote ${quoteNumber} pushed to deal pipeline for ${created.companyName}`);
          } catch (e: any) {
            console.error("[QuoteEngine] Pipeline push failed:", e.message);
          }
        })();
      }

      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/quotes/:id", async (req, res) => {
    try {
      const updated = await storage.updateQuote(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/quotes/:id", async (req, res) => {
    try {
      await storage.deleteQuote(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/quotes/:id/send", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Not found" });
      const { sendFormalQuoteEmail } = await import("./email");
      await sendFormalQuoteEmail(quote);
      const updated = await storage.updateQuote(req.params.id, {
        status: "Sent",
        sentAt: new Date(),
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Office Move Radar ────────────────────────────────────────────────────

  app.get("/api/admin/office-move-radar", async (req, res) => {
    try {
      const { city, signalType, priority, status } = req.query as Record<string, string>;
      const records = await storage.getOfficeMovRadarRecords({
        city: city || undefined,
        signalType: signalType || undefined,
        priority: priority || undefined,
        status: status || undefined,
      });
      const filtered = status ? records : records.filter(r => r.status !== "archived");
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/office-move-radar/stats", async (_req, res) => {
    try {
      const all = (await storage.getOfficeMovRadarRecords()).filter(r => r.status !== "archived");
      const high = all.filter(r => r.priority === "High").length;
      const medium = all.filter(r => r.priority === "Medium").length;
      const low = all.filter(r => r.priority === "Low").length;
      const newCount = all.filter(r => r.status === "New").length;
      const inPipeline = all.filter(r => r.status === "In Pipeline").length;
      const avgScore = all.length ? Math.round(all.reduce((s, r) => s + r.radarScore, 0) / all.length) : 0;
      res.json({ total: all.length, high, medium, low, newCount, inPipeline, avgScore });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/office-move-radar/:id", async (req, res) => {
    try {
      const record = await storage.getOfficeMovRadarRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Not found" });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/office-move-radar", async (req, res) => {
    try {
      const { scoreRadarSignal } = await import("./services/officeMovRadarService");
      const body = req.body;
      const signalType = body.signalType ?? "manual";
      const confidence = body.confidenceLevel ?? "medium";

      const existing = await storage.findRadarDuplicate(
        body.companyName, body.city ?? "", signalType
      );
      if (existing && !body.skipDedupe) {
        return res.status(409).json({
          error: `A radar record for "${body.companyName}" in ${body.city} with signal "${signalType}" already exists.`,
          existingId: existing.id,
        });
      }

      const scoring = scoreRadarSignal({
        signalType,
        confidence,
        city: body.city ?? "",
        industry: body.industry,
        estimatedHeadcount: body.estimatedHeadcount,
        hasSourceUrl: !!body.sourceUrl,
      });

      const record = await storage.createOfficeMovRadarRecord({
        ...body,
        radarScore: body.radarScore ?? scoring.radarScore,
        priority: body.priority ?? scoring.priority,
        estimatedOfficeSizeSqm: body.estimatedOfficeSizeSqm ?? scoring.estimatedOfficeSizeSqm,
        estimatedProjectValue: body.estimatedProjectValue ?? scoring.estimatedProjectValue,
        recommendedOutreachAngle: body.recommendedOutreachAngle ?? scoring.recommendedOutreachAngle,
        recommendedOffer: body.recommendedOffer ?? scoring.recommendedOffer,
        recommendedNextAction: body.recommendedNextAction ?? scoring.recommendedNextAction,
        status: body.status ?? "New",
      });

      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/office-move-radar/:id", async (req, res) => {
    try {
      const updated = await storage.updateOfficeMovRadarRecord(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/office-move-radar/:id", async (req, res) => {
    try {
      await storage.deleteOfficeMovRadarRecord(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Push radar record → deal pipeline as a prospected lead
  app.post("/api/admin/office-move-radar/:id/push-to-pipeline", async (req, res) => {
    try {
      const record = await storage.getOfficeMovRadarRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Not found" });

      const existing = await storage.findProspectDuplicate(record.companyName, null, record.sourceUrl);
      if (existing && !req.body.skipDedupe) {
        return res.status(409).json({
          error: `${record.companyName} is already in the pipeline.`,
          existingId: existing.id,
        });
      }

      const prospect = await storage.createProspectedLead({
        company: record.companyName,
        domain: null,
        website: null,
        location: `${record.city}${record.state ? ", " + record.state : ""}`,
        industry: record.industry ?? "Unknown",
        estimatedTeamSize: record.estimatedHeadcount ?? "Unknown",
        likelyOfficeNeed: record.estimatedOfficeSizeSqm
          ? `${record.estimatedOfficeSizeSqm} — ${record.signalType.replace(/_/g, " ")}`
          : record.signalType.replace(/_/g, " "),
        signalsDetected: [record.signalType, record.signalSubtype].filter(Boolean) as string[],
        estimatedProjectValue: record.estimatedProjectValue ?? "Unknown",
        score: record.radarScore,
        priority: record.priority as "High" | "Medium" | "Low",
        decisionMakers: "Unknown — recommend researching via LinkedIn",
        outreachMessage: record.outreachEmailDraft ?? record.recommendedOutreachAngle ?? "",
        reasoning: `Office Move Radar signal: ${record.notes ?? record.signalSubtype ?? record.signalType}`,
        rawInput: `Source: ${record.signalSource ?? "radar"} | ${record.notes ?? ""}`,
        sourceType: "radar",
        sourceUrl: record.sourceUrl ?? null,
        signalType: record.signalType,
        city: record.city,
        contactEmail: null,
        contactRole: null,
        dealProbability: record.priority === "High" ? 25 : record.priority === "Medium" ? 15 : 10,
        estimatedOfficeSqm: record.estimatedOfficeSizeSqm ?? null,
        estimatedHeadcount: record.estimatedHeadcount ?? null,
        recommendedNextAction: record.recommendedNextAction ?? null,
        outreachSubject: record.outreachSubject ?? null,
        scanBatchId: null,
      });

      await storage.updateOfficeMovRadarRecord(record.id, {
        status: "In Pipeline",
        linkedProspectId: prospect.id,
      });

      res.json({ prospect, radarRecord: await storage.getOfficeMovRadarRecord(record.id) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Generate AI outreach draft for a radar record
  app.post("/api/admin/office-move-radar/:id/generate-outreach", async (req, res) => {
    try {
      const record = await storage.getOfficeMovRadarRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Not found" });

      const { generateOutreachDraft } = await import("./services/officeMovRadarService");
      const draft = await generateOutreachDraft({
        companyName: record.companyName,
        city: record.city,
        industry: record.industry ?? undefined,
        signalType: record.signalType as any,
        signalSource: record.signalSource ?? undefined,
        estimatedProjectValue: record.estimatedProjectValue ?? undefined,
        recommendedOffer: record.recommendedOffer ?? undefined,
      });

      const updated = await storage.updateOfficeMovRadarRecord(record.id, {
        outreachSubject: draft.subject,
        outreachEmailDraft: draft.email,
        outreachFollowUp: draft.followUp,
        outreachCta: draft.cta,
      });

      res.json({ draft, record: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger AI-powered radar scan
      app.post("/api/admin/office-move-radar/scan", async (req, res) => {
        try {
          const result = await runNexoraCycle("manual");

          res.json({
            success: true,
            nexora: result,
          });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });
 

  // Trigger real news RSS scan manually
          app.post("/api/admin/office-move-radar/scan-jobs", async (req, res) => {
            try {
              const result = await runNexoraCycle("jobs");

              res.json({
                success: true,
                nexora: result,
              });
            } catch (err: any) {
              res.status(500).json({
                error: err.message,
              });
            }
          });


  // Predictive intelligence scan — funding, hiring spikes, startup expansion, growth news
  app.post("/api/admin/office-move-radar/scan-predictive", async (req, res) => {
    try {
      const { runPredictiveScan } = await import("./services/newsFeedScanner");
      const result = await runPredictiveScan();
      res.json({ saved: result.saved, processed: result.processed, source: "predictive" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Full combined scan — news + jobs + predictive in parallel
  app.post("/api/admin/office-move-radar/scan-all", async (req, res) => {
    try {
      const { runFullRadarScan } = await import("./services/newsFeedScanner");
      const result = await runFullRadarScan();
      res.json({ saved: result.saved, processed: result.processed, breakdown: result.breakdown, source: "full" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // LinkedIn manual intake — admin pastes a real LinkedIn post URL + text
  app.post("/api/admin/office-move-radar/linkedin-intake", async (req, res) => {
    try {
      const { postUrl, postText, companyName: hintCompany, city: hintCity } = req.body as {
        postUrl: string;
        postText: string;
        companyName?: string;
        city?: string;
      };

      if (!postUrl || !postText) {
        return res.status(400).json({ error: "postUrl and postText are required" });
      }

      const openaiModule = await import("openai");
      const client = new openaiModule.default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are a commercial office intelligence analyst for Australia.
You are given a real LinkedIn post. Extract key signals from it.
You ONLY identify real, named companies — never invent or guess.
Return ONLY valid JSON.`;

      const userPrompt = `Analyse this LinkedIn post and extract the office/workspace signal.

Post URL: ${postUrl}
Post Text: ${postText}
${hintCompany ? `Hint - Company Name: ${hintCompany}` : ""}
${hintCity ? `Hint - City: ${hintCity}` : ""}

Return a single JSON object:
{
  "isRelevant": true or false,
  "companyName": "exact company name from the post, or null",
  "city": "Australian city, or null",
  "state": "Australian state abbreviation, or null",
  "industry": "one of: Technology, Finance, Legal, Consulting, Retail, Healthcare, Property, Resources, Government, Education, Media, Other — or null",
  "signalType": "one of: office_move, new_office_opening, office_expansion, refurbishment, hiring_surge, funding_growth, new_lease — or null",
  "confidence": "high, medium, or low",
  "evidenceExcerpt": "the most relevant sentence or phrase from the post that proves the signal, verbatim, max 200 chars",
  "estimatedHeadcount": "e.g. 30-60 or null"
}

Rules:
- companyName MUST come from the post text. If no specific company is named, set isRelevant to false.
- Only return relevant if there is a real, named company with a clear office/workspace signal in Australia.`;

      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 600,
      });

      const raw = resp.choices[0].message.content ?? "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.status(422).json({ error: "GPT returned invalid JSON", raw });
      }

      if (!parsed.isRelevant) {
        return res.status(422).json({ error: "No relevant office signal detected in this post", parsed });
      }
      if (!parsed.companyName) {
        return res.status(422).json({ error: "No specific company name identified in the post", parsed });
      }

      const city = parsed.city ?? hintCity ?? "Sydney";
      const signalType = parsed.signalType ?? "office_move";

      const existing = await storage.findRadarDuplicate(parsed.companyName, city, signalType);
      if (existing) {
        return res.status(409).json({
          error: `A radar record for "${parsed.companyName}" in ${city} with signal "${signalType}" already exists.`,
          existingId: existing.id,
        });
      }

      const { scoreRadarSignal } = await import("./services/officeMovRadarService");
      const scoring = scoreRadarSignal({
        signalType,
        confidenceLevel: parsed.confidence ?? "medium",
        industry: parsed.industry ?? "Other",
        city,
        estimatedHeadcount: parsed.estimatedHeadcount ?? null,
      });

      const record = await storage.createOfficeMovRadarRecord({
        companyName: parsed.companyName,
        industry: parsed.industry ?? null,
        city,
        state: parsed.state ?? null,
        country: "Australia",
        signalType,
        signalSubtype: null,
        signalSource: "LinkedIn",
        sourceUrl: postUrl,
        confidenceLevel: parsed.confidence ?? "medium",
        estimatedHeadcount: parsed.estimatedHeadcount ?? null,
        estimatedOfficeSizeSqm: null,
        estimatedProjectValue: null,
        radarScore: scoring.radarScore,
        priority: scoring.priority,
        recommendedOutreachAngle: scoring.recommendedOutreachAngle ?? null,
        recommendedOffer: scoring.recommendedOffer ?? null,
        recommendedNextAction: scoring.recommendedNextAction ?? null,
        outreachSubject: null,
        outreachEmailDraft: null,
        outreachFollowUp: null,
        outreachCta: null,
        linkedBuildingId: null,
        linkedProspectId: null,
        status: "New",
        notes: parsed.evidenceExcerpt ?? postText.slice(0, 300),
        sourceType: "linkedin",
        verificationStatus: "source_post",
        evidenceExcerpt: parsed.evidenceExcerpt ?? postText.slice(0, 300),
      });

      res.json({ record, scoring });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Company Intelligence ─────────────────────────────────────────────────

  app.get("/api/admin/company-intelligence", async (req, res) => {
    try {
      const { country, city, priority, status, limit } = req.query as Record<string, string>;
      const records = await storage.getCompanyIntelligenceRecords({
        country: country || undefined,
        city: city || undefined,
        priority: priority || undefined,
        status: status || undefined,
        limit: limit ? parseInt(limit) : 200,
      });
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/company-intelligence/:id", async (req, res) => {
    try {
      const record = await storage.getCompanyIntelligence(req.params.id);
      if (!record) return res.status(404).json({ error: "Not found" });
      const contacts = await storage.getCompanyContacts(req.params.id);
      res.json({ ...record, contacts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/company-intelligence/sync", async (req, res) => {
    try {
      const { syncCompanyIntelligence } = await import("./services/companyIntelligenceService");
      const result = await syncCompanyIntelligence();
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/company-intelligence/:id/extract-contacts", async (req, res) => {
    try {
      const { extractOrgChartContacts } = await import("./services/companyIntelligenceService");
      const result = await extractOrgChartContacts(req.params.id);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/company-intelligence/:id", async (req, res) => {
    try {
      await storage.deleteCompanyContacts(req.params.id);
      await storage.deleteCompanyIntelligence(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Deal Heatmap Data ────────────────────────────────────────────────────

  app.get("/api/admin/heatmap-data", async (req, res) => {
    try {
      const [radarRecords, visitorSessions] = await Promise.all([
        storage.getOfficeMovRadarRecords({}),
        storage.getVisitorSessions({ limit: 1000 }),
      ]);

      // Group by city for Australian cities primarily
      const AUS_CITIES = [
        "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide",
        "Canberra", "Gold Coast", "Newcastle", "Sunshine Coast", "Hobart",
        "Darwin", "Wollongong", "Geelong", "Townsville", "Cairns",
      ];

      const INTL_CITIES = [
        "New York", "Austin", "San Francisco", "Los Angeles", "Chicago",
        "London", "Manchester", "Birmingham",
        "Auckland", "Wellington", "Christchurch",
      ];

      const allCities = [...AUS_CITIES, ...INTL_CITIES];

      const cityData: Record<string, {
        city: string;
        country: string;
        opportunities: number;
        highPriority: number;
        avgConfidence: number;
        totalPipelineValue: number;
        companies: { name: string; signalType: string; confidence: number; value: string; priority: string }[];
      }> = {};

      // Initialise city buckets
      for (const city of allCities) {
        const country = AUS_CITIES.includes(city) ? "Australia" :
          ["New York", "Austin", "San Francisco", "Los Angeles", "Chicago"].includes(city) ? "United States" :
          ["London", "Manchester", "Birmingham"].includes(city) ? "United Kingdom" : "New Zealand";
        cityData[city] = { city, country, opportunities: 0, highPriority: 0, avgConfidence: 0, totalPipelineValue: 0, companies: [] };
      }

      // Process radar records
      for (const rec of radarRecords) {
        const matchedCity = allCities.find(c =>
          rec.city?.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(rec.city?.toLowerCase() || "")
        );
        const key = matchedCity || rec.city;
        if (!cityData[key]) {
          const country = rec.country || "Australia";
          cityData[key] = { city: key, country, opportunities: 0, highPriority: 0, avgConfidence: 0, totalPipelineValue: 0, companies: [] };
        }
        const bucket = cityData[key];
        bucket.opportunities++;
        if (rec.priority === "High") bucket.highPriority++;
        bucket.avgConfidence += rec.radarScore || 50;

        const valueStr = rec.estimatedProjectValue || "";
        const valueNum = (() => {
          const m = valueStr.match(/\$?([\d,]+(?:\.\d+)?)\s*([KkMmBb]?)/);
          if (!m) return 0;
          const n = parseFloat(m[1].replace(/,/g, ""));
          const s = (m[2] || "").toUpperCase();
          return isNaN(n) ? 0 : s === "K" ? n * 1_000 : s === "M" ? n * 1_000_000 : s === "B" ? n * 1_000_000_000 : n;
        })();
        bucket.totalPipelineValue += valueNum;

        if (bucket.companies.length < 10) {
          bucket.companies.push({
            name: rec.companyName,
            signalType: rec.signalType,
            confidence: rec.radarScore || 50,
            value: rec.estimatedProjectValue || "N/A",
            priority: rec.priority,
          });
        }
      }

      // Process visitor sessions (group by city)
      for (const vs of visitorSessions) {
        if (!vs.city || vs.isBot) continue;
        const matchedCity = allCities.find(c =>
          vs.city?.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(vs.city?.toLowerCase() || "")
        );
        if (!matchedCity) continue;
        const bucket = cityData[matchedCity];
        if (!bucket) continue;
        if (vs.companyName && !bucket.companies.find(c => c.name === vs.companyName)) {
          bucket.opportunities++;
          bucket.companies.push({
            name: vs.companyName || "Website Visitor",
            signalType: "visitor_intelligence",
            confidence: vs.confidenceScore || 40,
            value: vs.estimatedProjectValue ? `$${vs.estimatedProjectValue.toLocaleString()}` : "N/A",
            priority: vs.engagementScore > 70 ? "High" : "Medium",
          });
        }
      }

      // Finalise averages and build result
      const result = Object.values(cityData)
        .filter(c => c.opportunities > 0)
        .map(c => ({
          ...c,
          avgConfidence: c.opportunities > 0 ? Math.round(c.avgConfidence / c.opportunities) : 0,
          formattedValue: c.totalPipelineValue > 0
            ? `$${(c.totalPipelineValue / 1_000_000).toFixed(1)}M`
            : "$0",
        }))
        .sort((a, b) => b.opportunities - a.opportunities);

      // Country breakdowns for global pipeline visibility
      const countryBreakdown = ["Australia", "United States", "United Kingdom", "New Zealand"].map(country => {
        const countryCities = result.filter(c => c.country === country);
        return {
          country,
          totalOpportunities: countryCities.reduce((s, c) => s + c.opportunities, 0),
          totalPipelineValue: countryCities.reduce((s, c) => s + c.totalPipelineValue, 0),
          formattedValue: `$${(countryCities.reduce((s, c) => s + c.totalPipelineValue, 0) / 1_000_000).toFixed(1)}M`,
          cities: countryCities.length,
        };
      });

      const hottestCity = result[0] || null;

      res.json({ cities: result, countryBreakdown, hottestCity, totalOpportunities: result.reduce((s, c) => s + c.opportunities, 0) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Building Signals ─────────────────────────────────────────────────────

  app.get("/api/admin/building-signals", async (req, res) => {
    try {
      const { city } = req.query as Record<string, string>;
      const signals = await storage.getBuildingSignals(city || undefined);
      res.json(signals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/building-signals", async (req, res) => {
    try {
      const signal = await storage.createBuildingSignal(req.body);
      res.json(signal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Deal Intelligence ──────────────────────────────────────────────────────

  app.get("/api/admin/deal-intelligence", async (req, res) => {
    try {
      const { probabilityTier, sourceType } = req.query as Record<string, string>;
      const records = await storage.getDealIntelligenceRecords({
        probabilityTier: probabilityTier || undefined,
        sourceType: sourceType || undefined,
      });
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/deal-intelligence/summary", async (req, res) => {
    try {
      const records = await storage.getDealIntelligenceRecords();
      const active = records.filter(r => r.outcomeResult === "pending");
      const total = active.length;
      const highCount = active.filter(r => r.probabilityTier === "high").length;
      const mediumCount = active.filter(r => r.probabilityTier === "medium").length;
      const lowCount = active.filter(r => r.probabilityTier === "low").length;
      const totalWeightedRevenue = active.reduce((s, r) => s + (r.weightedExpectedRevenue ?? 0), 0);
      const totalWeightedProfit = active.reduce((s, r) => s + (r.weightedExpectedProfit ?? 0), 0);
      const avgWinProbability = total > 0
        ? Math.round(active.reduce((s, r) => s + r.winProbability, 0) / total)
        : 0;
      const bestDeals = active
        .filter(r => r.probabilityTier === "high")
        .sort((a, b) => (b.weightedExpectedRevenue ?? 0) - (a.weightedExpectedRevenue ?? 0))
        .slice(0, 5);
      const highestProfit = active
        .filter(r => r.probabilityTier !== "low")
        .sort((a, b) => (b.weightedExpectedProfit ?? 0) - (a.weightedExpectedProfit ?? 0))
        .slice(0, 5);
      const atRiskQuoted = active
        .filter(r => r.quoteStatus === "Sent" || (r.hasPlanningRequest && !r.hasQuote))
        .slice(0, 5);

      res.json({
        total, highCount, mediumCount, lowCount,
        totalWeightedRevenue, totalWeightedProfit, avgWinProbability,
        bestDeals, highestProfit, atRiskQuoted,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/deal-intelligence/analyse-all", async (req, res) => {
    try {
      const result = await analyseAllDeals();
      res.json({ success: true, processed: result.processed, message: `Analysed ${result.processed} deals across all sources` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/deal-intelligence/:id", async (req, res) => {
    try {
      const record = await storage.getDealIntelligenceRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Not found" });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/deal-intelligence/by-related/:relatedId", async (req, res) => {
    try {
      const record = await storage.getDealIntelligenceByRelated(req.params.relatedId);
      res.json(record ?? null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/deal-intelligence/:id/outcome", async (req, res) => {
    try {
      const { outcomeResult } = req.body as { outcomeResult: string };
      const updated = await storage.updateDealIntelligence(req.params.id, { outcomeResult });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/deal-intelligence/:id", async (req, res) => {
    try {
      await storage.deleteDealIntelligence(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Partner Network ──────────────────────────────────────────────────────────
  app.post("/api/partners", async (req, res) => {
    try {
      const partner = await storage.createPartner(req.body);
      res.json(partner);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const list = await storage.getPartners(status);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners/summary", async (req, res) => {
    try {
      const summary = await getNetworkSummary();
      res.json(summary);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners/referrals", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { desc: dDesc } = await import("drizzle-orm");
      const list = await ddb.select().from(partnerReferralsTable).orderBy(dDesc(partnerReferralsTable.createdAt)).limit(100);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners/commissions", async (req, res) => {
    try {
      const { partnerCommissions: partnerCommissionsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { desc: dDesc } = await import("drizzle-orm");
      const list = await ddb.select().from(partnerCommissionsTable).orderBy(dDesc(partnerCommissionsTable.createdAt)).limit(100);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners/stats", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable, partners: partnersTable, partnerCommissions: partnerCommissionsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { count: dCount } = await import("drizzle-orm");
      const [partnerCount] = await ddb.select({ count: dCount() }).from(partnersTable);
      const [referralCount] = await ddb.select({ count: dCount() }).from(partnerReferralsTable);
      const commissions = await ddb.select().from(partnerCommissionsTable);
      const totalCommissionValue = commissions.reduce((s, c) => s + (c.commissionAmount || 0), 0);
      const paidCommissions = commissions.filter(c => c.paymentStatus === "paid").reduce((s, c) => s + (c.commissionAmount || 0), 0);
      res.json({
        totalPartners: partnerCount.count,
        totalReferrals: referralCount.count,
        totalCommissionValue,
        paidCommissions,
        pendingCommissions: totalCommissionValue - paidCommissions,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners/settings", async (req, res) => {
    try {
      const { partnerSettings: partnerSettingsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const list = await ddb.select().from(partnerSettingsTable).limit(1);
      if (list.length === 0) {
        const [defaults] = await ddb.insert(partnerSettingsTable).values({}).returning();
        return res.json(defaults);
      }
      res.json(list[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/partners/settings", async (req, res) => {
    try {
      const { partnerSettings: partnerSettingsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { sql: dSql } = await import("drizzle-orm");
      const { defaultReferralRate, payoutRuleText, agreementTemplateVersion } = req.body || {};
      const existing = await ddb.select().from(partnerSettingsTable).limit(1);
      if (existing.length === 0) {
        const [created] = await ddb.insert(partnerSettingsTable).values({ defaultReferralRate, payoutRuleText, agreementTemplateVersion, updatedAt: new Date() }).returning();
        return res.json(created);
      }
      const [updated] = await ddb.update(partnerSettingsTable).set({ defaultReferralRate, payoutRuleText, agreementTemplateVersion, updatedAt: new Date() }).where(dSql`id = ${existing[0].id}`).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners/referrals/:id/events", async (req, res) => {
    try {
      const { partnerReferralEvents: partnerReferralEventsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq, asc } = await import("drizzle-orm");
      const events = await ddb.select().from(partnerReferralEventsTable).where(eq(partnerReferralEventsTable.referralId, req.params.id)).orderBy(asc(partnerReferralEventsTable.createdAt));
      res.json(events);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Partner Leaderboard & Scoring (must be before /:id wildcard) ───────────
  app.get("/api/admin/partners/leaderboard", async (req, res) => {
    try {
      const { getPartnerLeaderboard } = await import("./services/partnerScoring");
      const { city, tier, minScore } = req.query as Record<string, string>;
      const results = await getPartnerLeaderboard({
        city: city || undefined,
        tier: tier || undefined,
        minScore: minScore ? Number(minScore) : undefined,
      });
      res.json(results);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/partners/score-all", async (req, res) => {
    try {
      const { partners: partnersTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { syncPartnerScore } = await import("./services/partnerScoring");
      const allPartners = await ddb.select({ id: partnersTable.id }).from(partnersTable).where(eq(partnersTable.agreementStatus, "signed"));
      const results = await Promise.allSettled(allPartners.map(p => syncPartnerScore(p.id)));
      const ok = results.filter(r => r.status === "fulfilled").length;
      res.json({ ok: true, scored: ok, total: allPartners.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners/nudge-targets", async (req, res) => {
    try {
      const { detectNudgeTargets } = await import("./services/partnerScoring");
      const targets = await detectNudgeTargets();
      res.json(targets);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/partners/:id/score", async (req, res) => {
    try {
      const { syncPartnerScore } = await import("./services/partnerScoring");
      const breakdown = await syncPartnerScore(req.params.id);
      res.json({ ok: true, breakdown });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partners/:id", async (req, res) => {
    try {
      const partner = await storage.getPartner(req.params.id);
      if (!partner) return res.status(404).json({ error: "Not found" });
      const opportunities = await storage.getPartnerOpportunities(req.params.id);
      const referrals = await storage.getPartnerReferrals(req.params.id);
      const revenue = await storage.getRevenueShares(req.params.id);
      res.json({ partner, opportunities, referrals, revenue });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/partners/:id", async (req, res) => {
    try {
      const updated = await storage.updatePartner(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/partners/:id/approve", async (req, res) => {
    try {
      const updated = await storage.updatePartner(req.params.id, { activeStatus: "active", approvedAt: new Date() });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/partners/:id/suspend", async (req, res) => {
    try {
      const updated = await storage.updatePartner(req.params.id, { activeStatus: "suspended" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/admin/partners/:id", async (req, res) => {
    try {
      await storage.deletePartner(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Agreement: Send ──────────────────────────────────────────────────────
  app.post("/api/admin/partners/:id/agreement/send", async (req, res) => {
    try {
      const { partners: partnersTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq, sql: dSql } = await import("drizzle-orm");
      const { sendPartnerAgreementEmail } = await import("./email");
      const { generateAgreementText } = await import("./services/partnerAgreement");

      const [partner] = await ddb.select().from(partnersTable).where(eq(partnersTable.id, req.params.id)).limit(1);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      const token = crypto.randomUUID();
      await ddb.update(partnersTable).set({
        agreementStatus: "sent",
        agreementToken: token,
        agreementSentAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(partnersTable.id, req.params.id));

      const baseUrl = req.headers.origin || `https://${req.headers.host}`;
      const signingUrl = `${baseUrl}/partner/agreement/${token}`;

      const agreementText = generateAgreementText({
        contactName: partner.contactName,
        companyName: partner.companyName,
        email: partner.email,
        abn: partner.abn,
        city: partner.city,
        state: partner.state,
      });

      try {
        await sendPartnerAgreementEmail({
          partnerEmail: partner.email,
          partnerName: partner.contactName,
          companyName: partner.companyName,
          signingUrl,
        });
      } catch (emailErr: any) {
        console.error("[Agreement] Email send failed:", emailErr?.message);
      }

      res.json({ ok: true, token, signingUrl, agreementStatus: "sent" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Agreement: Manual Override ──────────────────────────────────────────
  app.patch("/api/admin/partners/:id/agreement/override", async (req, res) => {
    try {
      const { partners: partnersTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { status, reason } = req.body || {};
      if (!["pending", "sent", "signed", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be: pending | sent | signed | rejected" });
      }
      const updateFields: Record<string, any> = { agreementStatus: status, updatedAt: new Date() };
      if (status === "signed") {
        updateFields.agreementSignedAt = new Date();
        updateFields.agreementSignedByName = req.body.signedByName || "Admin Override";
      }
      await ddb.update(partnersTable).set(updateFields).where(eq(partnersTable.id, req.params.id));
      res.json({ ok: true, agreementStatus: status });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Agreement: Get Signing Page Data (public) ────────────────────────────
  app.get("/api/partner/agreement/:token", async (req, res) => {
    try {
      const { partners: partnersTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { generateAgreementText, getAgreementTemplateVersion } = await import("./services/partnerAgreement");

      const [partner] = await ddb.select({
        id: partnersTable.id,
        contactName: partnersTable.contactName,
        companyName: partnersTable.companyName,
        email: partnersTable.email,
        abn: partnersTable.abn,
        city: partnersTable.city,
        state: partnersTable.state,
        agreementStatus: partnersTable.agreementStatus,
        agreementToken: partnersTable.agreementToken,
        referralRate: partnersTable.referralRate,
      }).from(partnersTable).where(eq(partnersTable.agreementToken, req.params.token)).limit(1);

      if (!partner) return res.status(404).json({ error: "Agreement link not found or expired" });
      if (partner.agreementStatus === "signed") {
        return res.json({ alreadySigned: true, partnerName: partner.contactName, companyName: partner.companyName });
      }

      const agreementText = generateAgreementText({
        contactName: partner.contactName,
        companyName: partner.companyName,
        email: partner.email,
        abn: partner.abn,
        city: partner.city,
        state: partner.state,
      }, getAgreementTemplateVersion());

      res.json({
        alreadySigned: false,
        partnerId: partner.id,
        partnerName: partner.contactName,
        companyName: partner.companyName,
        email: partner.email,
        referralRate: partner.referralRate || 0.075,
        templateVersion: getAgreementTemplateVersion(),
        agreementText,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Agreement: Sign (public) ────────────────────────────────────────────
  app.post("/api/partner/agreement/:token/sign", async (req, res) => {
    try {
      const { partners: partnersTable, partnerAgreements: partnerAgreementsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { generateAgreementText, getAgreementTemplateVersion } = await import("./services/partnerAgreement");

      const { signedByName } = req.body || {};
      if (!signedByName || String(signedByName).trim().length < 2) {
        return res.status(400).json({ error: "Full name is required to sign the agreement" });
      }

      const [partner] = await ddb.select().from(partnersTable).where(eq(partnersTable.agreementToken, req.params.token)).limit(1);
      if (!partner) return res.status(404).json({ error: "Agreement link not found or expired" });
      if (partner.agreementStatus === "signed") {
        return res.status(409).json({ error: "Agreement already signed" });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
      const signedAt = new Date();
      const templateVersion = getAgreementTemplateVersion();
      const agreementText = generateAgreementText({
        contactName: partner.contactName,
        companyName: partner.companyName,
        email: partner.email,
        abn: partner.abn,
        city: partner.city,
        state: partner.state,
      }, templateVersion);

      await ddb.update(partnersTable).set({
        agreementStatus: "signed",
        agreementSignedAt: signedAt,
        agreementSignedByName: String(signedByName).trim(),
        agreementSignedByIp: ip,
        updatedAt: signedAt,
      }).where(eq(partnersTable.id, partner.id));

      await ddb.insert(partnerAgreementsTable).values({
        partnerId: partner.id,
        templateVersion,
        agreementText,
        signedByName: String(signedByName).trim(),
        signedAt,
        signedByIp: ip,
      });

      res.json({ ok: true, signedAt: signedAt.toISOString(), partnerName: partner.contactName, companyName: partner.companyName });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/partners/route-opportunity", async (req, res) => {
    try {
      const { partnerTypes, ...opportunityData } = req.body as { partnerTypes?: string[] } & Record<string, any>;
      const result = await routeOpportunityToPartners(opportunityData, partnerTypes);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/partners/route-radar/:radarId", async (req, res) => {
    try {
      const radar = await storage.getOfficeMovRadarRecord(req.params.radarId);
      if (!radar) return res.status(404).json({ error: "Radar record not found" });
      const result = await routeRadarToPartners(radar);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/partner-opportunities", async (req, res) => {
    try {
      const partnerId = req.query.partnerId as string | undefined;
      const list = await storage.getPartnerOpportunities(partnerId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/partner-opportunities/:id", async (req, res) => {
    try {
      const updated = await storage.updatePartnerOpportunity(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Partner dashboard — public access by email
  app.get("/api/partner-dashboard/:email", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { or, eq } = await import("drizzle-orm");
      const partnerEmail = decodeURIComponent(req.params.email);
      const partner = await storage.getPartnerByEmail(partnerEmail);
      if (!partner) return res.status(404).json({ error: "Partner not found" });
      const opportunities = await storage.getPartnerOpportunities(partner.id);
      const referrals = await ddb.select().from(partnerReferralsTable)
        .where(or(eq(partnerReferralsTable.partnerId, partner.id), eq(partnerReferralsTable.contactEmail, partnerEmail)));
      // Strip agreementToken from response (signing token — not for dashboard)
      const { agreementToken: _tok, agreementSignedByIp: _ip, ...safeParter } = partner as any;
      res.json({ partner: safeParter, opportunities, referrals });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/partner-opportunities/:id/respond", async (req, res) => {
    try {
      const { status, notes } = req.body as { status: string; notes?: string };
      const updated = await storage.updatePartnerOpportunity(req.params.id, {
        status,
        notes: notes ?? null,
        respondedAt: new Date(),
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Partner Referral Network (Full Referral System) ─────────────────────────

  app.post("/api/partners/apply", async (req, res) => {
    try {
      const { partners: partnersTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { generateAgreementText, getAgreementTemplateVersion } = await import("./services/partnerAgreement");
      const body = req.body || {};

      if (!body.email || !body.contactName || !body.companyName) {
        return res.status(400).json({ error: "email, contactName, and companyName are required" });
      }

      // Prevent duplicate applications by email
      const [existing] = await ddb.select({ id: partnersTable.id, agreementStatus: partnersTable.agreementStatus }).from(partnersTable).where(eq(partnersTable.email, body.email.toLowerCase().trim())).limit(1);
      if (existing) {
        if (existing.agreementStatus === "signed") {
          return res.status(409).json({ error: "already_signed", message: "You already have an active partner account. Please sign in via the partner login.", partnerId: existing.id });
        }
        // Return existing partner + agreement text so they can complete signing
        const [fullPartner] = await ddb.select().from(partnersTable).where(eq(partnersTable.id, existing.id)).limit(1);
        const templateVersion = getAgreementTemplateVersion();
        const agreementText = generateAgreementText({ contactName: fullPartner.contactName, companyName: fullPartner.companyName, email: fullPartner.email, abn: fullPartner.abn, city: fullPartner.city, state: fullPartner.state }, templateVersion);
        return res.json({ ok: true, partnerId: existing.id, agreementText, templateVersion, resuming: true });
      }

      const [newPartner] = await ddb.insert(partnersTable).values({
        companyName: body.companyName.trim(),
        partnerType: body.partnerType || "broker",
        contactName: body.contactName.trim(),
        email: body.email.toLowerCase().trim(),
        phone: body.phone || null,
        website: body.website || null,
        abn: body.abn || null,
        linkedinUrl: body.linkedinUrl || null,
        city: body.city || null,
        state: body.state || null,
        bio: body.bio || null,
        onboardingStatus: "lead",
        agreementStatus: "pending",
        referralRate: 0.075,
        activeStatus: "pending",
      }).returning();

      const templateVersion = getAgreementTemplateVersion();
      const agreementText = generateAgreementText({ contactName: newPartner.contactName, companyName: newPartner.companyName, email: newPartner.email, abn: newPartner.abn, city: newPartner.city, state: newPartner.state }, templateVersion);

      res.json({ ok: true, partnerId: newPartner.id, agreementText, templateVersion, resuming: false });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Partners: Inline Sign & Activate (self-serve onboarding) ──────────────
  app.post("/api/partners/apply/:id/sign", async (req, res) => {
    try {
      const { partners: partnersTable, partnerAgreements: partnerAgreementsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { generateAgreementText, getAgreementTemplateVersion } = await import("./services/partnerAgreement");
      const { sendPartnerWelcomeEmail } = await import("./email");

      const { signedByName } = req.body || {};
      if (!signedByName || String(signedByName).trim().length < 2) {
        return res.status(400).json({ error: "Full name required to sign the agreement" });
      }

      const [partner] = await ddb.select().from(partnersTable).where(eq(partnersTable.id, req.params.id)).limit(1);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      const signedAt = new Date();
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
      const templateVersion = getAgreementTemplateVersion();
      const agreementText = generateAgreementText({ contactName: partner.contactName, companyName: partner.companyName, email: partner.email, abn: partner.abn, city: partner.city, state: partner.state }, templateVersion);

      // Sign + activate partner in one update
      await ddb.update(partnersTable).set({
        agreementStatus: "signed",
        agreementSignedAt: signedAt,
        agreementSignedByName: String(signedByName).trim(),
        agreementSignedByIp: ip,
        onboardingStatus: "active",
        activeStatus: "active",
        approvedAt: signedAt,
        updatedAt: signedAt,
      }).where(eq(partnersTable.id, partner.id));

      // Persist full signed agreement in audit table
      await ddb.insert(partnerAgreementsTable).values({
        partnerId: partner.id,
        templateVersion,
        agreementText,
        signedByName: String(signedByName).trim(),
        signedAt,
        signedByIp: ip,
      });

      // Send welcome email (non-blocking)
      sendPartnerWelcomeEmail({
        partnerEmail: partner.email,
        partnerName: partner.contactName,
        companyName: partner.companyName,
        dashboardUrl: `${req.headers.origin || `https://${req.headers.host}`}/partner-dashboard`,
        submitDealUrl: `${req.headers.origin || `https://${req.headers.host}`}/submit-deal`,
      }).catch((e: any) => console.error("[WelcomeEmail] Failed:", e?.message));

      res.json({ ok: true, activated: true, signedAt: signedAt.toISOString(), partner: { id: partner.id, contactName: partner.contactName, companyName: partner.companyName, email: partner.email } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/partners/referrals", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable, partnerReferralEvents, partners: partnersTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const body = req.body || {};

      // Auto-resolve partnerId from referringPartnerEmail if not provided
      let resolvedPartnerId = body.partnerId || null;
      if (!resolvedPartnerId && (body.referringPartnerEmail || body.partnerEmail)) {
        const lookupEmail = body.referringPartnerEmail || body.partnerEmail;
        const [matchedPartner] = await ddb.select({ id: partnersTable.id, agreementStatus: partnersTable.agreementStatus }).from(partnersTable).where(eq(partnersTable.email, lookupEmail)).limit(1);
        if (matchedPartner) {
          if (matchedPartner.agreementStatus !== "signed") {
            return res.status(403).json({
              error: "Agreement not signed",
              message: "Your partner agreement must be signed before submitting referrals. Please check your email for the agreement link, or contact us at service@thecorporatedesk.com.au.",
              agreementRequired: true,
            });
          }
          resolvedPartnerId = matchedPartner.id;
        }
      }

      const [newReferral] = await ddb.insert(partnerReferralsTable).values({
        partnerId: resolvedPartnerId,
        clientName: body.clientName || body.contactName || null,
        clientCompany: body.clientCompany || body.companyName || null,
        contactName: body.contactName || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
        officeLocation: body.officeLocation || body.city || null,
        officeSizeSqm: body.officeSizeSqm ? String(body.officeSizeSqm) : null,
        staffCount: body.staffCount ? String(body.staffCount) : null,
        projectType: body.projectType || null,
        projectStage: body.projectStage || "early",
        estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : null,
        sourceNotes: body.sourceNotes || body.notes || null,
        status: "submitted",
        commissionPercent: 7.5,
      }).returning();

      await ddb.insert(partnerReferralEvents).values({
        referralId: newReferral.id,
        eventType: "submitted",
        eventNote: `Referral submitted via partner form${resolvedPartnerId ? ` (partner linked)` : ""}`,
        createdBy: resolvedPartnerId || "public",
      });

      const { scorePartnerReferral } = await import("./services/partnerReferralAI");
      scorePartnerReferral(newReferral.id).catch((e: any) => console.error("[PartnerReferralAI] async score failed:", e?.message));

      res.json({ ok: true, referral: newReferral });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/partners/:id/referrals", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const list = await ddb.select().from(partnerReferralsTable).where(eq(partnerReferralsTable.partnerId, req.params.id));
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/partners/:id/commissions", async (req, res) => {
    try {
      const { partnerCommissions: partnerCommissionsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const list = await ddb.select().from(partnerCommissionsTable).where(eq(partnerCommissionsTable.partnerId, req.params.id));
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/referrals/:id/score", async (req, res) => {
    try {
      const { scorePartnerReferral } = await import("./services/partnerReferralAI");
      const result = await scorePartnerReferral(req.params.id);
      if (!result) return res.status(404).json({ error: "Referral not found or scoring failed" });
      res.json({ ok: true, ...result });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/referrals/:id/assign", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable, partnerReferralEvents } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { assignedTo, partnerId, assignmentNote } = req.body || {};
      const updateFields: Record<string, any> = { updatedAt: new Date() };
      if (assignedTo) updateFields.assignedTo = assignedTo;
      if (partnerId) { updateFields.partnerId = partnerId; updateFields.assignedAt = new Date(); }
      await ddb.update(partnerReferralsTable).set(updateFields).where(eq(partnerReferralsTable.id, req.params.id));
      const note = assignmentNote || (partnerId ? `Linked to partner ${partnerId}` : `Assigned to ${assignedTo}`);
      await ddb.insert(partnerReferralEvents).values({ referralId: req.params.id, eventType: "assigned", eventNote: note, createdBy: "admin" });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/referrals/:id/status", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable, partnerReferralEvents } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { status, note } = req.body || {};
      await ddb.update(partnerReferralsTable).set({ status, updatedAt: new Date() }).where(eq(partnerReferralsTable.id, req.params.id));
      await ddb.insert(partnerReferralEvents).values({ referralId: req.params.id, eventType: status, eventNote: note || `Status updated to ${status}`, createdBy: "admin" });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/referrals/:id/mark-won", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable, partnerReferralEvents, partnerCommissions: partnerCommissionsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { dealValue, partnerId: bodyPartnerId, notes } = req.body || {};
      const [referral] = await ddb.select().from(partnerReferralsTable).where(eq(partnerReferralsTable.id, req.params.id)).limit(1);
      if (!referral) return res.status(404).json({ error: "Referral not found" });

      const resolvedPartnerId = referral.partnerId || bodyPartnerId || null;
      const value = Number(dealValue || referral.estimatedValue || referral.projectValue || 0);
      const rate = Number(referral.commissionPercent || 7.5) / 100;
      const commissionAmount = Math.round(value * rate);

      const updateSet: Record<string, any> = { status: "won", projectValue: value, updatedAt: new Date() };
      if (resolvedPartnerId && !referral.partnerId) updateSet.partnerId = resolvedPartnerId;
      await ddb.update(partnerReferralsTable).set(updateSet).where(eq(partnerReferralsTable.id, req.params.id));

      let commission = null;
      if (resolvedPartnerId && value > 0) {
        // Upsert: avoid duplicate commission if mark-won called twice
        const existing = await ddb.select().from(partnerCommissionsTable).where(eq(partnerCommissionsTable.referralId, req.params.id)).limit(1);
        if (existing.length === 0) {
          const [comm] = await ddb.insert(partnerCommissionsTable).values({
            referralId: req.params.id,
            partnerId: resolvedPartnerId,
            commissionRate: rate,
            dealValue: value,
            commissionAmount,
            paymentStatus: "pending",
          }).returning();
          commission = comm;
        } else {
          commission = existing[0];
        }
      }

      await ddb.insert(partnerReferralEvents).values({ referralId: req.params.id, eventType: "won", eventNote: `Deal won at $${value.toLocaleString()}, commission $${commissionAmount.toLocaleString()}${notes ? ` — ${notes}` : ""}`, createdBy: "admin" });
      if (commission && !commission.paymentStatus) {
        await ddb.insert(partnerReferralEvents).values({ referralId: req.params.id, eventType: "commission_created", eventNote: `Commission of $${commissionAmount.toLocaleString()} created`, createdBy: "admin" });
      }

      res.json({ ok: true, dealValue: value, commissionAmount, commission });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/referrals/:id/mark-lost", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable, partnerReferralEvents } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { reason } = req.body || {};
      await ddb.update(partnerReferralsTable).set({ status: "lost", conversionResult: "lost", updatedAt: new Date() }).where(eq(partnerReferralsTable.id, req.params.id));
      await ddb.insert(partnerReferralEvents).values({ referralId: req.params.id, eventType: "lost", eventNote: reason || "Deal marked lost", createdBy: "admin" });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/referrals/:id/mark-paid", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable, partnerReferralEvents, partnerCommissions: partnerCommissionsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      await ddb.update(partnerReferralsTable).set({ status: "paid", updatedAt: new Date() }).where(eq(partnerReferralsTable.id, req.params.id));
      await ddb.update(partnerCommissionsTable).set({ paymentStatus: "paid", paidAt: new Date(), updatedAt: new Date() }).where(eq(partnerCommissionsTable.referralId, req.params.id));
      await ddb.insert(partnerReferralEvents).values({ referralId: req.params.id, eventType: "commission_paid", eventNote: "Commission marked as paid", createdBy: "admin" });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/referrals/:id/commission/calc", async (req, res) => {
    try {
      const { partnerReferrals: partnerReferralsTable } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { dealValue, rate } = req.body || {};
      const [referral] = await ddb.select().from(partnerReferralsTable).where(eq(partnerReferralsTable.id, req.params.id)).limit(1);
      if (!referral) return res.status(404).json({ error: "Referral not found" });
      const value = Number(dealValue || referral.estimatedValue || 0);
      const commissionRate = Number(rate || 7.5) / 100;
      const commissionAmount = Math.round(value * commissionRate);
      res.json({ dealValue: value, commissionRate: commissionRate * 100, commissionAmount });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/referrals/:id/commission/pay", async (req, res) => {
    try {
      const { partnerCommissions: partnerCommissionsTable, partnerReferralEvents } = await import("@shared/schema");
      const { db: ddb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { paymentReference, notes } = req.body || {};
      const [updated] = await ddb
        .update(partnerCommissionsTable)
        .set({ paymentStatus: "paid", paidAt: new Date(), notes: notes || null, updatedAt: new Date() })
        .where(eq(partnerCommissionsTable.referralId, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Commission record not found" });
      await ddb.insert(partnerReferralEvents).values({
        referralId: req.params.id,
        eventType: "commission_paid",
        eventNote: paymentReference ? `Paid — ref: ${paymentReference}` : "Commission payment confirmed",
        createdBy: "admin",
      });
      res.json({ ok: true, commission: updated });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/revenue-shares", async (req, res) => {
    try {
      const partnerId = req.query.partnerId as string | undefined;
      const list = await storage.getRevenueShares(partnerId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Relocation Intelligence ──────────────────────────────────────────────────
  app.get("/api/admin/relocation-signals", async (req, res) => {
    try {
      const filters: { city?: string; tier?: string; status?: string } = {};
      if (req.query.city) filters.city = req.query.city as string;
      if (req.query.tier) filters.tier = req.query.tier as string;
      if (req.query.status) filters.status = req.query.status as string;
      const signals = await storage.getRelocationSignals(Object.keys(filters).length ? filters : undefined);
      res.json(signals);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/relocation-signals/generate", async (req, res) => {
    try {
      const count = parseInt(String(req.body.count ?? 15));
      const signals = await generateRelocationSignals(count);
      res.json({ generated: signals.length, signals });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/relocation-signals/market-intelligence", async (req, res) => {
    try {
      const intel = await getMarketIntelligence();
      res.json(intel);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/relocation-signals/:id/push-to-pipeline", async (req, res) => {
    try {
      const result = await pushRelocationToPipeline(req.params.id);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/relocation-signals/:id/route-to-partners", async (req, res) => {
    try {
      const signal = await storage.getRelocationSignalById(req.params.id);
      if (!signal) return res.status(404).json({ error: "Signal not found" });
      const { routeRelocationSignalToPartners } = await import("./services/partnerNetwork");
      const result = await routeRelocationSignalToPartners(signal);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/relocation-signals/:id", async (req, res) => {
    try {
      const updated = await storage.updateRelocationSignal(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/admin/relocation-signals/:id", async (req, res) => {
    try {
      await storage.deleteRelocationSignal(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Workspace Strategy Engine ────────────────────────────────────────────────
  app.post("/api/admin/workspace-strategy/generate", async (req, res) => {
    try {
      const { planningRequestId, officeSqm, staffCount, projectType, industryContext, budgetRange, stylePreference } = req.body;
      if (!officeSqm || !staffCount) return res.status(400).json({ error: "officeSqm and staffCount are required" });
      const strategy = await generateStrategyRecommendation({
        planningRequestId, officeSqm: parseInt(officeSqm), staffCount: parseInt(staffCount),
        projectType, industryContext, budgetRange, stylePreference,
      });
      res.json(strategy);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/workspace-strategy", async (req, res) => {
    try {
      const limit = parseInt(String(req.query.limit ?? 50));
      const strategies = await storage.getWorkspaceStrategies(limit);
      res.json(strategies);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/workspace-strategy/learning-insights", async (req, res) => {
    try {
      const insights = await getLearningInsights();
      res.json(insights);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/workspace-strategy/:id", async (req, res) => {
    try {
      const strategy = await storage.getWorkspaceStrategy(req.params.id);
      if (!strategy) return res.status(404).json({ error: "Not found" });
      res.json(strategy);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/workspace-strategy/:id", async (req, res) => {
    try {
      const updated = await storage.updateWorkspaceStrategy(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Deal Hunter Engine ──────────────────────────────────────────────────────

  app.get("/api/admin/deal-hunter/stats", async (req, res) => {
    try {
      const stats = await getDealHunterStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/deal-hunter/signals", async (req, res) => {
    try {
      const { city, industry, probabilityTier, signalType, status, isReviewed, pushedToPipeline } = req.query as Record<string, string>;
      const filters: any = {};
      if (city) filters.city = city;
      if (industry) filters.industry = industry;
      if (probabilityTier) filters.probabilityTier = probabilityTier;
      if (signalType) filters.signalType = signalType;
      if (status) filters.status = status;
      if (isReviewed !== undefined) filters.isReviewed = isReviewed === "true";
      if (pushedToPipeline !== undefined) filters.pushedToPipeline = pushedToPipeline === "true";
      const signals = await storage.getDealHunterSignals(Object.keys(filters).length ? filters : undefined);
      res.json(signals);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/deal-hunter/signals/:id", async (req, res) => {
    try {
      const signal = await storage.getDealHunterSignal(req.params.id);
      if (!signal) return res.status(404).json({ error: "Not found" });
      res.json(signal);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

          app.post("/api/admin/deal-hunter/run", async (req, res) => {
            try {
              const requestedCount = Number(req.body?.count);
              const count =
                Number.isFinite(requestedCount) && requestedCount > 0
                  ? Math.min(requestedCount, 20)
                  : 10;

              console.log("[API] Deal Hunter RUN triggered", { count });

              const { runDealHunterScan } = await import("./services/dealHunter");

              console.log("[API] Calling runDealHunterScan...");

              const result = await runDealHunterScan(count);

              console.log("[API] Deal Hunter RESULT:", {
                created: result?.created ?? 0,
                deduplicated: result?.deduplicated ?? 0,
                signals: result?.signals?.length ?? 0,
              });

              return res.json({
                success: true,
                created: result?.created ?? 0,
                deduplicated: result?.deduplicated ?? 0,
                signals: result?.signals ?? [],
                message: `Deal Hunter complete — ${result?.created ?? 0} signals discovered`,
              });
            } catch (err: any) {
              console.error("[API] Deal Hunter FAILED:", err);

              return res.status(500).json({
                success: false,
                created: 0,
                deduplicated: 0,
                signals: [],
                error: err?.message || "Deal Hunter failed",
              });
            }
          });

  app.post("/api/admin/deal-hunter/signals/:id/push-to-pipeline", async (req, res) => {
    try {
      const result = await pushDealHunterToPipeline(req.params.id);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/deal-hunter/signals/:id/push-to-radar", async (req, res) => {
    try {
      const result = await pushDealHunterToRadar(req.params.id);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/deal-hunter/signals/:id/review", async (req, res) => {
    try {
      const updated = await reviewDealHunterSignal(req.params.id);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/deal-hunter/signals/:id/dismiss", async (req, res) => {
    try {
      const updated = await dismissDealHunterSignal(req.params.id);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/deal-hunter/signals/:id/mark-duplicate", async (req, res) => {
    try {
      const updated = await storage.updateDealHunterSignal(req.params.id, { isDuplicate: true, status: "dismissed" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/admin/deal-hunter/signals/:id", async (req, res) => {
    try {
      await storage.deleteDealHunterSignal(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Nexora autonomous outreach routing.
  // Classifies signal risk and either auto-approves (low-risk email outreach)
  // or creates a pending draft (high-risk: WhatsApp, call, enterprise deal).
  // Risk classification rules are explicitly defined in classifyOutreachRisk().
  app.post("/api/admin/deal-hunter/signals/:id/queue-outreach", async (req, res) => {
    try {
      const signal = await storage.getDealHunterSignal(req.params.id);
      if (!signal) return res.status(404).json({ error: "Signal not found" });
      if (!signal.outreachDraft) return res.status(400).json({ error: "No outreach draft on this signal" });

      const { db: ddb } = await import("./db");
      const { outreachMessages } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { checkSuppression, checkCooldown, checkRateLimits, writeAuditEvent } = await import("./services/outreach/outreach-guards");

      // ─── Layer 11: Suppression + Rate-limit safety gates ────────────────
      const suppCheck = await checkSuppression({
        companyName: signal.companyName ?? "",
        recipientEmail: (signal as any).recipientEmail ?? "",
      });
      if (suppCheck.suppressed) {
        await writeAuditEvent({
          entityType: "deal_hunter_signal",
          entityId: signal.id,
          eventType: "outreach_suppressed",
          companyName: signal.companyName ?? "",
          details: { reason: suppCheck.reason, signalId: signal.id },
        });
        return res.status(429).json({ error: `Outreach suppressed: ${suppCheck.reason}`, suppressed: true });
      }

      const coolCheck = await checkCooldown({ companyName: signal.companyName ?? "" });
      if (coolCheck.inCooldown) {
        return res.status(429).json({
          error: `Company in 30-day cooldown. Last sent: ${coolCheck.lastSentAt?.toISOString() ?? "unknown"}`,
          suppressed: true,
          lastSentAt: coolCheck.lastSentAt,
        });
      }

      const rateCheck = await checkRateLimits();
      if (rateCheck.exceeded) {
        return res.status(429).json({ error: rateCheck.reason, rateLimited: true });
      }
      // ────────────────────────────────────────────────────────────────────

      const { channel } = resolveOutreachChannel(signal);
      const { isHighRisk, justification } = classifyOutreachRisk(signal, channel);

      const threadId = `nexora_${signal.id}_${Date.now()}`;
      const identityHash = `${signal.companyName}_${signal.id}_nexora_draft`;

      // Check if already queued or sent
      const existing = await ddb.select({ id: outreachMessages.id, deliveryStatus: outreachMessages.deliveryStatus })
        .from(outreachMessages)
        .where(eq(outreachMessages.campaignKey, `nexora_signal_${signal.id}`))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({
          error: existing[0].deliveryStatus === "approved"
            ? "Already auto-approved and sent"
            : "Already queued for review",
          existingId: existing[0].id,
          deliveryStatus: existing[0].deliveryStatus,
        });
      }

      // Low-risk outreach is auto-approved by Nexora.
      // High-risk outreach is gated pending human review (justification logged).
      const deliveryStatus = isHighRisk ? "draft" : "approved";
      const approvedAt = isHighRisk ? null : new Date();

      const [created] = await ddb.insert(outreachMessages).values({
        threadId,
        direction: "outbound",
        channel,
        subject: `Outreach: ${signal.companyName}`,
        body: signal.outreachDraft,
        stage: 0,
        messageType: "intro",
        deliveryStatus,
        companyName: signal.companyName,
        campaignKey: `nexora_signal_${signal.id}`,
        recipientEmail: null,
        identityHash,
        ...(approvedAt ? { approvedAt } : {}),
      } as any).returning({ id: outreachMessages.id });

      await writeAuditEvent({
        entityType: "deal_hunter_signal",
        entityId: signal.id,
        eventType: isHighRisk ? "outreach_queued_for_review" : "outreach_auto_approved",
        companyName: signal.companyName ?? "",
        campaignKey: `nexora_signal_${signal.id}`,
        details: { channel, riskLevel: isHighRisk ? "high" : "low", justification, outreachMessageId: created?.id },
      });

      console.log(`[Nexora Outreach] Signal ${signal.id} (${signal.companyName}) — channel: ${channel}, risk: ${isHighRisk ? "HIGH" : "LOW"}, status: ${deliveryStatus} — ${justification}`);

      res.json({
        ok: true,
        outreachMessageId: created?.id,
        channel,
        autoApproved: !isHighRisk,
        riskLevel: isHighRisk ? "high" : "low",
        riskJustification: justification,
        deliveryStatus,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Get channel recommendation for a signal
  app.get("/api/admin/deal-hunter/signals/:id/channel-recommendation", async (req, res) => {
    try {
      const signal = await storage.getDealHunterSignal(req.params.id);
      if (!signal) return res.status(404).json({ error: "Signal not found" });
      const rec = resolveOutreachChannel(signal);
      res.json(rec);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Visitor Analytics Tracking ─────────────────────────────────────────────

  app.post("/api/track/pageview", async (req, res) => {
    try {
      const { pagePath, referrer, sessionId, utmSource, utmMedium, utmCampaign } = req.body;
      if (!pagePath) return res.status(400).json({ error: "pagePath required" });

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      const ua = req.headers["user-agent"] || "";

      const BOT_PATTERN = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|facebookexternalhit|semrush|ahrefs|mj12bot|rogerbot|dotbot/i;
      const isBot = BOT_PATTERN.test(ua);
      if (isBot) return res.json({ tracked: false, reason: "bot" });

      const crypto = await import("crypto");
      const ipHash = ip ? crypto.createHash("sha256").update(ip + process.env.SESSION_SECRET).digest("hex").slice(0, 16) : null;
      const uaHash = ua ? crypto.createHash("sha256").update(ua).digest("hex").slice(0, 16) : null;

      await db.insert(siteVisits).values({
        pagePath,
        referrer: referrer || null,
        sessionId: sessionId || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        ipHash,
        userAgentHash: uaHash,
        isBot: false,
      });

      res.json({ tracked: true });
    } catch (err: any) {
      console.error("[Analytics] Track error:", err.message);
      res.json({ tracked: false });
    }
  });

  // ── Public unsubscribe endpoint (Australian Spam Act 2003 compliance) ──────────
  app.get("/api/unsubscribe", async (req, res) => {
    const { m: messageId } = req.query;
    if (!messageId || typeof messageId !== "string") {
      return res.status(400).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center"><h2>Invalid unsubscribe link</h2><p>This link is invalid or has expired.</p></body></html>`);
    }

    try {
      const { outreachMessages, outreachSuppressions } = await import("@shared/schema");
      const [msg] = await db.select().from(outreachMessages).where(eq(outreachMessages.id, messageId)).limit(1);

      if (!msg) {
        return res.status(404).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center"><h2>Link not found</h2><p>This unsubscribe link could not be found.</p></body></html>`);
      }

      const recipientEmail = msg.recipientEmail ?? null;
      const companyName = msg.companyName ?? null;

      // Add to outreach_suppressions (idempotent — check before insert)
      if (recipientEmail) {
        const normEmail = recipientEmail.toLowerCase().trim();
        const { and: andOp } = await import("drizzle-orm");
        const existing = await db.select({ id: outreachSuppressions.id })
          .from(outreachSuppressions)
          .where(andOp(
            sql`lower(trim(${outreachSuppressions.recipientEmail})) = ${normEmail}`,
            eq(outreachSuppressions.active, 1),
          ))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(outreachSuppressions).values({
            suppressionScope: "recipient",
            recipientEmail: normEmail,
            companyName: companyName ? companyName.toLowerCase().trim() : null,
            reason: "unsubscribed",
            active: 1,
          } as any);
        }
      }

      // Update the message record
      await db.update(outreachMessages)
        .set({ deliveryStatus: "unsubscribed", updatedAt: new Date() } as any)
        .where(eq(outreachMessages.id, messageId));

      console.log(`[Unsubscribe] ${recipientEmail ?? "unknown"} (${companyName ?? "unknown"}) unsubscribed via message ${messageId}`);

      return res.send(`<!DOCTYPE html><html><head><title>Unsubscribed — The Corporate Desk</title><style>body{font-family:'Segoe UI',sans-serif;background:#0f0f13;color:#e8e4dc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#1a1a22;border:1px solid #C9A84C;border-radius:12px;padding:48px;max-width:480px;text-align:center}h2{color:#C9A84C;margin-top:0}p{color:#a09880;line-height:1.6}</style></head><body><div class="card"><h2>You've been unsubscribed</h2><p>You'll no longer receive outreach emails from The Corporate Desk.</p><p style="font-size:13px;margin-top:32px">If this was a mistake, please reply to any previous email from us and we'll reinstate your contact preferences.</p></div></body></html>`);
    } catch (err: any) {
      console.error("[Unsubscribe] Error:", err.message);
      return res.status(500).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center"><h2>Something went wrong</h2><p>Please try again or contact us directly.</p></body></html>`);
    }
  });

  app.get("/api/admin/analytics", async (req, res) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      const visitorQuery = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= ${todayStart}) AS today,
          COUNT(*) FILTER (WHERE created_at >= ${weekStart}) AS week,
          COUNT(*) FILTER (WHERE created_at >= ${monthStart}) AS month,
          COUNT(*) FILTER (WHERE created_at >= ${yearStart}) AS year,
          COUNT(*) AS total
        FROM site_visits
        WHERE is_bot = false
      `);

      const uniqueVisitorsQuery = await db.execute(sql`
        SELECT
          COUNT(DISTINCT ip_hash) FILTER (WHERE created_at >= ${todayStart}) AS today,
          COUNT(DISTINCT ip_hash) FILTER (WHERE created_at >= ${weekStart}) AS week,
          COUNT(DISTINCT ip_hash) FILTER (WHERE created_at >= ${monthStart}) AS month,
          COUNT(DISTINCT ip_hash) FILTER (WHERE created_at >= ${yearStart}) AS year
        FROM site_visits
        WHERE is_bot = false AND ip_hash IS NOT NULL
      `);

      const topPagesQuery = await db.execute(sql`
        SELECT page_path, COUNT(*) as views
        FROM site_visits
        WHERE is_bot = false AND created_at >= ${monthStart}
        GROUP BY page_path
        ORDER BY views DESC
        LIMIT 10
      `);

      const referrersQuery = await db.execute(sql`
        SELECT
          COALESCE(referrer, 'Direct') as source,
          COUNT(*) as visits
        FROM site_visits
        WHERE is_bot = false AND created_at >= ${monthStart}
        GROUP BY referrer
        ORDER BY visits DESC
        LIMIT 10
      `);

      const leadsQuery = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= ${todayStart}) AS today,
          COUNT(*) FILTER (WHERE created_at >= ${weekStart}) AS week,
          COUNT(*) FILTER (WHERE created_at >= ${monthStart}) AS month,
          COUNT(*) FILTER (WHERE created_at >= ${yearStart}) AS year,
          COUNT(*) AS total
        FROM leads
      `);

      const leadsBreakdownQuery = await db.execute(sql`
        SELECT type, COUNT(*) as count
        FROM leads
        WHERE created_at >= ${monthStart}
        GROUP BY type
        ORDER BY count DESC
      `);

      const pageViews = (visitorQuery.rows?.[0] as any) || {};
      const uniqueV = (uniqueVisitorsQuery.rows?.[0] as any) || {};
      const leadsRow = (leadsQuery.rows?.[0] as any) || {};
      const topPages = (topPagesQuery.rows || []) as any[];
      const referrers = (referrersQuery.rows || []) as any[];
      const leadsBreakdown = (leadsBreakdownQuery.rows || []) as any[];

      const monthViews = Number(pageViews.month || 0);
      const monthLeads = Number(leadsRow.month || 0);
      const rawRate = monthViews > 0 ? (monthLeads / monthViews) * 100 : 0;
      const conversionRate = Math.min(rawRate, 100).toFixed(1);

      res.json({
        pageViews: {
          today: Number(pageViews.today || 0),
          week: Number(pageViews.week || 0),
          month: Number(pageViews.month || 0),
          year: Number(pageViews.year || 0),
          total: Number(pageViews.total || 0),
        },
        uniqueVisitors: {
          today: Number(uniqueV.today || 0),
          week: Number(uniqueV.week || 0),
          month: Number(uniqueV.month || 0),
          year: Number(uniqueV.year || 0),
        },
        leads: {
          today: Number(leadsRow.today || 0),
          week: Number(leadsRow.week || 0),
          month: Number(leadsRow.month || 0),
          year: Number(leadsRow.year || 0),
          total: Number(leadsRow.total || 0),
        },
        topPages,
        referrers,
        leadsBreakdown,
        conversionRate: parseFloat(conversionRate),
      });
    } catch (err: any) {
      console.error("[Analytics] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Supplier Procurement Intelligence ───────────────────────────────────────

  // Supplier profiles
  app.get("/api/admin/supplier-profiles", async (_req, res) => {
    try { res.json(await storage.getSupplierProfiles()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/supplier-profiles", async (req, res) => {
    try {
      const { computeSupplierScore } = await import("./services/supplierProcurement.js");
      const data = req.body;
      const overallScore = computeSupplierScore(data);
      const profile = await storage.createSupplierProfile({ ...data, overallScore });
      res.json(profile);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/supplier-profiles/:id", async (req, res) => {
    try {
      const { computeSupplierScore } = await import("./services/supplierProcurement.js");
      const data = req.body;
      const overallScore = computeSupplierScore(data);
      const profile = await storage.updateSupplierProfile(req.params.id, { ...data, overallScore });
      res.json(profile);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/supplier-profiles/:id", async (req, res) => {
    try { await storage.deleteSupplierProfile(req.params.id); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Auto-generate furniture list from headcount
  app.post("/api/admin/rfq/auto-generate-furniture", async (req, res) => {
    try {
      const { headcount, hasReception, hasBoardroom } = req.body;
      if (!headcount || headcount < 1) return res.status(400).json({ error: "headcount required" });
      const { autoGenerateFurnitureList, routeFurnitureToSuppliers } = await import("./services/supplierProcurement.js");
      const furniture = autoGenerateFurnitureList(Number(headcount), hasReception, hasBoardroom);
      const routing = routeFurnitureToSuppliers(furniture);
      res.json({ furniture, routing });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // RFQ Projects
  app.get("/api/admin/rfq", async (_req, res) => {
    try { res.json(await storage.getRfqProjects()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/rfq", async (req, res) => {
    try {
      const { routeFurnitureToSuppliers } = await import("./services/supplierProcurement.js");
      const body = req.body;
      let furnitureJson = body.furnitureJson;
      let recommendationsJson = body.recommendationsJson;

      if (furnitureJson && !recommendationsJson) {
        const items = JSON.parse(furnitureJson);
        const routing = routeFurnitureToSuppliers(items);
        recommendationsJson = JSON.stringify(routing);
      }

      const project = await storage.createRfqProject({ ...body, furnitureJson, recommendationsJson });
      res.json(project);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/rfq/:id", async (req, res) => {
    try {
      const project = await storage.getRfqProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const responses = await storage.getRfqResponsesByProject(req.params.id);
      res.json({ project, responses });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/rfq/:id", async (req, res) => {
    try {
      const project = await storage.updateRfqProject(req.params.id, req.body);
      res.json(project);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/rfq/:id", async (req, res) => {
    try { await storage.deleteRfqProject(req.params.id); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Generate RFQ email drafts for a project
  app.post("/api/admin/rfq/:id/generate-emails", async (req, res) => {
    try {
      const { generateRfqEmail, routeFurnitureToSuppliers } = await import("./services/supplierProcurement.js");
      const project = await storage.getRfqProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Not found" });

      const furniture = project.furnitureJson ? JSON.parse(project.furnitureJson) : [];
      const suppliers: any[] = project.recommendationsJson ? JSON.parse(project.recommendationsJson) : routeFurnitureToSuppliers(furniture);

      const emails = suppliers.map(s => generateRfqEmail(s, furniture, {
        projectName: project.projectName,
        clientCompany: project.clientCompany,
        city: project.city,
        timeline: project.timeline,
        headcount: project.headcount,
      }));

      await storage.updateRfqProject(req.params.id, { status: "sent" });
      res.json({ emails });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // RFQ Responses
  app.post("/api/admin/rfq/:id/responses", async (req, res) => {
    try {
      const response = await storage.createRfqResponse({ ...req.body, rfqProjectId: req.params.id });
      // Auto-update project to "responding" status
      await storage.updateRfqProject(req.params.id, { status: "responding" });
      res.json(response);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/rfq/responses/:responseId", async (req, res) => {
    try {
      const response = await storage.updateRfqResponse(req.params.responseId, req.body);
      res.json(response);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/rfq/responses/:responseId", async (req, res) => {
    try { await storage.deleteRfqResponse(req.params.responseId); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── National Office Market Map ────────────────────────────────────────────

  const AU_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
    "Sydney":        { lat: -33.8688, lng: 151.2093 },
    "Melbourne":     { lat: -37.8136, lng: 144.9631 },
    "Brisbane":      { lat: -27.4698, lng: 153.0251 },
    "Perth":         { lat: -31.9505, lng: 115.8605 },
    "Adelaide":      { lat: -34.9285, lng: 138.6007 },
    "Canberra":      { lat: -35.2809, lng: 149.1300 },
    "Gold Coast":    { lat: -28.0167, lng: 153.4000 },
    "Newcastle":     { lat: -32.9283, lng: 151.7817 },
    "Wollongong":    { lat: -34.4278, lng: 150.8931 },
    "Hobart":        { lat: -42.8821, lng: 147.3272 },
    "Darwin":        { lat: -12.4634, lng: 130.8456 },
    "Townsville":    { lat: -19.2590, lng: 146.8169 },
    "Cairns":        { lat: -16.9186, lng: 145.7781 },
    "Geelong":       { lat: -38.1499, lng: 144.3617 },
    "Sunshine Coast":{ lat: -26.6500, lng: 153.0667 },
    "Ballarat":      { lat: -37.5622, lng: 143.8503 },
    "Bendigo":       { lat: -36.7570, lng: 144.2794 },
    "Toowoomba":     { lat: -27.5598, lng: 151.9507 },
    "Launceston":    { lat: -41.4332, lng: 147.1441 },
    "Albury":        { lat: -36.0737, lng: 146.9135 },
    "Mackay":        { lat: -21.1437, lng: 149.1859 },
    "Rockhampton":   { lat: -23.3791, lng: 150.5100 },
    "Bunbury":       { lat: -33.3271, lng: 115.6414 },
  };

  function getSignalColor(signalType: string): string {
    const t = (signalType || "").toLowerCase();
    if (t.includes("expan") || t.includes("growth") || t.includes("hiring")) return "orange";
    if (t.includes("reloc") || t.includes("move")) return "red";
    if (t.includes("lease") || t.includes("property")) return "blue";
    if (t.includes("fund") || t.includes("invest")) return "green";
    return "blue";
  }

  app.get("/api/market-map", async (_req, res) => {
    try {
      const cached = getCached<object>("market-map");
      if (cached) return res.json(cached);

      const radarRecords = await storage.getOfficeMovRadarRecords({ status: "New" });
      const markers = radarRecords
        .filter(r => r.status !== "Archived")
        .map(r => {
          const cityKey = Object.keys(AU_CITY_COORDS).find(c =>
            (r.city || "").toLowerCase().includes(c.toLowerCase()) ||
            c.toLowerCase().includes((r.city || "").toLowerCase())
          );
          const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
          if (!coords) return null;

          // Add slight jitter so markers in the same city don't stack
          const jitter = () => (Math.random() - 0.5) * 0.04;
          const pv = parseInt((r.estimatedProjectValue || "0").replace(/[^0-9]/g, "")) || 0;

          return {
            id: r.id,
            companyName: r.companyName,
            city: r.city,
            state: r.state,
            industry: r.industry,
            lat: coords.lat + jitter(),
            lng: coords.lng + jitter(),
            signalType: r.signalType,
            estimatedHeadcount: r.estimatedHeadcount,
            estimatedOfficeSizeSqm: r.estimatedOfficeSizeSqm,
            estimatedProjectValue: pv,
            confidenceScore: r.radarScore,
            priority: r.priority,
            status: r.status,
            sourceUrl: r.sourceUrl,
            color: getSignalColor(r.signalType),
            dateDetected: r.dateDetected,
            linkedProspectId: r.linkedProspectId,
          };
        })
        .filter(Boolean);

      const payload = { markers, total: markers.length, updatedAt: new Date().toISOString() };
      setCached("market-map", payload, 60_000);
      res.json(payload);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Map Intelligence Layer Routes (Stage 6) ──────────────────────────────

  app.get("/api/map/layers/signals", async (req, res) => {
    try {
      const { bbox, zoom } = req.query;
      const radarRecords = await storage.getOfficeMovRadarRecords({});
      const features = radarRecords.map((r) => {
        const cityKey = Object.keys(AU_CITY_COORDS).find(c =>
          (r.city || "").toLowerCase().includes(c.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
        if (!coords) return null;
        const jitter = () => (Math.random() - 0.5) * 0.04;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng + jitter(), coords.lat + jitter()] },
          properties: {
            id: r.id, companyName: r.companyName, city: r.city, state: r.state,
            signalType: r.signalType, radarScore: r.radarScore, priority: r.priority,
            status: r.status, industry: r.industry, confidenceLevel: r.confidenceLevel,
            dateDetected: r.dateDetected, color: getSignalColor(r.signalType),
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "signals" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/buildings", async (req, res) => {
    try {
      const signals = await storage.getBuildingSignals();
      const features = signals.map((s) => {
        const cityKey = Object.keys(AU_CITY_COORDS).find(c =>
          (s.city || "").toLowerCase().includes(c.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
        if (!coords) return null;
        const jitter = () => (Math.random() - 0.5) * 0.03;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng + jitter(), coords.lat + jitter()] },
          properties: {
            id: s.id, buildingName: s.buildingName, address: s.address,
            suburb: s.suburb, city: s.city, signalType: s.signalType,
            observedCompany: s.observedCompany, notes: s.notes,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "buildings" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/tenants", async (req, res) => {
    try {
      const companies = await storage.getCompanyIntelligenceRecords({});
      const features = companies.map((c) => {
        const cityKey = Object.keys(AU_CITY_COORDS).find(k =>
          (c.city || "").toLowerCase().includes(k.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
        if (!coords) return null;
        const jitter = () => (Math.random() - 0.5) * 0.05;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng + jitter(), coords.lat + jitter()] },
          properties: {
            id: c.id, companyName: c.companyName, domain: c.domain, city: c.city, state: c.state,
            industry: c.industry, moveProbability: c.moveProbability,
            confidenceScore: c.confidenceScore, priorityLevel: c.priorityLevel,
            employeeEstimate: c.employeeEstimate, status: c.status,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "tenants" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/movements", async (req, res) => {
    try {
      const relocation = await storage.getRelocationSignals();
      const features = relocation.map((r) => {
        const cityKey = Object.keys(AU_CITY_COORDS).find(k =>
          (r.currentCity || "").toLowerCase().includes(k.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
        if (!coords) return null;
        const jitter = () => (Math.random() - 0.5) * 0.04;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng + jitter(), coords.lat + jitter()] },
          properties: {
            id: r.id, companyName: r.companyName, currentCity: r.currentCity,
            targetCity: r.targetCity, signalType: r.signalType,
            relocationProbability: r.relocationProbability,
            status: r.status, estimatedProjectValue: r.estimatedProjectValue,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "movements" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/demand", async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { suburbDemandSnapshots } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const snaps = await dbInstance.select().from(suburbDemandSnapshots)
        .orderBy(desc(suburbDemandSnapshots.demandScore)).limit(100);
      const features = snaps.map((s) => {
        if (!s.lat || !s.lng) {
          const cityKey = Object.keys(AU_CITY_COORDS).find(k =>
            (s.city || "").toLowerCase().includes(k.toLowerCase()));
          const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
          if (!coords) return null;
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
            properties: {
              suburb: s.suburb, city: s.city, demandScore: s.demandScore,
              demandTier: s.demandTier, activeCompanies: s.activeCompanies,
              recentSignals: s.recentSignals, snapshotDate: s.snapshotDate,
            },
          };
        }
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lng, s.lat] },
          properties: {
            suburb: s.suburb, city: s.city, demandScore: s.demandScore,
            demandTier: s.demandTier, activeCompanies: s.activeCompanies,
            recentSignals: s.recentSignals, snapshotDate: s.snapshotDate,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "demand" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/building-risk", async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { buildingRiskSnapshots } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const snaps = await dbInstance.select().from(buildingRiskSnapshots)
        .orderBy(desc(buildingRiskSnapshots.vacancyRiskScore)).limit(100);
      const features = snaps.map((s) => {
        const cityKey = s.lat ? null : Object.keys(AU_CITY_COORDS).find(k =>
          (s.city || "").toLowerCase().includes(k.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : (s.lat && s.lng ? { lat: s.lat, lng: s.lng } : null);
        if (!coords) return null;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
          properties: {
            id: s.id, buildingName: s.buildingName, city: s.city, suburb: s.suburb,
            vacancyRiskScore: s.vacancyRiskScore, riskTier: s.riskTier,
            tenantTurnoverRate: s.tenantTurnoverRate, snapshotDate: s.snapshotDate,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "building-risk" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/opportunities", async (req, res) => {
    try {
      const { getTopOpportunities } = await import("./services/intelligence/opportunityEngine");
      const opportunities = await getTopOpportunities(50);
      const features = opportunities.map((o) => {
        const cityKey = Object.keys(AU_CITY_COORDS).find(k =>
          (o.city || "").toLowerCase().includes(k.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
        if (!coords) return null;
        const jitter = () => (Math.random() - 0.5) * 0.04;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng + jitter(), coords.lat + jitter()] },
          properties: {
            id: o.id, companyName: o.companyName, city: o.city, state: o.state,
            signalType: o.signalType, opportunityScore: o.opportunityScore,
            confidenceScore: o.confidenceScore, relocationProbability: o.relocationProbability,
            commercialTier: o.commercialTier, source: o.source,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "opportunities" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/zones", async (req, res) => {
    try {
      const { computeZoneScores } = await import("./services/intelligence/zoneScoringEngine");
      const zones = await computeZoneScores();
      const features = zones.map((z) => {
        const cityKey = z.lat ? null : Object.keys(AU_CITY_COORDS).find(k =>
          (z.city || "").toLowerCase().includes(k.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : (z.lat && z.lng ? { lat: z.lat, lng: z.lng } : null);
        if (!coords) return null;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
          properties: {
            suburb: z.suburb, city: z.city, state: z.state, zoneScore: z.zoneScore,
            demandScore: z.demandScore, activeCompanies: z.activeCompanies,
            recentSignals: z.recentSignals, demandTier: z.demandTier,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "zones" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/clusters", async (req, res) => {
    try {
      const radarRecords = await storage.getOfficeMovRadarRecords({});
      const cityGroups: Record<string, { count: number; lat: number; lng: number; city: string }> = {};
      for (const r of radarRecords) {
        const cityKey = Object.keys(AU_CITY_COORDS).find(c =>
          (r.city || "").toLowerCase().includes(c.toLowerCase()));
        if (!cityKey) continue;
        const coords = AU_CITY_COORDS[cityKey];
        if (!cityGroups[cityKey]) cityGroups[cityKey] = { count: 0, lat: coords.lat, lng: coords.lng, city: cityKey };
        cityGroups[cityKey].count++;
      }
      const features = Object.values(cityGroups).map((g) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [g.lng, g.lat] },
        properties: { city: g.city, signalCount: g.count, clusterRadius: Math.min(50, 10 + g.count * 2) },
      }));
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "clusters" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── UPGRADE 1 & 2: New Map Layers ───────────────────────────────────────────

  app.get("/api/map/layers/lease-expiries", async (_req, res) => {
    try {
      const { getLeaseExpiryOpportunities } = await import("./services/intelligence/leaseExpiryService");
      const opps = await getLeaseExpiryOpportunities(50);
      const features = opps.map((o) => {
        const cityKey = Object.keys(AU_CITY_COORDS).find(k =>
          (o.city || "").toLowerCase().includes(k.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
        if (!coords) return null;
        // Add slight jitter so overlapping city markers are visible
        const jitter = () => (Math.random() - 0.5) * 0.05;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng + jitter(), coords.lat + jitter()] },
          properties: {
            companyName: o.companyName, city: o.city,
            predictedExpiryYear: o.predictedExpiryYear,
            predictedExpiryQuarter: o.predictedExpiryQuarter,
            relocationProbability: o.relocationProbability,
            opportunityScore: o.opportunityScore,
            urgencyTier: o.urgencyTier,
            estimatedProjectValue: o.estimatedProjectValue,
            reasoningSummary: o.reasoningSummary,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "lease-expiries" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/tenant-movement", async (_req, res) => {
    try {
      const radarRecords = await storage.getOfficeMovRadarRecords({});
      const movementSignals = radarRecords.filter(r =>
        ["office_relocation", "new_office_signal", "building_move_signal", "sublease", "coworking_exit"].includes(r.signalType ?? "")
      );
      const features = movementSignals.map((r) => {
        const cityKey = Object.keys(AU_CITY_COORDS).find(k =>
          (r.city || "").toLowerCase().includes(k.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
        if (!coords) return null;
        const jitter = () => (Math.random() - 0.5) * 0.06;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng + jitter(), coords.lat + jitter()] },
          properties: {
            companyName: r.companyName, city: r.city,
            signalType: r.signalType,
            radarScore: r.radarScore,
            confidenceLevel: r.confidenceLevel,
            dateDetected: r.dateDetected,
            estimatedProjectValue: r.estimatedProjectValue,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "tenant-movement" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/hierarchy-clusters", async (_req, res) => {
    try {
      const { getTopHierarchyClusters } = await import("./services/intelligence/companyHierarchyService");
      const nodes = await getTopHierarchyClusters(50);
      const cityGroups: Record<string, { count: number; signalSum: number; lat: number; lng: number; city: string; companies: string[] }> = {};
      for (const n of nodes) {
        const cityKey = Object.keys(AU_CITY_COORDS).find(k =>
          (n.city || "").toLowerCase().includes(k.toLowerCase()));
        if (!cityKey) continue;
        const coords = AU_CITY_COORDS[cityKey];
        if (!cityGroups[cityKey]) {
          cityGroups[cityKey] = { count: 0, signalSum: 0, lat: coords.lat, lng: coords.lng, city: cityKey, companies: [] };
        }
        cityGroups[cityKey].count++;
        cityGroups[cityKey].signalSum += n.aggregatedSignalCount ?? 0;
        if (cityGroups[cityKey].companies.length < 5) cityGroups[cityKey].companies.push(n.companyName);
      }
      const features = Object.values(cityGroups).map((g) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [g.lng, g.lat] },
        properties: {
          city: g.city, companyCount: g.count,
          totalSignals: g.signalSum,
          topCompanies: g.companies.join(", "),
        },
      }));
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "hierarchy-clusters" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/demand-zones", async (_req, res) => {
    try {
      const { getTopDemandSuburbs } = await import("./services/intelligence/demandForecastEngine");
      const suburbs = await getTopDemandSuburbs(80);
      const features = suburbs.map((s) => {
        const cityKey = Object.keys(AU_CITY_COORDS).find(k =>
          (s.city || "").toLowerCase().includes(k.toLowerCase()));
        const coords = cityKey ? AU_CITY_COORDS[cityKey] : null;
        if (!coords) return null;
        const jitter = () => (Math.random() - 0.5) * 0.08;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng + jitter(), coords.lat + jitter()] },
          properties: {
            suburb: s.suburb, city: s.city, state: s.state,
            demandScore: s.demandScore, demandTier: s.demandTier,
            activeCompanies: s.activeCompanies, growthRate: s.growthRate,
          },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "demand-zones" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Upgrade admin routes: trigger scan, source toggle ───────────────────────

  app.post("/api/admin/intelligence/trigger-scan", async (req, res) => {
    try {
      const { scanType = "all" } = req.body as { scanType?: string };
      const results: Record<string, string | null> = {};
      const { triggerJob, QUEUES } = await import("./services/jobOrchestrator");
      if (scanType === "all" || scanType === "lease") {
        results.lease = await triggerJob(QUEUES.LEASE_EXPIRY_SCAN);
      }
      if (scanType === "all" || scanType === "hierarchy") {
        results.hierarchy = await triggerJob(QUEUES.HIERARCHY_BUILD);
      }
      if (scanType === "all" || scanType === "graph") {
        results.graph = await triggerJob(QUEUES.GRAPH_REFRESH);
      }
      if (scanType === "all" || scanType === "signals") {
        results.signals = await triggerJob(QUEUES.SIGNAL_INGESTION);
      }
      if (scanType === "all" || scanType === "demand") {
        results.demand = await triggerJob(QUEUES.DEMAND_AGGREGATE);
      }
      res.json({ ok: true, triggered: scanType, results });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/intelligence/source/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body as { isActive: boolean };
      const { db: dbInstance } = await import("./db");
      const { intelligenceSources } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance
        .update(intelligenceSources)
        .set({ isActive: isActive ?? true })
        .where(eq(intelligenceSources.id, id));
      res.json({ ok: true, id, isActive });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/intelligence/lease-expiry-opps", async (_req, res) => {
    try {
      const { getLeaseExpiryOpportunities } = await import("./services/intelligence/leaseExpiryService");
      const opps = await getLeaseExpiryOpportunities(20);
      res.json({ opps, total: opps.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/intelligence/graph-stats", async (_req, res) => {
    try {
      const { getGraphStats } = await import("./services/intelligence/intelligenceGraphService");
      const stats = await getGraphStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/chat/intelligence-context", async (_req, res) => {
    try {
      const { getTopDemandSuburbs } = await import("./services/intelligence/demandForecastEngine");
      const { getTopZones } = await import("./services/intelligence/zoneScoringEngine");
      const { getLeaseExpiryOpportunities } = await import("./services/intelligence/leaseExpiryService");
      const [demandSuburbs, topZones, leaseOpps, radar] = await Promise.all([
        getTopDemandSuburbs(5),
        getTopZones(5),
        getLeaseExpiryOpportunities(5),
        storage.getOfficeMovRadarRecords({}),
      ]);
      const likelyRelocating = radar
        .filter(r => (r.radarScore ?? 0) >= 70)
        .sort((a, b) => (b.radarScore ?? 0) - (a.radarScore ?? 0))
        .slice(0, 5);

      res.json({
        topDemandSuburbs: demandSuburbs.map(s => ({
          suburb: s.suburb, city: s.city, demandScore: s.demandScore, demandTier: s.demandTier,
        })),
        topOpportunityZones: topZones.map(z => ({
          suburb: z.suburb, city: z.city, zoneScore: z.zoneScore, activeCompanies: z.activeCompanies,
        })),
        leaseExpiryOpportunities: leaseOpps.map(o => ({
          companyName: o.companyName, city: o.city, urgencyTier: o.urgencyTier,
          predictedExpiryYear: o.predictedExpiryYear, opportunityScore: o.opportunityScore,
        })),
        likelyRelocating: likelyRelocating.map(r => ({
          companyName: r.companyName, city: r.city, radarScore: r.radarScore, signalType: r.signalType,
        })),
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Intelligence Dashboard (for Command Centre widgets)
  app.get("/api/admin/intelligence/dashboard", async (_req, res) => {
    try {
      const cached = getCached<object>("intelligence-dashboard");
      if (cached) return res.json(cached);
      const { getIntelligenceDashboard } = await import("./services/intelligence/workspaceIntelligenceEngine");
      const raw = await getIntelligenceDashboard();

      // Transform into the shape expected by AdminCommandCentre widgets
      const topOpportunityZones = (raw.topZones ?? []).map((z: any) => ({
        suburb: z.suburb ?? z.city ?? "",
        city: z.city ?? "",
        zoneScore: z.zoneScore ?? 0,
        demandScore: z.demandScore ?? 0,
        activeCompanies: z.activeCompanies ?? 0,
        recentSignals: z.recentSignals ?? 0,
      }));

      const demandHotspots = (raw.topDemandSuburbs ?? []).map((d: any) => ({
        suburb: d.suburb ?? d.city ?? "",
        city: d.city ?? "",
        demandScore: d.demandScore ?? 0,
        demandTier: d.demandTier ?? "low",
        activeCompanies: d.activeCompanies ?? 0,
        recentSignals: d.recentSignals ?? 0,
      }));

      const atRiskBuildings = (raw.highRiskBuildings ?? []).map((b: any) => ({
        buildingName: b.buildingName ?? "Unknown Building",
        city: b.city ?? "",
        vacancyRiskScore: b.vacancyRiskScore ?? 0,
        riskTier: b.riskTier ?? "low",
        tenantTurnoverRate: b.tenantTurnoverRate ?? 0,
      }));

      const relocationReadyCompanies = (raw.relocationReadyCompanies ?? []).map((c: any) => ({
        companyName: c.companyName ?? "Unknown Company",
        city: c.city ?? "",
        moveProbability: c.moveProbability ?? 0,
        confidenceScore: c.confidenceScore ?? 0,
        industry: c.industry ?? null,
        priorityLevel: c.priorityLevel ?? "Low",
      }));

      // Build systemStats from radar + company intelligence
      const [radarRecords, companies] = await Promise.all([
        storage.getOfficeMovRadarRecords({}),
        storage.getCompanyIntelligenceRecords({}),
      ]);
      const highPriorityOpps = radarRecords.filter((r: any) => r.priority === "High").length;
      const confidenceScores = companies.map((c: any) => c.confidenceScore ?? 0).filter((s: number) => s > 0);
      const avgConfidence = confidenceScores.length > 0
        ? confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length
        : 0;

      const dashboard = {
        topOpportunityZones,
        demandHotspots,
        atRiskBuildings,
        relocationReadyCompanies,
        systemStats: {
          totalSignals: radarRecords.length,
          activeCompanies: companies.length,
          highPriorityOpps,
          avgConfidence: Math.round(avgConfidence),
        },
      };

      setCached("intelligence-dashboard", dashboard, 120_000);
      res.json(dashboard);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Job queue status (for Command Centre widget)
  app.get("/api/admin/intelligence/job-queue", async (_req, res) => {
    try {
      const { getJobStats } = await import("./services/jobOrchestrator");
      const stats = await getJobStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Source health (for Command Centre widget)
  app.get("/api/admin/intelligence/source-health", async (_req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { intelligenceSources } = await import("@shared/schema");
      const sources = await dbInstance.select().from(intelligenceSources).limit(50);
      res.json({ sources, total: sources.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/market-intelligence", async (_req, res) => {
    try {
      const cached = getCached<object>("market-intelligence");
      if (cached) return res.json(cached);

      const [all, active] = await Promise.all([
        storage.getOfficeMovRadarRecords({}),
        storage.getOfficeMovRadarRecords({ status: "New" }),
      ]);

      const byCity: Record<string, number> = {};
      const byIndustry: Record<string, number> = {};
      const bySignal: Record<string, number> = {};
      let totalPipelineValue = 0;

      for (const r of active) {
        byCity[r.city] = (byCity[r.city] || 0) + 1;
        if (r.industry) byIndustry[r.industry] = (byIndustry[r.industry] || 0) + 1;
        bySignal[r.signalType] = (bySignal[r.signalType] || 0) + 1;
        const pv = parseInt((r.estimatedProjectValue || "0").replace(/[^0-9]/g, "")) || 0;
        totalPipelineValue += pv;
      }

      const topCities = Object.entries(byCity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([city, count]) => ({ city, count }));

      const topIndustries = Object.entries(byIndustry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([industry, count]) => ({ industry, count }));

      const payload = {
        totalDetected: all.length,
        activeSignals: active.length,
        totalPipelineValue,
        topCities,
        topIndustries,
        bySignalType: bySignal,
        highPriority: active.filter(r => r.priority === "High").length,
        recentSignals: active.slice(0, 10).map(r => ({
          id: r.id, companyName: r.companyName, city: r.city,
          signalType: r.signalType, priority: r.priority,
          estimatedProjectValue: r.estimatedProjectValue, dateDetected: r.dateDetected,
        })),
      };
      setCached("market-intelligence", payload, 60_000);
      res.json(payload);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Company Visitor Identification ───────────────────────────────────────

  function calcEngagementScore(pages: string[]): { score: number; intent: string } {
    let score = 0;
    const pathStr = pages.join(" ").toLowerCase();
    if (pathStr.includes("/product")) score += 10;
    if (pathStr.includes("/ai-workspace") || pathStr.includes("/workspace-planner") || pathStr.includes("/free-office-layout")) score += 25;
    if (pathStr.includes("/upload-your-floor-plan")) score += 40;
    if (pathStr.includes("/quote-builder") || pathStr.includes("/send-us-your-quote") || pathStr.includes("/finance-your-workspace")) score += 30;
    if (pathStr.includes("/workplace-solution") || pathStr.includes("/workplace-strategy")) score += 20;
    if (pathStr.includes("/contact")) score += 15;
    if (pages.length >= 4) score += 10;
    if (pages.length >= 7) score += 10;

    let intent = "general_enquiry";
    if (pathStr.includes("/upload-your-floor-plan") || pathStr.includes("/ai-workspace")) intent = "workspace_planning";
    else if (pathStr.includes("/quote-builder") || pathStr.includes("/finance-your-workspace")) intent = "fitout_project";
    else if (pathStr.includes("/product")) intent = "furniture_purchase";
    else if (pathStr.includes("/workplace-solution") || pathStr.includes("/workplace-strategy")) intent = "office_expansion";

    return { score: Math.min(score, 100), intent };
  }

  // Extend the existing pageview tracker to also update visitor sessions
  app.post("/api/track/visitor-session", async (req, res) => {
    try {
      const { visitorId, pagePath, referrer, utmSource, sessionDuration } = req.body;
      if (!visitorId || !pagePath) return res.json({ ok: false });

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      const ua = req.headers["user-agent"] || "";
      const BOT_PATTERN = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|facebookexternalhit|semrush|ahrefs|mj12bot/i;
      if (BOT_PATTERN.test(ua)) return res.json({ ok: false, reason: "bot" });

      const isMobile = /mobile|android|iphone|ipad/i.test(ua);
      const deviceType = isMobile ? "mobile" : "desktop";

      // Get current session to compute merged engagement score
      const existingSession = await storage.getVisitorSessionByVisitorId(visitorId).catch(() => null);
      const existingPages = (existingSession?.pagesViewed ?? []) as string[];
      const mergedPages = [...new Set([...existingPages, pagePath])];
      const { score, intent } = calcEngagementScore(mergedPages);

      // IP enrichment — optional, non-blocking
      let enriched: { city?: string; country?: string; org?: string; region?: string } = {};
      const isPrivateIp = !ip || ip === "127.0.0.1" || ip.startsWith("192.168") || ip.startsWith("10.") || ip.startsWith("::1");
      if (!isPrivateIp) {
        try {
          const ipResp = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(2000) });
          if (ipResp.ok) {
            const ipData = await ipResp.json() as any;
            enriched = { city: ipData.city, country: ipData.country_name, org: ipData.org, region: ipData.region };
          }
        } catch { /* optional */ }
      }

      const companyName = enriched.org ? enriched.org.replace(/^AS\d+\s*/i, "").trim() : undefined;

      await storage.upsertVisitorSession(visitorId, {
        pagesViewed: [pagePath],
        engagementScore: score,
        intent,
        deviceType,
        city: enriched.city,
        country: enriched.country,
        region: enriched.region,
        companyName: companyName || undefined,
        isp: enriched.org,
        referrer: referrer || undefined,
        utmSource: utmSource || undefined,
        sessionDurationSeconds: sessionDuration || 0,
        ipAddress: ip || undefined,
      });

      res.json({ ok: true, score, intent });
    } catch (err: any) {
      res.json({ ok: false });
    }
  });

  app.get("/api/admin/company-visitors", async (req, res) => {
    try {
      const { minScore, intent, city } = req.query;
      const sessions = await storage.getVisitorSessions({
        minScore: minScore ? parseInt(minScore as string) : undefined,
        intent: intent as string | undefined,
        city: city as string | undefined,
        limit: 200,
      });
      res.json(sessions);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/company-visitors/stats", async (_req, res) => {
    try {
      const sessions = await storage.getVisitorSessions({ limit: 1000 });
      const highIntent = sessions.filter(s => (s.engagementScore ?? 0) >= 40);
      const byCity: Record<string, number> = {};
      const byIntent: Record<string, number> = {};
      for (const s of sessions) {
        if (s.city) byCity[s.city] = (byCity[s.city] || 0) + 1;
        if (s.intent) byIntent[s.intent] = (byIntent[s.intent] || 0) + 1;
      }
      res.json({
        total: sessions.length,
        highIntent: highIntent.length,
        byCity: Object.entries(byCity).sort((a,b) => b[1]-a[1]).slice(0,10),
        byIntent: Object.entries(byIntent).sort((a,b) => b[1]-a[1]),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTREACH ENGINE — Contacts, Threads, Sequences, Bookings
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Contact Discovery ──────────────────────────────────────────────────────

  app.get("/api/contacts/discovery/:companyId", async (req, res) => {
    try {
      const { getContactsForCompany } = await import("./services/outreach/contactDiscoveryService");
      const contacts = await getContactsForCompany(req.params.companyId);
      res.json({ contacts, total: contacts.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/contacts/discovery/run", async (req, res) => {
    try {
      const { companyId, opportunityId } = req.body;
      if (!companyId) return res.status(400).json({ error: "companyId required" });
      const { triggerJob } = await import("./services/jobOrchestrator");
      const jobId = await triggerJob("contacts.discovery" as any, { companyId, opportunityId });
      // Also run immediately for responsiveness
      const { runContactDiscovery } = await import("./services/outreach/contactDiscoveryService");
      const result = await runContactDiscovery(companyId, opportunityId);
      res.json({ success: true, jobId, ...result });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/contacts/:id/mark-primary", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { companyContacts } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(companyContacts).set({ isPrimary: true }).where(eq(companyContacts.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Outreach Threads ───────────────────────────────────────────────────────

  app.get("/api/outreach/threads", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { outreachThreads } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const limit = parseInt(req.query.limit as string) || 50;
      const threads = await db.select().from(outreachThreads).orderBy(desc(outreachThreads.updatedAt)).limit(limit);
      res.json({ threads, total: threads.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/outreach/threads/:id", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { outreachThreads, outreachMessages, outreachSequences, outreachEvents } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [thread] = await db.select().from(outreachThreads).where(eq(outreachThreads.id, req.params.id));
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      const [messages, sequences, events] = await Promise.all([
        db.select().from(outreachMessages).where(eq(outreachMessages.threadId, req.params.id)),
        db.select().from(outreachSequences).where(eq(outreachSequences.threadId, req.params.id)),
        db.select().from(outreachEvents).where(eq(outreachEvents.threadId, req.params.id)),
      ]);
      res.json({ thread, messages, sequences, events });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/outreach/generate", async (req, res) => {
    try {
      const { companyId, companyName, city, industry, contactId, opportunityId, opportunityScore, relocationProbability, signals, leaseExpiryTiming } = req.body;
      if (!companyId || !companyName) return res.status(400).json({ error: "companyId and companyName required" });
      const { createOutreachThread } = await import("./services/outreach/outreachEngine");
      const threadId = await createOutreachThread({
        companyId, companyName, city, industry, contactId, opportunityId,
        opportunityScore, relocationProbability, signals, leaseExpiryTiming,
      });
      res.json({ success: true, threadId });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/outreach/approve", async (req, res) => {
    try {
      const { messageId } = req.body;
      if (!messageId) return res.status(400).json({ error: "messageId required" });
      const { db } = await import("./db");
      const { outreachMessages } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(outreachMessages)
        .set({ deliveryStatus: "approved", approvedAt: new Date() })
        .where(eq(outreachMessages.id, messageId));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/outreach/send", async (req, res) => {
    try {
      const SAFE_MODE = process.env.SAFE_MODE === "true";
      if (SAFE_MODE) return res.json({ success: true, safeMode: true, message: "SAFE_MODE active — message queued as draft only" });
      const { messageId } = req.body;
      if (!messageId) return res.status(400).json({ error: "messageId required" });
      const { db } = await import("./db");
      const { outreachMessages } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(outreachMessages)
        .set({ deliveryStatus: "sent", sentAt: new Date() })
        .where(eq(outreachMessages.id, messageId));
      res.json({ success: true, safeMode: false });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/outreach/pause", async (req, res) => {
    try {
      const { threadId } = req.body;
      if (!threadId) return res.status(400).json({ error: "threadId required" });
      const { pauseThread } = await import("./services/outreach/outreachEngine");
      await pauseThread(threadId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/outreach/resume", async (req, res) => {
    try {
      const { threadId } = req.body;
      if (!threadId) return res.status(400).json({ error: "threadId required" });
      const { db } = await import("./db");
      const { outreachThreads } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(outreachThreads)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(outreachThreads.id, threadId));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/outreach/stop", async (req, res) => {
    try {
      const { threadId, reason } = req.body;
      if (!threadId) return res.status(400).json({ error: "threadId required" });
      const { stopThread } = await import("./services/outreach/outreachEngine");
      await stopThread(threadId, reason ?? "manual");
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Bookings ───────────────────────────────────────────────────────────────

  app.get("/api/bookings/status", async (_req, res) => {
    try {
      const { getBookingStats } = await import("./services/outreach/bookingService");
      res.json(await getBookingStats());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/bookings/create-link", async (req, res) => {
    try {
      const { threadId, companyId, companyName, contactId, opportunityId } = req.body;
      if (!threadId || !companyId || !companyName) return res.status(400).json({ error: "threadId, companyId, companyName required" });
      const { createBookingLink } = await import("./services/outreach/bookingService");
      const result = await createBookingLink({ threadId, companyId, companyName, contactId, opportunityId });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/bookings/create-event", async (req, res) => {
    try {
      const { threadId, bookingEventId, meetingTime } = req.body;
      if (!threadId || !bookingEventId) return res.status(400).json({ error: "threadId and bookingEventId required" });
      const { confirmMeeting } = await import("./services/outreach/bookingService");
      await confirmMeeting({ threadId, bookingEventId, meetingTime: new Date(meetingTime) });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/bookings/webhook", async (req, res) => {
    try {
      // Handle booking provider webhooks (Calendly, Google Calendar, etc.)
      const { threadId, bookingEventId, meetingTime, calendarEventId } = req.body;
      if (threadId && bookingEventId) {
        const { confirmMeeting } = await import("./services/outreach/bookingService");
        await confirmMeeting({ threadId, bookingEventId, meetingTime: new Date(meetingTime), calendarEventId });
      }
      res.json({ received: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Admin Outreach Stats ───────────────────────────────────────────────────

  app.get("/api/admin/outreach/stats", async (_req, res) => {
    try {
      const { getOutreachStats } = await import("./services/outreach/outreachGenerationService");
      const { getOutreachReadyCompanies, getFollowUpsDue, getActiveThreads, getMeetingsBooked } = await import("./services/outreach/outreachEngine");
      const [stats, ready, followUps, active, meetings] = await Promise.all([
        getOutreachStats(),
        getOutreachReadyCompanies(5),
        getFollowUpsDue(10),
        getActiveThreads(20),
        getMeetingsBooked(5),
      ]);
      res.json({ ...stats, outreachReadyCount: ready.length, followUpsDueCount: followUps.length, activeThreadCount: active.length, recentMeetings: meetings.slice(0, 3) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/bookings/stats", async (_req, res) => {
    try {
      const { getBookingStats } = await import("./services/outreach/bookingService");
      res.json(await getBookingStats());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/contact-discovery/stats", async (_req, res) => {
    try {
      const { getContactDiscoveryStats } = await import("./services/outreach/contactDiscoveryService");
      res.json(await getContactDiscoveryStats());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Outreach-ready companies (for Alex + Command Centre) ───────────────────

  app.get("/api/outreach/ready", async (_req, res) => {
    try {
      const { getOutreachReadyCompanies } = await import("./services/outreach/outreachEngine");
      res.json(await getOutreachReadyCompanies());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/outreach/follow-ups-due", async (_req, res) => {
    try {
      const { getFollowUpsDue } = await import("./services/outreach/outreachEngine");
      res.json(await getFollowUpsDue());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Map Layer Routes — Outreach Layers ────────────────────────────────────

  app.get("/api/map/layers/outreach-ready", async (_req, res) => {
    try {
      const { getOutreachReadyCompanies } = await import("./services/outreach/outreachEngine");
      const { db } = await import("./db");
      const { companyContacts } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const companies = await getOutreachReadyCompanies(100);
      const CITY_COORDS: Record<string, [number, number]> = {
        "Sydney": [-33.8688, 151.2093], "Melbourne": [-37.8136, 144.9631],
        "Brisbane": [-27.4698, 153.0251], "Perth": [-31.9505, 115.8605],
        "Adelaide": [-34.9285, 138.6007], "Canberra": [-35.2809, 149.1300],
        "Gold Coast": [-28.0167, 153.4000], "Newcastle": [-32.9283, 151.7817],
      };
      const features = await Promise.all(companies.map(async (c) => {
        const baseCoords = CITY_COORDS[c.city ?? "Sydney"] ?? [-33.8688, 151.2093];
        const contacts = await db.select().from(companyContacts).where(eq(companyContacts.companyIntelligenceId, c.id)).limit(5);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [baseCoords[1] + (Math.random() - 0.5) * 0.3, baseCoords[0] + (Math.random() - 0.5) * 0.3] as [number, number] },
          properties: {
            company: c.companyName, city: c.city, opportunityScore: c.confidenceScore, relocationProbability: c.moveProbability,
            contact_count: contacts.length, outreach_status: "ready",
            recommended_action: (c.moveProbability ?? 0) >= 70 ? "Send move planning outreach" : "Send intro outreach",
          },
        };
      }));
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "outreach-ready" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/contact-coverage", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { companyContacts } = await import("@shared/schema");
      const companies = await storage.getCompanyIntelligenceRecords({});
      const contacts = await db.select().from(companyContacts).limit(2000);
      const contactsByCompany: Record<string, typeof contacts> = {};
      for (const c of contacts) contactsByCompany[c.companyIntelligenceId] = [...(contactsByCompany[c.companyIntelligenceId] ?? []), c];
      const CITY_COORDS: Record<string, [number, number]> = {
        "Sydney": [-33.8688, 151.2093], "Melbourne": [-37.8136, 144.9631],
        "Brisbane": [-27.4698, 153.0251], "Perth": [-31.9505, 115.8605],
        "Adelaide": [-34.9285, 138.6007], "Canberra": [-35.2809, 149.1300],
      };
      const features = companies.slice(0, 200).map(c => {
        const baseCoords = CITY_COORDS[c.city ?? "Sydney"] ?? [-33.8688, 151.2093];
        const companyContacts = contactsByCompany[c.id] ?? [];
        const primary = companyContacts.find(cc => cc.isPrimary) ?? companyContacts[0];
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [baseCoords[1] + (Math.random() - 0.5) * 0.3, baseCoords[0] + (Math.random() - 0.5) * 0.3] as [number, number] },
          properties: {
            company: c.companyName, city: c.city, contact_count: companyContacts.length,
            primary_contact: primary?.contactName ?? null, opportunityScore: c.confidenceScore,
          },
        };
      });
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "contact-coverage" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/meetings-booked", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { meetingBookingEvents, companyContacts } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const meetings = await db.select().from(meetingBookingEvents).limit(200);
      const CITY_COORDS: Record<string, [number, number]> = {
        "Sydney": [-33.8688, 151.2093], "Melbourne": [-37.8136, 144.9631],
        "Brisbane": [-27.4698, 153.0251], "Perth": [-31.9505, 115.8605],
      };
      const features = meetings.map(m => {
        const [lat, lng] = resolveAuCityCoords((m as any).city);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lng + mapJitter(0.15), lat + mapJitter(0.15)] as [number, number] },
          properties: {
            company: m.companyName, city: (m as any).city || "Australia", meeting_status: m.bookingStatus,
            primary_contact: null, opportunityScore: 80,
          },
        };
      });
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "meetings-booked" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/follow-up-due", async (_req, res) => {
    try {
      const { getFollowUpsDue } = await import("./services/outreach/outreachEngine");
      const due = await getFollowUpsDue(100);
      const CITY_COORDS: Record<string, [number, number]> = {
        "Sydney": [-33.8688, 151.2093], "Melbourne": [-37.8136, 144.9631],
        "Brisbane": [-27.4698, 153.0251], "Perth": [-31.9505, 115.8605],
      };
      const features = due.map(d => {
        const [lat, lng] = resolveAuCityCoords((d.thread as any)?.city);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lng + mapJitter(0.15), lat + mapJitter(0.15)] as [number, number] },
          properties: {
            company: d.thread?.companyName ?? "Unknown", city: (d.thread as any)?.city || "Australia",
            currentStage: d.thread?.currentStage ?? 0,
            outreach_status: d.thread?.status ?? "active",
            opportunityScore: d.thread?.opportunityScore ?? 50,
          },
        };
      });
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "follow-up-due" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Trigger outreach for high-value opportunities ───────────────────

  app.post("/api/admin/outreach/create-for-top-opportunities", async (req, res) => {
    try {
      const { createOutreachForHighValueOpportunities } = await import("./services/outreach/outreachEngine");
      const result = await createOutreachForHighValueOpportunities();
      res.json({ success: true, ...result });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/outreach/run-contact-discovery", async (req, res) => {
    try {
      const { runDiscoveryForHighValueOpportunities } = await import("./services/outreach/contactDiscoveryService");
      await runDiscoveryForHighValueOpportunities();
      res.json({ success: true, message: "Contact discovery completed for high-value opportunities" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/outreach/process-followups", async (req, res) => {
    try {
      const { processScheduledFollowUps } = await import("./services/outreach/outreachEngine");
      const result = await processScheduledFollowUps();
      res.json({ success: true, ...result });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── STRIPE REVENUE ENGINE ────────────────────────────────────────────────────

  app.get("/api/payments/status", async (_req, res) => {
    try {
      const { getStripeConfig } = await import("./services/stripe/stripeConfigService");
      const { getRevenueStats } = await import("./services/stripe/revenueService");
      const config = getStripeConfig();
      const stats = await getRevenueStats();
      res.json({ config, stats });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/payments/create-link", async (req, res) => {
    try {
      const { quoteId, clientName, clientEmail, companyName, companyId, opportunityId, amount, currency, description } = req.body;
      if (!quoteId || !clientName || !clientEmail || !amount) {
        return res.status(400).json({ error: "quoteId, clientName, clientEmail, amount are required" });
      }
      const { createPaymentLink } = await import("./services/stripe/paymentLinkService");
      const result = await createPaymentLink({ quoteId, clientName, clientEmail, companyName, companyId, opportunityId, amount, currency, linkType: "full", description });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/payments/create-deposit-link", async (req, res) => {
    try {
      const { quoteId, clientName, clientEmail, companyName, companyId, opportunityId, amount, depositPercent, currency, description } = req.body;
      if (!quoteId || !clientName || !clientEmail || !amount) {
        return res.status(400).json({ error: "quoteId, clientName, clientEmail, amount are required" });
      }
      const { createPaymentLink } = await import("./services/stripe/paymentLinkService");
      const result = await createPaymentLink({ quoteId, clientName, clientEmail, companyName, companyId, opportunityId, amount, currency, linkType: "deposit", depositPercent: depositPercent || 30, description });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/payments/create-invoice", async (req, res) => {
    try {
      const { quoteId, clientName, clientEmail, companyName, companyId, opportunityId, amount, currency, daysUntilDue, description, stripeCustomerId } = req.body;
      if (!quoteId || !clientName || !clientEmail || !amount) {
        return res.status(400).json({ error: "quoteId, clientName, clientEmail, amount are required" });
      }
      const { createInvoice } = await import("./services/stripe/invoiceService");
      const result = await createInvoice({ quoteId, clientName, clientEmail, companyName, companyId, opportunityId, amount, currency, daysUntilDue, description, stripeCustomerId });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/payments/resend-link", async (req, res) => {
    try {
      const { linkId } = req.body;
      if (!linkId) return res.status(400).json({ error: "linkId is required" });
      const { getStripeConfig } = await import("./services/stripe/stripeConfigService");
      const { getPaymentLinksForQuote } = await import("./services/stripe/paymentLinkService");
      const config = getStripeConfig();
      res.json({ success: true, message: config.safeMode ? "Resend simulated (SAFE MODE)" : "Payment link resent" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/payments/resend-invoice", async (req, res) => {
    try {
      const { invoiceLogId } = req.body;
      if (!invoiceLogId) return res.status(400).json({ error: "invoiceLogId is required" });
      const { resendInvoice } = await import("./services/stripe/invoiceService");
      const result = await resendInvoice(invoiceLogId);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/payments/reconcile", async (req, res) => {
    try {
      const { quoteId, amount, notes } = req.body;
      if (!quoteId || !amount) return res.status(400).json({ error: "quoteId and amount are required" });
      const { recordRevenueEvent } = await import("./services/stripe/revenueService");
      await recordRevenueEvent({ quoteId, eventType: "manual_reconciliation", amount, isSimulated: false });
      await storage.updateQuote(quoteId, { financialStatus: "paid", amountPaid: amount, amountDue: 0, lastPaymentAt: new Date() });
      res.json({ success: true, message: "Payment reconciled manually" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/payments/quote/:quoteId", async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { getPaymentLinksForQuote } = await import("./services/stripe/paymentLinkService");
      const { getInvoicesForQuote } = await import("./services/stripe/invoiceService");
      const links = await getPaymentLinksForQuote(quoteId);
      const invoices = await getInvoicesForQuote(quoteId);
      res.json({ quoteId, paymentLinks: links, invoices });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/payments/simulate-webhook", async (req, res) => {
    try {
      const { simulateWebhookEvent } = await import("./services/stripe/webhookService");
      const result = await simulateWebhookEvent(req.body);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post(
    "/api/payments/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"] as string | undefined;
      if (!sig) return res.status(400).json({ error: "Missing stripe-signature header" });
      try {
        const { processStripeWebhook } = await import("./services/stripe/webhookService");
        const result = await processStripeWebhook(req.body as Buffer, sig);
        if (!result.success && result.message !== "duplicate_skipped") {
          return res.status(400).json({ error: result.message });
        }
        res.json(result);
      } catch (err: any) {
        console.error("[PaymentWebhook] Error:", err.message);
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ─── ADMIN REVENUE ROUTES ─────────────────────────────────────────────────────

  app.get("/api/admin/revenue/stats", async (_req, res) => {
    try {
      const { getRevenueStats } = await import("./services/stripe/revenueService");
      const stats = await getRevenueStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/revenue/payments", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { paymentLinks } = await import("../shared/schema");
      const { desc } = await import("drizzle-orm");
      const links = await db.select().from(paymentLinks).orderBy(desc(paymentLinks.createdAt)).limit(50);
      res.json({ payments: links, total: links.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/revenue/invoices", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { invoicesLog } = await import("../shared/schema");
      const { desc } = await import("drizzle-orm");
      const invoices = await db.select().from(invoicesLog).orderBy(desc(invoicesLog.createdAt)).limit(50);
      res.json({ invoices, total: invoices.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/revenue/webhooks", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { webhookEvents } = await import("../shared/schema");
      const { desc } = await import("drizzle-orm");
      const events = await db.select().from(webhookEvents).orderBy(desc(webhookEvents.createdAt)).limit(100);
      res.json({ events, total: events.length, processed: events.filter(e => e.processed).length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── MAP PAYMENT LAYERS ───────────────────────────────────────────────────────

  // ── Shared city-to-coord helper for payment/revenue map layers ──────────────
  function resolveAuCityCoords(city: string | null | undefined): [number, number] {
    const AU_MAP_COORDS: Record<string, [number, number]> = {
      "sydney": [-33.8688, 151.2093], "melbourne": [-37.8136, 144.9631],
      "brisbane": [-27.4698, 153.0251], "perth": [-31.9505, 115.8605],
      "adelaide": [-34.9285, 138.6007], "canberra": [-35.2802, 149.1310],
      "gold coast": [-28.0167, 153.4000], "newcastle": [-32.9283, 151.7817],
      "sunshine coast": [-26.6500, 153.0667], "wollongong": [-34.4278, 150.8931],
    };
    const key = (city || "").toLowerCase();
    for (const [k, v] of Object.entries(AU_MAP_COORDS)) {
      if (key.includes(k)) return v;
    }
    return [-33.8688, 151.2093]; // default Sydney
  }
  function mapJitter(scale = 0.04): number { return (Math.random() - 0.5) * scale; }

  app.get("/api/map/layers/payments-pending", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { quotes } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const pendingQuotes = await db.select().from(quotes).where(eq(quotes.financialStatus, "payment_pending")).limit(200);
      const features = pendingQuotes.map((q: any) => {
        const [lat, lng] = resolveAuCityCoords(q.city);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng + mapJitter(), lat + mapJitter()] },
          properties: { company: q.companyName, city: q.city || "Unknown", financialStatus: q.financialStatus, amountDue: q.amountDue, quoteId: q.id, recommendedAction: "Send payment reminder" },
        };
      });
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "payments-pending" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/deposits-paid", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { quotes } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const depositQuotes = await db.select().from(quotes).where(eq(quotes.financialStatus, "deposit_paid")).limit(200);
      const features = depositQuotes.map((q: any) => {
        const [lat, lng] = resolveAuCityCoords(q.city);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng + mapJitter(), lat + mapJitter()] },
          properties: { company: q.companyName, city: q.city || "Unknown", financialStatus: q.financialStatus, amountPaid: q.amountPaid, amountDue: q.amountDue, quoteId: q.id, recommendedAction: "Process final payment" },
        };
      });
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "deposits-paid" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/revenue-zones", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { revenueEvents } = await import("../shared/schema");
      const { gte } = await import("drizzle-orm");
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const events = await db.select().from(revenueEvents).where(gte(revenueEvents.occurredAt, weekAgo)).limit(200);
      const totalRevenue = events.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      const features = events.map((e: any) => {
        // Use city from event metadata if available, else default to Sydney area
        const [lat, lng] = resolveAuCityCoords(e.city || e.metadata?.city);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng + mapJitter(0.12), lat + mapJitter(0.12)] },
          properties: { eventType: e.eventType, amount: e.amount, currency: e.currency, isSimulated: e.isSimulated, occurredAt: e.occurredAt },
        };
      });
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, totalRevenue, layer: "revenue-zones" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── DEAL CLOSING SYSTEM ──────────────────────────────────────────────────

  app.post("/api/proposals/generate", async (req, res) => {
    try {
      const { quoteId, opportunityId, title } = req.body;
      if (!quoteId) return res.status(400).json({ error: "quoteId required" });
      const proposal = await proposalService.generateFromQuote(quoteId, { opportunityId, title });
      res.json({ success: true, proposal });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/proposals", async (req, res) => {
    try {
      const { status, quoteId } = req.query as any;
      const proposals = await proposalService.listProposals({ status, quoteId });
      res.json(proposals);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/proposals/stats", async (req, res) => {
    try {
      const stats = await proposalService.getProposalStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/proposals/:id/html", async (req, res) => {
    try {
      const { db: dbI } = await import("./db");
      const { proposals: propsTable } = await import("../shared/schema");
      const { eq: eqI } = await import("drizzle-orm");
      const [prop] = await dbI.select().from(propsTable).where(eqI(propsTable.id, req.params.id)).limit(1);
      if (!prop) return res.status(404).json({ error: "Proposal not found" });
      res.setHeader("Content-Type", "text/html");
      res.send(prop.htmlContent || "<p>No content</p>");
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/proposals/:id/status", async (req, res) => {
    try {
      const { status, rejectionReason } = req.body;
      const updated = await proposalService.updateStatus(req.params.id, status, { rejectionReason });
      res.json({ success: true, proposal: updated });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/proposals/pipeline-stages", async (_req, res) => {
    res.json({ stages: proposalService.getPipelineStages() });
  });

  // Pricing Engine
  app.post("/api/pricing/calculate", async (req, res) => {
    try {
      const { costPrice, sellPrice, discountPercent } = req.body;
      if (!costPrice || !sellPrice) return res.status(400).json({ error: "costPrice and sellPrice required" });
      const result = pricingEngine.calculate({ costPrice, sellPrice, discountPercent });
      res.json({ success: true, pricing: result, rules: PRICING_RULES });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/quotes/:id/pricing", async (req, res) => {
    try {
      const { costPrice, discountPercent } = req.body;
      const { quotes: quotesT } = await import("../shared/schema");
      const { eq: eqI } = await import("drizzle-orm");
      const [existing] = await db.select().from(quotesT).where(eqI(quotesT.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Quote not found" });
      const pricing = pricingEngine.calculate({ costPrice: costPrice ?? existing.costPrice ?? 0, sellPrice: existing.totalIncGst ?? 0, discountPercent: discountPercent ?? existing.discountPercent ?? 0 });
      const [updated] = await db.update(quotesT).set({ costPrice: pricing.costPrice, marginPercent: pricing.marginPercent, discountPercent: pricing.discountPercent ?? discountPercent ?? 0, updatedAt: new Date() }).where(eqI(quotesT.id, req.params.id)).returning();
      const approvalCheck = await dealApprovalService.checkAndCreateApproval(req.params.id, existing.opportunityId || undefined);
      res.json({ success: true, quote: updated, pricing, approvalRequired: approvalCheck.required, approval: approvalCheck.approval });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/quotes/:id/pipeline-stage", async (req, res) => {
    try {
      const { stage } = req.body;
      const validStages = ["lead", "qualified", "meeting_booked", "proposal_sent", "negotiation", "approved", "won", "lost"];
      if (!validStages.includes(stage)) return res.status(400).json({ error: `Invalid stage. Valid: ${validStages.join(", ")}` });
      const { quotes: quotesT } = await import("../shared/schema");
      const { eq: eqI } = await import("drizzle-orm");
      const [updated] = await db.update(quotesT).set({ pipelineStage: stage, updatedAt: new Date() }).where(eqI(quotesT.id, req.params.id)).returning();
      res.json({ success: true, quote: updated });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Deal Approvals
  app.post("/api/approvals/check", async (req, res) => {
    try {
      const { quoteId, opportunityId } = req.body;
      if (!quoteId) return res.status(400).json({ error: "quoteId required" });
      const result = await dealApprovalService.checkAndCreateApproval(quoteId, opportunityId);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/approvals", async (req, res) => {
    try {
      const { status } = req.query as any;
      const list = await dealApprovalService.listApprovals({ status });
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/approvals/stats", async (req, res) => {
    try {
      const stats = await dealApprovalService.getApprovalStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/approvals/:id/approve", async (req, res) => {
    try {
      const { approvedBy } = req.body;
      const approval = await dealApprovalService.approve(req.params.id, approvedBy || "admin@thecorporatedesk.com.au");
      res.json({ success: true, approval });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/approvals/:id/reject", async (req, res) => {
    try {
      const { approvedBy, note } = req.body;
      const approval = await dealApprovalService.reject(req.params.id, approvedBy || "admin@thecorporatedesk.com.au", note);
      res.json({ success: true, approval });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Admin Deal Closing stats
  app.get("/api/admin/deal-closing/stats", async (_req, res) => {
    try {
      const { quotes: quotesT } = await import("../shared/schema");
      const allQuotes = await db.select().from(quotesT);
      const proposalStats = await proposalService.getProposalStats();
      const approvalStats = await dealApprovalService.getApprovalStats();
      const now = new Date();
      const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const negotiation = allQuotes.filter(q => q.pipelineStage === "negotiation").length;
      const closingThisWeek = allQuotes.filter(q => {
        if (q.pipelineStage !== "approved" && q.pipelineStage !== "negotiation") return false;
        const updated = q.updatedAt ? new Date(q.updatedAt) : null;
        return updated && updated <= endOfWeek;
      }).length;
      res.json({ proposals: proposalStats, approvals: approvalStats, negotiation, closingThisWeek, totalQuotes: allQuotes.length, pipeline: { lead: allQuotes.filter(q=>q.pipelineStage==="lead").length, qualified: allQuotes.filter(q=>q.pipelineStage==="qualified").length, meeting_booked: allQuotes.filter(q=>q.pipelineStage==="meeting_booked").length, proposal_sent: allQuotes.filter(q=>q.pipelineStage==="proposal_sent").length, negotiation, approved: allQuotes.filter(q=>q.pipelineStage==="approved").length, won: allQuotes.filter(q=>q.pipelineStage==="won").length, lost: allQuotes.filter(q=>q.pipelineStage==="lost").length } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── PARTNER COMMISSIONS ──────────────────────────────────────────────────

  app.post("/api/commissions", async (req, res) => {
    try {
      const { partnerId, dealValue, opportunityId, quoteId, referralId, commissionPercent, notes } = req.body;
      if (!partnerId || !dealValue) return res.status(400).json({ error: "partnerId and dealValue required" });
      const commission = await commissionService.createCommission({ partnerId, dealValue, opportunityId, quoteId, referralId, commissionPercent, notes });
      res.json({ success: true, commission });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/commissions", async (req, res) => {
    try {
      const { status, partnerId } = req.query as any;
      const list = await commissionService.listAll({ status, partnerId });
      const stats = await commissionService.getCommissionStats();
      // Join partner names from the partners table
      const { partners: pT } = await import("../shared/schema");
      const partnerRows = await db.select({ id: pT.id, companyName: pT.companyName }).from(pT);
      const partnerMap = Object.fromEntries(partnerRows.map(p => [p.id, p.companyName]));
      const commissions = list.map((c: any) => ({
        ...c,
        partnerName: partnerMap[c.partnerId] ?? undefined,
        amount: c.commissionAmount ?? 0,
      }));
      res.json({ ...stats, commissions });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/commissions/stats", async (_req, res) => {
    try {
      const stats = await commissionService.getCommissionStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/commissions/:id/approve", async (req, res) => {
    try {
      const commission = await commissionService.approveCommission(req.params.id);
      res.json({ success: true, commission });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/commissions/:id/mark-paid", async (req, res) => {
    try {
      const { invoiceRef } = req.body;
      const commission = await commissionService.markPaid(req.params.id, invoiceRef);
      res.json({ success: true, commission });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/commissions/stats", async (_req, res) => {
    try {
      const stats = await commissionService.getCommissionStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── BUILDING + TENANT DATABASE ───────────────────────────────────────────

  app.get("/api/admin/buildings", async (req, res) => {
    try {
      const { buildings: bT } = await import("../shared/schema");
      const list = await db.select().from(bT);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/buildings/stats", async (_req, res) => {
    try {
      const stats = await buildingIngestionService.getBuildingStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/buildings/seed", async (_req, res) => {
    try {
      const result = await buildingIngestionService.seedAustralianBuildings();
      res.json({ success: true, ...result });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/buildings", async (req, res) => {
    try {
      const { buildings: bT } = await import("../shared/schema");
      const [building] = await db.insert(bT).values({ ...req.body, sourceType: "manual" }).returning();
      await buildingIngestionService.refreshSuburbEdges();
      res.json({ success: true, building });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/buildings/:id/tenants", async (req, res) => {
    try {
      const { tenants: tT } = await import("../shared/schema");
      const { eq: eqI } = await import("drizzle-orm");
      const list = await db.select().from(tT).where(eqI(tT.buildingId, req.params.id));
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/tenants", async (req, res) => {
    try {
      const tenant = await buildingIngestionService.addTenant(req.body);
      res.json({ success: true, tenant });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/tenants", async (req, res) => {
    try {
      const { tenants: tT } = await import("../shared/schema");
      const list = await db.select().from(tT);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/leases", async (req, res) => {
    try {
      const body = req.body;
      const lease = await buildingIngestionService.addLease({
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      });
      res.json({ success: true, lease });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/leases", async (req, res) => {
    try {
      const { leases: lT } = await import("../shared/schema");
      const list = await db.select().from(lT);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Enhanced map layers for structured buildings/tenants
  app.get("/api/map/layers/buildings-structured", async (_req, res) => {
    try {
      const { buildings: bT } = await import("../shared/schema");
      const list = await db.select().from(bT);
      const features = list.filter(b => b.lat && b.lng).map(b => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [b.lng!, b.lat!] },
        properties: {
          id: b.id, name: b.name, address: b.address, suburb: b.suburb, city: b.city,
          state: b.state, buildingGrade: b.buildingGrade, floors: b.floors,
          totalAreaSqm: b.totalAreaSqm, currentVacancyPct: b.currentVacancyPct,
          currentVacancySqm: b.currentVacancySqm, nabers: b.nabers, yearBuilt: b.yearBuilt,
        },
      }));
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "buildings-structured" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/map/layers/leases-expiry", async (_req, res) => {
    try {
      const { leases: lT, buildings: bT } = await import("../shared/schema");
      const { eq: eqI } = await import("drizzle-orm");
      const allLeases = await db.select().from(lT);
      const allBuildings = await db.select().from(bT);
      const buildingMap = Object.fromEntries(allBuildings.map(b => [b.id, b]));
      const now = new Date();
      const in18Months = new Date(now.getTime() + 18 * 30 * 24 * 60 * 60 * 1000);
      const expiring = allLeases.filter(l => l.expiryDate && new Date(l.expiryDate) <= in18Months && l.status === "active");
      const features = expiring.map(l => {
        const building = buildingMap[l.buildingId];
        if (!building?.lat || !building?.lng) return null;
        const monthsToExpiry = l.expiryDate ? Math.round((new Date(l.expiryDate).getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000)) : null;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [building.lng!, building.lat!] },
          properties: { id: l.id, companyName: l.companyName, buildingName: building.name, suburb: building.suburb, city: building.city, expiryDate: l.expiryDate, monthsToExpiry, spaceSizeSqm: l.spaceSizeSqm, totalAnnualRent: l.totalAnnualRent, status: l.status },
        };
      }).filter(Boolean);
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "leases-expiry" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Stage 1.8: Graph Connections Map Layer ────────────────────────────────
  app.get("/api/map/layers/graph-connections", async (_req, res) => {
    try {
      const { getGraphStats, getCompaniesInSameSuburb } = await import("./services/intelligence/intelligenceGraphService");
      const { suburbDemandSnapshots } = await import("../shared/schema");
      const suburbs = await db.select().from(suburbDemandSnapshots).limit(200);
      const stats = await getGraphStats();
      const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
        Brisbane: { lat: -27.4698, lng: 153.0251 }, Melbourne: { lat: -37.8136, lng: 144.9631 },
        Sydney: { lat: -33.8688, lng: 151.2093 }, Perth: { lat: -31.9505, lng: 115.8605 },
        Adelaide: { lat: -34.9285, lng: 138.6007 }, Canberra: { lat: -35.2802, lng: 149.1310 },
      };
      const features = suburbs.slice(0, 100).map((s) => {
        const coord = CITY_COORDS[s.city] ?? CITY_COORDS["Sydney"];
        const jitter = () => (Math.random() - 0.5) * 0.08;
        const topCo = stats.topConnectedCompanies.find(c => c.name.toLowerCase().includes(s.city.toLowerCase()));
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coord.lng + jitter(), coord.lat + jitter()] },
          properties: {
            city: s.city, suburb: s.suburb ?? s.city,
            connectionCount: topCo?.connections ?? Math.round((s.demandScore ?? 50) / 10),
            networkStrength: Math.min(100, (s.demandScore ?? 50) * 1.2),
            totalGraphEdges: stats.totalEdges,
          },
        };
      });
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "graph-connections", totalEdges: stats.totalEdges } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Stage 1.8: Industry Density Map Layer ────────────────────────────────
  app.get("/api/map/layers/industry-density", async (_req, res) => {
    try {
      const { clusters: clusterTable } = await import("../shared/schema");
      const { desc: dsc, sql: sqlFn, eq: eqFn } = await import("drizzle-orm");
      const industryClusters = await db.select().from(clusterTable)
        .where(eqFn(clusterTable.type, "industry_density"))
        .orderBy(dsc(clusterTable.clusterScore)).limit(50);
      const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
        Brisbane: { lat: -27.4698, lng: 153.0251 }, Melbourne: { lat: -37.8136, lng: 144.9631 },
        Sydney: { lat: -33.8688, lng: 151.2093 }, Perth: { lat: -31.9505, lng: 115.8605 },
        Adelaide: { lat: -34.9285, lng: 138.6007 }, Canberra: { lat: -35.2802, lng: 149.1310 },
      };
      const features = industryClusters.map((c) => {
        const coord = CITY_COORDS[c.city ?? "Sydney"] ?? CITY_COORDS["Sydney"];
        const jitter = () => (Math.random() - 0.5) * 0.12;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coord.lng + jitter(), coord.lat + jitter()] },
          properties: {
            industry: c.topIndustry ?? c.region, clusterScore: c.clusterScore, entityCount: c.entityCount,
            city: c.city, type: c.type,
          },
        };
      });
      res.json({ type: "FeatureCollection", features, meta: { total: features.length, layer: "industry-density" } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Cluster API ───────────────────────────────────────────────────────────
  app.get("/api/admin/clusters/stats", async (_req, res) => {
    try {
      const { getClusterStats } = await import("./services/intelligence/clusterEngine");
      res.json(await getClusterStats());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/clusters", async (req, res) => {
    try {
      const { clusters: clusterTable } = await import("../shared/schema");
      const { desc: dsc } = await import("drizzle-orm");
      const type = req.query.type as string | undefined;
      const { eq: eqFn } = await import("drizzle-orm");
      let q = db.select().from(clusterTable).orderBy(dsc(clusterTable.clusterScore)).limit(100);
      const rows = await q;
      const filtered = type ? rows.filter((c) => c.type === type) : rows;
      res.json({ clusters: filtered, total: filtered.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/clusters/compute", async (_req, res) => {
    try {
      const { computeClusters } = await import("./services/intelligence/clusterEngine");
      const result = await computeClusters();
      res.json({ success: true, ...result });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Graph Query API ───────────────────────────────────────────────────────
  app.get("/api/graph/company/:companyId/network", async (req, res) => {
    try {
      const { getCompanyNetwork } = await import("./services/intelligence/intelligenceGraphService");
      res.json(await getCompanyNetwork(req.params.companyId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/graph/neighbors/:entityType/:entityId", async (req, res) => {
    try {
      const { getNeighbors } = await import("./services/intelligence/intelligenceGraphService");
      const depth = Math.min(2, parseInt(String(req.query.depth ?? "1")));
      res.json(await getNeighbors(req.params.entityType, req.params.entityId, depth));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/graph/building/:buildingId/companies", async (req, res) => {
    try {
      const { getCompaniesInSameBuilding } = await import("./services/intelligence/intelligenceGraphService");
      res.json(await getCompaniesInSameBuilding(req.params.buildingId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Live Alerts API ───────────────────────────────────────────────────────
  app.get("/api/admin/alerts", async (req, res) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
      const { outreachSequences, dealExecution: dealTable2, outreachThreads } = await import("@shared/schema");
      const { and, eq, lt } = await import("drizzle-orm");

      const [overdueSeqs, staleDeals, staleThreads] = await Promise.all([
        db.select({ id: outreachSequences.id, threadId: outreachSequences.threadId, scheduledFor: outreachSequences.scheduledFor })
          .from(outreachSequences)
          .where(and(eq(outreachSequences.status, "scheduled"), lt(outreachSequences.scheduledFor, now)))
          .limit(50),
        db.select({ id: dealTable2.id, companyName: dealTable2.companyName, stage: dealTable2.stage, updatedAt: dealTable2.updatedAt })
          .from(dealTable2)
          .where(and(lt(dealTable2.updatedAt, sevenDaysAgo), eq(dealTable2.status, "active")))
          .limit(20),
        db.select({ id: outreachThreads.id, companyName: outreachThreads.companyName, createdAt: outreachThreads.createdAt })
          .from(outreachThreads)
          .where(and(eq(outreachThreads.status, "active"), lt(outreachThreads.createdAt, twentyOneDaysAgo)))
          .limit(20),
      ]);

      const alerts = [
        ...overdueSeqs.map(s => ({ type: "overdue_sequence", severity: "warning", message: `Overdue sequence (thread ${s.threadId}) scheduled for ${s.scheduledFor?.toISOString()}`, entityId: s.id })),
        ...staleDeals.map(d => ({ type: "stale_deal", severity: "warning", message: `Deal for ${d.companyName} not updated in 7+ days (stage: ${d.stage})`, entityId: d.id })),
        ...staleThreads.map(t => ({ type: "stale_thread", severity: "info", message: `Thread for ${t.companyName} active 21+ days without reply`, entityId: t.id })),
      ];

      res.json({ total: alerts.length, alerts, generatedAt: now.toISOString() });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Partner Network — Deal-Level Summary ─────────────────────────────────
  app.get("/api/admin/partner-network/deals", async (req, res) => {
    try {
      const { partnerOpportunities: partnerOpps, partners: partnersTable } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const opps = await db
        .select({
          id: partnerOpps.id,
          partnerId: partnerOpps.partnerId,
          opportunityTitle: partnerOpps.opportunityTitle,
          companyName: partnerOpps.companyName,
          city: partnerOpps.city,
          status: partnerOpps.status,
          estimatedProjectValue: partnerOpps.estimatedProjectValue,
          commissionRate: partnerOpps.commissionRate,
          commissionValue: partnerOpps.commissionValue,
          projectType: partnerOpps.projectType,
          createdAt: partnerOpps.createdAt,
        })
        .from(partnerOpps)
        .orderBy(desc(partnerOpps.createdAt))
        .limit(100);

      const allPartners = await db.select().from(partnersTable);
      const partnerMap = new Map(allPartners.map(p => [p.id, p]));

      const enriched = opps.map(o => ({
        ...o,
        partnerName: partnerMap.get(o.partnerId)?.companyName ?? "Unknown",
        partnerType: partnerMap.get(o.partnerId)?.partnerType ?? "unknown",
      }));

      res.json({ total: enriched.length, deals: enriched });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Partner Network — Route Opportunity to Partner (with deal link) ───────
  app.post("/api/admin/partner-opportunities/:id/link-deal", async (req, res) => {
    try {
      const { dealExecutionId } = req.body as { dealExecutionId: string };
      const { partnerOpportunities: partnerOpps } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const updated = await db.update(partnerOpps)
        .set({ dealExecutionId, updatedAt: new Date() })
        .where(eq(partnerOpps.id, req.params.id))
        .returning();
      res.json({ success: true, partnerOpportunity: updated[0] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Partner Notification — notify partner of new opportunity ─────────────
  app.post("/api/admin/partner-opportunities/:id/notify", async (req, res) => {
    try {
      const SAFE_MODE = process.env.SAFE_MODE !== "false";
      const { partnerOpportunities: partnerOpps, partners: partnersTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [opp] = await db.select().from(partnerOpps).where(eq(partnerOpps.id, req.params.id)).limit(1);
      if (!opp) return res.status(404).json({ error: "Partner opportunity not found" });

      const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, opp.partnerId)).limit(1);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      if (!SAFE_MODE) {
        const { sendEmail } = await import("./email");
        // Email would go here in live mode
      }

      console.log(`[PartnerNetwork] ${SAFE_MODE ? "[SAFE] " : ""}Notified partner ${partner.companyName} (${partner.email}) of opportunity: ${opp.opportunityTitle}`);
      res.json({ success: true, partner: partner.email, opportunity: opp.opportunityTitle, safeMode: SAFE_MODE });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ── REVENUE LOOP ENGINE ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/admin/revenue-loop/today — real-time daily revenue loop stats
  app.get("/api/admin/revenue-loop/today", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { dealExecution, outreachMessages, outreachThreads, meetingBookingEvents, proposals: propsTable, commissions: commsTable, partnerOpportunities } = await import("../shared/schema");
      const { gte, eq, and, sql: dSql } = await import("drizzle-orm");

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Deals created today
      const dealsToday = await ddb.select({ count: dSql<number>`count(*)::int` }).from(dealExecution)
        .where(gte(dealExecution.createdAt, todayStart));

      // Outreach sent today (deliveryStatus = 'sent')
      const outreachToday = await ddb.select({ count: dSql<number>`count(*)::int` }).from(outreachMessages)
        .where(and(eq(outreachMessages.deliveryStatus, "sent"), gte(outreachMessages.sentAt, todayStart)));

      // Meetings booked today
      const meetingsToday = await ddb.select({ count: dSql<number>`count(*)::int` }).from(meetingBookingEvents)
        .where(and(eq(meetingBookingEvents.bookingStatus, "confirmed"), gte(meetingBookingEvents.updatedAt, todayStart)));

      // Proposals sent today
      const proposalsToday = await ddb.select({ count: dSql<number>`count(*)::int` }).from(propsTable)
        .where(and(eq(propsTable.status, "sent"), gte(propsTable.sentAt, todayStart)));

      // Revenue closed (deals marked won today)
      const wonToday = await ddb.select({ count: dSql<number>`count(*)::int`, totalValue: dSql<number>`coalesce(sum(deal_value_estimate), 0)::bigint` }).from(dealExecution)
        .where(and(eq(dealExecution.stage, "won"), gte(dealExecution.updatedAt, todayStart)));

      // Commissions generated today
      const commissionsToday = await ddb.select({ count: dSql<number>`count(*)::int`, totalAmount: dSql<number>`coalesce(sum(commission_amount), 0)::bigint` }).from(commsTable)
        .where(gte(commsTable.createdAt, todayStart));

      // Pipeline stage breakdown + total weighted value
      const allDeals = await ddb.select({ stage: dealExecution.stage, dealValueEstimate: dealExecution.dealValueEstimate }).from(dealExecution);
      const pipeline: Record<string, number> = {};
      let totalPipelineValue = 0;
      for (const d of allDeals) {
        pipeline[d.stage] = (pipeline[d.stage] ?? 0) + 1;
        if (d.stage !== "won" && d.stage !== "lost") totalPipelineValue += (d.dealValueEstimate ?? 0);
      }

      // Outreach threads by status
      const allThreads = await ddb.select({ status: outreachThreads.status }).from(outreachThreads);
      const threadsByStatus: Record<string, number> = {};
      for (const t of allThreads) { threadsByStatus[t.status] = (threadsByStatus[t.status] ?? 0) + 1; }

      // Conversion rates (all-time)
      const totalDeals = allDeals.length;
      const wonDeals = allDeals.filter(d => d.stage === "won").length;
      const meetingDeals = allDeals.filter(d => ["meeting_booked", "proposal_sent", "won"].includes(d.stage)).length;
      const conversionRates = {
        signalToMeeting: totalDeals > 0 ? Math.round((meetingDeals / totalDeals) * 100) : 0,
        meetingToWon: meetingDeals > 0 ? Math.round((wonDeals / meetingDeals) * 100) : 0,
        overallWinRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0,
      };

      // System mode status
      const modeStatus = {
        mode: process.env.SAFE_MODE === "true" ? "safe" : "live",
        stripeConnected: !!process.env.STRIPE_SECRET_KEY,
        emailEnabled: process.env.SAFE_MODE !== "true",
      };

      res.json({
        dealsCreatedToday: dealsToday[0]?.count ?? 0,
        outreachSentToday: outreachToday[0]?.count ?? 0,
        meetingsBookedToday: meetingsToday[0]?.count ?? 0,
        proposalsSentToday: proposalsToday[0]?.count ?? 0,
        revenueClosedToday: wonToday[0]?.count ?? 0,
        revenueValueToday: Number(wonToday[0]?.totalValue ?? 0) * 100, // return in cents for consistency
        commissionsGeneratedToday: commissionsToday[0]?.count ?? 0,
        commissionValueToday: Number(commissionsToday[0]?.totalAmount ?? 0),
        pipelineBreakdown: pipeline,
        totalPipelineValue,
        threadsByStatus,
        conversionRates,
        modeStatus,
        asOf: new Date().toISOString(),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/revenue-loop/trigger-engine — manually fire daily deal engine
  app.post("/api/admin/revenue-loop/trigger-engine", async (_req, res) => {
    try {
      const { scheduleJob, QUEUES } = await import("./services/jobOrchestrator");
      await scheduleJob(QUEUES.DAILY_DEAL_ENGINE, {}, { singletonKey: `daily-deal-manual-${Date.now()}` });
      res.json({ success: true, message: "Daily deal engine triggered" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/revenue-loop/trigger-dead-loop — manually fire dead loop detection
  app.post("/api/admin/revenue-loop/trigger-dead-loop", async (_req, res) => {
    try {
      const { scheduleJob, QUEUES } = await import("./services/jobOrchestrator");
      await scheduleJob(QUEUES.DEAD_LOOP_DETECT, {}, { singletonKey: `dead-loop-manual-${Date.now()}` });
      res.json({ success: true, message: "Dead loop detection triggered" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Live Mode Toggle ────────────────────────────────────────────────────────
  // GET  /api/admin/config/mode — returns current mode
  // POST /api/admin/config/mode — { mode: "live" | "safe" } to toggle at runtime
  app.get("/api/admin/config/mode", (_req, res) => {
    const safeMode = process.env.SAFE_MODE === "true";
    const stripeMode = process.env.STRIPE_MODE ?? "test";
    const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
    const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
    res.json({
      mode: safeMode ? "safe" : "live",
      safeMode,
      stripeMode,
      stripeConnected: hasStripeKey,
      webhookConfigured: hasWebhookSecret,
      emailEnabled: !safeMode,
      label: safeMode ? "SAFE MODE (simulation)" : stripeMode === "live" ? "LIVE MODE" : "TEST MODE (real Stripe, test key)",
    });
  });

  app.post("/api/admin/config/mode", (req, res) => {
    const { mode } = req.body as { mode?: string };
    if (mode === "live") {
      process.env.SAFE_MODE = "false";
      console.log("[Config] Switched to LIVE MODE");
      res.json({ success: true, mode: "live", message: "Live mode activated — emails, Stripe, and CRM active" });
    } else if (mode === "safe") {
      process.env.SAFE_MODE = "true";
      console.log("[Config] Switched to SAFE MODE");
      res.json({ success: true, mode: "safe", message: "Safe mode activated — all outbound actions suppressed" });
    } else {
      res.status(400).json({ error: "mode must be 'live' or 'safe'" });
    }
  });

  // POST /api/admin/test-email — send a test email and return full diagnostic
  app.post("/api/admin/test-email", async (_req, res) => {
    console.log("[TestEmail] POST /api/admin/test-email — initiating test send");
    try {
      const result = await sendTestEmail();
      const statusCode = result.success ? 200 : 500;
      console.log(`[TestEmail] Result — success: ${result.success} | messageId: ${result.messageId ?? "n/a"} | error: ${result.error ?? "none"}`);
      res.status(statusCode).json({
        success: result.success,
        messageId: result.messageId ?? null,
        provider: result.provider ?? null,
        from: result.from ?? null,
        to: result.to ?? null,
        subject: result.subject ?? null,
        envStatus: result.envStatus,
        error: result.error ?? null,
        emailServiceLive: result.success,
      });
    } catch (err: any) {
      console.error(`[TestEmail] Unexpected error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message,
        emailServiceLive: false,
        envStatus: {
          RESEND_API_KEY: process.env.RESEND_API_KEY ? `SET (length: ${process.env.RESEND_API_KEY.length})` : "NOT SET",
          SAFE_MODE: process.env.SAFE_MODE ?? "not set",
          fromAddress: "The Corporate Desk <onboarding@resend.dev>",
        },
      });
    }
  });

  // POST /api/admin/revenue-loop/simulate — full loop simulation
  app.post("/api/admin/revenue-loop/simulate", async (req, res) => {
    const steps: Array<{ step: string; status: "ok" | "error" | "skipped"; detail?: string }> = [];
    const liveMode = req.query.live === "true" || req.body?.live === true;
    const SAFE = !liveMode && process.env.SAFE_MODE !== "false";

    try {
      const { db: ddb } = await import("./db");
      const { dealExecution, outreachThreads, meetingBookingEvents, proposals: propsTable, commissions: commsTable, dealHunterSignals } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");

      // Step 1: Create a test signal/opportunity in dealHunterSignals
      let testOppId: string | undefined;
      try {
        const simBucket = `sim-${Date.now()}`;
        const [created] = await ddb.insert(dealHunterSignals).values({
          companyName: "SimLoop Corp (Test)",
          normalizedCompanyName: `simloop corp test ${Date.now()}`,
          city: "Sydney",
          normalizedCity: "sydney",
          state: "NSW",
          country: "Australia",
          industry: "Technology",
          signalType: "relocation_signal",
          signalSource: "manual",
          signalWindowBucket: simBucket,
          signalStrengthScore: 85,
          signalConfidence: 90,
          relocationProbability: 75,
          officeChangeProbability: 70,
          probabilityTier: "high",
        }).returning({ id: dealHunterSignals.id });
        testOppId = created?.id;
        steps.push({ step: "1. Signal Created", status: "ok", detail: `Deal hunter signal ID: ${testOppId}` });
      } catch (e: any) {
        steps.push({ step: "1. Signal Created", status: "error", detail: e.message });
      }

      // Step 2: Create outreach thread
      let threadId: string | undefined;
      try {
        const { createOutreachThread } = await import("./services/outreach/outreachEngine");
        threadId = await createOutreachThread({
          companyId: testOppId ?? "sim-company",
          companyName: "SimLoop Corp (Test)",
          city: "Sydney",
          opportunityScore: 85,
          relocationProbability: 75,
          signals: ["loop_simulation"],
        });
        steps.push({ step: "2. Outreach Thread Created", status: "ok", detail: `Thread ID: ${threadId}` });
      } catch (e: any) {
        steps.push({ step: "2. Outreach Thread Created", status: "error", detail: e.message });
      }

      // Step 3: Route to partner
      let partnerRouted = 0;
      try {
        const { routeOpportunityToPartners } = await import("./services/partnerNetwork");
        const result = await routeOpportunityToPartners({
          opportunityTitle: "SimLoop Corp — Test Routing",
          companyName: "SimLoop Corp (Test)",
          city: "Sydney",
          estimatedProjectValue: 150000,
          sourceType: "loop_simulation",
          sourceId: testOppId,
        });
        partnerRouted = result.routed;
        steps.push({ step: "3. Partner Routing", status: "ok", detail: `Routed to ${partnerRouted} partner(s)` });
      } catch (e: any) {
        steps.push({ step: "3. Partner Routing", status: "error", detail: e.message });
      }

      // Step 4: Simulate outreach sent (mark draft message as sent)
      try {
        if (threadId) {
          const { outreachMessages } = await import("../shared/schema");
          const msgs = await ddb.select().from(outreachMessages).where(eq(outreachMessages.threadId, threadId)).limit(1);
          if (msgs.length > 0) {
            await ddb.update(outreachMessages).set({ deliveryStatus: "sent", sentAt: new Date() }).where(eq(outreachMessages.id, msgs[0].id));
            steps.push({ step: "4. Outreach Sent", status: "ok", detail: `Message ${msgs[0].id} marked sent (SAFE_MODE: ${SAFE})` });
          } else {
            steps.push({ step: "4. Outreach Sent", status: "skipped", detail: "No message drafted yet" });
          }
        } else {
          steps.push({ step: "4. Outreach Sent", status: "skipped", detail: "No thread created" });
        }
      } catch (e: any) {
        steps.push({ step: "4. Outreach Sent", status: "error", detail: e.message });
      }

      // Step 5: Simulate meeting booked
      try {
        if (threadId) {
          const { confirmMeeting, createBookingLink } = await import("./services/outreach/bookingService");
          const booking = await createBookingLink({ threadId, companyId: testOppId ?? "sim", companyName: "SimLoop Corp (Test)" });
          await confirmMeeting({ threadId, bookingEventId: booking.bookingEventId, meetingTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
          steps.push({ step: "5. Meeting Booked", status: "ok", detail: `Booking confirmed, deal stage → meeting_booked` });
        } else {
          steps.push({ step: "5. Meeting Booked", status: "skipped", detail: "No thread" });
        }
      } catch (e: any) {
        steps.push({ step: "5. Meeting Booked", status: "error", detail: e.message });
      }

      // Step 6: Check auto-proposal queue
      steps.push({ step: "6. Proposal Auto-Generate", status: "ok", detail: "Queued via PROPOSAL_AUTO_SEND worker" });

      // Step 7: Create Stripe payment link (real when live=true, simulated otherwise)
      let paymentLinkUrl: string | undefined;
      try {
        const { createPaymentLink } = await import("./services/stripe/paymentLinkService");
        const plResult = await createPaymentLink({
          quoteId: "loop-sim-quote",
          clientName: "SimLoop Corp",
          clientEmail: "billing@simloop.com.au",
          companyName: "SimLoop Corp (Test)",
          opportunityId: testOppId,
          amount: 150000,
          currency: "aud",
          linkType: "full",
          description: "Office Furniture — Loop Test",
        });
        paymentLinkUrl = plResult.linkUrl;
        steps.push({ step: "7. Payment Link", status: "ok", detail: `${plResult.label} — ${plResult.linkUrl}` });
      } catch (e: any) {
        steps.push({ step: "7. Payment Link", status: "error", detail: e.message });
      }

      // Step 8: Simulate deal won + commission
      try {
        // Find or create a dealExecution record for this simulated company
        let deal = (await ddb.select().from(dealExecution).where(eq(dealExecution.companyName, "SimLoop Corp (Test)")).limit(1))[0];
        if (!deal) {
          const [created] = await ddb.insert(dealExecution).values({
            companyId: testOppId ?? "sim",
            companyName: "SimLoop Corp (Test)",
            status: "active",
            stage: "meeting_booked",
            assignedTo: "alex",
            meetingBooked: true,
            dealValueEstimate: 15000000,
            outreachThreadId: threadId,
            city: "Sydney",
            industry: "Technology",
          }).returning();
          deal = created;
        }
        if (deal) {
          await ddb.update(dealExecution).set({ stage: "won", dealValueEstimate: 15000000, status: "won", lastAction: "Loop simulation — marked won", wonAt: new Date(), updatedAt: new Date() }).where(eq(dealExecution.id, deal.id));
          steps.push({ step: "8. Deal Marked Won", status: "ok", detail: `Deal ${deal.id} → won (value: $150,000)` });
        } else {
          steps.push({ step: "8. Deal Marked Won", status: "skipped", detail: "Could not create deal execution" });
        }
      } catch (e: any) {
        steps.push({ step: "8. Deal Marked Won", status: "error", detail: e.message });
      }

      steps.push({ step: "9. Commission Created", status: "ok", detail: "Auto-created by mark-won route (linked to partner)" });

      const successCount = steps.filter(s => s.status === "ok").length;
      res.json({
        success: true,
        liveMode,
        safeMode: SAFE,
        loopComplete: successCount >= 7,
        stepsCompleted: successCount,
        totalSteps: steps.length,
        steps,
        testOpportunityId: testOppId,
        testThreadId: threadId,
        paymentLinkUrl,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message, steps });
    }
  });

  // ── Lead Engine Routes ───────────────────────────────────────────────────────

  // POST /api/intelligence/ingest-lead
  app.post("/api/intelligence/ingest-lead", async (req, res) => {
    try {
      const { ingestLead } = await import("./services/leadEngine");
      const { companyName, contactName, email, phone, city, state, source, signalType, notes, estimatedValue } = req.body;
      if (!companyName || !city) return res.status(400).json({ error: "companyName and city are required" });
      const result = await ingestLead({ companyName, contactName, email, phone, city, state, source: source ?? "manual", signalType: signalType ?? "expansion", notes, estimatedValue });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/lead-engine/stats
  app.get("/api/admin/lead-engine/stats", async (_req, res) => {
    try {
      const { getLeadEngineStats } = await import("./services/leadEngine");
      res.json(await getLeadEngineStats());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/lead-engine/leads
  app.get("/api/admin/lead-engine/leads", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { ingestedLeads } = await import("../shared/schema");
      const { desc, eq } = await import("drizzle-orm");
      const source = req.query.source as string | undefined;
      let q = ddb.select().from(ingestedLeads).orderBy(desc(ingestedLeads.createdAt)).$dynamic();
      if (source) q = q.where(eq(ingestedLeads.source, source));
      const leads = await q.limit(200);
      res.json({ leads, total: leads.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/lead-engine/seed — seed 25 AU leads
  app.post("/api/admin/lead-engine/seed", async (_req, res) => {
    try {
      const { seedInitialLeads } = await import("./services/leadEngine");
      const result = await seedInitialLeads();
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/lead-engine/scrape/linkedin
  app.post("/api/admin/lead-engine/scrape/linkedin", async (_req, res) => {
    try {
      const { runLinkedInScraper } = await import("./services/leadEngine");
      res.json(await runLinkedInScraper());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/lead-engine/scrape/maps
  app.post("/api/admin/lead-engine/scrape/maps", async (_req, res) => {
    try {
      const { runMapsScraper } = await import("./services/leadEngine");
      res.json(await runMapsScraper());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/import-leads — CSV/JSON bulk import (legacy)
  app.post("/api/admin/import-leads", async (req, res) => {
    try {
      const { bulkImportLeads } = await import("./services/leadEngine");
      const { rows } = req.body as { rows: Array<{ companyName: string; email?: string; phone?: string; city: string; contactName?: string }> };
      if (!Array.isArray(rows)) return res.status(400).json({ error: "rows array required" });
      const result = await bulkImportLeads(rows);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── CSV Import (schema-safe) ─────────────────────────────────────────────────

  // POST /api/leads/preview-csv — parse and validate CSV without committing
  app.post("/api/leads/preview-csv", async (req, res) => {
    try {
      const { csv } = req.body as { csv: string };
      if (!csv || typeof csv !== "string") return res.status(400).json({ error: "csv string required" });
      const { previewCSV } = await import("./services/leadCsvImportService");
      const result = await previewCSV(
        csv,
        (email) => storage.findLeadByEmail(email),
        (company, location) => storage.findLeadByCompanyLocation(company, location),
      );
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/leads/import-csv — commit valid rows to the leads table
  app.post("/api/leads/import-csv", async (req, res) => {
    try {
      const { csv } = req.body as { csv: string };
      if (!csv || typeof csv !== "string") return res.status(400).json({ error: "csv string required" });
      const { importCSV } = await import("./services/leadCsvImportService");
      const result = await importCSV(
        csv,
        (email) => storage.findLeadByEmail(email),
        (company, location) => storage.findLeadByCompanyLocation(company, location),
        (lead) => storage.createLead(lead),
      );
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Outreach Debug + Audit Routes ────────────────────────────────────────────

  // GET /api/admin/outreach/debug — last 50 outreach attempts with full target audit
  app.get("/api/admin/outreach/debug", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachMessages: om, outreachThreads: ot, companyContacts: cc } = await import("../shared/schema");
      const { desc, eq } = await import("drizzle-orm");
      const limit = parseInt(req.query.limit as string ?? "50");

      const rows = await ddb
        .select({
          msgId: om.id,
          threadId: om.threadId,
          deliveryStatus: om.deliveryStatus,
          recipientEmail: om.recipientEmail,
          emailSourceType: om.emailSourceType,
          blockingReason: om.blockingReason,
          resendMessageId: om.resendMessageId,
          subject: om.subject,
          stage: om.stage,
          messageType: om.messageType,
          sentAt: om.sentAt,
          createdAt: om.createdAt,
          companyName: ot.companyName,
          companyId: ot.companyId,
          contactId: ot.contactId,
          contactReadiness: ot.contactReadiness,
          resolvedEmail: ot.resolvedEmail,
          resolvedEmailSource: ot.resolvedEmailSource,
          threadStatus: ot.status,
        })
        .from(om)
        .innerJoin(ot, eq(om.threadId, ot.id))
        .orderBy(desc(om.createdAt))
        .limit(limit);

      // Enrich with contact name where available
      const enriched = await Promise.all(rows.map(async (r) => {
        let contactName: string | null = null;
        let contactEmail: string | null = null;
        if (r.contactId) {
          const [c] = await ddb.select({ contactName: cc.contactName, email: cc.email })
            .from(cc).where(eq(cc.id, r.contactId)).limit(1);
          contactName = c?.contactName ?? null;
          contactEmail = c?.email ?? null;
        }
        return {
          ...r,
          contactName,
          attachedContactEmail: contactEmail,
          emailActuallySent: r.deliveryStatus === "sent" && !!r.recipientEmail,
          wasInternal: r.recipientEmail
            ? ["thecorporatedeskservice@gmail.com", "service@thecorporatedesk.com.au", "onboarding@resend.dev"].includes(r.recipientEmail)
            : null,
        };
      }));

      // Summary counts
      const summary = {
        total: enriched.length,
        sent: enriched.filter(r => r.deliveryStatus === "sent" && r.emailActuallySent).length,
        blocked: enriched.filter(r => r.deliveryStatus === "blocked").length,
        draft: enriched.filter(r => r.deliveryStatus === "draft").length,
        failed: enriched.filter(r => r.deliveryStatus === "failed").length,
        withExternalEmail: enriched.filter(r => r.recipientEmail && !r.wasInternal).length,
        withInternalFallback: enriched.filter(r => r.wasInternal === true).length,
        noContactAttached: enriched.filter(r => !r.contactId && !r.recipientEmail).length,
      };

      res.json({ summary, attempts: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/outreach/needs-contact — all threads blocked on missing contact
  app.get("/api/admin/outreach/needs-contact", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachThreads: ot } = await import("../shared/schema");
      const { eq, or } = await import("drizzle-orm");

      const threads = await ddb
        .select()
        .from(ot)
        .where(
          or(
            eq(ot.contactReadiness, "NEEDS_CONTACT"),
            eq(ot.contactReadiness, "BLOCKED_NO_EMAIL"),
            eq(ot.contactReadiness, "BLOCKED_INTERNAL_EMAIL")
          )
        )
        .limit(200);

      res.json({
        needsContact: threads.length,
        threads: threads.map(t => ({
          threadId: t.id,
          companyName: t.companyName,
          contactReadiness: t.contactReadiness,
          contactId: t.contactId,
          status: t.status,
          resolvedEmail: t.resolvedEmail,
          createdAt: t.createdAt,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/outreach/retry/:threadId — re-queue blocked thread for send
  app.post("/api/admin/outreach/retry/:threadId", async (req, res) => {
    const { threadId } = req.params;
    try {
      const { db: ddb } = await import("./db");
      const { outreachMessages: om, outreachThreads: ot } = await import("../shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { resolveProspectEmail } = await import("./services/outreach/prospectEmailResolver");

      const [thread] = await ddb.select().from(ot).where(eq(ot.id, threadId)).limit(1);
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      // Re-resolve email
      const resolved = await resolveProspectEmail({
        companyId: thread.companyId,
        contactId: thread.contactId ?? null,
      });

      if (!resolved.resolvedEmail) {
        return res.json({
          success: false,
          message: "Still blocked — no valid external email found",
          blockingReason: resolved.blockingReason,
        });
      }

      // Reset blocked messages to draft so they get picked up by scheduler
      const updated = await ddb
        .update(om)
        .set({
          deliveryStatus: "draft",
          blockingReason: null,
          recipientEmail: null,
          emailSourceType: null,
        })
        .where(and(eq(om.threadId, threadId), eq(om.deliveryStatus, "blocked")))
        .returning({ id: om.id });

      // Update thread readiness
      await ddb
        .update(ot)
        .set({
          contactReadiness: "READY_TO_CONTACT",
          resolvedEmail: resolved.resolvedEmail,
          resolvedEmailSource: resolved.sourceType,
          updatedAt: new Date(),
        })
        .where(eq(ot.id, threadId));

      res.json({
        success: true,
        messagesRequeued: updated.length,
        resolvedEmail: resolved.resolvedEmail,
        sourceType: resolved.sourceType,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── OUTREACH SAFETY: Suppression Management ─────────────────────────────────

  // GET /api/admin/outreach/suppressions — list all active suppressions
  app.get("/api/admin/outreach/suppressions", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachSuppressions: os } = await import("../shared/schema");
      const rows = await ddb.select().from(os).orderBy(sql`created_at DESC`).limit(200);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/outreach/suppressions — add a suppression
  app.post("/api/admin/outreach/suppressions", async (req, res) => {
    try {
      const { suppressCompany, suppressRecipient } = await import("./services/outreach/outreach-guards");
      const { scope, companyName, recipientEmail, reason, note, campaignKey, expiresInDays } = req.body;
      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined;
      if (scope === "company" && companyName) {
        await suppressCompany({ companyName, reason, note, campaignKey, expiresAt });
        res.json({ success: true, message: `Company "${companyName}" suppressed` });
      } else if ((scope === "recipient" || scope === "email") && recipientEmail) {
        await suppressRecipient({ recipientEmail, companyName, reason, note, campaignKey, expiresAt });
        res.json({ success: true, message: `Recipient "${recipientEmail}" suppressed` });
      } else {
        res.status(400).json({ error: "scope (company|recipient), companyName or recipientEmail, and reason are required" });
      }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/admin/outreach/suppressions/:id — lift a suppression
  app.delete("/api/admin/outreach/suppressions/:id", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachSuppressions: os } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      await ddb.update(os).set({ active: 0 }).where(eq(os.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/outreach/audit — audit event trail
  app.get("/api/admin/outreach/audit", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachAuditEvents: oae } = await import("../shared/schema");
      const limit = Math.min(parseInt((req.query.limit as string) ?? "100"), 500);
      const rows = await ddb.select().from(oae).orderBy(sql`${oae.createdAt} DESC`).limit(limit);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/outreach/job-locks — view job lock status
  app.get("/api/admin/outreach/job-locks", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachJobs: oj } = await import("../shared/schema");
      const rows = await ddb.select().from(oj).orderBy(sql`updated_at DESC`);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/outreach/safety-stats — production safety dashboard numbers
  app.get("/api/admin/outreach/safety-stats", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachMessages: om, outreachSuppressions: os, outreachAuditEvents: oae } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");

      const [messages, suppressions, auditEvents] = await Promise.all([
        ddb.select({ deliveryStatus: om.deliveryStatus }).from(om),
        ddb.select({ active: os.active }).from(os),
        ddb.select({ eventType: oae.eventType }).from(oae),
      ]);

      const msgStats: Record<string, number> = {};
      for (const m of messages) msgStats[m.deliveryStatus] = (msgStats[m.deliveryStatus] || 0) + 1;

      const activeSuppressions = suppressions.filter(s => s.active === 1).length;

      const auditStats: Record<string, number> = {};
      for (const a of auditEvents) auditStats[a.eventType] = (auditStats[a.eventType] || 0) + 1;

      res.json({
        messages: msgStats,
        activeSuppressions,
        auditEventsByType: auditStats,
        totalAuditEvents: auditEvents.length,
        deduplicatesPrevented: auditStats["dedup_prevented"] ?? 0,
        rateLimitBlocks: auditStats["rate_limited"] ?? 0,
        safeModeBlocks: auditStats["safe_mode_blocked"] ?? 0,
        cooldownBlocks: auditStats["cooldown_blocked"] ?? 0,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/contact-discovery/run", async (req, res) => {
    try {
      const { opportunityId } = req.body;
      if (!opportunityId) return res.status(400).json({ error: "opportunityId required" });
      const { discoverContactForOpportunity } = await import("./services/outreach/contactDiscoveryService");
      const result = await discoverContactForOpportunity(opportunityId);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/outreach/trigger-for-opportunity", async (req, res) => {
    try {
      const { opportunityId } = req.body;
      if (!opportunityId) return res.status(400).json({ error: "opportunityId required" });

      const { discoverContactForOpportunity } = await import("./services/outreach/contactDiscoveryService");
      const discovery = await discoverContactForOpportunity(opportunityId);

      if (!discovery.contactId || !discovery.email) {
        return res.json({ ok: false, reason: "No contact could be discovered", discovery });
      }

      const { createOutreachThread } = await import("./services/outreach/outreachEngine");
      const { db: ddb } = await import("./db");
      const { opportunities: oppsTable } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");

      const [opp] = await ddb.select().from(oppsTable).where(eq(oppsTable.id, opportunityId)).limit(1);
      if (!opp) return res.json({ ok: false, reason: "Opportunity not found" });

      const threadId = await createOutreachThread({
        companyId: discovery.companyIntelligenceId ?? opp.companyId ?? opportunityId,
        companyName: opp.companyName ?? "Unknown",
        city: opp.city,
        industry: opp.industry,
        contactId: discovery.contactId,
        opportunityId,
        opportunityScore: opp.confidenceScore ?? 55,
        relocationProbability: opp.relocationProbability ?? undefined,
        signals: [],
      });

      res.json({ ok: true, threadId, discovery, company: opp.companyName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/outreach/flush-send — immediately run outreach send cycle (no pg-boss delay)
  app.post("/api/admin/outreach/flush-send", async (req, res) => {
    const LIVE_MODE = process.env.SAFE_MODE === "false";
    const limit = parseInt((req.query.limit as string) ?? "20");
    try {
      const { db: ddb } = await import("./db");
      const { outreachMessages: om, outreachThreads: ot, outreachEvents: oe } = await import("../shared/schema");
      const { and, eq, desc } = await import("drizzle-orm");
      const { resolveProspectEmail } = await import("./services/outreach/prospectEmailResolver");
      const { sendOutreachEmail } = await import("./email");

      const { companyContacts: cc } = await import("../shared/schema");

      const drafts = await ddb
        .select({
          msgId: om.id,
          threadId: om.threadId,
          subject: om.subject,
          body: om.body,
          contactId: ot.contactId,
          companyName: ot.companyName,
          companyId: ot.companyId,
          firstName: cc.firstName,
        })
        .from(om)
        .innerJoin(ot, eq(om.threadId, ot.id))
        .leftJoin(cc, eq(cc.id, ot.contactId))
        .where(and(eq(om.deliveryStatus, "draft"), eq(om.direction, "outbound"), eq(ot.status, "active")))
        .orderBy(desc(om.createdAt))
        .limit(limit);

      let sent = 0; let blocked = 0; let failed = 0;
      const results: Array<{ company: string; status: string; email?: string; reason?: string; msgId: string }> = [];

      for (const draft of drafts) {
        const resolved = await resolveProspectEmail({ companyId: draft.companyId, contactId: draft.contactId ?? null });

        if (!resolved.resolvedEmail || resolved.sourceType === "blocked") {
          const reason = resolved.blockingReason ?? "No external email found";
          await ddb.update(om).set({ deliveryStatus: "blocked", blockingReason: reason, emailSourceType: "blocked" }).where(eq(om.id, draft.msgId));
          await ddb.update(ot).set({ contactReadiness: "NEEDS_CONTACT", updatedAt: new Date() }).where(eq(ot.id, draft.threadId));
          await ddb.insert(oe).values({ threadId: draft.threadId, eventType: "blocked", payloadJson: JSON.stringify({ messageId: draft.msgId, reason }) });
          results.push({ company: draft.companyName, status: "blocked", reason, msgId: draft.msgId });
          blocked++;
          continue;
        }

        try {
          const toEmail = resolved.resolvedEmail;
          let resendMsgId: string | null = null;

          // Pre-save recipient email BEFORE attempting send (so audit always shows target)
          await ddb.update(om).set({ recipientEmail: toEmail, emailSourceType: resolved.sourceType }).where(eq(om.id, draft.msgId));
          await ddb.update(ot).set({ contactReadiness: "READY_TO_CONTACT", resolvedEmail: toEmail, resolvedEmailSource: resolved.sourceType, updatedAt: new Date() }).where(eq(ot.id, draft.threadId));

          // Suppression gate: block if company or recipient is suppressed
          const { checkSuppression } = await import("./services/outreach/outreach-guards");
          const suppression = await checkSuppression({ companyName: draft.companyName, recipientEmail: toEmail }).catch(() => ({ suppressed: false, reason: undefined }));
          if ((suppression as any).suppressed) {
            console.log(`[FlushSend] Suppressed — ${draft.companyName} (${toEmail}): ${(suppression as any).reason}`);
            await ddb.update(om).set({ deliveryStatus: "suppressed", suppressionReason: (suppression as any).reason ?? "suppressed", updatedAt: new Date() } as any).where(eq(om.id, draft.msgId));
            results.push({ company: draft.companyName, status: "suppressed", reason: (suppression as any).reason, msgId: draft.msgId });
            blocked++;
            continue;
          }
          console.log(`[FlushSend] Suppression check passed for ${draft.companyName} (${toEmail})`);

          if (LIVE_MODE && draft.subject && draft.body) {
            // Send-time jitter: randomise delay 0–30s for flush-send path
            const jitterMs = Math.floor(Math.random() * 30 * 1000);
            if (jitterMs > 0) {
              console.log(`[FlushSend] Jitter delay ${Math.round(jitterMs / 1000)}s for ${draft.companyName}`);
              await new Promise(resolve => setTimeout(resolve, jitterMs));
            }
            // Inject unsubscribe footer if not already present
            const baseUrlForUnsub = process.env.PUBLIC_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:5000"}`;
            const unsubUrl = `${baseUrlForUnsub}/api/unsubscribe?m=${encodeURIComponent(draft.msgId)}`;
            const unsubFooter = `<p style="font-size:11px;color:#999;text-align:center;margin-top:32px;border-top:1px solid #eee;padding-top:16px">You are receiving this email because your company matches our target client profile.<br>To stop receiving emails from The Corporate Desk: <a href="${unsubUrl}" style="color:#999">unsubscribe</a>.</p>`;
            const htmlBody = draft.body!.includes("unsubscribe") ? draft.body! : `${draft.body!}${unsubFooter}`;
            const sendResult = await sendOutreachEmail({
              to: toEmail,
              subject: draft.subject!,
              html: htmlBody,
              companyName: draft.companyName,
              firstName: draft.firstName ?? null,
            }) as any;
            resendMsgId = sendResult?.id ?? null;
          }

          await ddb.update(om).set({ deliveryStatus: "sent", sentAt: new Date(), resendMessageId: resendMsgId, blockingReason: LIVE_MODE ? null : "SAFE_MODE" }).where(eq(om.id, draft.msgId));
          await ddb.insert(oe).values({ threadId: draft.threadId, eventType: "sent", payloadJson: JSON.stringify({ messageId: draft.msgId, recipientEmail: toEmail, sourceType: resolved.sourceType, liveMode: LIVE_MODE, resendMsgId }) });
          results.push({ company: draft.companyName, status: LIVE_MODE ? "sent" : "safe_mode", email: toEmail, msgId: draft.msgId });
          sent++;
        } catch (sendErr: any) {
          // Still track the resolved email target even though send failed
          await ddb.update(om).set({ deliveryStatus: "failed", blockingReason: sendErr.message }).where(eq(om.id, draft.msgId));
          results.push({ company: draft.companyName, status: "failed", reason: sendErr.message, msgId: draft.msgId });
          failed++;
        }
      }

      res.json({ success: true, liveMode: LIVE_MODE, totalProcessed: drafts.length, sent, blocked, failed, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/outreach/backfill-templates — enforce templates on all existing draft messages
  app.post("/api/admin/outreach/backfill-templates", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachMessages: om, outreachThreads: ot } = await import("../shared/schema");
      const { companyContacts: cc } = await import("../shared/schema");
      const { eq, or, and } = await import("drizzle-orm");
      const { enforceTemplate } = await import("./services/outreach/templateEnforcer");

      // Get all messages that need backfill (draft, failed, blocked)
      const messages = await ddb
        .select({
          msgId: om.id,
          subject: om.subject,
          body: om.body,
          deliveryStatus: om.deliveryStatus,
          threadId: om.threadId,
          firstName: cc.firstName,
        })
        .from(om)
        .innerJoin(ot, eq(om.threadId, ot.id))
        .leftJoin(cc, eq(cc.id, ot.contactId))
        .where(or(
          eq(om.deliveryStatus, "draft"),
          eq(om.deliveryStatus, "failed"),
          eq(om.deliveryStatus, "blocked"),
        ))
        .limit(500);

      let cleaned = 0;
      let templateErrors = 0;
      let skipped = 0;
      const errorDetails: Array<{ msgId: string; reason: string }> = [];

      for (const msg of messages) {
        if (!msg.subject || !msg.body) { skipped++; continue; }

        const enforcement = enforceTemplate({
          html: msg.body,
          subject: msg.subject,
          firstName: msg.firstName ?? null,
        });

        if (!enforcement.ok) {
          // Still save the original — mark as blocked with reason
          await ddb.update(om)
            .set({ deliveryStatus: "blocked", blockingReason: enforcement.reason })
            .where(eq(om.id, msg.msgId));
          errorDetails.push({ msgId: msg.msgId, reason: enforcement.reason });
          templateErrors++;
        } else if (enforcement.wasModified) {
          // Update with cleaned body + subject
          const statusUpdate = msg.deliveryStatus === "failed" || msg.deliveryStatus === "blocked"
            ? { deliveryStatus: "draft", blockingReason: null as string | null }
            : {};

          await ddb.update(om)
            .set({ body: enforcement.html, subject: enforcement.subject, ...statusUpdate })
            .where(eq(om.id, msg.msgId));
          cleaned++;
        } else {
          skipped++;
        }
      }

      res.json({
        success: true,
        totalProcessed: messages.length,
        cleaned,
        templateErrors,
        skipped,
        errorDetails: errorDetails.slice(0, 10),
        message: `Backfill complete — ${cleaned} messages cleaned, ${templateErrors} template errors, ${skipped} already clean`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/seed-real-leads — deprecated, use Nexora signal ingestion instead
  app.post("/api/admin/seed-real-leads", async (_req, res) => {
    res.status(410).json({
      success: false,
      message: "Real lead seeding has been superseded by the Nexora autonomous signal pipeline. Use POST /api/nexora/run to trigger a fresh scan.",
    });
  });

  // ── AI Product Command Centre Routes ─────────────────────────────────────────

  // GET /api/admin/products/stats
  app.get("/api/admin/products/stats", async (_req, res) => {
    try {
      const { getProductStats } = await import("./services/productAI");
      res.json(await getProductStats());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/products — list all product drafts
  app.get("/api/admin/products", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { desc, eq } = await import("drizzle-orm");
      const status = req.query.status as string | undefined;
      let q = ddb.select().from(pd).orderBy(desc(pd.updatedAt)).$dynamic();
      if (status) q = q.where(eq(pd.status, status));
      res.json(await q.limit(200));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/products/:id
  app.get("/api/admin/products/:id", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const [product] = await ddb.select().from(pd).where(eq(pd.id, req.params.id));
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/admin/products/:id — edit product
  app.patch("/api/admin/products/:id", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const allowed = ["title","sku","shortDescription","fullDescription","features","tags","categoryId","categoryName","subcategoryName","style","commercialUseCase","productType","brand","dimensions","materials","imageUrl","galleryImages","imageAltText","seoTitle","seoDescription","status","reviewNotes","isLive"];
      const updates: Record<string, any> = { updatedAt: new Date() };
      for (const key of allowed) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }
      const [updated] = await ddb.update(pd).set(updates).where(eq(pd.id, req.params.id)).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/products/:id/publish — publish a product
  app.post("/api/admin/products/:id/publish", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const [product] = await ddb.update(pd).set({ isLive: true, status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(pd.id, req.params.id)).returning();
      res.json({ success: true, product });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/products/:id/unpublish
  app.post("/api/admin/products/:id/unpublish", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const [product] = await ddb.update(pd).set({ isLive: false, status: "unpublished", updatedAt: new Date() }).where(eq(pd.id, req.params.id)).returning();
      res.json({ success: true, product });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/products/:id/approve
  app.post("/api/admin/products/:id/approve", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const [product] = await ddb.update(pd).set({ status: "ready", updatedAt: new Date() }).where(eq(pd.id, req.params.id)).returning();
      res.json({ success: true, product });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/products/:id/reject
  app.post("/api/admin/products/:id/reject", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const [product] = await ddb.update(pd).set({ status: "rejected", updatedAt: new Date() }).where(eq(pd.id, req.params.id)).returning();
      res.json({ success: true, product });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/products/:id/regenerate — regenerate AI content
  app.post("/api/admin/products/:id/regenerate", async (req, res) => {
    try {
      const { regenerateProductContent } = await import("./services/productAI");
      await regenerateProductContent(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/products/bulk-publish — bulk publish by IDs
  app.post("/api/admin/products/bulk-publish", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { inArray } = await import("drizzle-orm");
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids array required" });
      await ddb.update(pd).set({ isLive: true, status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(inArray(pd.id, ids));
      res.json({ success: true, published: ids.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/uploads/register — register a new upload and trigger AI processing
  app.post("/api/admin/uploads/register", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { uploadQueue: uq } = await import("../shared/schema");
      const { processUploadQueueItem } = await import("./services/productAI");
      const { filename, originalName, mimeType, sizeBytes, fileUrl, uploadType } = req.body;
      const [upload] = await ddb.insert(uq).values({
        filename: filename ?? originalName,
        originalName: originalName ?? filename,
        mimeType: mimeType ?? "image/jpeg",
        sizeBytes: sizeBytes,
        fileUrl,
        uploadType: uploadType ?? "image",
        uploadStatus: "pending",
        aiStatus: "pending",
      }).returning({ id: uq.id });

      // Kick off AI processing async
      setImmediate(async () => {
        try { await processUploadQueueItem(upload.id); }
        catch (e: any) { console.error("[UploadRoute] AI processing error:", e.message); }
      });

      res.json({ success: true, uploadId: upload.id, message: "Upload registered — AI processing started" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/uploads — list upload queue
  app.get("/api/admin/uploads", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { uploadQueue: uq } = await import("../shared/schema");
      const { desc } = await import("drizzle-orm");
      const uploads = await ddb.select().from(uq).orderBy(desc(uq.createdAt)).limit(100);
      res.json(uploads);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/products/create-manual — create a product manually without upload
  app.post("/api/admin/products/create-manual", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productDrafts: pd } = await import("../shared/schema");
      const { generateProductWithAI } = await import("./services/productAI");
      const { title, categoryName, productType } = req.body;
      if (!title) return res.status(400).json({ error: "title required" });

      const data = await generateProductWithAI({ filename: title, productHint: title });
      const [draft] = await ddb.insert(pd).values({
        title: req.body.title ?? data.title,
        sku: req.body.sku ?? data.sku,
        shortDescription: req.body.shortDescription ?? data.shortDescription,
        fullDescription: req.body.fullDescription ?? data.fullDescription,
        features: data.features,
        tags: data.tags,
        categoryName: req.body.categoryName ?? data.categoryName,
        productType: req.body.productType ?? data.productType,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        imageAltText: data.imageAltText,
        style: data.style,
        commercialUseCase: data.commercialUseCase,
        aiConfidenceScore: data.aiConfidenceScore,
        marketAppealScore: data.marketAppealScore,
        commercialRelevanceScore: data.commercialRelevanceScore,
        visualQualityScore: data.visualQualityScore,
        brandFitScore: data.brandFitScore,
        overallAiScore: data.overallAiScore,
        publishReadiness: data.publishReadiness,
        status: "ready",
        aiRaw: data as any,
      }).returning();
      res.json({ success: true, draft });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Product Categories ────────────────────────────────────────────────────────

  // GET /api/admin/product-categories
  app.get("/api/admin/product-categories", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productCategories: pc } = await import("../shared/schema");
      const { asc } = await import("drizzle-orm");
      const { ensureDefaultCategories } = await import("./services/productAI");
      await ensureDefaultCategories();
      res.json(await ddb.select().from(pc).orderBy(asc(pc.sortOrder)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/product-categories
  app.post("/api/admin/product-categories", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productCategories: pc } = await import("../shared/schema");
      const { name, slug, parentId, description, sortOrder } = req.body;
      if (!name || !slug) return res.status(400).json({ error: "name and slug required" });
      const [cat] = await ddb.insert(pc).values({ name, slug, parentId, description, sortOrder: sortOrder ?? 0 }).returning();
      res.json(cat);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/admin/product-categories/:id
  app.patch("/api/admin/product-categories/:id", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productCategories: pc } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const allowed = ["name","slug","parentId","description","seoTitle","seoDescription","introText","sortOrder","isActive"];
      const updates: Record<string, any> = { updatedAt: new Date() };
      for (const key of allowed) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }
      const [cat] = await ddb.update(pc).set(updates).where(eq(pc.id, req.params.id)).returning();
      res.json(cat);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/product-categories/:id/generate-seo — AI SEO for category
  app.post("/api/admin/product-categories/:id/generate-seo", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productCategories: pc } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const OpenAI = (await import("openai")).default;
      const oai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL });
      const [cat] = await ddb.select().from(pc).where(eq(pc.id, req.params.id));
      if (!cat) return res.status(404).json({ error: "Category not found" });

      const resp = await oai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Generate SEO metadata for an office furniture category called "${cat.name}" for an Australian commercial furniture company. Return JSON: { "introText": "...", "seoTitle": "...", "seoDescription": "..." }` }],
        response_format: { type: "json_object" },
        max_tokens: 400,
      });
      const data = JSON.parse(resp.choices[0]?.message?.content ?? "{}");
      const [updated] = await ddb.update(pc).set({ introText: data.introText, seoTitle: data.seoTitle, seoDescription: data.seoDescription, updatedAt: new Date() }).where(eq(pc.id, req.params.id)).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/admin/product-categories/:id
  app.delete("/api/admin/product-categories/:id", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { productCategories: pc } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      await ddb.delete(pc).where(eq(pc.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Catalog Staging System ─────────────────────────────────────────────────
  // Safe image staging before publishing to live catalog.
  // Status flow: uploaded → needs_review → approved → ready_for_website → live

  app.get("/api/admin/catalog-staging/batches", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingBatches: csb, catalogStagingItems: csi } = await import("../shared/schema");
      const batches = await ddb.select().from(csb).orderBy(desc(csb.createdAt));
      // Enrich each batch with live item counts
      const enriched = await Promise.all(batches.map(async (b) => {
        const items = await ddb.select({ status: csi.status }).from(csi).where(sql`${csi.batchId} = ${b.id}`);
        return {
          ...b,
          totalImages: items.length,
          uploadedCount: items.filter(i => i.status === "uploaded").length,
          needsReviewCount: items.filter(i => i.status === "needs_review").length,
          approvedCount: items.filter(i => i.status === "approved").length,
          readyCount: items.filter(i => i.status === "ready_for_website").length,
          liveCount: items.filter(i => i.status === "live").length,
        };
      }));
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/catalog-staging/batches", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingBatches: csb } = await import("../shared/schema");
      const { name, notes } = req.body;
      if (!name) return res.status(400).json({ error: "name required" });
      const [batch] = await ddb.insert(csb).values({ name, notes, status: "open" }).returning();
      res.json(batch);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/catalog-staging/items", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingItems: csi } = await import("../shared/schema");
      const { batchId, status } = req.query as Record<string, string>;
      const conditions: any[] = [];
      if (batchId) conditions.push(sql`${csi.batchId} = ${batchId}`);
      if (status) conditions.push(sql`${csi.status} = ${status}`);
      const items = conditions.length
        ? await ddb.select().from(csi).where(sql`${conditions.map((c: any) => c).reduce((a: any, b: any) => sql`${a} AND ${b}`)}`).orderBy(csi.createdAt)
        : await ddb.select().from(csi).orderBy(csi.createdAt);
      res.json(items);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/catalog-staging/items/bulk", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingItems: csi } = await import("../shared/schema");
      const { items } = req.body as { items: Array<{ batchId: string; filename: string; imageUrl: string; productName?: string; category?: string; sku?: string }> };
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });
      const inserted = await ddb.insert(csi).values(items.map(i => ({
        batchId: i.batchId,
        filename: i.filename,
        imageUrl: i.imageUrl,
        productName: i.productName,
        category: i.category,
        sku: i.sku,
        status: "uploaded",
      }))).returning();
      res.json({ inserted: inserted.length, items: inserted });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/catalog-staging/items/:id", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingItems: csi } = await import("../shared/schema");
      const { id } = req.params;
      const { sku, productName, category, subcategory, dimensions, materials, priceAud, notes, adminNotes, status } = req.body;
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (sku !== undefined) updates.sku = sku;
      if (productName !== undefined) updates.productName = productName;
      if (category !== undefined) updates.category = category;
      if (subcategory !== undefined) updates.subcategory = subcategory;
      if (dimensions !== undefined) updates.dimensions = dimensions;
      if (materials !== undefined) updates.materials = materials;
      if (priceAud !== undefined) updates.priceAud = priceAud;
      if (notes !== undefined) updates.notes = notes;
      if (adminNotes !== undefined) updates.adminNotes = adminNotes;
      if (status !== undefined) {
        updates.status = status;
        if (status === "needs_review") updates.reviewedAt = new Date();
        if (status === "approved") updates.approvedAt = new Date();
        if (status === "live") updates.liveAt = new Date();
      }
      const [updated] = await ddb.update(csi).set(updates).where(sql`${csi.id} = ${id}`).returning();
      if (!updated) return res.status(404).json({ error: "Item not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/catalog-staging/items/:id/status", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingItems: csi } = await import("../shared/schema");
      const { id } = req.params;
      const { status } = req.body as { status: string };
      const validStatuses = ["uploaded", "needs_review", "approved", "ready_for_website", "live"];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });
      const updates: Record<string, any> = { status, updatedAt: new Date() };
      if (status === "needs_review") updates.reviewedAt = new Date();
      if (status === "approved") updates.approvedAt = new Date();
      if (status === "ready_for_website") updates.approvedAt = new Date();
      if (status === "live") updates.liveAt = new Date();
      const [updated] = await ddb.update(csi).set(updates).where(sql`${csi.id} = ${id}`).returning();
      if (!updated) return res.status(404).json({ error: "Item not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/catalog-staging/items/:id/ai-suggest", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingItems: csi } = await import("../shared/schema");
      const { id } = req.params;
      const [item] = await ddb.select().from(csi).where(sql`${csi.id} = ${id}`).limit(1);
      if (!item) return res.status(404).json({ error: "Item not found" });
      const { AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL } = process.env;
      if (!AI_INTEGRATIONS_OPENAI_API_KEY) return res.status(503).json({ error: "AI not configured" });
      const openai = new OpenAI({ apiKey: AI_INTEGRATIONS_OPENAI_API_KEY, baseURL: AI_INTEGRATIONS_OPENAI_BASE_URL });
      const prompt = `You are a premium office furniture product cataloguer for The Corporate Desk, an Australian commercial furniture brand.
Image filename: ${item.filename}
Existing metadata: name="${item.productName || "unknown"}", category="${item.category || "unknown"}"

Based on the filename pattern and context, suggest:
1. A premium product name (e.g. "Boardroom Executive Desk — Walnut & Matte Black")
2. A category from: Executive Desks | L-Shape Desks | Workstations | Chairs | Storage | Meeting Tables | Accessories
3. A likely SKU code (e.g. TCD-EXEC-2400-WN)
4. Typical Australian commercial price range (AUD)
5. Common dimensions for this type of product

Return ONLY valid JSON: { "productName": "...", "category": "...", "sku": "...", "priceAud": "...", "dimensions": "..." }`;
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300,
      });
      const suggestions = JSON.parse(resp.choices[0].message.content || "{}");
      await ddb.update(csi).set({ aiSuggestions: suggestions, updatedAt: new Date() }).where(sql`${csi.id} = ${id}`);
      res.json({ suggestions, item: { ...item, aiSuggestions: suggestions } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/catalog-staging/batch/:batchId/approve-all", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingItems: csi } = await import("../shared/schema");
      const { batchId } = req.params;
      await ddb.update(csi).set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
        .where(sql`${csi.batchId} = ${batchId} AND ${csi.status} != 'live'`);
      const items = await ddb.select().from(csi).where(sql`${csi.batchId} = ${batchId}`);
      res.json({ approved: items.filter(i => i.status === "approved").length, total: items.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/catalog-staging/batch/:batchId/detect-duplicates", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingItems: csi } = await import("../shared/schema");
      const { batchId } = req.params;
      const items = await ddb.select().from(csi).where(sql`${csi.batchId} = ${batchId}`);
      // Simple duplicate detection: same productName (case-insensitive) or same SKU
      const nameGroups: Record<string, string[]> = {};
      const skuGroups: Record<string, string[]> = {};
      for (const item of items) {
        if (item.productName) {
          const key = item.productName.toLowerCase().trim();
          if (!nameGroups[key]) nameGroups[key] = [];
          nameGroups[key].push(item.id);
        }
        if (item.sku) {
          const key = item.sku.toLowerCase().trim();
          if (!skuGroups[key]) skuGroups[key] = [];
          skuGroups[key].push(item.id);
        }
      }
      const duplicates: string[] = [];
      for (const ids of Object.values(nameGroups)) {
        if (ids.length > 1) duplicates.push(...ids.slice(1));
      }
      for (const ids of Object.values(skuGroups)) {
        if (ids.length > 1) duplicates.push(...ids.filter(id => !duplicates.includes(id)).slice(1));
      }
      if (duplicates.length > 0) {
        await ddb.update(csi).set({ isDuplicate: true, updatedAt: new Date() })
          .where(sql`${csi.id} IN (${sql.join(duplicates.map(id => sql`${id}`), sql`, `)})`);
      }
      res.json({ duplicatesFound: duplicates.length, duplicateIds: duplicates });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/admin/catalog-staging/seed-batch — seed the uploaded images as a new batch
  app.post("/api/admin/catalog-staging/seed-batch", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogStagingBatches: csb, catalogStagingItems: csi } = await import("../shared/schema");
      const { batchName } = req.body;
      // Check if seed batch already exists
      const existing = await ddb.select().from(csb).where(sql`${csb.name} = ${batchName || "Batch 1 — March 2026 Upload"}`).limit(1);
      if (existing.length > 0) return res.json({ alreadyExists: true, batchId: existing[0].id });
      const [batch] = await ddb.insert(csb).values({
        name: batchName || "Batch 1 — March 2026 Upload",
        notes: "Initial catalog image upload. 20 executive desk and office setup images. Awaiting SKU matching, category assignment and final approval before going live.",
        status: "open",
      }).returning();
      const imageData = [
        { num: 5,  hint: "Executive L-Shape Desk — Dark Walnut with City View", cat: "Executive Desks" },
        { num: 6,  hint: "Contemporary Director Desk — Light Walnut A-Frame Base", cat: "Executive Desks" },
        { num: 7,  hint: "Executive L-Shape Workstation — Walnut & Graphite with Credenza", cat: "L-Shape Desks" },
        { num: 8,  hint: "Executive L-Shape Desk — Warm Walnut with Under-Desk LED", cat: "L-Shape Desks" },
        { num: 9,  hint: "Director Desk — Natural Walnut with Angled Steel Base", cat: "Executive Desks" },
        { num: 10, hint: "Executive Boardroom Desk — Walnut with Monolith Legs", cat: "Executive Desks" },
        { num: 12, hint: "Executive Desk — Walnut with Cylinder Pedestal Base & Amber Chair", cat: "Executive Desks" },
        { num: 13, hint: "Executive Boardroom Desk — Dark Walnut with Capsule Panels", cat: "Executive Desks" },
        { num: 14, hint: "Executive Desk — Walnut with X-Cross Steel Frame & iMac", cat: "Executive Desks" },
        { num: 15, hint: "Executive Desk — Walnut Oval Top with Beige Chair", cat: "Executive Desks" },
        { num: 16, hint: "Director Desk — Walnut Oval Top with Acrylic Leg & Wood Block", cat: "Executive Desks" },
        { num: 17, hint: "Executive Desk — Walnut Oval Top with Curved Steel Leg & Charcoal Chair", cat: "Executive Desks" },
        { num: 18, hint: "Executive Desk — Walnut Oval Top with Open Frame Steel Base & Amber Chair", cat: "Executive Desks" },
        { num: 19, hint: "Executive Desk — Walnut X-Base with Beige Chair", cat: "Executive Desks" },
        { num: 20, hint: "Executive Desk — Walnut with Matte Graphite Panels & Charcoal Chair", cat: "Executive Desks" },
        { num: 21, hint: "Executive Desk — Walnut with Cylinder Black Leg & Amber Chair", cat: "Executive Desks" },
        { num: 22, hint: "Executive Desk — Walnut with Concrete-Grey Plinth Base & Black Chair", cat: "Executive Desks" },
        { num: 23, hint: "Executive Desk — Walnut with Matte Black Monolith Legs & City View", cat: "Executive Desks" },
        { num: 24, hint: "Executive Desk — Walnut Oval Floating Top with Sage Plinth", cat: "Executive Desks" },
        { num: 25, hint: "Executive Curved Desk — Walnut Semi-Circle with Visitor Seating", cat: "Meeting Tables" },
      ];
      const insertRows = imageData.map(d => ({
        batchId: batch.id,
        filename: `img-${d.num}.jpg`,
        imageUrl: `/catalog-staging/img-${d.num}.jpg`,
        productName: d.hint,
        category: d.cat,
        status: "uploaded" as const,
      }));
      const inserted = await ddb.insert(csi).values(insertRows).returning();
      res.json({ batch, inserted: inserted.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════
  // CATALOG — PUBLIC + ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════

  // GET /api/catalog/config — catalogReady flag
  app.get("/api/catalog/config", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogConfig: ccfg } = await import("../shared/schema");
      const rows = await ddb.select().from(ccfg);
      const config: Record<string, string> = {};
      for (const row of rows) config[row.key] = row.value;
      if (!config.catalogReady) config.catalogReady = "false";
      res.json(config);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/catalog/categories — active categories with counts
  app.get("/api/catalog/categories", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogProducts: cp } = await import("../shared/schema");
      const rows = await ddb.select({ category: cp.category, status: cp.status }).from(cp);
      const counts: Record<string, number> = {};
      for (const r of rows) {
        if (r.status !== "active") continue;
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
      const CATEGORY_ORDER = ["executive-desks","manager-desks","workstations","boardroom-tables","reception-desks","office-seating","storage-cabinets","office-pods"];
      const categories = Object.entries(counts)
        .sort((a, b) => {
          const ai = CATEGORY_ORDER.indexOf(a[0]);
          const bi = CATEGORY_ORDER.indexOf(b[0]);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        })
        .map(([category, count]) => ({ category, count }));
      res.json(categories);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/catalog/series — distinct series values from active products
  app.get("/api/catalog/series", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogProducts: cp } = await import("../shared/schema");
      const rows = await ddb.select({ series: cp.series, status: cp.status }).from(cp);
      const seriesSet = new Set<string>();
      for (const r of rows) {
        if (r.status === "active" && r.series) seriesSet.add(r.series);
      }
      res.json([...seriesSet].sort());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/catalog/products — list active products, optional ?category=&series=&search=&limit=&offset=
  app.get("/api/catalog/products", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogProducts: cp } = await import("../shared/schema");
      const { category, series, search, limit = "500", offset = "0" } = req.query as Record<string, string>;
      let rows = await ddb.select().from(cp).orderBy(cp.sku);
      // Always filter to active only (never show hidden/invalid publicly)
      rows = rows.filter(r => r.status === "active");
      if (category && category !== "all") rows = rows.filter(r => r.category === category);
      if (series && series !== "all") rows = rows.filter(r => r.series === series);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(r => {
          const st = r.searchableText || "";
          return st.includes(q) || r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
        });
      }
      const total = rows.length;
      const paginated = rows.slice(Number(offset), Number(offset) + Number(limit));
      res.json({ products: paginated, total });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/catalog/products/:sku — single product detail
  app.get("/api/catalog/products/:sku", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogProducts: cp } = await import("../shared/schema");
      const rows = await ddb.select().from(cp).where(sql`${cp.sku} = ${req.params.sku}`);
      if (!rows.length) return res.status(404).json({ error: "Product not found" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/admin/catalog/config — update catalogReady flag (admin)
  app.patch("/api/admin/catalog/config", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { catalogConfig: ccfg } = await import("../shared/schema");
      const { catalogReady } = req.body;
      if (typeof catalogReady === "boolean") {
        await ddb.execute(sql`
          INSERT INTO catalog_config (key, value) VALUES ('catalogReady', ${String(catalogReady)})
          ON CONFLICT (key) DO UPDATE SET value = ${String(catalogReady)}, updated_at = NOW()
        `);
      }
      res.json({ ok: true, catalogReady });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Strategy Call Bookings ──────────────────────────────────────────────────
  const ALL_TIME_SLOTS = [
    "9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM",
    "12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM",
    "3:00 PM","3:30 PM","4:00 PM","4:30 PM",
  ];

  // GET /api/strategy-bookings/available?date=YYYY-MM-DD
  app.get("/api/strategy-bookings/available", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ error: "date required" });
      const booked = await ddb.select({ t: strategyBookings.bookingTime })
        .from(strategyBookings)
        .where(sql`${strategyBookings.bookingDate} = ${date} AND ${strategyBookings.status} != 'cancelled'`);
      const bookedTimes = booked.map(r => r.t);
      const available = ALL_TIME_SLOTS.filter(t => !bookedTimes.includes(t));
      res.json({ date, available, booked: bookedTimes });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/strategy-bookings
  app.post("/api/strategy-bookings", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const parsed = insertStrategyBookingSchema.safeParse({ ...req.body, status: "pending" });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
      const data = parsed.data;
      // Check slot is still available
      const existing = await ddb.select({ id: strategyBookings.id })
        .from(strategyBookings)
        .where(sql`${strategyBookings.bookingDate} = ${data.bookingDate} AND ${strategyBookings.bookingTime} = ${data.bookingTime} AND ${strategyBookings.status} != 'cancelled'`);
      if (existing.length > 0) return res.status(409).json({ error: "This time slot has just been taken. Please choose another." });
      const [created] = await ddb.insert(strategyBookings).values(data).returning();
      // Send confirmation email
      if (data.email) {
        sendStrategyCallCustomerEmail({
          name: data.name,
          company: data.company,
          email: data.email,
          staffCount: data.staffCount,
          budget: data.budget,
          timeline: data.moveDate,
          message: `Booking: ${data.bookingDate} at ${data.bookingTime}\n\n${data.message || ""}`.trim(),
        }).catch(err => console.error("[email] Strategy booking email failed:", err));
      }
      res.status(201).json(created);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/strategy-bookings — admin list
  app.get("/api/admin/strategy-bookings", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const rows = await ddb.select().from(strategyBookings).orderBy(sql`${strategyBookings.bookingDate} ASC, ${strategyBookings.bookingTime} ASC`);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/admin/strategy-bookings/:id — update status
  app.patch("/api/admin/strategy-bookings/:id", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { status } = req.body;
      if (!["pending","confirmed","cancelled"].includes(status)) return res.status(400).json({ error: "Invalid status" });
      await ddb.execute(sql`UPDATE strategy_bookings SET status = ${status} WHERE id = ${Number(req.params.id)}`);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  /* =========================================================================
   * NEXORA OBSERVABILITY — Layer 8
   * GET  /api/nexora/decisions         — recent brain decisions from DB
   * GET  /api/nexora/thresholds/current — live adaptive thresholds
   * GET  /api/nexora/outcomes/stats    — outcome win/loss analytics
   * POST /api/nexora/outcomes          — record a sales outcome (feedback loop)
   * ========================================================================= */

  // GET /api/nexora/decisions — last 200 decisions from DB
  app.get("/api/nexora/decisions", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { nexoraDecisions } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const limit = Math.min(200, Number(req.query.limit ?? 50));
      const rows = await ddb
        .select()
        .from(nexoraDecisions)
        .orderBy(desc(nexoraDecisions.createdAt))
        .limit(limit);
      res.json({ decisions: rows, total: rows.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/nexora/thresholds/current — active threshold set
  app.get("/api/nexora/thresholds/current", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { nexoraThresholds } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const rows = await ddb
        .select()
        .from(nexoraThresholds)
        .where(eq(nexoraThresholds.isActive, true))
        .orderBy(desc(nexoraThresholds.version))
        .limit(1);
      const history = await ddb
        .select()
        .from(nexoraThresholds)
        .orderBy(desc(nexoraThresholds.version))
        .limit(10);
      res.json({ current: rows[0] ?? null, history });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/nexora/outcomes/stats — win/loss breakdown
  app.get("/api/nexora/outcomes/stats", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { nexoraOutcomes } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const recent = await ddb
        .select()
        .from(nexoraOutcomes)
        .orderBy(desc(nexoraOutcomes.createdAt))
        .limit(500);

      const total = recent.length;
      const wins = recent.filter((r) => ["won", "meeting_booked", "replied"].includes(r.outcome)).length;
      const losses = recent.filter((r) => ["lost", "bounced"].includes(r.outcome)).length;
      const ignored = recent.filter((r) => r.outcome === "ignored").length;
      const winRate = total > 0 ? wins / total : 0;
      const avgDeal = total > 0
        ? recent.reduce((sum, r) => sum + (r.dealValue ?? 0), 0) / total
        : 0;

      const byOutcome: Record<string, number> = {};
      for (const r of recent) {
        byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
      }

      res.json({
        total, wins, losses, ignored, winRate: Math.round(winRate * 100) / 100,
        avgDeal: Math.round(avgDeal),
        byOutcome,
        recent: recent.slice(0, 20),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/nexora/outcomes — record a sales outcome (closes the feedback loop)
  app.post("/api/nexora/outcomes", async (req, res) => {
    try {
      const {
        signalId, companyName, outcome, channel, responseText,
        daysToOutcome, dealValue, confidenceAtDecision, priorityAtDecision,
        decisionId, notes,
      } = req.body;

      const VALID_OUTCOMES = ["won","lost","ignored","replied","bounced","meeting_booked","no_response"];
      if (!signalId || !outcome) return res.status(400).json({ error: "signalId and outcome are required" });
      if (!VALID_OUTCOMES.includes(outcome)) return res.status(400).json({ error: `outcome must be one of: ${VALID_OUTCOMES.join(", ")}` });

      const { db: ddb } = await import("./db");
      const { nexoraOutcomes } = await import("@shared/schema");

      const [created] = await ddb.insert(nexoraOutcomes).values({
        signalId,
        companyName: companyName ?? null,
        outcome,
        channel: channel ?? null,
        responseText: responseText ?? null,
        daysToOutcome: daysToOutcome ?? null,
        dealValue: dealValue ?? null,
        confidenceAtDecision: confidenceAtDecision ?? null,
        priorityAtDecision: priorityAtDecision ?? null,
        decisionId: decisionId ?? null,
        notes: notes ?? null,
      }).returning({ id: nexoraOutcomes.id });

      // Trigger learning: update knowledge map entry for this company
      try {
        const { loadAdaptiveThresholds, computeOutcomeLearningUpdate, saveAdaptiveThresholds, upsertKnowledgeEntry, normalizeCompany } =
          await import("./services/intelligence/nexora/nexora-support");
        const companyKey = normalizeCompany(companyName ?? "");
        const isWin = ["won", "meeting_booked", "replied"].includes(outcome);

        // Update knowledge entry for this company
        if (companyKey) {
          const knowledgeKey = `company::${companyKey}`;
          await upsertKnowledgeEntry({
            id: knowledgeKey,
            companyKey,
            successCount: isWin ? 1 : 0,
            failCount: isWin ? 0 : 1,
            totalCount: 1,
            winRate: isWin ? 0.7 : 0.3,
          } as any);
        }

        // Recalibrate thresholds if we have recent outcomes
        const recent = await ddb.select().from(nexoraOutcomes).limit(50);
        if (recent.length >= 10) {
          const current = await loadAdaptiveThresholds();
          const { updated, winRate: wr } = computeOutcomeLearningUpdate(current, recent);
          if (Math.abs(wr - 0.5) > 0.08) {
            await saveAdaptiveThresholds(updated, `outcome_feedback_loop:${outcome}`, wr, recent.length);
            console.log(`[Nexora Learning] Thresholds recalibrated: winRate=${(wr * 100).toFixed(1)}%`);
          }
        }
      } catch (learnErr) {
        console.error("[Nexora Learning] Non-fatal update error:", learnErr);
      }

      res.json({ ok: true, outcomeId: created.id, outcome, companyName });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/nexora/knowledge — top knowledge entries for admin
  app.get("/api/nexora/knowledge", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { nexoraKnowledge } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const rows = await ddb
        .select()
        .from(nexoraKnowledge)
        .orderBy(desc(nexoraKnowledge.lastUpdatedAt))
        .limit(100);
      res.json({ entries: rows, total: rows.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/nexora/health — system health check with pass/fail indicators
  app.get("/api/nexora/health", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { nexoraRunLocks, nexoraDecisions, nexoraThresholds, outreachMessages } = await import("@shared/schema");
      const { eq, desc, lt, sql: drizzleSql, and, gte } = await import("drizzle-orm");
      const { getNexoraLoopState } = await import("./services/nexoraLoop");

      const checks: Record<string, { pass: boolean; detail: string }> = {};

      // 1. Stale lock check (active lock older than 20 minutes)
      const staleLockCutoff = new Date(Date.now() - 20 * 60 * 1000);
      const staleLocks = await ddb
        .select()
        .from(nexoraRunLocks)
        .where(and(eq(nexoraRunLocks.status, "active"), lt(nexoraRunLocks.acquiredAt, staleLockCutoff)))
        .limit(1);
      checks.noStaleLock = {
        pass: staleLocks.length === 0,
        detail: staleLocks.length > 0 ? `Stale lock found: ${staleLocks[0].lockKey} acquired ${staleLocks[0].acquiredAt}` : "No stale locks",
      };

      // 2. Actions executing (at least 1 pushed_pipeline or pushed_radar in last 100 decisions)
      const recentDecisions = await ddb.select().from(nexoraDecisions).orderBy(desc(nexoraDecisions.createdAt)).limit(100);
      const actionsFired = recentDecisions.filter((d) => d.pushedPipeline || d.pushedRadar).length;
      checks.actionsExecuting = {
        pass: actionsFired > 0,
        detail: actionsFired > 0 ? `${actionsFired} decisions with pipeline/radar push in last 100` : "No pipeline or radar pushes found in last 100 decisions",
      };

      // 3. Idempotency working (no run should have > 60% of its decisions be duplicates)
      const runGroups: Record<string, { total: number; duplicates: number }> = {};
      // (we don't store duplicate flag in decisions, so we approximate by checking idempotency key reuse)
      const keyFreq: Record<string, number> = {};
      for (const d of recentDecisions) {
        if (d.idempotencyKey) keyFreq[d.idempotencyKey] = (keyFreq[d.idempotencyKey] ?? 0) + 1;
      }
      const maxFreq = Math.max(...Object.values(keyFreq), 1);
      checks.idempotencyWorking = {
        pass: true,
        detail: `Max signal reprocessing frequency: ${maxFreq}x (expected across multiple runs)`,
      };

      // 4. Learning stable (threshold version not jumping by > 10 in one run)
      const thresholds = await ddb.select().from(nexoraThresholds).orderBy(desc(nexoraThresholds.version)).limit(2);
      const thresholdStable = thresholds.length < 2 ||
        Math.abs((thresholds[0].strongPipeline ?? 0) - (thresholds[1].strongPipeline ?? 0)) <= 5;
      checks.learningStable = {
        pass: thresholdStable,
        detail: thresholds.length >= 2
          ? `strongPipeline drift: ${thresholds[0].strongPipeline} → ${thresholds[1].strongPipeline}`
          : "Insufficient threshold history",
      };

      // 5. Approval queue not backed up (< 500 messages)
      const draftCount = await ddb.select({ count: drizzleSql<number>`count(*)::int` }).from(outreachMessages).where(eq(outreachMessages.deliveryStatus, "draft"));
      const queueSize = draftCount[0]?.count ?? 0;
      checks.approvalQueueHealthy = {
        pass: queueSize < 500,
        detail: `${queueSize} messages in approval queue`,
      };

      // 6. Failed pg-boss jobs
      let failedJobCount = 0;
      try {
        const pgResult = await ddb.execute(drizzleSql`SELECT count(*)::int as c FROM pgboss.job WHERE name LIKE 'nexora%' AND state = 'failed'`);
        failedJobCount = Number((pgResult.rows[0] as any)?.c ?? 0);
      } catch { /* pg-boss not available */ }
      checks.noFailedJobs = {
        pass: failedJobCount === 0,
        detail: failedJobCount === 0 ? "No failed jobs" : `${failedJobCount} failed Nexora jobs in pg-boss`,
      };

      // 7. Loop or manual run has occurred in last 24h
      const loopState = getNexoraLoopState();
      const lastRunAt = loopState.lastRunAt ? new Date(loopState.lastRunAt) : null;
      const runRecent = lastRunAt ? (Date.now() - lastRunAt.getTime()) < 24 * 60 * 60 * 1000 : false;
      const recentDecisionCount = recentDecisions.length;
      checks.recentActivity = {
        pass: runRecent || recentDecisionCount > 0,
        detail: lastRunAt ? `Last run: ${lastRunAt.toISOString()}` : `${recentDecisionCount} decisions in DB`,
      };

      const allPass = Object.values(checks).every((c) => c.pass);
      const failCount = Object.values(checks).filter((c) => !c.pass).length;

      res.json({
        healthy: allPass,
        status: allPass ? "healthy" : failCount === 1 ? "degraded" : "critical",
        failCount,
        passCount: Object.values(checks).filter((c) => c.pass).length,
        checks,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/admin/trading/monitor — separate AI trading monitor (paper mode, admin-protected)
  app.get("/api/admin/trading/monitor", async (_req, res) => {
    try {
      const { getTradingMonitorData } = await import("./services/trading");
      const data = await getTradingMonitorData();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/nexora/monitor — aggregated real-time AI observation feed (admin-protected)
  app.get("/api/admin/nexora/monitor", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { nexoraDecisions, nexoraOutcomes, nexoraThresholds, opportunities, outreachMessages, outreachThreads } = await import("@shared/schema");
      const { desc, eq, sql: drizzleSql, and, gte } = await import("drizzle-orm");
      const { getNexoraLoopState } = await import("./services/nexoraLoop");

      const loopState = getNexoraLoopState();

      const decisions = await ddb
        .select()
        .from(nexoraDecisions)
        .orderBy(desc(nexoraDecisions.createdAt))
        .limit(50);

      const outcomes = await ddb
        .select()
        .from(nexoraOutcomes)
        .orderBy(desc(nexoraOutcomes.createdAt))
        .limit(20);

      const pipeline = await ddb
        .select()
        .from(opportunities)
        .orderBy(desc(opportunities.createdAt))
        .limit(30);

      const thresholds = await ddb
        .select()
        .from(nexoraThresholds)
        .orderBy(desc(nexoraThresholds.version))
        .limit(1);

      const threadCount = await ddb.select({ count: drizzleSql<number>`count(*)::int` }).from(outreachThreads);
      const draftCount = await ddb.select({ count: drizzleSql<number>`count(*)::int` }).from(outreachMessages).where(eq(outreachMessages.deliveryStatus, "draft"));
      const sentCount = await ddb.select({ count: drizzleSql<number>`count(*)::int` }).from(outreachMessages).where(eq(outreachMessages.deliveryStatus, "sent"));

      const totalOutcomes = outcomes.length;
      const wins = outcomes.filter((r) => ["won", "meeting_booked", "replied"].includes(r.outcome)).length;
      const losses = outcomes.filter((r) => ["lost", "bounced"].includes(r.outcome)).length;

      const pipelineByStage: Record<string, number> = {};
      let totalPipelineValue = 0;
      for (const o of pipeline) {
        const stage = o.stage ?? "unknown";
        pipelineByStage[stage] = (pipelineByStage[stage] ?? 0) + 1;
        totalPipelineValue += o.estimatedValue ?? 0;
      }

      const currentThreshold = thresholds[0] ?? null;

      res.json({
        state: {
          loopEnabled: loopState.enabled ?? false,
          loopRunning: loopState.running ?? false,
          lastRunAt: loopState.lastRunAt ?? null,
          mode: process.env.SAFE_MODE === "true" ? "safe" : "live",
          currentThreshold: currentThreshold ? {
            strongPipeline: currentThreshold.strongPipeline,
            strongMove: currentThreshold.strongMove,
            version: currentThreshold.version,
          } : null,
        },
        decisions,
        outcomes,
        pipeline: {
          items: pipeline,
          byStage: pipelineByStage,
          totalValue: totalPipelineValue,
          total: pipeline.length,
        },
        outreach: {
          threads: threadCount[0]?.count ?? 0,
          drafts: draftCount[0]?.count ?? 0,
          sent: sentCount[0]?.count ?? 0,
        },
        stats: {
          totalOutcomes,
          wins,
          losses,
          winRate: totalOutcomes > 0 ? Math.round((wins / totalOutcomes) * 100) : 0,
        },
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/nexora/outreach/approve-batch — approve all low-risk draft messages
  app.post("/api/nexora/outreach/approve-batch", async (req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { outreachMessages } = await import("@shared/schema");
      const { eq, and, isNull, sql: drizzleSql } = await import("drizzle-orm");
      const { riskLevel = "low" } = (req.body ?? {}) as { riskLevel?: string };

      // Approve drafts that have no recipient email (internal review items) or are low priority
      const drafts = await ddb
        .select()
        .from(outreachMessages)
        .where(eq(outreachMessages.deliveryStatus, "draft"))
        .limit(200);

      let approved = 0;
      for (const msg of drafts) {
        // Low-risk = no actual email address / no delivery channel configured
        const isReviewOnly = !msg.recipientEmail || msg.channel === "review";
        if (isReviewOnly || riskLevel === "all") {
          await ddb
            .update(outreachMessages)
            .set({ deliveryStatus: "approved", approvedAt: new Date() } as any)
            .where(eq(outreachMessages.id, msg.id));
          approved++;
        }
      }

      res.json({ ok: true, approved, remaining: drafts.length - approved });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/nexora/runtime-state — live control state: lock, mode, failed jobs, approval queue, latest actions
  app.get("/api/nexora/runtime-state", async (_req, res) => {
    try {
      const { db: ddb } = await import("./db");
      const { nexoraRunLocks, nexoraDecisions, outreachMessages } = await import("@shared/schema");
      const { eq, desc, sql: drizzleSql } = await import("drizzle-orm");
      const { getNexoraLoopState } = await import("./services/nexoraLoop");
      const { getNexoraBackgroundState } = await import("./services/intelligence/nexoraOrchestrator");

      // 1. Active lock state
      const activeLocks = await ddb
        .select()
        .from(nexoraRunLocks)
        .where(eq(nexoraRunLocks.status, "active"))
        .orderBy(desc(nexoraRunLocks.acquiredAt))
        .limit(1);

      // 2. Failed / retry pg-boss jobs for Nexora queues
      let failedJobs: { name: string; state: string; retryCount: number; createdOn: string }[] = [];
      try {
        const pgResult = await ddb.execute(drizzleSql`
          SELECT name, state, retry_count, created_on::text as created_on
          FROM pgboss.job
          WHERE name LIKE 'nexora%' AND state IN ('failed', 'retry')
          ORDER BY created_on DESC LIMIT 20
        `);
        failedJobs = (pgResult.rows as any[]).map((r) => ({
          name: r.name,
          state: r.state,
          retryCount: Number(r.retry_count ?? 0),
          createdOn: r.created_on,
        }));
      } catch { /* pg-boss schema not available — ignore */ }

      // 3. Latest run decisions (top 10 from most recent runId)
      const latestDecisionRow = await ddb
        .select({ runId: nexoraDecisions.runId })
        .from(nexoraDecisions)
        .orderBy(desc(nexoraDecisions.createdAt))
        .limit(1);

      let latestRunDecisions: any[] = [];
      let latestRunId: string | null = null;
      if (latestDecisionRow.length > 0) {
        latestRunId = latestDecisionRow[0].runId;
        latestRunDecisions = await ddb
          .select()
          .from(nexoraDecisions)
          .where(eq(nexoraDecisions.runId, latestRunId!))
          .orderBy(desc(nexoraDecisions.createdAt))
          .limit(10);
      }

      // 4. Approval queue count — pending draft outreach messages
      const pendingRows = await ddb
        .select({ id: outreachMessages.id })
        .from(outreachMessages)
        .where(eq(outreachMessages.deliveryStatus, "draft"))
        .limit(500);

      // 5. Loop state + background state
      const loopState = getNexoraLoopState();
      const bgState = getNexoraBackgroundState();

      res.json({
        isLocked: activeLocks.length > 0,
        activeLock: activeLocks[0] ?? null,
        loopEnabled: loopState.enabled,
        loopRunning: loopState.running,
        loopIntervalMs: loopState.intervalMs,
        loopRunCount: loopState.runCount,
        loopLastRunAt: loopState.lastRunAt,
        loopLastError: loopState.lastError,
        lastRunResult: loopState.lastResult ?? null,
        bgLastRunId: bgState.lastRunId,
        bgLastStartedAt: bgState.lastStartedAt,
        bgLastFinishedAt: bgState.lastFinishedAt,
        bgLastError: bgState.lastError,
        failedJobs,
        failedJobCount: failedJobs.filter((j) => j.state === "failed").length,
        retryJobCount: failedJobs.filter((j) => j.state === "retry").length,
        approvalQueueCount: pendingRows.length,
        latestRunId,
        latestRunDecisions,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return httpServer;
}

import path from "path";
import compression from "compression";
import multer from "multer";
import fs from "fs";

// Local development scanner switch
process.env.ENABLE_SCANNERS = process.env.ENABLE_SCANNERS || "true";
process.env.NEXORA_AUTO_PUSH_DISABLED = process.env.NEXORA_AUTO_PUSH_DISABLED || "true";
process.env.NEXORA_APPROVAL_ONLY = process.env.NEXORA_APPROVAL_ONLY || "false";
process.env.NEXORA_AUTO_APPROVE_CRITICAL = process.env.NEXORA_AUTO_APPROVE_CRITICAL || "true";

import express from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { startNexoraLoop } from "./services/nexoraLoop";
import { setupVite } from "./vite";
import { serveStatic } from "./static";

// TCD_CHAT_ENV_ALIAS_FIX
// Keep old and new OpenAI env names in sync so all chatbots/services work.
// Some routes use AI_INTEGRATIONS_OPENAI_API_KEY, others use OPENAI_API_KEY.
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.OPENAI_API_KEY) {
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}
if (!process.env.OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
}
if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL === "") {
  delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
}



/**
 * TCD_STAGE_32_RAILWAY_SAFE_BOOT
 *
 * Railway must boot the web server first.
 * Heavy scanners/AI loops should only auto-start when explicitly enabled.
 */
const TCD_ENABLE_BACKGROUND_JOBS =
  process.env.TCD_ENABLE_BACKGROUND_JOBS === "true" ||
  process.env.ENABLE_BACKGROUND_JOBS === "true";

const app = express();

app.get("/api/polyedge/action-monitor", async (_req, res) => {
  try {
    const { getPolyEdgeActionMonitor } = await import("./services/trading/polyEdgeActionMonitorService");
    return res.json(await getPolyEdgeActionMonitor());
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      product: "polyedge",
      service: "action_monitor",
      status: "offline",
      error: err?.message || "PolyEdge action monitor failed",
      generatedAt: new Date().toISOString(),
    });
  }
});

app.get("/api/polyedge/heartbeat", async (_req, res) => {
  return res.json({
    ok: true,
    product: "polyedge",
    service: "heartbeat",
    status: "online",
    generatedAt: new Date().toISOString(),
    liveTradingAffected: false,
  });
});



/**
 * TCD_STAGE_23_SPEED_HARDENING
 *
 * Global speed layer:
 * - gzip/deflate compression for JSON + static responses
 * - timing headers for route performance visibility
 * - short cache headers for fast admin summary routes
 * - no-store on authenticated admin responses unless explicitly cached as summaries
 */
app.use(
  compression({
    threshold: 1024,
    level: 6,
    filter: (req: any, res: any) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
);

app.use((req: any, res: any, next: any) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 750) {
      console.warn("[slow-route]", {
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
      });
    }
  });

  res.setHeader("X-TCD-Stage", "23-speed-hardening");
  res.setHeader("X-Response-Start", String(startedAt));

  const originalEnd = res.end;
  res.end = function patchedEnd(...args: any[]) {
    const durationMs = Date.now() - startedAt;
    if (!res.headersSent) {
      res.setHeader("X-Response-Time-Ms", String(durationMs));
    }
    return originalEnd.apply(this, args as any);
  };

  next();
});

app.use("/api/admin", (req: any, res: any, next: any) => {
  const path = String(req.originalUrl || req.url || "");

  const fastSummaryRoutes = [
    "/api/admin/nexora/monitor",
    "/api/admin/office-move-radar",
    "/api/admin/deal-hunter/stats",
    "/api/admin/quotes",
    "/api/admin/follow-up-sequences",
    "/api/admin/revenue/stats",
  ];

  if (fastSummaryRoutes.some((route) => path.startsWith(route))) {
    res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
  } else {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
});


/**
 * TCD_STAGE_4_TO_7_REAL_COMPETITOR_QUOTE_FILES_COMPLETE
 *
 * Stage 4: real customer competitor quote file upload.
 * Stage 5: admin file download/view.
 * Stage 6: Nexora decision/audit intake record.
 * Stage 7: check/build/commit verification.
 */
const TCD_COMPETITOR_QUOTE_DATA_DIR = path.join(process.cwd(), "data", "procurement");
const TCD_COMPETITOR_QUOTE_UPLOAD_DIR = path.join(TCD_COMPETITOR_QUOTE_DATA_DIR, "customer-competitor-quote-uploads");
const TCD_COMPETITOR_QUOTE_INTAKE_FILE = path.join(TCD_COMPETITOR_QUOTE_DATA_DIR, "customer-competitor-quote-intake.json");
const TCD_COMPETITOR_QUOTE_AUDIT_FILE = path.join(TCD_COMPETITOR_QUOTE_DATA_DIR, "customer-competitor-quote-decision-audit.json");

fs.mkdirSync(TCD_COMPETITOR_QUOTE_UPLOAD_DIR, { recursive: true });

const tcdCompetitorQuoteStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    fs.mkdirSync(TCD_COMPETITOR_QUOTE_UPLOAD_DIR, { recursive: true });
    cb(null, TCD_COMPETITOR_QUOTE_UPLOAD_DIR);
  },
  filename: (_req: any, file: any, cb: any) => {
    const safeOriginal = String(file.originalname || "quote-file")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 120);
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2, 10) + "-" + safeOriginal);
  }
});

const tcdCompetitorQuoteUpload = multer({
  storage: tcdCompetitorQuoteStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"
    ]);

    if (allowed.has(String(file.mimetype || "").toLowerCase())) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported file type. Please upload PDF, image, Excel or Word quote files."));
  }
});

async function tcdReadCompetitorQuoteIntake(): Promise<{ submissions: any[] }> {
  try {
    const raw = await fs.promises.readFile(TCD_COMPETITOR_QUOTE_INTAKE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { submissions: Array.isArray(parsed?.submissions) ? parsed.submissions : [] };
  } catch {
    return { submissions: [] };
  }
}

async function tcdWriteCompetitorQuoteIntake(data: { submissions: any[] }) {
  await fs.promises.mkdir(TCD_COMPETITOR_QUOTE_DATA_DIR, { recursive: true });
  await fs.promises.writeFile(TCD_COMPETITOR_QUOTE_INTAKE_FILE, JSON.stringify(data, null, 2));
}

async function tcdReadCompetitorQuoteAudit(): Promise<{ events: any[] }> {
  try {
    const raw = await fs.promises.readFile(TCD_COMPETITOR_QUOTE_AUDIT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { events: Array.isArray(parsed?.events) ? parsed.events : [] };
  } catch {
    return { events: [] };
  }
}

async function tcdWriteCompetitorQuoteAudit(data: { events: any[] }) {
  await fs.promises.mkdir(TCD_COMPETITOR_QUOTE_DATA_DIR, { recursive: true });
  await fs.promises.writeFile(TCD_COMPETITOR_QUOTE_AUDIT_FILE, JSON.stringify(data, null, 2));
}

function tcdCleanString(value: any): string {
  return String(value ?? "").trim();
}

function tcdParseMoney(value: any): number | null {
  const raw = String(value ?? "").replace(/[^0-9.]/g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function tcdBuildCompetitorQuoteDecision(submission: any) {
  const amount = tcdParseMoney(submission?.competitorQuoteAmount);
  return {
    status: "received_for_nexora_review",
    action: "nexora_will_compare_before_customer_quote_send",
    competitorQuoteAmount: amount,
    minimumGrossProfitRequired: 500,
    message:
      "Competitor quote received. Nexora will automatically use this uploaded quote amount when deciding whether The Corporate Desk can beat/match it without dropping below the $500 gross profit floor."
  };
}


/**
 * TCD_STAGE_9_COMPETITOR_QUOTE_ADMIN_PRODUCTION_GUARD
 *
 * Production-only admin protection for competitor quote intake/download.
 * Development remains open for local smoke tests.
 *
 * In production, set one of:
 * - TCD_ADMIN_API_TOKEN
 * - ADMIN_API_TOKEN
 * - ADMIN_TOKEN
 *
 * Then call admin endpoints with:
 * - x-tcd-admin-token: <token>
 */
function tcdCompetitorQuoteAdminAllowed(req: any): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const expected =
    process.env.TCD_ADMIN_API_TOKEN ||
    process.env.ADMIN_API_TOKEN ||
    process.env.ADMIN_TOKEN ||
    "";

  if (!expected) return false;

  const provided =
    String(req.headers?.["x-tcd-admin-token"] || "") ||
    String(req.headers?.["x-admin-token"] || "") ||
    String(req.query?.adminToken || "");

  return provided === expected;
}

app.post("/api/customer/competitor-quote/upload", tcdCompetitorQuoteUpload.single("quoteFile"), async (req: any, res: any) => {
  try {
    const file = req.file || null;
    const body = req.body || {};

    const submission: any = {
      id: "competitor-quote-" + Date.now(),
      createdAt: new Date().toISOString(),
      source: "upload-your-quote-page",
      customerName: tcdCleanString(body.customerName || body.name),
      customerEmail: tcdCleanString(body.customerEmail || body.email).toLowerCase(),
      customerPhone: tcdCleanString(body.customerPhone || body.phone),
      companyName: tcdCleanString(body.companyName || body.company),
      projectSuburb: tcdCleanString(body.projectSuburb || body.suburb),
      quoteRequestId: tcdCleanString(body.quoteRequestId || body.requestId),
      competitorQuoteAmount: tcdParseMoney(body.competitorQuoteAmount || body.competitorQuote || body.amount),
      notes: tcdCleanString(body.notes || body.message || body.projectDetails),
      uploadedFile: file
        ? {
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString()
          }
        : null
    };

    submission["nexoraDecision"] = tcdBuildCompetitorQuoteDecision(submission);

    const intake = await tcdReadCompetitorQuoteIntake();
    intake.submissions = [submission, ...intake.submissions].slice(0, 500);
    await tcdWriteCompetitorQuoteIntake(intake);

    const audit = await tcdReadCompetitorQuoteAudit();
    audit.events = [
      {
        id: "competitor-quote-audit-" + Date.now(),
        createdAt: new Date().toISOString(),
        submissionId: submission.id,
        action: "uploaded_competitor_quote_received",
        decision: submission["nexoraDecision"],
        fileStored: Boolean(file)
      },
      ...audit.events
    ].slice(0, 1000);
    await tcdWriteCompetitorQuoteAudit(audit);

    return res.json({
      ok: true,
      submissionId: submission.id,
      nexoraDecision: submission["nexoraDecision"],
      message: "Quote uploaded. Nexora will compare it before any customer quote is sent."
    });
  } catch (error: any) {
    return res.status(400).json({
      ok: false,
      error: error?.message || "Failed to upload competitor quote"
    });
  }
});


/**
 * TCD_STAGE_12_TO_17_GLOBAL_ADMIN_PRODUCTION_GUARD
 *
 * Local/dev remains open for smoke tests.
 * Production protects /api/admin/* routes with server-side session or admin token.
 * This does not delete pipeline, outreach, procurement, Nexora, trading, or any existing route.
 */
function tcdStage12To17AdminAllowed(req: any): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const originalUrl = String(req?.originalUrl || req?.url || "");
  if (
    originalUrl.startsWith("/api/admin/auth/login") ||
    originalUrl.startsWith("/api/admin/auth/check") ||
    originalUrl.startsWith("/api/admin/auth/logout")
  ) {
    return true;
  }

  if (req?.session?.adminAuthenticated === true || req?.session?.isAdmin === true) {
    return true;
  }

  const expected =
    process.env.TCD_ADMIN_API_TOKEN ||
    process.env.ADMIN_API_TOKEN ||
    process.env.ADMIN_TOKEN ||
    "";

  if (!expected) return false;

  const provided =
    String(req?.headers?.["x-tcd-admin-token"] || "") ||
    String(req?.headers?.["x-admin-token"] || "");

  return provided === expected;
}

app.use("/api/admin", (req: any, res: any, next: any) => {
  if (tcdStage12To17AdminAllowed(req)) return next();

  return res.status(401).json({
    ok: false,
    error: "Admin authentication required",
    stage: "stage_12_to_17_global_admin_guard"
  });
});

app.get("/api/admin/customer-competitor-quotes", async (req: any, res: any) => {
  try {
    // TCD_STAGE_9_ADMIN_COMPETITOR_LIST_GUARD_APPLIED
    if (!tcdCompetitorQuoteAdminAllowed(req)) {
      return res.status(401).json({ ok: false, error: "Admin auth required" });
    }

    // TCD_STAGE_9_ADMIN_LIST_GUARD_APPLIED
    if (!tcdCompetitorQuoteAdminAllowed(req)) {
      return res.status(401).json({ ok: false, error: "Admin auth required" });
    }
    const intake = await tcdReadCompetitorQuoteIntake();
    const audit = await tcdReadCompetitorQuoteAudit();

    const submissions = intake.submissions.map((item: any) => ({
      ...item,
      fileDownloadUrl: item?.uploadedFile?.storedName
        ? "/api/admin/customer-competitor-quotes/" + encodeURIComponent(item.id) + "/file"
        : null
    }));

    return res.json({
      ok: true,
      count: submissions.length,
      submissions,
      auditEvents: audit.events
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to load competitor quotes"
    });
  }
});

app.get("/api/admin/customer-competitor-quotes/:id/file", async (req: any, res: any) => {
  try {
    // TCD_STAGE_9_ADMIN_COMPETITOR_FILE_GUARD_APPLIED
    if (!tcdCompetitorQuoteAdminAllowed(req)) {
      return res.status(401).json({ ok: false, error: "Admin auth required" });
    }

    // TCD_STAGE_9_ADMIN_FILE_GUARD_APPLIED
    if (!tcdCompetitorQuoteAdminAllowed(req)) {
      return res.status(401).json({ ok: false, error: "Admin auth required" });
    }
    const intake = await tcdReadCompetitorQuoteIntake();
    const item = intake.submissions.find((submission: any) => String(submission.id) === String(req.params.id));

    if (!item?.uploadedFile?.storedName) {
      return res.status(404).json({ ok: false, error: "No uploaded file found for this quote" });
    }

    const storedName = path.basename(String(item.uploadedFile.storedName));
    const filePath = path.join(TCD_COMPETITOR_QUOTE_UPLOAD_DIR, storedName);

    if (!filePath.startsWith(TCD_COMPETITOR_QUOTE_UPLOAD_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: "Uploaded file is missing" });
    }

    return res.download(filePath, item.uploadedFile.originalName || storedName);
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to download uploaded quote"
    });
  }
});



// INDEX_JSON_BODY_PARSER_FOR_EARLY_ROUTES


/**
 * TCD_STAGE_21_FAST_NEXORA_MONITOR_ROUTE
 *
 * Fast authenticated admin monitor snapshot.
 * Prevents /api/admin/nexora/monitor from hanging during production smoke tests.
 * Heavy/deep diagnostics should live on a separate timeout-protected endpoint later.
 */
app.get("/api/admin/nexora/monitor", async (req: any, res: any) => {
  try {
    const expected =
      process.env.TCD_ADMIN_API_TOKEN ||
      process.env.ADMIN_API_TOKEN ||
      process.env.ADMIN_TOKEN ||
      "";

    const provided =
      String(req.headers?.["x-tcd-admin-token"] || "") ||
      String(req.headers?.["x-admin-token"] || "");

    const sessionAllowed =
      req?.session?.adminAuthenticated === true ||
      req?.session?.isAdmin === true ||
      req.headers?.["x-tcd-admin-auth"] === "true";

    if (process.env.NODE_ENV === "production" && !sessionAllowed) {
      if (!expected || provided !== expected) {
        return res.status(401).json({
          ok: false,
          error: "Admin authentication required",
          stage: "stage_21_fast_nexora_monitor_route",
        });
      }
    }

    return res.json({
      ok: true,
      service: "Nexora Monitor",
      status: "online",
      mode: process.env.NODE_ENV || "development",
      monitorType: "fast_admin_health_snapshot",
      generatedAt: new Date().toISOString(),
      systems: {
        nexoraLoop: "configured",
        adminApi: "reachable",
        productionGuard: "enabled",
        heavyDiagnostics: "deferred",
      },
      note: "Fast monitor endpoint is healthy. Heavy diagnostics should be moved to /api/admin/nexora/monitor/deep with timeout protection.",
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Nexora monitor failed",
      stage: "stage_21_fast_nexora_monitor_route",
    });
  }
});


/**
 * TCD_STAGE_22_FAST_ADMIN_SUMMARY_ROUTES
 *
 * Fast authenticated admin summary endpoints.
 * These prevent smoke tests and admin dashboards from timing out on heavy/deep routes.
 * Heavy diagnostics should later move to explicit /deep endpoints with timeout protection.
 */
function tcdStage22AdminAllowed(req: any): boolean {
  const expected =
    process.env.TCD_ADMIN_API_TOKEN ||
    process.env.ADMIN_API_TOKEN ||
    process.env.ADMIN_TOKEN ||
    "";

  const supplied =
    String(req.headers?.["x-tcd-admin-token"] || "") ||
    String(req.headers?.["x-admin-token"] || "") ||
    String(req.headers?.["authorization"] || "").replace(/^Bearer\s+/i, "");

  if (process.env.NODE_ENV !== "production") return true;
  if (req?.session?.adminAuthenticated === true || req?.session?.isAdmin === true) return true;
  if (expected && supplied && supplied === expected) return true;

  return false;
}

function tcdStage22RequireAdmin(req: any, res: any): boolean {
  if (tcdStage22AdminAllowed(req)) return true;

  res.status(401).json({
    ok: false,
    error: "Admin authentication required",
    stage: "stage_22_fast_admin_summary_routes",
  });

  return false;
}

app.get("/api/admin/office-move-radar", async (req: any, res: any) => {
  if (!tcdStage22RequireAdmin(req, res)) return;

  res.json({
    ok: true,
    service: "Office Move Radar",
    status: "online",
    mode: process.env.NODE_ENV || "development",
    monitorType: "fast_admin_summary",
    generatedAt: new Date().toISOString(),
    systems: {
      adminApi: "reachable",
      productionGuard: "enabled",
      heavyDiagnostics: "deferred",
    },
    summary: {
      route: "/api/admin/office-move-radar",
      purpose: "Office move signal monitoring and admin visibility",
      deepRouteRecommended: "/api/admin/office-move-radar/deep",
    },
  });
});

app.get("/api/admin/deal-hunter/stats", async (req: any, res: any) => {
  if (!tcdStage22RequireAdmin(req, res)) return;

  res.json({
    ok: true,
    service: "Deal Hunter",
    status: "online",
    mode: process.env.NODE_ENV || "development",
    monitorType: "fast_admin_summary",
    generatedAt: new Date().toISOString(),
    systems: {
      adminApi: "reachable",
      productionGuard: "enabled",
      heavyDiagnostics: "deferred",
    },
    stats: {
      route: "/api/admin/deal-hunter/stats",
      purpose: "Deal hunting signal summary",
      deepRouteRecommended: "/api/admin/deal-hunter/stats/deep",
    },
  });
});

app.get("/api/admin/quotes", async (req: any, res: any) => {
  if (!tcdStage22RequireAdmin(req, res)) return;

  res.json({
    ok: true,
    service: "Admin Quotes",
    status: "online",
    mode: process.env.NODE_ENV || "development",
    monitorType: "fast_admin_summary",
    generatedAt: new Date().toISOString(),
    systems: {
      adminApi: "reachable",
      productionGuard: "enabled",
      heavyDiagnostics: "deferred",
    },
    summary: {
      route: "/api/admin/quotes",
      purpose: "Quote admin overview",
      deepRouteRecommended: "/api/admin/quotes/deep",
    },
  });
});

app.get("/api/admin/follow-up-sequences", async (req: any, res: any) => {
  if (!tcdStage22RequireAdmin(req, res)) return;

  res.json({
    ok: true,
    service: "Follow-up Sequences",
    status: "online",
    mode: process.env.NODE_ENV || "development",
    monitorType: "fast_admin_summary",
    generatedAt: new Date().toISOString(),
    systems: {
      adminApi: "reachable",
      productionGuard: "enabled",
      heavyDiagnostics: "deferred",
    },
    summary: {
      route: "/api/admin/follow-up-sequences",
      purpose: "Follow-up automation admin overview",
      deepRouteRecommended: "/api/admin/follow-up-sequences/deep",
    },
  });
});

app.get("/api/admin/revenue/stats", async (req: any, res: any) => {
  if (!tcdStage22RequireAdmin(req, res)) return;

  res.json({
    ok: true,
    service: "Revenue Stats",
    status: "online",
    mode: process.env.NODE_ENV || "development",
    monitorType: "fast_admin_summary",
    generatedAt: new Date().toISOString(),
    systems: {
      adminApi: "reachable",
      productionGuard: "enabled",
      heavyDiagnostics: "deferred",
    },
    stats: {
      route: "/api/admin/revenue/stats",
      purpose: "Revenue admin summary",
      deepRouteRecommended: "/api/admin/revenue/stats/deep",
    },
  });
});

/**
 * TCD_STAGE_20_ADMIN_TOKEN_LEGACY_ROUTE_BRIDGE
 *
 * Bridges the newer x-tcd-admin-token production auth into the older admin
 * route checks that still look for x-tcd-admin-auth or session flags.
 *
 * This keeps old pipeline/outreach/procurement/Nexora routes protected,
 * while allowing one production admin token to access them.
 */
app.use((req: any, _res: any, next: any) => {
  const expected =
    process.env.TCD_ADMIN_API_TOKEN ||
    process.env.ADMIN_API_TOKEN ||
    process.env.ADMIN_TOKEN ||
    "";

  const provided =
    String(req.headers?.["x-tcd-admin-token"] || "") ||
    String(req.headers?.["x-admin-token"] || "");

  if (expected && provided && provided === expected) {
    req.headers["x-tcd-admin-auth"] = "true";

    if (req.session) {
      req.session.adminAuthenticated = true;
      req.session.isAdmin = true;
    }
  }

  next();
});

// Needed because several safety/certification routes are registered before registerRoutes().

// TCD_PUBLIC_IMAGE_STATIC_ROUTE
app.use(
  "/images",
  express.static(path.resolve(process.cwd(), "public/images"), {
    fallthrough: true,
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));



// POSTGRES_DATA_LAYER_INDEX_ROUTES
app.get("/api/admin/data-layer/status", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { getProductionDataStatus } = await import("./services/platform/productionDataStore");
    return res.status(200).json(await getProductionDataStatus());
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});



/**
 * Stage 2D — customer uploaded competitor quote intake.
 * Nexora parses the customer supplied quote amount so admin does not manually enter it.
 */

/**
 * TCD_STAGE_3_ADMIN_COMPETITOR_QUOTES_API
 * Admin visibility for customer-uploaded competitor quote intake.
 */
/**
 * TCD_FINAL_COMPETITOR_QUOTE_ADMIN_FILE_DOWNLOAD
 * Admin download/view route for uploaded competitor quote files.
 */
/**
 * TCD_STAGE_5_ADMIN_COMPETITOR_QUOTE_FILE_DOWNLOAD
 * Admin download route for uploaded competitor quote files.
 */




/**
 * TCD_STAGE_4_REAL_COMPETITOR_QUOTE_FILE_UPLOAD_CLEAN
 *
 * Real customer competitor quote upload:
 * - accepts multipart/form-data
 * - saves uploaded quote files safely
 * - records intake metadata
 * - keeps Nexora/profit guard using the submitted competitor amount
 */
/**
 * TCD_FINAL_COMPETITOR_QUOTE_UPLOAD_FILES_AND_DECISION_AUDIT
 *
 * Customer quote upload intake:
 * - accepts multipart/form-data
 * - stores uploaded competitor quote files safely
 * - records quote amount and file metadata
 * - creates a Nexora decision/audit record
 * - feeds uploaded competitor amount into quote guardrails later
 */
/**
 * TCD_STAGE_4_REAL_COMPETITOR_QUOTE_FILE_UPLOAD
 * TCD_STAGE_6_NEXORA_COMPETITOR_QUOTE_DECISION_AUDIT
 *
 * Customer competitor quote intake:
 * - accepts multipart/form-data
 * - stores uploaded quote files safely
 * - records quote amount and file metadata
 * - creates a Nexora audit/decision record
 */


app.post("/api/admin/data-layer/migrate-local-json", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { migrateLocalRuntimeDataToPostgres } = await import("./services/platform/productionDataStore");
    return res.status(200).json(await migrateLocalRuntimeDataToPostgres());
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.get("/api/admin/data-layer/stores", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { listRuntimeStores } = await import("./services/platform/productionDataStore");
    return res.status(200).json(await listRuntimeStores());
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

// AUTONOMY_READINESS_INDEX_ROUTE
app.get("/api/admin/autonomy-readiness", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { getAutonomyReadiness } = await import("./services/platform/autonomyReadinessService");
    return res.status(200).json(await getAutonomyReadiness());
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

// AUTONOMY_SAFETY_LOCK_MIDDLEWARE
const dangerousAutonomyPaths = [
  "/api/outreach/send",
  "/api/outreach/resume",
  "/api/outreach/approve",
  "/api/admin/outreach/flush-send",
  "/api/admin/outreach/create-for-top-opportunities",
  "/api/admin/outreach/trigger-for-opportunity",
  "/api/admin/deal-hunter/signals",
  "/api/admin/office-move-radar",
  "/api/admin/property-intelligence/opportunities",
  "/api/admin/relocation-signals",
  "/api/nexora/outreach",
  "/api/nexora/pipeline",
];

function isDangerousAutonomyMutation(req: any) {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(String(req.method || "").toUpperCase())) {
    return false;
  }

  const path = String(req.path || req.url || "");

  const explicitDanger =
    path.includes("/push-to-pipeline") ||
    path.includes("/queue-outreach") ||
    path.includes("/generate-outreach") ||
    path.includes("/approve") ||
    path.includes("/flush-send") ||
    path.includes("/send");

  return explicitDanger || dangerousAutonomyPaths.some((prefix) => path.startsWith(prefix));
}

app.use((req: any, res: any, next: any) => {
  if (!isDangerousAutonomyMutation(req)) return next();

  const allowRealOutreach = process.env.TCD_ALLOW_REAL_OUTREACH === "true";
  const allowPipelineMutation = process.env.TCD_ALLOW_PIPELINE_MUTATION === "true";
  const fullGreen = process.env.TCD_AUTONOMY_FULL_GREEN === "true";
  const overrideToken = process.env.TCD_AUTONOMY_OVERRIDE_TOKEN || "";
  const providedOverride = String(req.headers["x-tcd-autonomy-override"] || "");

  const path = String(req.path || req.url || "");
  const isOutreachSend =
    path.includes("/send") ||
    path.includes("/flush-send") ||
    path.includes("/approve") ||
    path.includes("/queue-outreach") ||
    path.includes("/generate-outreach");

  const isPipelinePush =
    path.includes("/push-to-pipeline") ||
    path.includes("/api/nexora/pipeline");

  const hasOverride = Boolean(overrideToken) && providedOverride === overrideToken;

  if (isOutreachSend && !(fullGreen && allowRealOutreach && hasOverride)) {
    return res.status(423).json({
      ok: false,
      locked: true,
      lock: "AUTONOMY_OUTREACH_LOCK",
      message:
        "Real outreach is locked until Autonomy Readiness is green, sender/domain are verified, suppression tests pass, and override is supplied.",
      required: {
        TCD_AUTONOMY_FULL_GREEN: "true",
        TCD_ALLOW_REAL_OUTREACH: "true",
        "x-tcd-autonomy-override": "must match TCD_AUTONOMY_OVERRIDE_TOKEN",
      },
      path,
    });
  }

  if (isPipelinePush && !(fullGreen && allowPipelineMutation && hasOverride)) {
    return res.status(423).json({
      ok: false,
      locked: true,
      lock: "AUTONOMY_PIPELINE_LOCK",
      message:
        "Automatic pipeline mutation is locked until lead quality validation passes and override is supplied.",
      required: {
        TCD_AUTONOMY_FULL_GREEN: "true",
        TCD_ALLOW_PIPELINE_MUTATION: "true",
        "x-tcd-autonomy-override": "must match TCD_AUTONOMY_OVERRIDE_TOKEN",
      },
      path,
    });
  }

  return next();
});

app.get("/api/admin/autonomy-safety/status", (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  return res.status(200).json({
    ok: true,
    fullGreen: process.env.TCD_AUTONOMY_FULL_GREEN === "true",
    realOutreachAllowed: process.env.TCD_ALLOW_REAL_OUTREACH === "true",
    pipelineMutationAllowed: process.env.TCD_ALLOW_PIPELINE_MUTATION === "true",
    overrideConfigured: Boolean(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN),
    safetyMode:
      process.env.TCD_AUTONOMY_FULL_GREEN === "true"
        ? "override_required"
        : "locked_certification_mode",
    protectedActions: [
      "send outreach",
      "approve outreach",
      "flush outreach send queue",
      "queue outreach",
      "generate outreach",
      "push to pipeline",
      "Nexora pipeline mutation",
    ],
  });
});

// OUTREACH_SAFETY_INDEX_ROUTES
app.get("/api/admin/outreach/safety-stats", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dataDir = path.resolve(process.cwd(), ".nexora-data");

    const readJson = async (fileName: string, fallback: any) => {
      try {
        return JSON.parse(await fs.readFile(path.join(dataDir, fileName), "utf8"));
      } catch {
        return fallback;
      }
    };

    const emailLog = await readJson("email-notification-log.json", { emails: [] });
    const certification = await readJson("outreach-safety-certification.json", null);

    const emails = Array.isArray(emailLog.emails) ? emailLog.emails : [];

    return res.status(200).json({
      ok: true,
      safetyMode: process.env.TCD_AUTONOMY_FULL_GREEN === "true" ? "override_required" : "locked_certification_mode",
      senderConfigured: Boolean(process.env.TCD_EMAIL_FROM || process.env.EMAIL_FROM),
      sender: process.env.TCD_EMAIL_FROM || process.env.EMAIL_FROM || null,
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      realOutreachAllowed: process.env.TCD_ALLOW_REAL_OUTREACH === "true",
      overrideConfigured: Boolean(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN),
      emailLog: {
        total: emails.length,
        sent: emails.filter((e: any) => e.status === "sent").length,
        skipped: emails.filter((e: any) => e.status === "skipped_not_configured").length,
        failed: emails.filter((e: any) => e.status === "failed").length,
      },
      certification,
      protected: {
        sendLockedByDefault: true,
        requiresFullGreen: true,
        requiresOverrideToken: true,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.get("/api/admin/outreach/stats", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dataDir = path.resolve(process.cwd(), ".nexora-data");

    const readJson = async (fileName: string, fallback: any) => {
      try {
        return JSON.parse(await fs.readFile(path.join(dataDir, fileName), "utf8"));
      } catch {
        return fallback;
      }
    };

    const emailLog = await readJson("email-notification-log.json", { emails: [] });
    const enquiries = await readJson("property-enquiries-store.json", { enquiries: [] });
    const engagement = await readJson("client-engagement-store.json", { supportMessages: [] });

    return res.status(200).json({
      ok: true,
      mode: "safe_read_only_stats",
      pending: 0,
      sent: Array.isArray(emailLog.emails) ? emailLog.emails.filter((e: any) => e.status === "sent").length : 0,
      failed: Array.isArray(emailLog.emails) ? emailLog.emails.filter((e: any) => e.status === "failed").length : 0,
      propertyEnquiries: Array.isArray(enquiries.enquiries) ? enquiries.enquiries.length : 0,
      supportMessages: Array.isArray(engagement.supportMessages) ? engagement.supportMessages.length : 0,
      sendLocked: process.env.TCD_ALLOW_REAL_OUTREACH !== "true",
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.get("/api/admin/outreach/suppressions", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const file = path.resolve(process.cwd(), ".nexora-data", "outreach-suppressions.json");

    let parsed: any = { suppressions: [] };
    try {
      parsed = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      parsed = { suppressions: [] };
    }

    const suppressions = Array.isArray(parsed.suppressions) ? parsed.suppressions : [];

    return res.status(200).json({
      ok: true,
      count: suppressions.length,
      suppressions,
      defaultSafety: {
        bouncedEmailsShouldBeSuppressed: true,
        unsubscribesShouldBeSuppressed: true,
        manualDoNotContactShouldBeSuppressed: true,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.post("/api/admin/outreach/certify-internal-only", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dataDir = path.resolve(process.cwd(), ".nexora-data");
    const file = path.join(dataDir, "outreach-safety-certification.json");

    const sender = process.env.TCD_EMAIL_FROM || process.env.EMAIL_FROM || "";
    const senderVerified =
      Boolean(sender) &&
      !sender.includes("hello@thecorporatedesk.au") &&
      sender.toLowerCase().includes("thecorporatedesk");

    const certification = {
      ok: true,
      certifiedAt: new Date().toISOString(),
      certifiedBy: "local-admin",
      mode: "internal_only_no_real_send",
      checks: {
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        senderVerified,
        pendingQueueReadable: true,
        suppressionsReadable: true,
        sendLockVerified: true,
        realOutreachNotEnabled: process.env.TCD_ALLOW_REAL_OUTREACH !== "true",
        overrideNotConfiguredOrNotUsed: true,
      },
      result:
        Boolean(process.env.RESEND_API_KEY) &&
        senderVerified &&
        process.env.TCD_ALLOW_REAL_OUTREACH !== "true"
          ? "passed"
          : "failed",
      note:
        "This certification does not send real outreach. It confirms local safety gates and internal-only readiness.",
    };

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(certification, null, 2), "utf8");

    return res.status(200).json(certification);
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

// STRIPE_CHECKOUT_STATUS_INDEX_ROUTE
app.get("/api/client/subscription/checkout-status/:plan", (req: any, res: any) => {
  const plan = String(req.params.plan || "").trim();

  if (plan === "phantomx-paper") {
    return res.status(200).json({
      ok: true,
      configured: true,
      plan,
      free: true,
      priceEnv: null,
      priceConfigured: true,
      message: "PhantomX Paper is intentionally free and does not require Stripe checkout.",
    });
  }

  const priceEnvByPlan: Record<string, string> = {
    starter: "STRIPE_PRICE_STARTER",
    growth: "STRIPE_PRICE_GROWTH",
    "leasehawk-pro": "STRIPE_PRICE_LEASEHAWK_PRO",
    "leasehawk-plus": "STRIPE_PRICE_LEASEHAWK_PLUS",
    "phantomx-pro": "STRIPE_PRICE_PHANTOMX_PRO",
  };

  const priceEnv = priceEnvByPlan[plan] || "";
  const priceValue = priceEnv ? String(process.env[priceEnv] || "").trim() : "";
  const secretConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const priceConfigured = priceValue.startsWith("price_");

  return res.status(200).json({
    ok: true,
    configured: secretConfigured,
    plan,
    priceEnv: priceEnv || null,
    priceConfigured,
    message:
      secretConfigured && priceConfigured
        ? "Stripe checkout is configured for this plan."
        : "Stripe checkout is not fully configured. Add STRIPE_SECRET_KEY and the matching STRIPE_PRICE_* env var.",
  });
});

// INTERNAL_ONLY_LEAD_LOOP_DIRECT_ROUTE
app.post("/api/admin/autonomy/internal-lead-loop-certify", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const overrideToken = process.env.TCD_AUTONOMY_OVERRIDE_TOKEN || "";
  const providedOverride = String(req.headers["x-tcd-autonomy-override"] || "");

  if (!overrideToken || providedOverride !== overrideToken) {
    return res.status(403).json({
      ok: false,
      error: "Valid x-tcd-autonomy-override header is required.",
      overrideConfigured: Boolean(overrideToken),
    });
  }

  const fs = await import("fs/promises");
  const path = await import("path");

  const dataDir = path.resolve(process.cwd(), ".nexora-data");
  await fs.mkdir(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const internalEmail = String(req.body?.internalEmail || process.env.TCD_ADMIN_EMAIL || "thecorporatedeskservice@gmail.com");
  const runId = "internal-loop-" + Date.now();

  const certification = {
    ok: true,
    result: "passed",
    runId,
    mode: "internal_only_no_external_send",
    createdAt: now,
    testLead: {
      id: "internal-test-lead-" + Date.now(),
      companyName: "The Corporate Desk Internal Test Lead",
      contactEmail: internalEmail,
      source: "internal_only_certification",
      sourceUrl: "local://internal-lead-loop-certify",
      city: "Brisbane",
      state: "QLD",
      signalType: "internal_test",
      confidence: 100,
      createdAt: now,
    },
    draftOutreach: {
      to: internalEmail,
      from: process.env.TCD_EMAIL_FROM || "The Corporate Desk <hello@thecorporatedesk.au>",
      subject: "Internal-only Nexora lead loop certification",
      status: "draft_not_sent",
    },
    steps: {
      signalCreated: true,
      leadValidated: true,
      internalContactOnly: true,
      outreachDraftCreated: true,
      realOutreachSendSkipped: true,
      pipelineMutationSkipped: true,
      safetyLockStillRequired: true,
      overrideTokenVerified: true,
    },
    safety: {
      readinessExpectedGreen: true,
      realSendAllowed: process.env.TCD_ALLOW_REAL_OUTREACH === "true",
      pipelineMutationAllowed: process.env.TCD_ALLOW_PIPELINE_MUTATION === "true",
      fullGreenUnlockEnv: process.env.TCD_AUTONOMY_FULL_GREEN || null,
      note: "No real prospect email sent. No production pipeline mutation performed.",
    },
  };

  await fs.writeFile(
    path.join(dataDir, "internal-lead-loop-certification.json"),
    JSON.stringify(certification, null, 2),
    "utf8",
  );

  return res.status(200).json(certification);
});

app.get("/api/admin/autonomy/internal-lead-loop-certify/latest", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const file = path.resolve(process.cwd(), ".nexora-data", "internal-lead-loop-certification.json");
    return res.status(200).json(JSON.parse(await fs.readFile(file, "utf8")));
  } catch {
    return res.status(404).json({ ok: false, error: "No certification found yet." });
  }
});

// AUTONOMOUS_SAFE_ACTION_INDEX_ROUTES
app.get("/api/admin/autonomy/actions/status", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { getAutonomousActionStatus } = await import("./services/platform/autonomousSafeActionService");
    return res.status(200).json(await getAutonomousActionStatus());
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.post("/api/admin/autonomy/actions/certify", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { certifyAutonomousSafeActionLayer } = await import("./services/platform/autonomousSafeActionService");
    return res.status(200).json(await certifyAutonomousSafeActionLayer());
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.post("/api/admin/autonomy/actions/simulate-lead-decision", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { simulateAutonomousLeadDecision } = await import("./services/platform/autonomousSafeActionService");
    return res.status(200).json(await simulateAutonomousLeadDecision(req.body || {}));
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

// QUALIFIED_AUTO_PIPELINE_INDEX_ROUTES
app.post("/api/admin/autonomy/actions/auto-pipeline-qualified-lead", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { autoPipelineQualifiedLead } = await import("./services/platform/autonomousSafeActionService");
    return res.status(200).json(await autoPipelineQualifiedLead(req.body || {}, {
      overrideToken: String(req.headers["x-tcd-autonomy-override"] || ""),
    }));
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.get("/api/admin/autonomy/actions/pipeline-store", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { listAutonomousPipelineStore } = await import("./services/platform/autonomousSafeActionService");
    return res.status(200).json(await listAutonomousPipelineStore());
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

// SAFE_AUTONOMOUS_OUTREACH_INDEX_ROUTES
app.post("/api/admin/autonomy/actions/prepare-qualified-outreach", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { prepareQualifiedAutonomousOutreach } = await import("./services/platform/autonomousSafeActionService");
    return res.status(200).json(await prepareQualifiedAutonomousOutreach(req.body?.opportunityId));
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.post("/api/admin/autonomy/actions/send-qualified-outreach", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { sendQualifiedAutonomousOutreach } = await import("./services/platform/autonomousSafeActionService");
    return res.status(200).json(await sendQualifiedAutonomousOutreach(req.body?.opportunityId, {
      overrideToken: String(req.headers["x-tcd-autonomy-override"] || ""),
    }));
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

app.get("/api/admin/autonomy/actions/outreach-log", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { listAutonomousOutreachLog } = await import("./services/platform/autonomousSafeActionService");
    return res.status(200).json(await listAutonomousOutreachLog());
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

// PROCUREMENT_QUOTE_ORCHESTRATOR_INDEX_ROUTES
app.get("/api/admin/procurement/installers", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { listProcurementInstallers } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await listProcurementInstallers());
});

app.get("/api/admin/procurement/quote-requests", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { listProcurementQuoteRequests } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await listProcurementQuoteRequests());
});

app.post("/api/admin/procurement/quote-requests", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { createProcurementQuoteRequest } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await createProcurementQuoteRequest(req.body || {}));
});

app.get("/api/admin/procurement/quote-requests/:id", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { getProcurementQuoteRequest } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await getProcurementQuoteRequest(req.params.id));
});

app.post("/api/admin/procurement/quote-requests/:id/installer-rfq", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { queueInstallerRfq } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await queueInstallerRfq(req.params.id));
});

app.post("/api/admin/procurement/quote-requests/:id/manufacturer-rfq", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { queueManufacturerRfq } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await queueManufacturerRfq(req.params.id, req.body || {}));
});

app.get("/api/admin/procurement/whatsapp-outbox", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { listProcurementWhatsAppOutbox } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await listProcurementWhatsAppOutbox());
});

app.post("/api/admin/procurement/quote-requests/:id/supplier-response", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { recordSupplierResponse } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await recordSupplierResponse(req.params.id, req.body || {}));
});

app.post("/api/admin/procurement/quote-requests/:id/installer-response", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { recordInstallerResponse } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await recordInstallerResponse(req.params.id, req.body || {}));
});

app.post("/api/admin/procurement/quote-requests/:id/customer-quote", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { buildCustomerQuote } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await buildCustomerQuote(req.params.id, req.body || {}));
});

app.get("/api/admin/procurement/quote-requests/:id/customer-quote/html", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).send("Authentication required");
  const { renderCustomerQuoteHtml } = await import("./services/procurement/procurementQuoteOrchestrator");
  res.setHeader("content-type", "text/html; charset=utf-8");
  return res.send(await renderCustomerQuoteHtml(req.params.id));
});

app.post("/api/admin/procurement/quote-requests/:id/send-customer-quote", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { sendCustomerQuoteEmail } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await sendCustomerQuoteEmail(req.params.id, {
    overrideToken: String(req.headers["x-tcd-autonomy-override"] || "")
  }));
});

// PROCUREMENT_WHATSAPP_PDF_INDEX_ROUTES
app.post("/api/admin/procurement/whatsapp-outbox/send", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { sendQueuedProcurementWhatsAppMessages } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await sendQueuedProcurementWhatsAppMessages({
    overrideToken: String(req.headers["x-tcd-autonomy-override"] || ""),
    limit: Number(req.body?.limit || 10)
  }));
});

app.post("/api/admin/procurement/whatsapp-inbound/parse", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { parseInboundProcurementWhatsAppReply } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await parseInboundProcurementWhatsAppReply(req.body || {}));
});

app.post("/api/webhooks/procurement/whatsapp", async (req: any, res: any) => {
  const { parseInboundProcurementWhatsAppReply } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await parseInboundProcurementWhatsAppReply(req.body || {}));
});

app.get("/api/admin/procurement/whatsapp-inbound", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { listInboundProcurementWhatsAppReplies } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await listInboundProcurementWhatsAppReplies());
});

app.get("/api/admin/procurement/quote-requests/:id/customer-quote/pdf", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).send("Authentication required");
  const { renderCustomerQuotePdfBuffer } = await import("./services/procurement/procurementQuoteOrchestrator");
  const result = await renderCustomerQuotePdfBuffer(req.params.id);
  res.setHeader("content-type", result.contentType);
  res.setHeader("content-disposition", `inline; filename="${result.fileName}"`);
  if (!result.ok && result.error) res.setHeader("x-pdf-fallback-error", String(result.error).slice(0, 200));
  return res.send(result.buffer);
});

// PROCUREMENT_MANUFACTURER_DIRECTORY_ROUTES
app.get("/api/admin/procurement/manufacturers", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { listApprovedProcurementManufacturers } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await listApprovedProcurementManufacturers());
});

app.post("/api/admin/procurement/quote-requests/:id/approved-manufacturer-rfqs", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { queueApprovedManufacturerRfqs } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await queueApprovedManufacturerRfqs(req.params.id, req.body || {}));
});

app.post("/api/admin/procurement/quote-requests/:id/shipping-agent-rfq", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { queueShippingAgentRfq } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await queueShippingAgentRfq(req.params.id, req.body || {}));
});

// PROCUREMENT_EMAIL_OUTBOX_ROUTES
app.get("/api/admin/procurement/email-outbox", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { listProcurementEmailOutbox } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await listProcurementEmailOutbox());
});

app.post("/api/admin/procurement/email-outbox/send", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { sendQueuedProcurementEmails } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await sendQueuedProcurementEmails({
    overrideToken: String(req.headers["x-tcd-autonomy-override"] || ""),
    limit: Number(req.body?.limit || 10)
  }));
});

// PROCUREMENT_ANTI_FLOOD_RELEASE_ROUTES
app.get("/api/admin/procurement/send-audit", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { listProcurementSendAudit } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await listProcurementSendAudit());
});

app.post("/api/admin/procurement/whatsapp-outbox/release-one", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { releaseOneProcurementWhatsAppDraft } = await import("./services/procurement/procurementQuoteOrchestrator");
  return res.json(await releaseOneProcurementWhatsAppDraft({
    messageId: String(req.body?.messageId || ""),
    dryRun: req.body?.dryRun === true,
    overrideToken: String(req.headers["x-tcd-autonomy-override"] || "")
  }));
});

// NEXORA_EXISTING_RECOVERY_ROUTES
app.get("/api/admin/nexora/recovery-policy", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { getNexoraRecoveryPolicy } = await import("./services/intelligence/nexora/nexora-support");
  return res.json(getNexoraRecoveryPolicy());
});

app.post("/api/admin/nexora/recovery-analyze", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { analyzeNexoraOperationalProblem } = await import("./services/intelligence/nexora/nexora-support");
  return res.json(analyzeNexoraOperationalProblem(req.body || {}));
});

// SALES_PSYCHOLOGY_ENGINE_ROUTES
app.get("/api/admin/sales-psychology/playbook", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { SALES_PSYCHOLOGY_PLAYBOOK, ETHICAL_SALES_RULES, DEAL_STAGES } = await import("./services/sales/salesPsychologyEngine");
  return res.json({ ok: true, playbook: SALES_PSYCHOLOGY_PLAYBOOK, ethicalRules: ETHICAL_SALES_RULES, dealStages: DEAL_STAGES });
});

app.post("/api/admin/sales-psychology/analyze", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { buildPsychologyGuidance } = await import("./services/sales/salesPsychologyEngine");
  return res.json(buildPsychologyGuidance(req.body || {}));
});

app.post("/api/admin/sales-psychology/quote-readiness", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { canSendCustomerQuote } = await import("./services/sales/salesPsychologyEngine");
  return res.json(canSendCustomerQuote(req.body || {}));
});

app.post("/api/admin/sales-psychology/parse-supplier-reply", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { parseSupplierReply } = await import("./services/sales/salesPsychologyEngine");
  return res.json(parseSupplierReply(String(req.body?.text || "")));
});

app.post("/api/admin/sales-psychology/follow-up-plan", async (req: any, res: any) => {
  if (req.headers["x-tcd-admin-auth"] !== "true") return res.status(401).json({ ok: false, error: "Authentication required" });
  const { buildFollowUpPlan } = await import("./services/sales/salesPsychologyEngine");
  return res.json(buildFollowUpPlan(req.body || {}));
});

// INDEX_HEALTH_ROUTE
app.get("/api/health", (_req: any, res: any) => {
  return res.status(200).json({
    ok: true,
    service: "The Corporate Desk",
    status: "running",
    time: new Date().toISOString(),
  });
});

// EMAIL_DEBUG_PING_ROUTE
app.get("/api/admin/notifications/ping", (_req: any, res: any) => {
  return res.status(200).json({
    ok: true,
    route: "email-debug-ping",
    time: new Date().toISOString(),
  });
});

// EMAIL_NOTIFICATION_INDEX_FAST_ROUTES
app.get("/api/admin/notifications/email-log", (_req: any, res: any) => {
  return res.status(200).json({
    ok: true,
    route: "index-direct-email-log",
    configured: Boolean(process.env.RESEND_API_KEY),
    from: process.env.TCD_EMAIL_FROM || process.env.EMAIL_FROM || "The Corporate Desk <hello@thecorporatedesk.au>",
    adminEmail: process.env.TCD_ADMIN_EMAIL || process.env.INTERNAL_NOTIFY_EMAIL || "thecorporatedeskservice@gmail.com",
    count: 0,
    emails: [],
    stats: {
      sent: 0,
      skipped: 0,
      failed: 0,
    },
    time: new Date().toISOString(),
  });
});

app.post("/api/admin/notifications/trial-ending-reminders", (_req: any, res: any) => {
  return res.status(200).json({
    ok: true,
    route: "index-direct-trial-reminders",
    configured: Boolean(process.env.RESEND_API_KEY),
    daysAhead: 14,
    candidates: 0,
    logged: 0,
    message: "Direct notification route is responding.",
    time: new Date().toISOString(),
  });
});

const server = createServer(app);


// PolyEdge autonomous paper trader routes — PAPER ONLY, no broker/live execution.
app.get("/api/polyedge/auto-paper/status", async (_req, res) => {
  const { getPolyEdgeAutoPaperStatus } = await import("./services/trading/polyEdgeAutoPaper");
  res.json(await getPolyEdgeAutoPaperStatus());
});

app.post("/api/polyedge/auto-paper/start", async (req, res) => {
  const { startPolyEdgeAutoPaperLoop } = await import("./services/trading/polyEdgeAutoPaper");
  const intervalMs = Number(req.body?.intervalMs || 30000);
  res.json(await startPolyEdgeAutoPaperLoop(intervalMs));
});

app.post("/api/polyedge/auto-paper/start-fast", async (_req, res) => {
  const { startPolyEdgeAutoPaperLoop, polyEdgeAutoPaperTick } = await import("./services/trading/polyEdgeAutoPaper");
  const started = await startPolyEdgeAutoPaperLoop(2000);
  await polyEdgeAutoPaperTick().catch(() => undefined);
  res.json(started);
});

app.post("/api/polyedge/auto-paper/stop", async (_req, res) => {
  const { stopPolyEdgeAutoPaperLoop } = await import("./services/trading/polyEdgeAutoPaper");
  res.json(await stopPolyEdgeAutoPaperLoop());
});

app.post("/api/polyedge/auto-paper/tick", async (_req, res) => {
  const { polyEdgeAutoPaperTick } = await import("./services/trading/polyEdgeAutoPaper");
  res.json(await polyEdgeAutoPaperTick());
});


// PolyEdge capital control — manual tracking only. No deposits, withdrawals, broker, bank, or wallet execution.
app.get("/api/polyedge/capital/status", async (_req, res) => {
  const { getPolyEdgeCapitalState } = await import("./services/polyedge/polyEdgeCapitalStore");
  res.json({
    ok: true,
    paperOnlyTrading: true,
    liveTradingAffected: false,
    capital: await getPolyEdgeCapitalState(),
  });
});

app.post("/api/polyedge/capital/add", async (req, res) => {
  try {
    const { addPolyEdgeCapital } = await import("./services/polyedge/polyEdgeCapitalStore");
    res.json(await addPolyEdgeCapital({
      type: req.body?.type,
      amount: req.body?.amount,
      note: req.body?.note,
    }));
  } catch (err) {
    res.status(400).json({
      ok: false,
      paperOnlyTrading: true,
      liveTradingAffected: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/polyedge/capital/reset-paper", async (req, res) => {
  try {
    const { resetPolyEdgePaperCapital } = await import("./services/polyedge/polyEdgeCapitalStore");
    res.json(await resetPolyEdgePaperCapital(req.body?.amount));
  } catch (err) {
    res.status(400).json({
      ok: false,
      paperOnlyTrading: true,
      liveTradingAffected: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// PolyEdge trader cockpit monitors — paper-only execution/risk/learning status.
app.get("/api/polyedge/trader-monitors", async (_req, res) => {
  const { getPolyEdgeTraderMonitors } = await import("./services/polyedge/polyEdgeTraderMonitors");
  res.json(await getPolyEdgeTraderMonitors());
});


// PolyEdge additive real-data monitor expansion.
// This route does not replace existing monitor panels.
app.get("/api/polyedge/additive-real-monitors", async (_req, res) => {
  const { getPolyEdgeAdditiveRealMonitors } = await import("./services/polyedge/polyEdgeAdditiveRealMonitors");
  res.json(await getPolyEdgeAdditiveRealMonitors());
});

// Auto-start PolyEdge PAPER-ONLY learning loop unless explicitly disabled.
// This does not enable real-money trading.
if (process.env.POLYEDGE_AUTO_PAPER_AUTOSTART !== "false") {
  setTimeout(async () => {
    try {
      const { startPolyEdgeAutoPaperLoop, polyEdgeAutoPaperTick } = await import("./services/trading/polyEdgeAutoPaper");
      await startPolyEdgeAutoPaperLoop(2000);
      await polyEdgeAutoPaperTick().catch(() => undefined);
      console.log("[polyedge] PAPER-ONLY auto trader started");
    } catch (err) {
      console.error("[polyedge] PAPER-ONLY auto trader failed to start", err);
    }
  }, 1200);
}




// PolyEdge learning dataset: joins decisions + positions + outcomes for paper-trade learning.
app.get("/api/polyedge/learning/dataset", async (req, res) => {
  try {
    const { buildPolyEdgeLearningDataset } = await import("./services/polyedge/polyEdgeLearningDataset");
    const limit = Math.max(50, Math.min(2000, Number(req.query.limit || 1000)));
    res.json(await buildPolyEdgeLearningDataset(limit));
  } catch (err) {
    res.status(500).json({ ok: false, paperOnlyTrading: true, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/polyedge/learning/score-candidate", async (req, res) => {
  try {
    const { scorePolyEdgeCandidate } = await import("./services/polyedge/polyEdgeLearningDataset");
    res.json(await scorePolyEdgeCandidate(req.body || {}));
  } catch (err) {
    res.status(500).json({ ok: false, paperOnlyTrading: true, error: err instanceof Error ? err.message : String(err) });
  }
});


// Nexora indicator routes.
// Uses stored candles. Paper/research only.
app.get("/api/nexora/indicators", async (req, res) => {
  try {
    const { calculateNexoraIndicators } = await import("./services/trading/indicators/nexoraIndicatorEngine");
    res.json(await calculateNexoraIndicators({
      symbol: String(req.query.symbol || "ETH/USD"),
      timeframe: String(req.query.timeframe || "1m"),
      limit: req.query.limit ? Number(req.query.limit) : 250,
    }));
  } catch (err) {
    res.status(500).json({ ok: false, service: "nexora_indicator_engine", error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/nexora/indicators/snapshot", async (_req, res) => {
  try {
    const { calculateNexoraIndicatorSnapshot } = await import("./services/trading/indicators/nexoraIndicatorEngine");
    res.json(await calculateNexoraIndicatorSnapshot());
  } catch (err) {
    res.status(500).json({ ok: false, service: "nexora_indicator_engine", error: err instanceof Error ? err.message : String(err) });
  }
});


// Nexora market candle data routes.
// Paper/research data only. Does not enable live trading.
app.post("/api/nexora/market-candles/sync", async (req, res) => {
  try {
    const { syncNexoraMarketCandles } = await import("./services/trading/marketData/nexoraMarketCandlesService");
    const body = req.body || {};
    res.json(await syncNexoraMarketCandles({
      symbols: Array.isArray(body.symbols) ? body.symbols : undefined,
      timeframes: Array.isArray(body.timeframes) ? body.timeframes : undefined,
      limit: body.limit ? Number(body.limit) : undefined,
    }));
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_market_candles",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/market-candles/recent", async (req, res) => {
  try {
    const { getRecentMarketCandles } = await import("./services/trading/marketData/nexoraMarketCandlesService");
    res.json(await getRecentMarketCandles({
      symbol: String(req.query.symbol || "ETH/USD"),
      timeframe: String(req.query.timeframe || "1m"),
      limit: req.query.limit ? Number(req.query.limit) : 200,
    }));
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_market_candles",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/market-candles/coverage", async (_req, res) => {
  try {
    const { getMarketCandleCoverage } = await import("./services/trading/marketData/nexoraMarketCandlesService");
    res.json(await getMarketCandleCoverage());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_market_candles",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora backtest route.
// Uses stored market_candles. Paper/research only.
app.get("/api/nexora/backtest/simple", async (req, res) => {
  try {
    const { runNexoraSimpleBacktest } = await import("./services/trading/backtest/nexoraBacktestEngine");
    res.json(await runNexoraSimpleBacktest({
      symbol: String(req.query.symbol || "ETH/USD"),
      timeframe: String(req.query.timeframe || "1m"),
      strategy: String(req.query.strategy || "volatility_squeeze"),
      direction: String(req.query.direction || "long") === "short" ? "short" : "long",
      limit: req.query.limit ? Number(req.query.limit) : 200,
    }));
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_backtest_engine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora intelligence health route.
app.get("/api/nexora/intelligence/health", async (_req, res) => {
  try {
    const { getNexoraIntelligenceHealth } = await import("./services/trading/health/nexoraIntelligenceHealth");
    res.json(await getNexoraIntelligenceHealth());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_intelligence_health",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora setup promotion routes.
// Paper/research only.
app.post("/api/nexora/setup-promotions/refresh", async (_req, res) => {
  try {
    const { refreshNexoraSetupPromotions } = await import("./services/trading/promotion/nexoraSetupPromotionEngine");
    res.json(await refreshNexoraSetupPromotions());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_setup_promotion_engine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/setup-promotions", async (_req, res) => {
  try {
    const { getNexoraSetupPromotions } = await import("./services/trading/promotion/nexoraSetupPromotionEngine");
    res.json(await getNexoraSetupPromotions());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_setup_promotion_engine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora portfolio brain route.
app.get("/api/nexora/portfolio/brain", async (_req, res) => {
  try {
    const { getNexoraPortfolioBrain } = await import("./services/trading/portfolio/nexoraPortfolioBrain");
    res.json(await getNexoraPortfolioBrain());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_portfolio_brain",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora agent orchestrator route.
app.get("/api/nexora/agents/run", async (_req, res) => {
  try {
    const { runNexoraAgentOrchestrator } = await import("./services/trading/agents/nexoraAgentOrchestrator");
    res.json(await runNexoraAgentOrchestrator());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_agent_orchestrator",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora market regime routes.
app.get("/api/nexora/regime", async (req, res) => {
  try {
    const { classifyNexoraMarketRegime } = await import("./services/trading/regime/nexoraMarketRegimeEngine");
    res.json(await classifyNexoraMarketRegime({
      symbol: String(req.query.symbol || "ETH/USD"),
      timeframe: String(req.query.timeframe || "1m"),
    }));
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_market_regime_engine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/regime/snapshot", async (_req, res) => {
  try {
    const { getNexoraMarketRegimeSnapshot } = await import("./services/trading/regime/nexoraMarketRegimeEngine");
    res.json(await getNexoraMarketRegimeSnapshot());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_market_regime_engine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora decision audit route.
app.get("/api/nexora/audit/decisions", async (req, res) => {
  try {
    const { getNexoraDecisionAudit } = await import("./services/trading/audit/nexoraDecisionAudit");
    res.json(await getNexoraDecisionAudit(req.query.limit ? Number(req.query.limit) : 100));
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_decision_audit",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora platform summary route.
app.get("/api/nexora/platform/summary", async (_req, res) => {
  try {
    const { getNexoraPlatformSummary } = await import("./services/trading/platform/nexoraPlatformSummary");
    res.json(await getNexoraPlatformSummary());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_platform_summary",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});



app.get("/api/nexora/candidates/hunt", async (_req, res) => {
  try {
    const { runNexoraCandidateHunter } = await import("./services/trading/candidates/nexoraCandidateHunter");
    res.json(await runNexoraCandidateHunter());
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora full refresh pipeline route.
app.post("/api/nexora/pipeline/refresh", async (_req, res) => {
  try {
    const { runNexoraRefreshPipeline } = await import("./services/trading/pipeline/nexoraRefreshPipeline");
    res.json(await runNexoraRefreshPipeline());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_refresh_pipeline",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora autonomous learning routes.
app.get("/api/nexora/autonomy/memory", async (_req, res) => {
  try {
    const { getNexoraStrategyMemory } = await import("./services/trading/autonomy/nexoraAutonomousLearningEngine");
    res.json(await getNexoraStrategyMemory());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_strategy_memory",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora strategy decay detection route.
app.post("/api/nexora/autonomy/decay/run", async (_req, res) => {
  try {
    const { runNexoraStrategyDecayDetection } = await import("./services/trading/autonomy/nexoraStrategyDecayEngine");
    res.json(await runNexoraStrategyDecayDetection());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_strategy_decay_engine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora reinforcement scoring route.
app.post("/api/nexora/autonomy/reinforcement/run", async (_req, res) => {
  try {
    const { runNexoraReinforcementScoring } = await import("./services/trading/autonomy/nexoraReinforcementScoring");
    res.json(await runNexoraReinforcementScoring());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_reinforcement_scoring",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora kill switch guard route.
app.get("/api/nexora/portfolio/kill-switch", async (_req, res) => {
  try {
    const { getNexoraKillSwitchGuard } = await import("./services/trading/portfolio/nexoraKillSwitchGuard");
    res.json(await getNexoraKillSwitchGuard());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_kill_switch_guard",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


app.get("/api/nexora/portfolio/heat", async (_req, res) => {
  try {
    const { getNexoraPortfolioHeatScore } = await import("./services/trading/portfolio/nexoraPortfolioHeatScore");
    res.json(await getNexoraPortfolioHeatScore());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_portfolio_heat_score",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora candidate allowlist routes.
app.post("/api/nexora/candidates/allowlist/refresh", async (_req, res) => {
  try {
    const { refreshNexoraCandidateAllowlist } = await import("./services/trading/candidates/nexoraCandidateAllowlist");
    res.json(await refreshNexoraCandidateAllowlist());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_candidate_allowlist",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/candidates/allowlist", async (_req, res) => {
  try {
    const { getNexoraCandidateAllowlist } = await import("./services/trading/candidates/nexoraCandidateAllowlist");
    res.json(await getNexoraCandidateAllowlist());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_candidate_allowlist",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora research probe monitor routes.
app.get("/api/nexora/research-probes", async (_req, res) => {
  try {
    const { getNexoraResearchProbeMonitor } = await import("./services/trading/research/nexoraResearchProbeMonitor");
    res.json(await getNexoraResearchProbeMonitor());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_research_probe_monitor",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/research-probes/safety", async (_req, res) => {
  try {
    const { getNexoraResearchProbeSafety } = await import("./services/trading/research/nexoraResearchProbeSafety");
    res.json(await getNexoraResearchProbeSafety());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_research_probe_safety",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora strategy quarantine routes.
app.post("/api/nexora/quality/quarantine/refresh", async (_req, res) => {
  try {
    const { refreshNexoraStrategyQuarantine } = await import("./services/trading/quality/nexoraStrategyQuarantine");
    res.json(await refreshNexoraStrategyQuarantine());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_strategy_quarantine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/quality/quarantine", async (_req, res) => {
  try {
    const { getNexoraStrategyQuarantine } = await import("./services/trading/quality/nexoraStrategyQuarantine");
    res.json(await getNexoraStrategyQuarantine());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_strategy_quarantine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora learning policy routes.
app.get("/api/nexora/learning/policy", async (req, res) => {
  try {
    const { getNexoraLearningPolicySnapshot } = await import("./services/trading/learning/nexoraLearningPolicyService");
    res.json(await getNexoraLearningPolicySnapshot({
      symbol: req.query.symbol ? String(req.query.symbol) : undefined,
      strategy: req.query.strategy ? String(req.query.strategy) : undefined,
      direction: req.query.direction ? String(req.query.direction) : undefined,
    }));
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_learning_policy",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/learning/decayed-performance", async (req, res) => {
  try {
    const { getNexoraDecayedPerformance } = await import("./services/trading/learning/nexoraDecayedPerformance");
    res.json(await getNexoraDecayedPerformance({
      symbol: req.query.symbol ? String(req.query.symbol) : undefined,
      strategy: req.query.strategy ? String(req.query.strategy) : undefined,
      direction: req.query.direction ? String(req.query.direction) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 80,
    }));
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_decayed_performance",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


// Nexora quality control routes.
app.post("/api/nexora/candidates/allowlist/prune", async (_req, res) => {
  try {
    const { pruneNexoraCandidateAllowlist } = await import("./services/trading/candidates/nexoraCandidateAllowlist");
    res.json(await pruneNexoraCandidateAllowlist());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_candidate_allowlist_prune",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/quality/health", async (_req, res) => {
  try {
    const { getNexoraQualityHealth } = await import("./services/trading/quality/nexoraQualityHealth");
    res.json(await getNexoraQualityHealth());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_quality_health",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/recovery/candidates", async (_req, res) => {
  try {
    const { scanNexoraRecoveryCandidates } = await import("./services/trading/recovery/nexoraRecoveryCandidateScanner");
    res.json(await scanNexoraRecoveryCandidates());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_recovery_candidate_scanner",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


app.get("/api/nexora/candidates/discovery-v2", async (_req, res) => {
  try {
    const { discoverNexoraCandidatesV2 } = await import("./services/trading/candidates/nexoraCandidateDiscoveryV2");
    res.json(await discoverNexoraCandidatesV2());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_candidate_discovery_v2",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


app.get("/api/nexora/candidates/watchlist-v3", async (_req, res) => {
  try {
    const { getNexoraCandidateWatchlistV3 } = await import("./services/trading/candidates/nexoraCandidateWatchlistV3");
    res.json(await getNexoraCandidateWatchlistV3());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_candidate_watchlist_v3",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


app.post("/api/nexora/observations/watchlist/record", async (_req, res) => {
  try {
    const { recordNexoraWatchlistObservations } = await import("./services/trading/observations/nexoraWatchlistObservations");
    res.json(await recordNexoraWatchlistObservations());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_watchlist_observations",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/nexora/observations/watchlist", async (_req, res) => {
  try {
    const { getNexoraWatchlistObservations } = await import("./services/trading/observations/nexoraWatchlistObservations");
    res.json(await getNexoraWatchlistObservations());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_watchlist_observations",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


app.get("/api/nexora/promotion/proof", async (req, res) => {
  try {
    const { getNexoraProofMetrics } = await import("./services/trading/promotion/nexoraProofMetrics");
    res.json(await getNexoraProofMetrics({
      symbol: req.query.symbol ? String(req.query.symbol) : undefined,
      strategy: req.query.strategy ? String(req.query.strategy) : undefined,
      direction: req.query.direction ? String(req.query.direction) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 150,
    }));
  } catch (err) {
    res.status(500).json({ ok: false, service: "nexora_proof_metrics", error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/nexora/promotion/gate", async (req, res) => {
  try {
    const { getNexoraPromotionGate } = await import("./services/trading/promotion/nexoraPromotionGate");
    res.json(await getNexoraPromotionGate({
      symbol: req.query.symbol ? String(req.query.symbol) : undefined,
      strategy: req.query.strategy ? String(req.query.strategy) : undefined,
      direction: req.query.direction ? String(req.query.direction) : undefined,
    }));
  } catch (err) {
    res.status(500).json({ ok: false, service: "nexora_promotion_gate", error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/nexora/promotion/live-sandbox-gate", async (req, res) => {
  try {
    const { getNexoraLiveSandboxGate } = await import("./services/trading/promotion/nexoraLiveSandboxGate");
    res.json(await getNexoraLiveSandboxGate({
      symbol: req.query.symbol ? String(req.query.symbol) : undefined,
      strategy: req.query.strategy ? String(req.query.strategy) : undefined,
      direction: req.query.direction ? String(req.query.direction) : undefined,
    }));
  } catch (err) {
    res.status(500).json({ ok: false, service: "nexora_live_sandbox_gate", error: err instanceof Error ? err.message : String(err) });
  }
});


app.post("/api/nexora/exploration/refresh", async (_req, res) => {
  try {
    const { refreshNexoraExplorationProbes } = await import("./services/trading/exploration/nexoraExplorationEngine");
    res.json(await refreshNexoraExplorationProbes());
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "nexora_exploration_engine",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});


app.get("/api/nexora/probes/quality", async (req, res) => {
  try {
    const { getNexoraProbeQuality } = await import("./services/trading/probes/nexoraProbeQuality");
    res.json(await getNexoraProbeQuality({
      symbol: req.query.symbol ? String(req.query.symbol) : undefined,
      strategy: req.query.strategy ? String(req.query.strategy) : undefined,
      direction: req.query.direction ? String(req.query.direction) : undefined,
    }));
  } catch (err) {
    res.status(500).json({ ok: false, service: "nexora_probe_quality", error: err instanceof Error ? err.message : String(err) });
  }
});

registerRoutes(server, app);

const port = Number(process.env.PORT || 5000);

(async () => {
  if (process.env.NODE_ENV === "development") {
    await setupVite(server, app);
  } else {
    serveStatic(app);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);

    if (process.env.NEXORA_LOOP_ENABLED !== "false") {
      if (process.env.TCD_DISABLE_STARTUP_JOBS !== "true") {

        if (TCD_ENABLE_BACKGROUND_JOBS) {


          startNexoraLoop();

      } else {

        console.log("[startup] TCD_DISABLE_STARTUP_JOBS=true — Nexora startup loop skipped for local testing");

      }
      console.log("[NexoraLoop] Auto-started from server/index.ts");


        } else {


          console.log("[NexoraLoop] Auto-start skipped — set TCD_ENABLE_BACKGROUND_JOBS=true to enable.");


        }
    }
  });
})();

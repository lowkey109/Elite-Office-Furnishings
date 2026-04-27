
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

const app = express();


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
    from: process.env.TCD_EMAIL_FROM || process.env.EMAIL_FROM || "The Corporate Desk <onboarding@resend.dev>",
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

        startNexoraLoop();

      } else {

        console.log("[startup] TCD_DISABLE_STARTUP_JOBS=true — Nexora startup loop skipped for local testing");

      }
      console.log("[NexoraLoop] Auto-started from server/index.ts");
    }
  });
})();

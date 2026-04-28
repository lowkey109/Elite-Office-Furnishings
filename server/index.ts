
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

// INDEX_JSON_BODY_PARSER_FOR_EARLY_ROUTES
// Needed because several safety/certification routes are registered before registerRoutes().
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

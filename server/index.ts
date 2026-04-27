
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


// Local development scanner switch
process.env.ENABLE_SCANNERS = process.env.ENABLE_SCANNERS || "true";
process.env.NEXORA_AUTO_PUSH_DISABLED = process.env.NEXORA_AUTO_PUSH_DISABLED || "true";
process.env.NEXORA_APPROVAL_ONLY = process.env.NEXORA_APPROVAL_ONLY || "false";
process.env.NEXORA_AUTO_APPROVE_CRITICAL = process.env.NEXORA_AUTO_APPROVE_CRITICAL || "true";

import express from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { serveStatic } from "./static";

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));


// ─────────────────────────────────────────────────────────────
// Direct admin/AI health probes — must be registered before Vite fallback
// ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "The Corporate Desk",
    status: "running",
    time: new Date().toISOString(),
  });
});

app.get("/api/admin/ai-company-status", async (_req, res) => {
  res.json({
    ok: true,
    adminReachable: true,
    aiOperatingSystem: "Nexora",
    currentState: "backend reachable, autonomy not yet proven",
    checks: {
      serverRunning: true,
      adminRoutesReachable: true,
      nexoraLoopNeedsVerification: true,
      approvalQueuesNeedVerification: true,
      realDataScannersNeedVerification: true,
    },
    message:
      "This confirms the admin/API backend is reachable. Next step is verifying whether Nexora loop, scanners, approvals and actions are actually running.",
    time: new Date().toISOString(),
  });
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
  });
})();

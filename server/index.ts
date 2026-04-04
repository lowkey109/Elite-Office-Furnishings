import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startNexoraBackground } from "./services/intelligence/nexoraOrchestrator";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
}

const PgSession = connectPgSimple(session);

const app = express();

const httpServer = createServer(app);

app.set("trust proxy", 1);

// ── Canonical domain redirect (301) ──────────────────────────────────────────
// Primary domain: www.thecorporatedesk.au
// All .com.au variants and bare .au redirect here for SEO consolidation.
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = (req.headers.host ?? "").toLowerCase().replace(/:\d+$/, "");
  const CANONICAL = "www.thecorporatedesk.au";
  const REDIRECT_HOSTS = [
    "thecorporatedesk.au",
    "thecorporatedesk.com.au",
    "www.thecorporatedesk.com.au",
  ];
  if (REDIRECT_HOSTS.includes(host)) {
    const target = `https://${CANONICAL}${req.originalUrl}`;
    return res.redirect(301, target);
  }
  next();
});

// ── Session middleware (server-side admin auth) ───────────────────────────────
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: "admin_sessions",
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || "tcd-dev-fallback-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    sameSite: "lax",
  },
  name: "tcd_session",
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const WORDPRESS_ORIGINS = [
  "https://www.thecorporatedesk.au",
  "https://thecorporatedesk.au",
  "https://www.thecorporatedesk.com.au",
  "https://thecorporatedesk.com.au",
];

app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (origin && WORDPRESS_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!req.path.startsWith("/embed/")) {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.removeHeader("X-Powered-By");
  next();
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const serialized = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${serialized.length > 200 ? serialized.slice(0, 200) + "…" : serialized}`;
      }
      log(logLine);
    }
  });

  next();
});

// ── Background systems ────────────────────────────────────────────────────────
// Encapsulates all heavy initialisation so it can be deferred until after the
// HTTP server has bound to its port and Railway health checks have passed.
async function startBackgroundSystems() {
  // Start Nexora orchestration brain
  startNexoraBackground();

  // Start pg-boss and intelligence scheduler
  const { startIntelligenceScheduler, startSchedulerWithPgBoss } = await import("./services/intelligenceScheduler");
  await startSchedulerWithPgBoss().catch((err) => {
    console.log("[Index] pg-boss unavailable — Nexora will coordinate sub-tasks directly:", err?.message);
  });
  startIntelligenceScheduler(); // no-op; kept for compatibility

  // Start follow-up email scheduler (bounded email task — not an orchestration brain)
  const { startFollowUpScheduler } = await import("./services/followUpScheduler");
  startFollowUpScheduler();

  // Clean up expired DB locks — prevents stale locks blocking Nexora after a crash
  import("./services/intelligence/nexora/nexora-support")
    .then(({ cleanupExpiredLocks }) => cleanupExpiredLocks())
    .catch(() => undefined); // non-fatal
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);

    // ── Delayed background boot (15 s) ────────────────────────────────────
    // HTTP server binds first so Railway health checks pass immediately.
    // All heavy initialisation (Nexora, pg-boss, schedulers) starts only
    // after the platform has confirmed the app is up and stable.
    setTimeout(async () => {
      try {
        log("Delayed background systems booting...");
        await startBackgroundSystems();
      } catch (err) {
        console.error("[Startup] Background boot failed:", err);
      }
    }, 15000);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  // On SIGTERM (container stop, deploy, restart) or SIGINT (Ctrl-C):
  // 1. Stop accepting new connections
  // 2. Let the current Nexora cycle finish (stopNexoraBackground disables timer)
  // 3. Drain pg-boss (stopJobOrchestrator)
  // 4. Exit cleanly so the platform can restart safely

  let shuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Received ${signal} — initiating graceful shutdown...`);

    // Stop new HTTP requests
    httpServer.close(() => {
      log("HTTP server closed");
    });

    // Stop Nexora background timer (running cycle completes naturally)
    const { stopNexoraBackground } = await import("./services/intelligence/nexoraOrchestrator");
    stopNexoraBackground();
    log("Nexora background loop disabled");

    // Drain pg-boss gracefully
    const { stopJobOrchestrator } = await import("./services/jobOrchestrator");
    await stopJobOrchestrator().catch(() => undefined);
    log("pg-boss stopped");

    // Release any held DB run-locks
    import("./services/intelligence/nexora/nexora-support")
      .then(({ cleanupExpiredLocks }) => cleanupExpiredLocks())
      .catch(() => undefined);

    log("Graceful shutdown complete");
    process.exit(0);
  }

  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => gracefulShutdown("SIGINT"));
})();
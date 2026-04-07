import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
}

const app = express();

const httpServer = createServer(app);

app.set("trust proxy", 1);

// ── Canonical domain redirect (301) ──────────────────────────────────────────
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

const sessionSecret = process.env.SESSION_SECRET?.trim();
if (!sessionSecret) {
  console.warn(
    "[Session] SESSION_SECRET is not set — using insecure fallback. " +
    "Set SESSION_SECRET in your environment for production deployments.",
  );
}

const isProduction = process.env.NODE_ENV === "production";

// Session middleware — must be registered before any route that reads req.session
app.use(
  session({
    secret: sessionSecret || "tcd-dev-fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      // In production the app sits behind a TLS-terminating proxy (trust proxy is
      // already set above), so secure cookies work correctly.  In development we
      // keep them insecure so the local HTTP server still sets the cookie.
      secure: isProduction,
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      sameSite: "lax",
    },
    name: "tcd_session",
  })
);

console.log(`[Session] Session store initialised (secure=${isProduction})`);

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

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

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

    // ── Delayed background system initialization ──────────────────────────
    // All background systems (Nexora, pg-boss, schedulers) are intentionally
    // delayed 15 seconds after the HTTP server binds to its port. This
    // prevents startup race conditions where background tasks attempt DB
    // connections or job scheduling before the process is fully ready.
    setTimeout(async () => {
      log("[Startup] Initialising background systems (15s post-bind delay)...");

      // ── Single orchestration brain: NexoraOrchestrator ─────────────────
      // The SOLE entry point for all business intelligence, signal
      // processing, outreach decisions, and pipeline actions.
      const { startNexoraBackground } = await import("./services/intelligence/nexoraOrchestrator");
      startNexoraBackground();
      log("[Startup] Nexora background loop started");

      // ── pg-boss: durable job persistence layer ──────────────────────────
      // Subordinate to Nexora — only re-triggers jobs Nexora has scheduled.
      const { startIntelligenceScheduler, startSchedulerWithPgBoss } = await import("./services/intelligenceScheduler");
      await startSchedulerWithPgBoss().catch((err: any) => {
        log(`[Startup] pg-boss unavailable — Nexora will coordinate sub-tasks directly: ${err?.message}`);
      });
      startIntelligenceScheduler(); // no-op; kept for compatibility

      // ── Follow-up scheduler: bounded email sequences only ───────────────
      // Not an orchestration brain — only advances pre-created follow-up
      // sequences in the DB. Does not make business decisions.
      const { startFollowUpScheduler } = await import("./services/followUpScheduler");
      startFollowUpScheduler();
      log("[Startup] Follow-up scheduler started");

      // ── Runtime hardening: clean up expired DB locks ────────────────────
      // Prevents stale locks from blocking Nexora if the server crashed mid-run.
      import("./services/intelligence/nexora/nexora-support")
        .then(({ cleanupExpiredLocks }) => cleanupExpiredLocks())
        .catch(() => undefined); // non-fatal

      log("[Startup] All background systems initialised");
    }, 15_000);
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

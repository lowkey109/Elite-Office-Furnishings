import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startNexoraBackground } from "./services/intelligence/nexoraOrchestrator";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
}

const PgSession = connectPgSimple(session);

const app = express();

const httpServer = createServer(app);

startNexoraBackground();

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

// ── Session store initialisation ──────────────────────────────────────────────
// connect-pg-simple's createTableIfMissing reads a bundled table.sql file via
// __dirname, which resolves to /app/dist/table.sql after esbuild bundling —
// a path that does not exist. Instead, we create the admin_sessions table
// directly via a raw SQL query before handing the pool to connect-pg-simple.
// initSessionStore() is awaited inside the startup IIFE before any routes are
// registered, so the session middleware is always registered with the correct store.
async function initSessionStore(): Promise<{ store: any; storeType: string }> {
  if (!process.env.DATABASE_URL) {
    console.warn("[Session] DATABASE_URL not set — using in-memory session store");
    return { store: undefined, storeType: "memory" };
  }

  const sessionPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 3,
  });

  try {
    // Create the admin_sessions table directly — avoids connect-pg-simple's
    // file-based table.sql lookup which fails in the bundled dist output.
    await sessionPool.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        sid    VARCHAR        NOT NULL COLLATE "default" PRIMARY KEY,
        sess   JSON           NOT NULL,
        expire TIMESTAMP(6)  NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expire ON admin_sessions (expire);
    `);
    console.log("[Session] admin_sessions table verified/created");

    const store = new PgSession({
      pool: sessionPool,
      tableName: "admin_sessions",
      // createTableIfMissing is intentionally omitted — table is created above
      // via raw SQL to avoid the bundled table.sql ENOENT error.
    });
    console.log("[Session] Using PostgreSQL session store");
    return { store, storeType: "postgresql" };
  } catch (err: any) {
    console.warn("[Session] PostgreSQL session store init failed, falling back to memory:", err.message);
    try { await sessionPool.end(); } catch { /* ignore */ }
    return { store: undefined, storeType: "memory" };
  }
}

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

(async () => {
  // ── Session store: must be initialised before routes so the session
  // middleware is registered with the correct store (pg or memory fallback).
  const { store: sessionStore, storeType: sessionStoreType } = await initSessionStore();
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "tcd-dev-fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000,
      sameSite: "lax",
    },
    name: "tcd_session",
  }));
  console.log(`[Session] Admin session store: ${sessionStoreType}`);

  await registerRoutes(httpServer, app);

  // ── Single orchestration brain: NexoraOrchestrator ───────────────────────
  // startNexoraBackground() is called at the top of this file (line 21).
  // It is the SOLE entry point for all business intelligence, signal
  // processing, outreach decisions, and pipeline actions.
  //
  // pg-boss is started as a durable job persistence layer, subordinate
  // to Nexora. It does not run its own logic — it only re-triggers jobs
  // that Nexora has already scheduled via runIntelligenceSubTasks().
  //
  // startIntelligenceScheduler() is called for backward compatibility
  // (it is now a no-op — all independent timers have been removed from it).
  //
  // startFollowUpScheduler() runs follow-up email sequences. This is a
  // narrow, bounded email task that is explicitly not an orchestration brain.
  // It does not make business decisions; it only advances pre-created
  // follow-up sequences in the DB.

  const { startIntelligenceScheduler, startSchedulerWithPgBoss } = await import("./services/intelligenceScheduler");
  await startSchedulerWithPgBoss().catch((err) => {
    console.log("[Index] pg-boss unavailable — Nexora will coordinate sub-tasks directly:", err?.message);
  });
  startIntelligenceScheduler(); // no-op; kept for compatibility

  const { startFollowUpScheduler } = await import("./services/followUpScheduler");
  startFollowUpScheduler(); // bounded email follow-up only — not an orchestration brain

  // ── Runtime hardening: clean up expired DB locks on startup ─────────────
  // Prevents stale locks from blocking Nexora if the server crashed mid-run.
  import("./services/intelligence/nexora/nexora-support")
    .then(({ cleanupExpiredLocks }) => cleanupExpiredLocks())
    .catch(() => undefined); // non-fatal

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
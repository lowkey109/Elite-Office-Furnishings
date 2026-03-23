import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
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
  "https://thecorporatedesk.com.au",
  "https://www.thecorporatedesk.com.au",
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
  await registerRoutes(httpServer, app);

  const { startFollowUpScheduler } = await import("./services/followUpScheduler");
  startFollowUpScheduler();

  const { startIntelligenceScheduler, startSchedulerWithPgBoss } = await import("./services/intelligenceScheduler");
  const pgBossStarted = await startSchedulerWithPgBoss().catch(() => false);
  if (!pgBossStarted) {
    console.log("[Index] pg-boss unavailable — using in-process scheduler fallback");
    startIntelligenceScheduler();
  }

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
})();
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startNexoraBackground } from "./services/intelligence/nexoraOrchestrator";
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

startNexoraBackground();

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

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startNexoraBackground } from "./services/intelligence/nexoraOrchestrator";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import path from "path";
import { createServer } from "http";
import { registerRoutes } from "./routes";

<<<<<<< HEAD
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

// ── Session middleware with fallback ──────────────────────────────────────────
let sessionStore: any;
let sessionStoreType = "memory";

try {
  sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: "admin_sessions",
    createTableIfMissing: true,
  });
  sessionStoreType = "postgresql";
  console.log("[Session] Using PostgreSQL session store");
} catch (err: any) {
  console.warn("[Session] PostgreSQL session store failed, falling back to memory:", err.message);
  sessionStore = undefined;
  sessionStoreType = "memory";
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

const __dirname = new URL('.', import.meta.url).pathname

app.use(express.static(path.join(__dirname, "../dist/public")))

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/public/index.html"))
})

=======
>>>>>>> 49e2c29 (Fix missing closure in admin login route)
const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

<<<<<<< HEAD
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
=======
// Register API routes (FIXED SIGNATURE)
registerRoutes(server, app);
>>>>>>> 49e2c29 (Fix missing closure in admin login route)

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

<<<<<<< HEAD
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();
=======
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
>>>>>>> 49e2c29 (Fix missing closure in admin login route)

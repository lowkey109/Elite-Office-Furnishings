const fs = require("fs");

const routeFile = "server/routes.ts";
const engine = "server/services/intelligence/nexora/autonomy/resilience/nexoraResilienceCore.ts";
const routes = "server/services/intelligence/nexora/autonomy/routes/nexoraResilienceRoutes.ts";

for (const file of [routeFile, engine, routes]) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync(routeFile, "utf8");
if (!routeSource.includes("registerNexoraResilienceRoutes")) {
  console.error("Resilience routes not mounted.");
  process.exit(1);
}

const source = fs.readFileSync(engine, "utf8") + fs.readFileSync(routes, "utf8");

const required = [
  "fallback-journal",
  "safeCreateNexoraTaskOrFallback",
  "replayNexoraFallbackJournal",
  "/api/nexora/resilience/status",
  "/api/nexora/resilience/task",
  "/api/nexora/resilience/replay",
  "/api/nexora/maintenance/console",
];

const missing = required.filter((term) => !source.includes(term));

if (missing.length) {
  console.error("Missing resilience terms:", missing);
  process.exit(1);
}

console.log("Nexora resilience local check passed.");

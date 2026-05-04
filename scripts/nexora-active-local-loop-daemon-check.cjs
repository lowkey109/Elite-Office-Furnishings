const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/loopdaemon/nexoraActiveLocalLoopDaemon.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraActiveLocalLoopDaemonRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraActiveLocalLoopDaemonRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/active-loop/status",
  "/api/nexora/active-loop/start",
  "/api/nexora/active-loop/stop",
  "/api/nexora/active-loop/tick",
  "/api/nexora/active-loop/seed",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraActiveLocalLoopDaemonRoutes")) {
  console.error("Active loop registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora active local loop daemon check passed.");

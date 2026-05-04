const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/loopcoverage/nexoraLoopCoverageEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraLoopCoverageRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraLoopCoverageRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/loop-coverage/status",
  "/api/nexora/loop-coverage/audit",
  "/api/nexora/loop-coverage/expand-safe",
  "/api/nexora/loop-coverage/registry",
  "/api/nexora/loop-coverage/report",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraLoopCoverageRoutes")) {
  console.error("Loop coverage registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora loop coverage build check passed.");

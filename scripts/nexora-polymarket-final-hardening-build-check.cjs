const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polymarketfinal/nexoraPolymarketFinalHardening.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketFinalHardeningRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketFinalHardeningRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/polymarket-final/status",
  "/api/nexora/polymarket-final/audit",
  "/api/nexora/polymarket-final/readiness",
  "/api/nexora/polymarket-final/runbook",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolymarketFinalHardeningRoutes")) {
  console.error("Polymarket final registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora Polymarket final hardening build check passed.");

const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polymarketmega/nexoraPolymarketMegaAccelerator.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketMegaAcceleratorRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketMegaAcceleratorRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/polymarket-mega/status",
  "/api/nexora/polymarket-mega/snapshot",
  "/api/nexora/polymarket-mega/runbook",
  "/api/nexora/polymarket-mega/health",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolymarketMegaAcceleratorRoutes")) {
  console.error("Mega accelerator registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora Polymarket mega accelerator build check passed.");

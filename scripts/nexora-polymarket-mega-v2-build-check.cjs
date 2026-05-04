const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polymarketmega2/nexoraPolymarketMegaAcceleratorV2.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketMegaAcceleratorV2Routes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketMegaAcceleratorV2Routes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/polymarket-mega-v2/status",
  "/api/nexora/polymarket-mega-v2/evidence-farm",
  "/api/nexora/polymarket-mega-v2/rank-signals",
  "/api/nexora/polymarket-mega-v2/health",
  "/api/nexora/polymarket-mega-v2/operator-pack",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolymarketMegaAcceleratorV2Routes")) {
  console.error("Polymarket mega v2 registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora Polymarket mega accelerator v2 build check passed.");

const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polymarketcollector/nexoraPolymarketRealCollector.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketRealCollectorRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketRealCollectorRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/polymarket-collector/status",
  "/api/nexora/polymarket-collector/config",
  "/api/nexora/polymarket-collector/market/register",
  "/api/nexora/polymarket-collector/markets",
  "/api/nexora/polymarket-collector/binance/normalize",
  "/api/nexora/polymarket-collector/clob/normalize",
  "/api/nexora/polymarket-collector/edge-scan",
  "/api/nexora/polymarket-collector/health",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolymarketRealCollectorRoutes")) {
  console.error("Polymarket real collector registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora Polymarket real collector build check passed.");

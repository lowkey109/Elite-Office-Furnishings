const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/marketdata/nexoraMarketDataPaperEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraMarketDataPaperRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraMarketDataPaperRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/market-data/status",
  "/api/nexora/market-data/binance/tick",
  "/api/nexora/market-data/polymarket/snapshot",
  "/api/nexora/market-data/fair-value",
  "/api/nexora/market-data/latency",
  "/api/nexora/market-data/edge",
  "/api/nexora/market-data/signal",
  "/api/nexora/market-data/cycle",
  "/api/nexora/market-data/list",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraMarketDataPaperRoutes")) {
  console.error("Market data registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora market data paper build check passed.");

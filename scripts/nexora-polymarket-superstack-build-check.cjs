const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polymarketsuperstack/nexoraPolymarketSuperstack.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketSuperstackRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketSuperstackRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/polymarket-superstack/status",
  "/api/nexora/polymarket-superstack/config",
  "/api/nexora/polymarket-superstack/market/register",
  "/api/nexora/polymarket-superstack/markets",
  "/api/nexora/polymarket-superstack/watchlist",
  "/api/nexora/polymarket-superstack/binance/tick",
  "/api/nexora/polymarket-superstack/clob/snapshot",
  "/api/nexora/polymarket-superstack/edge",
  "/api/nexora/polymarket-superstack/cycle",
  "/api/nexora/polymarket-superstack/paper/settle",
  "/api/nexora/polymarket-superstack/records",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolymarketSuperstackRoutes")) {
  console.error("Polymarket superstack registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora Polymarket superstack build check passed.");

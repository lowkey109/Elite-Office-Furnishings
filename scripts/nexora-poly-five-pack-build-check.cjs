const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polyfive/risk/nexoraPolyRiskExtractor.ts",
  "server/services/intelligence/nexora/autonomy/polyfive/discovery/nexoraPolyMarketDiscovery.ts",
  "server/services/intelligence/nexora/autonomy/polyfive/clob/nexoraPolyClobOrderBook.ts",
  "server/services/intelligence/nexora/autonomy/polyfive/strategy/nexoraMoonDevStrategyFactory.ts",
  "server/services/intelligence/nexora/autonomy/polyfive/pnl/nexoraPolyPnlAnalytics.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolyFivePackRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolyFivePackRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/poly-five/status",
  "/api/nexora/poly-five/risk/extract",
  "/api/nexora/poly-five/risk/status",
  "/api/nexora/poly-five/markets/default",
  "/api/nexora/poly-five/markets/import",
  "/api/nexora/poly-five/markets",
  "/api/nexora/poly-five/clob/normalize",
  "/api/nexora/poly-five/clob/books",
  "/api/nexora/poly-five/clob/status",
  "/api/nexora/poly-five/strategy/create",
  "/api/nexora/poly-five/strategy/batch",
  "/api/nexora/poly-five/strategy/list",
  "/api/nexora/poly-five/strategy/status",
  "/api/nexora/poly-five/pnl/report",
  "/api/nexora/poly-five/pnl/reports",
  "/api/nexora/poly-five/pnl/status",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolyFivePackRoutes")) {
  console.error("Poly five pack registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora Poly 5 Pack build check passed.");

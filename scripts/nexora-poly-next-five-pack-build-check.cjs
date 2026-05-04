const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polynextfive/marketapi/nexoraPolyMarketApiDiscovery.ts",
  "server/services/intelligence/nexora/autonomy/polynextfive/orderbook/nexoraPolyClobFetchDesign.ts",
  "server/services/intelligence/nexora/autonomy/polynextfive/strategytournament/nexoraPolyStrategyTournament.ts",
  "server/services/intelligence/nexora/autonomy/polynextfive/riskstress/nexoraPolyRiskStress.ts",
  "server/services/intelligence/nexora/autonomy/polynextfive/evidence/nexoraPolyEvidencePipeline.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolyNextFivePackRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolyNextFivePackRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/poly-next-five/status",
  "/api/nexora/poly-next-five/market-api/config",
  "/api/nexora/poly-next-five/market-api/query",
  "/api/nexora/poly-next-five/market-api/import",
  "/api/nexora/poly-next-five/market-api/markets",
  "/api/nexora/poly-next-five/clob/fetch-plan",
  "/api/nexora/poly-next-five/clob/normalize",
  "/api/nexora/poly-next-five/clob/records",
  "/api/nexora/poly-next-five/strategy/tournament",
  "/api/nexora/poly-next-five/strategy/tournaments",
  "/api/nexora/poly-next-five/risk/stress",
  "/api/nexora/poly-next-five/risk/stress-tests",
  "/api/nexora/poly-next-five/evidence/report",
  "/api/nexora/poly-next-five/evidence/reports",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolyNextFivePackRoutes")) {
  console.error("Poly next five pack registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora Poly Next 5 Pack build check passed.");

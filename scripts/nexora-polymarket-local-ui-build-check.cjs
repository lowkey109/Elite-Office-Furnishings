const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polymarketui/nexoraPolymarketLocalOperatorUi.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketLocalOperatorUiRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketLocalOperatorUiRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");
const indexTs = fs.readFileSync("server/index.ts", "utf8");

const endpoints = [
  "/nexora/polymarket",
  "/nexora/polymarket/signals",
  "/nexora/polymarket/backtests",
  "/nexora/polymarket/execution",
  "/nexora/polymarket/research",
  "/nexora/polymarket/readiness",
  "/api/nexora/polymarket-ui/summary",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolymarketLocalOperatorUiRoutes")) {
  console.error("Polymarket UI registrar is not mounted in routes.ts.");
  process.exit(1);
}

if (!indexTs.includes("registerNexoraPolymarketLocalOperatorUiRoutes")) {
  console.error("Polymarket UI registrar is not direct-mounted in index.ts.");
  process.exit(1);
}

console.log("Nexora Polymarket local UI build check passed.");

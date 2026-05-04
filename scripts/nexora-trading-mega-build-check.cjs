const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/tradingmega/nexoraTradingMegaEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraTradingMegaRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraTradingMegaRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/trading-mega/status",
  "/api/nexora/trading-mega/strategy/register",
  "/api/nexora/trading-mega/paper/plan",
  "/api/nexora/trading-mega/paper/execute",
  "/api/nexora/trading-mega/paper/settle",
  "/api/nexora/trading-mega/whale/observe",
  "/api/nexora/trading-mega/copy/signal",
  "/api/nexora/trading-mega/research/note",
  "/api/nexora/trading-mega/records",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraTradingMegaRoutes")) {
  console.error("Trading mega registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora trading mega build check passed.");

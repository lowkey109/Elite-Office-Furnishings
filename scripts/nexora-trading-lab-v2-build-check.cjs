const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/tradinglab/nexoraTradingIntelligenceLabV2.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraTradingIntelligenceLabV2Routes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraTradingIntelligenceLabV2Routes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/trading-lab/status",
  "/api/nexora/trading-lab/strategy/create",
  "/api/nexora/trading-lab/strategy/mutate",
  "/api/nexora/trading-lab/strategies",
  "/api/nexora/trading-lab/exposure/check",
  "/api/nexora/trading-lab/portfolio/open",
  "/api/nexora/trading-lab/portfolio/settle",
  "/api/nexora/trading-lab/signal/swarm",
  "/api/nexora/trading-lab/tournament/run",
  "/api/nexora/trading-lab/dashboard",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraTradingIntelligenceLabV2Routes")) {
  console.error("Trading lab registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora trading lab v2 build check passed.");

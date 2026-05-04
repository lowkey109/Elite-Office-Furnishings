const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/tradingreadiness/nexoraTradingLiveReadinessGate.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraTradingLiveReadinessGateRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraTradingLiveReadinessGateRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/trading-readiness/status",
  "/api/nexora/trading-readiness/evidence",
  "/api/nexora/trading-readiness/gate",
  "/api/nexora/trading-readiness/owner-review",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraTradingLiveReadinessGateRoutes")) {
  console.error("Trading readiness registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora trading live readiness build check passed.");

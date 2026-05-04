const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/tradingexecution/nexoraTradingExecutionSafety.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraTradingExecutionSafetyRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraTradingExecutionSafetyRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/trading-execution/status",
  "/api/nexora/trading-execution/kill-switch",
  "/api/nexora/trading-execution/limits",
  "/api/nexora/trading-execution/intent",
  "/api/nexora/trading-execution/fill/simulate",
  "/api/nexora/trading-execution/reconcile",
  "/api/nexora/trading-execution/report",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraTradingExecutionSafetyRoutes")) {
  console.error("Trading execution registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora trading execution safety build check passed.");

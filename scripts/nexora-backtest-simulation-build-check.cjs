const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/backtesting/nexoraBacktestSimulationEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraBacktestSimulationRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraBacktestSimulationRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/backtesting/status",
  "/api/nexora/backtesting/dataset/synthetic",
  "/api/nexora/backtesting/dataset",
  "/api/nexora/backtesting/run",
  "/api/nexora/backtesting/runs",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraBacktestSimulationRoutes")) {
  console.error("Backtesting registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora backtesting build check passed.");

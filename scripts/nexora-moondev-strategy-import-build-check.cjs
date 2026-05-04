const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/moondevstrategyimport/nexoraMoonDevStrategyBacktestImporter.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraMoonDevStrategyBacktestImporterRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraMoonDevStrategyBacktestImporterRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/moondev-strategy-import/status",
  "/api/nexora/moondev-strategy-import/strategies",
  "/api/nexora/moondev-strategy-import/backtests",
  "/api/nexora/moondev-strategy-import/rank",
  "/api/nexora/moondev-strategy-import/adapter-plan",
  "/api/nexora/moondev-strategy-import/report",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraMoonDevStrategyBacktestImporterRoutes")) {
  console.error("MoonDev strategy import registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora MoonDev strategy import build check passed.");

const fs = require("fs");

const requiredFiles = [
  "server/services/intelligence/nexora/autonomy/storageguard/nexoraLocalStorageGuard.ts",
  "server/services/intelligence/nexora/autonomy/compaction/nexoraLocalCompactionEngine.ts",
  "server/services/intelligence/nexora/autonomy/simulation/nexoraWorkflowSimulator.ts",
  "server/services/intelligence/nexora/autonomy/rules/nexoraDecisionRuleEngine.ts",
  "server/services/intelligence/nexora/autonomy/maintenance/nexoraMaintenancePlanner.ts",
  "server/services/intelligence/nexora/autonomy/trace/nexoraOperatingTrace.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraAdvancedLocalOpsRoutes.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routesTs = fs.readFileSync("server/routes.ts", "utf8");
if (!routesTs.includes("registerNexoraAdvancedLocalOpsRoutes")) {
  console.error("Advanced local ops routes are not mounted.");
  process.exit(1);
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraAdvancedLocalOpsRoutes.ts", "utf8");
const endpoints = [
  "/api/nexora/advanced-local/status",
  "/api/nexora/storage/inspect",
  "/api/nexora/compaction/plan",
  "/api/nexora/workflow-simulator/run",
  "/api/nexora/rules/create",
  "/api/nexora/maintenance/plan",
  "/api/nexora/trace/record",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint", endpoint);
    process.exit(1);
  }
}

console.log("Nexora advanced local ops Build 126-145 local check passed.");

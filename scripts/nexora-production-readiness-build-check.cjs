const fs = require("fs");

const requiredFiles = [
  "server/services/intelligence/nexora/autonomy/auth/nexoraAuthEnforcement.ts",
  "server/services/intelligence/nexora/autonomy/routegovernance/nexoraRouteGovernance.ts",
  "server/services/intelligence/nexora/autonomy/migrationpack/nexoraMigrationPackBuilder.ts",
  "server/services/intelligence/nexora/autonomy/restore/nexoraRestoreControls.ts",
  "server/services/intelligence/nexora/autonomy/localmonitor/nexoraLocalMonitor.ts",
  "server/services/intelligence/nexora/autonomy/v1/nexoraV1ReleaseControls.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraProductionReadinessRoutes.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routesTs = fs.readFileSync("server/routes.ts", "utf8");
if (!routesTs.includes("registerNexoraProductionReadinessRoutes")) {
  console.error("Production readiness routes are not mounted.");
  process.exit(1);
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraProductionReadinessRoutes.ts", "utf8");
const endpoints = [
  "/api/nexora/prod-readiness/status",
  "/api/nexora/auth/policy/create",
  "/api/nexora/auth/evaluate",
  "/api/nexora/route-governance/snapshot",
  "/api/nexora/migration-pack/create",
  "/api/nexora/restore/point/create",
  "/api/nexora/local-monitor/check",
  "/api/nexora/v1/release-candidate",
  "/api/nexora/v1/release-gate",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint", endpoint);
    process.exit(1);
  }
}

console.log("Nexora production readiness Build 86-105 local check passed.");

const fs = require("fs");

const requiredFiles = [
  "server/services/intelligence/nexora/autonomy/apicatalogue/nexoraApiCatalogue.ts",
  "server/services/intelligence/nexora/autonomy/testharness/nexoraLocalTestHarness.ts",
  "server/services/intelligence/nexora/autonomy/seedpacks/nexoraSeedPacks.ts",
  "server/services/intelligence/nexora/autonomy/healthscore/nexoraHealthScoreEngine.ts",
  "server/services/intelligence/nexora/autonomy/operatorpacks/nexoraOperatorPacks.ts",
  "server/services/intelligence/nexora/autonomy/packagekit/nexoraPackageManifest.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraOperatorKitRoutes.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routesTs = fs.readFileSync("server/routes.ts", "utf8");
if (!routesTs.includes("registerNexoraOperatorKitRoutes")) {
  console.error("Operator kit routes are not mounted.");
  process.exit(1);
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraOperatorKitRoutes.ts", "utf8");
const endpoints = [
  "/api/nexora/operator-kit/status",
  "/api/nexora/api-catalogue/create",
  "/api/nexora/test-harness/plan",
  "/api/nexora/test-harness/dry-run",
  "/api/nexora/seed-packs/create",
  "/api/nexora/health-score",
  "/api/nexora/operator-pack/create",
  "/api/nexora/package-manifest/create",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint", endpoint);
    process.exit(1);
  }
}

console.log("Nexora operator kit Build 106-125 local check passed.");

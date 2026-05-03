const fs = require("fs");

const routeFile = "server/routes.ts";
const requiredFiles = [
  "server/services/intelligence/nexora/autonomy/localapprovals/nexoraLocalApprovalGate.ts",
  "server/services/intelligence/nexora/autonomy/localcrm/nexoraLocalCrm.ts",
  "server/services/intelligence/nexora/autonomy/localquotes/nexoraLocalQuoteBook.ts",
  "server/services/intelligence/nexora/autonomy/localsuppliers/nexoraLocalSupplierCatalogue.ts",
  "server/services/intelligence/nexora/autonomy/localprojects/nexoraLocalProjectBoard.ts",
  "server/services/intelligence/nexora/autonomy/exporter/nexoraExportPack.ts",
  "server/services/intelligence/nexora/autonomy/exporter/nexoraLocalSnapshotEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraLocalBusinessRoutes.ts",
];

for (const file of [routeFile, ...requiredFiles]) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routes = fs.readFileSync(routeFile, "utf8");
if (!routes.includes("registerNexoraLocalBusinessRoutes")) {
  console.error("Local business routes not mounted.");
  process.exit(1);
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraLocalBusinessRoutes.ts", "utf8");
const endpoints = [
  "/api/nexora/local-business/status",
  "/api/nexora/local-approvals/create",
  "/api/nexora/local-crm/lead/upsert",
  "/api/nexora/local-quotes/create",
  "/api/nexora/local-suppliers/upsert",
  "/api/nexora/local-projects/create",
  "/api/nexora/export/create",
  "/api/nexora/snapshot/create",
];

const missing = endpoints.filter((endpoint) => !routeSource.includes(endpoint));

if (missing.length) {
  console.error("Missing endpoints:", missing);
  process.exit(1);
}

console.log("Nexora local business build 36-47 check passed.");

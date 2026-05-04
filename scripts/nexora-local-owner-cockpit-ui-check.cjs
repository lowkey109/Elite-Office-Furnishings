const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/localui/nexoraLocalOwnerCockpitUi.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraLocalOwnerCockpitUiRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraLocalOwnerCockpitUiRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/nexora/owner",
  "/nexora/company",
  "/nexora/approvals",
  "/nexora/office",
  "/nexora/teaching",
  "/nexora/rewards",
  "/nexora/recovery",
  "/api/nexora/local-ui/status",
  "/api/nexora/local-ui/owner-summary",
  "/api/nexora/local-ui/company-summary",
  "/api/nexora/local-ui/approval-summary",
  "/api/nexora/local-ui/office-summary",
  "/api/nexora/local-ui/teaching-summary",
  "/api/nexora/local-ui/reward-summary",
  "/api/nexora/local-ui/recovery-summary",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraLocalOwnerCockpitUiRoutes")) {
  console.error("Local UI registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora local owner cockpit UI check passed.");

const fs = require("fs");

const requiredFiles = [
  "server/services/intelligence/nexora/autonomy/companyrun/nexoraCompanyRunEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraCompanyRunRoutes.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraCompanyRunRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/company-run/status",
  "/api/nexora/company-run/divisions",
  "/api/nexora/company-run/agents/seed",
  "/api/nexora/company-run/work-order",
  "/api/nexora/company-run/work-orders",
  "/api/nexora/company-run/objective",
  "/api/nexora/company-run/objectives",
  "/api/nexora/company-run/division-plan",
  "/api/nexora/company-run/daily-cycle",
  "/api/nexora/company-run/executive-pack",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraCompanyRunRoutes")) {
  console.error("Company-run registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora company-run build check passed.");

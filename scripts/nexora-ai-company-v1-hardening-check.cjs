const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/v1hardening/nexoraAICompanyV1Hardening.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraAICompanyV1HardeningRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraAICompanyV1HardeningRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/v1-hardening/status",
  "/api/nexora/v1-hardening/auth/scaffold",
  "/api/nexora/v1-hardening/access-map/create",
  "/api/nexora/v1-hardening/office-command-pack",
  "/api/nexora/v1-hardening/company-scheduler",
  "/api/nexora/v1-hardening/dashboard-summary",
  "/api/nexora/v1-hardening/postgres/checklist",
  "/api/nexora/v1-hardening/replay/dry-run",
  "/api/nexora/v1-hardening/readiness/final",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraAICompanyV1HardeningRoutes")) {
  console.error("V1 hardening registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora AI Company v1 hardening check passed.");

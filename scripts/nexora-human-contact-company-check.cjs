const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/humancompany/nexoraHumanContactCompanyEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraHumanContactCompanyRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraHumanContactCompanyRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/human-company/status",
  "/api/nexora/human-company/owner-cockpit",
  "/api/nexora/human-company/contact/create",
  "/api/nexora/human-company/contacts",
  "/api/nexora/human-company/communication/draft",
  "/api/nexora/human-company/approval/request",
  "/api/nexora/human-company/approval/decide",
  "/api/nexora/human-company/approvals",
  "/api/nexora/human-company/handoff/create",
  "/api/nexora/human-company/handoffs",
  "/api/nexora/human-company/touchpoint/record",
  "/api/nexora/human-company/touchpoints",
  "/api/nexora/human-company/inbox/create",
  "/api/nexora/human-company/inbox",
  "/api/nexora/human-company/briefing/daily",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraHumanContactCompanyRoutes")) {
  console.error("Human-company registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora human-contact company check passed.");

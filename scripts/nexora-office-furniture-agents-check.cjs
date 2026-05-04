const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/officeagents/nexoraOfficeFurnitureAgents.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraOfficeFurnitureAgentRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraOfficeFurnitureAgentRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/office-agents/status",
  "/api/nexora/office-agents/tick",
  "/api/nexora/office-agents/lead/intake",
  "/api/nexora/office-agents/quote/draft",
  "/api/nexora/office-agents/supplier/request",
  "/api/nexora/office-agents/followup/draft",
  "/api/nexora/office-agents/project/scope",
  "/api/nexora/office-agents/project/handover",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraOfficeFurnitureAgentRoutes")) {
  console.error("Office furniture agent registrar not mounted.");
  process.exit(1);
}

console.log("Nexora office furniture agents check passed.");

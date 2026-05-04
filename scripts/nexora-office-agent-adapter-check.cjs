const fs = require("fs");

const routeFile = "server/services/intelligence/nexora/autonomy/routes/nexoraOfficeAgentAdapterRoutes.ts";
const routesTs = "server/routes.ts";

if (!fs.existsSync(routeFile)) {
  console.error("Missing", routeFile);
  process.exit(1);
}

if (!fs.existsSync(routesTs)) {
  console.error("Missing", routesTs);
  process.exit(1);
}

const source = fs.readFileSync(routeFile, "utf8");
const mounted = fs.readFileSync(routesTs, "utf8");

const endpoints = [
  "/api/nexora/office-agents/status",
  "/api/nexora/office-agents/tick",
  "/api/nexora/office-agents/lead/intake",
  "/api/nexora/office-agents/quote/draft",
  "/api/nexora/office-agents/supplier/request",
  "/api/nexora/office-agents/followup/draft",
  "/api/nexora/office-agents/project/scope",
];

const missingEndpoints = endpoints.filter((endpoint) => !source.includes(endpoint));

if (missingEndpoints.length) {
  console.error("Missing endpoints:", missingEndpoints);
  process.exit(1);
}

if (!mounted.includes("registerNexoraOfficeAgentAdapterRoutes")) {
  console.error("Office agent adapter registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora office agent adapter check passed.");

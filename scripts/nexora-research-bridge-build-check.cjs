const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/researchbridge/nexoraResearchBridgeEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraResearchBridgeRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraResearchBridgeRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/research-bridge/status",
  "/api/nexora/research-bridge/audit",
  "/api/nexora/research-bridge/todo-plan",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraResearchBridgeRoutes")) {
  console.error("Research bridge registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora research bridge build check passed.");

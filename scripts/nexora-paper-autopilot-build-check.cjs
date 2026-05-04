const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/paperautopilot/nexoraPaperAutopilotEvidenceEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPaperAutopilotEvidenceRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPaperAutopilotEvidenceRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/paper-autopilot/status",
  "/api/nexora/paper-autopilot/cycle",
  "/api/nexora/paper-autopilot/batch",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPaperAutopilotEvidenceRoutes")) {
  console.error("Paper autopilot registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora paper autopilot build check passed.");

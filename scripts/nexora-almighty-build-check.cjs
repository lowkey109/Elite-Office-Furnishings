const fs = require("fs");

const requiredFiles = [
  "server/services/intelligence/nexora/autonomy/goalcompiler/nexoraGoalCompiler.ts",
  "server/services/intelligence/nexora/autonomy/playbooks/nexoraPlaybookRunner.ts",
  "server/services/intelligence/nexora/autonomy/risksim/nexoraRiskSimulator.ts",
  "server/services/intelligence/nexora/autonomy/almighty/nexoraAlmightyCommander.ts",
  "server/services/intelligence/nexora/autonomy/brainpack/nexoraBrainPack.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraAlmightyRoutes.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routesTs = fs.readFileSync("server/routes.ts", "utf8");
if (!routesTs.includes("registerNexoraAlmightyRoutes")) {
  console.error("Almighty routes are not mounted.");
  process.exit(1);
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraAlmightyRoutes.ts", "utf8");
const endpoints = [
  "/api/nexora/almighty/status",
  "/api/nexora/goals/compile",
  "/api/nexora/playbooks/create",
  "/api/nexora/playbooks/dry-run",
  "/api/nexora/risk-sim/run",
  "/api/nexora/almighty/command",
  "/api/nexora/brainpack/create",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint", endpoint);
    process.exit(1);
  }
}

console.log("Nexora almighty Build 146-165 local check passed.");

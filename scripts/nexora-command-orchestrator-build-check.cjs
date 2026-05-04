const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/commandorchestrator/nexoraCommandOrchestrator.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraCommandOrchestratorRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraCommandOrchestratorRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/command-orchestrator/status",
  "/api/nexora/command-orchestrator/seed",
  "/api/nexora/command-orchestrator/register",
  "/api/nexora/command-orchestrator/commands",
  "/api/nexora/command-orchestrator/plan",
  "/api/nexora/command-orchestrator/runbook",
  "/api/nexora/command-orchestrator/queue",
  "/api/nexora/command-orchestrator/dry-run",
  "/api/nexora/command-orchestrator/dashboard",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraCommandOrchestratorRoutes")) {
  console.error("Command orchestrator registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora command orchestrator build check passed.");

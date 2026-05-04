const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/humanops/nexoraHumanLoopBusinessOps.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraHumanLoopBusinessOpsRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraHumanLoopBusinessOpsRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/human-ops/status",
  "/api/nexora/human-ops/customer-journey/create",
  "/api/nexora/human-ops/customer-journeys",
  "/api/nexora/human-ops/supplier-desk/request",
  "/api/nexora/human-ops/supplier-desk/requests",
  "/api/nexora/human-ops/install/plan",
  "/api/nexora/human-ops/install/plans",
  "/api/nexora/human-ops/escalation/create",
  "/api/nexora/human-ops/escalations",
  "/api/nexora/human-ops/owner-decision/create",
  "/api/nexora/human-ops/owner-decision/queue",
  "/api/nexora/human-ops/briefing",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraHumanLoopBusinessOpsRoutes")) {
  console.error("Human-loop business ops registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora human-loop business ops check passed.");

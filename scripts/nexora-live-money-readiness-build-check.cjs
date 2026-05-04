const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/livemoney/nexoraLiveMoneyReadiness.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraLiveMoneyReadinessRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraLiveMoneyReadinessRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/live-money/status",
  "/api/nexora/live-money/wallet-policy",
  "/api/nexora/live-money/execution-policy",
  "/api/nexora/live-money/readiness",
  "/api/nexora/live-money/approval-request",
  "/api/nexora/live-money/operator-checklist",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraLiveMoneyReadinessRoutes")) {
  console.error("Live money readiness registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora live money readiness scaffold check passed.");

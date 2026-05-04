const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/liveexecutiondesign/nexoraPolymarketLiveExecutionDesign.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketLiveExecutionDesignRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolymarketLiveExecutionDesignRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/live-execution-design/status",
  "/api/nexora/live-execution-design/architecture",
  "/api/nexora/live-execution-design/intent-schema",
  "/api/nexora/live-execution-design/intent-draft",
  "/api/nexora/live-execution-design/external-signer",
  "/api/nexora/live-execution-design/checklist",
  "/api/nexora/live-execution-design/report",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolymarketLiveExecutionDesignRoutes")) {
  console.error("Live execution design registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora live execution design build check passed.");

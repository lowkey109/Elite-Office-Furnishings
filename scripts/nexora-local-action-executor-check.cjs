const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/localexecutor/nexoraLocalActionExecutor.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraLocalActionExecutorRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraLocalActionExecutorRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/local-executor/status",
  "/api/nexora/local-executor/run",
  "/api/nexora/local-executor/dry-run",
  "/api/nexora/local-executor/report",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraLocalActionExecutorRoutes")) {
  console.error("Local executor registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora local action executor check passed.");

const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/nbp/nexoraNextBestPlanEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraNextBestPlanRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraNextBestPlanRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/nbp/status",
  "/api/nexora/nbp/create",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraNextBestPlanRoutes")) {
  console.error("NBP registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora NBP build check passed.");

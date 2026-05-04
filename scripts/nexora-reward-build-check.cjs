const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/rewards/nexoraRewardEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraRewardRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraRewardRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/rewards/status",
  "/api/nexora/rewards/create",
  "/api/nexora/rewards/praise",
  "/api/nexora/rewards/success-pattern",
  "/api/nexora/rewards/confidence/update",
  "/api/nexora/rewards/promotion/recommend",
  "/api/nexora/rewards/list",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraRewardRoutes")) {
  console.error("Reward registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora reward build check passed.");

const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/moondevadapter/nexoraMoonDevAdapterScorer.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraMoonDevAdapterRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraMoonDevAdapterRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/moondev-adapter/status",
  "/api/nexora/moondev-adapter/score",
  "/api/nexora/moondev-adapter/plan",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraMoonDevAdapterRoutes")) {
  console.error("MoonDev adapter registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora MoonDev adapter build check passed.");

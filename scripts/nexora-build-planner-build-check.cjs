const fs = require("fs");

const requiredFiles = [
  "server/services/intelligence/nexora/autonomy/buildplanner/nexoraBuildInventory.ts",
  "server/services/intelligence/nexora/autonomy/buildplanner/nexoraBuildCollisionPlanner.ts",
  "server/services/intelligence/nexora/autonomy/buildplanner/nexoraBuildPreflight.ts",
  "server/services/intelligence/nexora/autonomy/buildplanner/nexoraFutureBuildRoadmap.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraBuildPlannerRoutes.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routesTs = fs.readFileSync("server/routes.ts", "utf8");
if (!routesTs.includes("registerNexoraBuildPlannerRoutes")) {
  console.error("Build planner routes are not mounted.");
  process.exit(1);
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraBuildPlannerRoutes.ts", "utf8");
const endpoints = [
  "/api/nexora/build-planner/inventory",
  "/api/nexora/build-planner/collision-check",
  "/api/nexora/build-planner/preflight",
  "/api/nexora/build-planner/roadmap",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint", endpoint);
    process.exit(1);
  }
}

console.log("Nexora Build Planner 61-65 local check passed.");

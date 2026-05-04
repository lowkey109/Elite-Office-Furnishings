const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/localmaster/nexoraLocalMasterControl.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraLocalMasterControlRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraLocalMasterControlRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/local-master/status",
  "/api/nexora/local-master/run",
  "/api/nexora/local-master/no-deploy-guard",
  "/api/nexora/local-master/route-registry",
  "/api/nexora/local-master/simulate",
  "/api/nexora/local-master/owner-briefing",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraLocalMasterControlRoutes")) {
  console.error("Local master registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora local master control check passed.");

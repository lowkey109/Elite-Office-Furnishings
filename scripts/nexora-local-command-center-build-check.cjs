const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/localcommandcenter/nexoraLocalCommandCenter.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraLocalCommandCenterRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraLocalCommandCenterRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/local-command-center/status",
  "/api/nexora/local-command-center/snapshot",
  "/api/nexora/local-command-center/report",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraLocalCommandCenterRoutes")) {
  console.error("Local command center registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora local command center build check passed.");

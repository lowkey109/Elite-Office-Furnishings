const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/localv1/nexoraFinalLocalV1ReleasePack.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraFinalLocalV1Routes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraFinalLocalV1Routes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/final-local-v1/status",
  "/api/nexora/final-local-v1/check",
  "/api/nexora/final-local-v1/release-pack",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraFinalLocalV1Routes")) {
  console.error("Final local v1 registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora final local v1 build check passed.");

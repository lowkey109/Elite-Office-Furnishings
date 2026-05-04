const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/humanboundary/nexoraHumanBoundaryDoctrine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraHumanBoundaryDoctrineRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraHumanBoundaryDoctrineRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/human-boundary/status",
  "/api/nexora/human-boundary/doctrine/create",
  "/api/nexora/human-boundary/doctrine",
  "/api/nexora/human-boundary/classify",
  "/api/nexora/human-boundary/approve/request",
  "/api/nexora/human-boundary/sign/request",
  "/api/nexora/human-boundary/commit/request",
  "/api/nexora/human-boundary/queue",
  "/api/nexora/human-boundary/responsibility-map",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraHumanBoundaryDoctrineRoutes")) {
  console.error("Human-boundary registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora human-boundary doctrine check passed.");

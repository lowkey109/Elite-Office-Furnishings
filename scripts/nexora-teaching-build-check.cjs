const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/teaching/nexoraTeachingEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraTeachingRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraTeachingRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/teaching/status",
  "/api/nexora/teaching/skills/seed",
  "/api/nexora/teaching/skill/create",
  "/api/nexora/teaching/skills",
  "/api/nexora/teaching/capability/assess",
  "/api/nexora/teaching/gap/create",
  "/api/nexora/teaching/lesson/create",
  "/api/nexora/teaching/lessons",
  "/api/nexora/teaching/example/capture",
  "/api/nexora/teaching/playbook/from-lesson",
  "/api/nexora/teaching/training/create",
  "/api/nexora/teaching/queue/create",
  "/api/nexora/teaching/queue",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraTeachingRoutes")) {
  console.error("Teaching registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora teaching build check passed.");

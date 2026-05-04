const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/moondevsystems/nexoraMoonDevSystemsAccelerator.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraMoonDevSystemsAcceleratorRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraMoonDevSystemsAcceleratorRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/moondev-systems/status",
  "/api/nexora/moondev-systems/inventory",
  "/api/nexora/moondev-systems/gap-analysis",
  "/api/nexora/moondev-systems/score",
  "/api/nexora/moondev-systems/phase-plan",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraMoonDevSystemsAcceleratorRoutes")) {
  console.error("MoonDev systems registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora MoonDev systems accelerator build check passed.");

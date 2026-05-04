const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/moondevphase1/nexoraMoonDevPhase1Adapters.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraMoonDevPhase1Routes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraMoonDevPhase1Routes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/moondev-phase1/status",
  "/api/nexora/moondev-phase1/base-agent",
  "/api/nexora/moondev-phase1/swarm",
  "/api/nexora/moondev-phase1/risk",
  "/api/nexora/moondev-phase1/strategy",
  "/api/nexora/moondev-phase1/polymarket",
  "/api/nexora/moondev-phase1/copy-whale",
  "/api/nexora/moondev-phase1/master-plan",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraMoonDevPhase1Routes")) {
  console.error("MoonDev Phase1 registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora MoonDev Phase1 build check passed.");

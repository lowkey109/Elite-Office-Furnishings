const fs = require("fs");

const routesFile = "server/routes.ts";
const expected = [
  "registerNexoraAdvancedAutonomyRoutes",
  "registerNexoraGovernorBusinessRoutes",
  "registerNexoraOperationalAutopilotRoutes",
  "registerNexoraMissionControlRoutes",
];

if (!fs.existsSync(routesFile)) {
  console.error("Missing server/routes.ts");
  process.exit(1);
}

const s = fs.readFileSync(routesFile, "utf8");

const missing = expected.filter((name) => !s.includes(name));

if (missing.length) {
  console.error("Missing Nexora route registrars:", missing);
  process.exit(1);
}

const routeFiles = [
  "server/services/intelligence/nexora/autonomy/routes/nexoraAdvancedAutonomyRoutes.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraGovernorBusinessRoutes.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraOperationalAutopilotRoutes.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraMissionControlRoutes.ts",
];

for (const file of routeFiles) {
  if (!fs.existsSync(file)) {
    console.error("Missing route file:", file);
    process.exit(1);
  }
}

console.log("Nexora local route manifest check passed.");

const fs = require("fs");

const routeFile = "server/routes.ts";

const registrars = [
  "registerNexoraAdvancedAutonomyRoutes",
  "registerNexoraGovernorBusinessRoutes",
  "registerNexoraOperationalAutopilotRoutes",
  "registerNexoraMissionControlRoutes",
  "registerNexoraSupremeMatrixRoutes",
];

const files = [
  "server/services/intelligence/nexora/autonomy/persistence/nexoraDurableKernel.ts",
  "server/services/intelligence/nexora/autonomy/governor/nexoraAutonomyGovernor.ts",
  "server/services/intelligence/nexora/autonomy/business/nexoraBusinessPipelineEngine.ts",
  "server/services/intelligence/nexora/autonomy/autopilot/nexoraOperationalAutopilot.ts",
  "server/services/intelligence/nexora/autonomy/mission/nexoraMissionControl.ts",
  "server/services/intelligence/nexora/autonomy/supreme/nexoraSupremeOrchestrationMatrix.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraSupremeMatrixRoutes.ts",
];

if (!fs.existsSync(routeFile)) {
  console.error("Missing", routeFile);
  process.exit(1);
}

const routes = fs.readFileSync(routeFile, "utf8");

const missingRegistrars = registrars.filter((name) => !routes.includes(name));
if (missingRegistrars.length) {
  console.error("Missing route registrars:", missingRegistrars);
  process.exit(1);
}

const missingFiles = files.filter((file) => !fs.existsSync(file));
if (missingFiles.length) {
  console.error("Missing Nexora files:", missingFiles);
  process.exit(1);
}

const supremeRoutes = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraSupremeMatrixRoutes.ts", "utf8");
const expectedEndpoints = [
  "/api/nexora/supreme/status",
  "/api/nexora/supreme/register-workers",
  "/api/nexora/supreme/decision/record",
  "/api/nexora/supreme/capability-graph/build",
  "/api/nexora/supreme/dance/generate",
  "/api/nexora/supreme/dance/rehearse",
  "/api/nexora/supreme/dance/queue",
  "/api/nexora/supreme/red-team/run",
  "/api/nexora/supreme/matrix/execute",
];

const missingEndpoints = expectedEndpoints.filter((endpoint) => !supremeRoutes.includes(endpoint));
if (missingEndpoints.length) {
  console.error("Missing Supreme endpoints:", missingEndpoints);
  process.exit(1);
}

console.log("Nexora Supreme local check passed.");

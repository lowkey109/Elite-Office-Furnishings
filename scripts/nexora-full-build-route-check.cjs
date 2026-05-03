const fs = require("fs");

const routeFile = "server/routes.ts";

const registrars = [
  "registerNexoraAdvancedAutonomyRoutes",
  "registerNexoraGovernorBusinessRoutes",
  "registerNexoraOperationalAutopilotRoutes",
  "registerNexoraMissionControlRoutes",
  "registerNexoraSupremeMatrixRoutes",
  "registerNexoraMegaBuildRoutes",
];

if (!fs.existsSync(routeFile)) {
  console.error("Missing server/routes.ts");
  process.exit(1);
}

const routes = fs.readFileSync(routeFile, "utf8");
const missing = registrars.filter((name) => !routes.includes(name));

if (missing.length) {
  console.error("Missing route registrars:", missing);
  process.exit(1);
}

const files = [
  "server/services/intelligence/nexora/autonomy/persistence/nexoraDurableKernel.ts",
  "server/services/intelligence/nexora/autonomy/governor/nexoraAutonomyGovernor.ts",
  "server/services/intelligence/nexora/autonomy/business/nexoraBusinessPipelineEngine.ts",
  "server/services/intelligence/nexora/autonomy/autopilot/nexoraOperationalAutopilot.ts",
  "server/services/intelligence/nexora/autonomy/mission/nexoraMissionControl.ts",
  "server/services/intelligence/nexora/autonomy/supreme/nexoraSupremeOrchestrationMatrix.ts",
  "server/services/intelligence/nexora/autonomy/strategy/nexoraStrategyCompiler.ts",
  "server/services/intelligence/nexora/autonomy/finance/nexoraFinanceQuoteIntelligence.ts",
  "server/services/intelligence/nexora/autonomy/supplier/nexoraSupplierCommand.ts",
  "server/services/intelligence/nexora/autonomy/crm/nexoraCrmPipelineEngine.ts",
  "server/services/intelligence/nexora/autonomy/project/nexoraProjectOpsEngine.ts",
  "server/services/intelligence/nexora/autonomy/academy/nexoraAcademyEngine.ts",
  "server/services/intelligence/nexora/autonomy/cockpit/nexoraExecutiveCockpit.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraMegaBuildRoutes.ts",
];

const missingFiles = files.filter((file) => !fs.existsSync(file));

if (missingFiles.length) {
  console.error("Missing files:", missingFiles);
  process.exit(1);
}

console.log("Nexora full build route/file check passed.");

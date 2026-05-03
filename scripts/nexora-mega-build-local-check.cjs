const fs = require("fs");

const routeFile = "server/routes.ts";
const requiredRegistrar = "registerNexoraMegaBuildRoutes";

const files = [
  "server/services/intelligence/nexora/autonomy/finance/nexoraFinanceQuoteIntelligence.ts",
  "server/services/intelligence/nexora/autonomy/supplier/nexoraSupplierCommand.ts",
  "server/services/intelligence/nexora/autonomy/crm/nexoraCrmPipelineEngine.ts",
  "server/services/intelligence/nexora/autonomy/project/nexoraProjectOpsEngine.ts",
  "server/services/intelligence/nexora/autonomy/academy/nexoraAcademyEngine.ts",
  "server/services/intelligence/nexora/autonomy/cockpit/nexoraExecutiveCockpit.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraMegaBuildRoutes.ts",
];

const endpoints = [
  "/api/nexora/mega/status",
  "/api/nexora/mega/register-workers",
  "/api/nexora/finance/quote/analyse",
  "/api/nexora/finance/quote/queue",
  "/api/nexora/finance/revenue/forecast",
  "/api/nexora/supplier/matrix",
  "/api/nexora/supplier/rfq/draft",
  "/api/nexora/supplier/sweep",
  "/api/nexora/crm/lead/score",
  "/api/nexora/crm/followup/draft",
  "/api/nexora/crm/pipeline/queue",
  "/api/nexora/project/plan",
  "/api/nexora/project/queue",
  "/api/nexora/academy/module/create",
  "/api/nexora/academy/training/queue",
  "/api/nexora/cockpit/status",
  "/api/nexora/cockpit/executive",
  "/api/nexora/cockpit/burst",
];

if (!fs.existsSync(routeFile)) {
  console.error("Missing", routeFile);
  process.exit(1);
}

const routes = fs.readFileSync(routeFile, "utf8");

if (!routes.includes(requiredRegistrar)) {
  console.error("Missing registrar:", requiredRegistrar);
  process.exit(1);
}

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing file:", file);
    process.exit(1);
  }
}

const megaRoutes = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraMegaBuildRoutes.ts", "utf8");

const missingEndpoints = endpoints.filter((endpoint) => !megaRoutes.includes(endpoint));
if (missingEndpoints.length) {
  console.error("Missing endpoints:", missingEndpoints);
  process.exit(1);
}

const safetyTerms = [
  "nexoraBrain",
  "approval",
  "paper/sandbox",
  "bindingCommitment",
  "purchaseOrder",
];

const allSource = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const missingSafety = safetyTerms.filter((term) => !allSource.includes(term));

if (missingSafety.length) {
  console.error("Missing safety terms:", missingSafety);
  process.exit(1);
}

console.log("Nexora Mega Build 14-19 local check passed.");

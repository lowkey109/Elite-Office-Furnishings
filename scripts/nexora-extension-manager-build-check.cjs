const fs = require("fs");

const requiredFiles = [
  "server/services/intelligence/nexora/autonomy/extension/nexoraExtensionRegistry.ts",
  "server/services/intelligence/nexora/autonomy/extension/nexoraDependencyGraphInspector.ts",
  "server/services/intelligence/nexora/autonomy/extension/nexoraDuplicateRouteInspector.ts",
  "server/services/intelligence/nexora/autonomy/extension/nexoraSafePatchFramework.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraExtensionManagerRoutes.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routes = fs.readFileSync("server/routes.ts", "utf8");

const requiredRouteTerms = [
  "registerNexoraExtensionManagerRoutes",
  "/api/nexora/extensions/status",
];

for (const term of requiredRouteTerms) {
  if (!routes.includes(term) && !fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraExtensionManagerRoutes.ts", "utf8").includes(term)) {
    console.error("Missing route term", term);
    process.exit(1);
  }
}

console.log("Nexora extension manager Build 56-60 local check passed.");

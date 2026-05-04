const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/productimportexport/nexoraProductImportExportEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraProductImportExportRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraProductImportExportRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/product-import-export/status",
  "/api/nexora/product-import-export/products/csv",
  "/api/nexora/product-import-export/supplier-costs/json",
  "/api/nexora/product-import-export/validate",
  "/api/nexora/product-import-export/duplicates",
  "/api/nexora/product-import-export/quote/markdown",
  "/api/nexora/product-import-export/margin/csv",
  "/api/nexora/product-import-export/supplier-rfq/markdown",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraProductImportExportRoutes")) {
  console.error("Product import/export registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora product import/export build check passed.");

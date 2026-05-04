const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/productcatalogue/nexoraProductCatalogueEngine.ts",
  "server/services/intelligence/nexora/autonomy/quotepack/nexoraQuotePackGenerator.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraProductCatalogueQuoteRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraProductCatalogueQuoteRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/product-catalogue/status",
  "/api/nexora/product-catalogue/seed",
  "/api/nexora/product-catalogue/product/upsert",
  "/api/nexora/product-catalogue/product",
  "/api/nexora/product-catalogue/products",
  "/api/nexora/product-catalogue/supplier-cost/upsert",
  "/api/nexora/product-catalogue/supplier-costs",
  "/api/nexora/product-catalogue/bundle/create",
  "/api/nexora/product-catalogue/import/json",
  "/api/nexora/product-catalogue/export",
  "/api/nexora/quote-pack/status",
  "/api/nexora/quote-pack/create",
  "/api/nexora/quote-pack/customer-draft",
  "/api/nexora/quote-pack/list",
  "/api/nexora/quote-pack/approvals",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraProductCatalogueQuoteRoutes")) {
  console.error("Product catalogue registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora product catalogue quote build check passed.");

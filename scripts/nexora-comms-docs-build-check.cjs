const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/commsdocs/nexoraCommsDocsEngine.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraCommsDocsRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraCommsDocsRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/comms-docs/status",
  "/api/nexora/comms-docs/templates/seed",
  "/api/nexora/comms-docs/templates",
  "/api/nexora/comms-docs/draft",
  "/api/nexora/comms-docs/outbox",
  "/api/nexora/comms-docs/quote-document",
  "/api/nexora/comms-docs/customer-quote-draft",
  "/api/nexora/comms-docs/supplier-pack",
  "/api/nexora/comms-docs/approval-packet",
  "/api/nexora/comms-docs/send-queue",
  "/api/nexora/comms-docs/list",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraCommsDocsRoutes")) {
  console.error("Comms docs registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora comms docs build check passed.");

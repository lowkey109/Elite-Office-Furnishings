const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/emailapproval/nexoraHumanApprovedEmailOutbox.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraHumanApprovedEmailOutboxRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraHumanApprovedEmailOutboxRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/email-approval/status",
  "/api/nexora/email-approval/draft",
  "/api/nexora/email-approval/outbox",
  "/api/nexora/email-approval/mark-sent",
  "/api/nexora/email-approval/list",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraHumanApprovedEmailOutboxRoutes")) {
  console.error("Email approval registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora email approval outbox build check passed.");

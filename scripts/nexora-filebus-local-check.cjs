const fs = require("fs");

const routeFile = "server/routes.ts";
const engine = "server/services/intelligence/nexora/autonomy/filebus/nexoraFileBus.ts";
const routes = "server/services/intelligence/nexora/autonomy/routes/nexoraFileBusRoutes.ts";

for (const file of [routeFile, engine, routes]) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const mounted = fs.readFileSync(routeFile, "utf8");
if (!mounted.includes("registerNexoraFileBusRoutes")) {
  console.error("Filebus routes not mounted.");
  process.exit(1);
}

const source = fs.readFileSync(engine, "utf8") + fs.readFileSync(routes, "utf8");

const required = [
  "enqueueNexoraFileBusMessage",
  "scheduleNexoraDelayedJob",
  "processNexoraFileBus",
  "/api/nexora/filebus/status",
  "/api/nexora/filebus/enqueue",
  "/api/nexora/filebus/process",
];

const missing = required.filter((term) => !source.includes(term));
if (missing.length) {
  console.error("Missing filebus terms:", missing);
  process.exit(1);
}

console.log("Nexora filebus local check passed.");

const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/collectors/nexoraWebSocketCollectorRuntime.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraWebSocketCollectorRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraWebSocketCollectorRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/collectors/status",
  "/api/nexora/collectors/sample/start",
  "/api/nexora/collectors/sample/stop",
  "/api/nexora/collectors/binance/sample-tick",
  "/api/nexora/collectors/polymarket/sample-snapshot",
  "/api/nexora/collectors/sample-cycle",
  "/api/nexora/collectors/samples",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraWebSocketCollectorRoutes")) {
  console.error("Collector registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora websocket collector build check passed.");

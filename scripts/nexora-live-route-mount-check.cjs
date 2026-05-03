const fs = require("fs");

const routes = fs.readFileSync("server/routes.ts", "utf8");
const liveFile = "server/services/intelligence/nexora/autonomy/routes/nexoraLiveVerificationRoutes.ts";

if (!routes.includes("registerNexoraLiveVerificationRoutes")) {
  console.error("server/routes.ts does not mount registerNexoraLiveVerificationRoutes");
  process.exit(1);
}

if (!fs.existsSync(liveFile)) {
  console.error("Missing", liveFile);
  process.exit(1);
}

const live = fs.readFileSync(liveFile, "utf8");

const endpoints = [
  "/api/nexora/live/status",
  "/api/nexora/advanced/status",
  "/api/nexora/mega/status",
  "/api/nexora/cockpit/status",
  "/api/nexora/cockpit/burst",
  "/api/nexora/supreme/status",
  "/api/nexora/strategy/status",
];

const missing = endpoints.filter((endpoint) => !live.includes(endpoint));

if (missing.length) {
  console.error("Missing live endpoints:", missing);
  process.exit(1);
}

console.log("Nexora live route mount check passed.");

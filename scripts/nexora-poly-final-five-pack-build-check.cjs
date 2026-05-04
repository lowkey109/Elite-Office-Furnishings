const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/polyfinalfive/clobfill/nexoraClobSnapshotFillSimulator.ts",
  "server/services/intelligence/nexora/autonomy/polyfinalfive/pnldashboard/nexoraPaperPnlDashboardPolish.ts",
  "server/services/intelligence/nexora/autonomy/polyfinalfive/moondevtournament/nexoraMoonDevTournamentFromImported.ts",
  "server/services/intelligence/nexora/autonomy/polyfinalfive/killtests/nexoraKillSwitchStressTests.ts",
  "server/services/intelligence/nexora/autonomy/polyfinalfive/readiness/nexoraFinalPaperReadiness.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraPolyFinalFivePackRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraPolyFinalFivePackRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/poly-final-five/status",
  "/api/nexora/poly-final-five/clob-fill/simulate",
  "/api/nexora/poly-final-five/clob-fill/list",
  "/api/nexora/poly-final-five/pnl-dashboard/create",
  "/api/nexora/poly-final-five/pnl-dashboard/list",
  "/api/nexora/poly-final-five/moondev-tournament/run",
  "/api/nexora/poly-final-five/moondev-tournament/list",
  "/api/nexora/poly-final-five/kill-tests/run",
  "/api/nexora/poly-final-five/kill-tests/list",
  "/api/nexora/poly-final-five/readiness/create",
  "/api/nexora/poly-final-five/readiness/list",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraPolyFinalFivePackRoutes")) {
  console.error("Poly final five pack registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora Poly Final 5 Pack build check passed.");

const fs = require("fs");

const file = "server/index.ts";
let s = fs.readFileSync(file, "utf8");

const routeImports = [
  {
    symbol: "registerNexoraHardMountRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraHardMountRoutes",
  },
  {
    symbol: "registerNexoraActiveLocalLoopDaemonRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraActiveLocalLoopDaemonRoutes",
  },
  {
    symbol: "registerNexoraLocalActionExecutorRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraLocalActionExecutorRoutes",
  },
  {
    symbol: "registerNexoraLoopCoverageRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraLoopCoverageRoutes",
  },
  {
    symbol: "registerNexoraOfficeFurnitureAgentRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraOfficeFurnitureAgentRoutes",
  },
  {
    symbol: "registerNexoraHumanBoundaryDoctrineRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraHumanBoundaryDoctrineRoutes",
  },
  {
    symbol: "registerNexoraAICompanyOperatingCompletionRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraAICompanyOperatingCompletionRoutes",
  },
  {
    symbol: "registerNexoraTeachingRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraTeachingRoutes",
  },
  {
    symbol: "registerNexoraRewardRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraRewardRoutes",
  },
  {
    symbol: "registerNexoraPolymarketPaperRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraPolymarketPaperRoutes",
  },
  {
    symbol: "registerNexoraMarketDataPaperRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraMarketDataPaperRoutes",
  },
  {
    symbol: "registerNexoraBacktestSimulationRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraBacktestSimulationRoutes",
  },
  {
    symbol: "registerNexoraTradingExecutionSafetyRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraTradingExecutionSafetyRoutes",
  },
  {
    symbol: "registerNexoraTradingDashboardRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraTradingDashboardRoutes",
  },
  {
    symbol: "registerNexoraFinalLocalV1Routes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraFinalLocalV1Routes",
  },
  {
    symbol: "registerNexoraUnifiedAgentRuntimeRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraUnifiedAgentRuntimeRoutes",
  },
  {
    symbol: "registerNexoraSwarmConsensusRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraSwarmConsensusRoutes",
  },
  {
    symbol: "registerNexoraRiskGovernorRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraStandardRuntimeRoutes",
    optional: true,
  },
  {
    symbol: "registerNexoraProductCatalogueQuoteRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraProductCatalogueQuoteRoutes",
  },
  {
    symbol: "registerNexoraCommsDocsRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraCommsDocsRoutes",
  },
  {
    symbol: "registerNexoraHumanApprovedEmailOutboxRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraHumanApprovedEmailOutboxRoutes",
  },
  {
    symbol: "registerNexoraLocalCommandCenterRoutes",
    path: "./services/intelligence/nexora/autonomy/routes/nexoraLocalCommandCenterRoutes",
  },
];

const existingFiles = new Set();
for (const item of routeImports) {
  const tsPath = `server/${item.path.replace("./", "")}.ts`;
  if (fs.existsSync(tsPath)) {
    existingFiles.add(item.symbol);
  }
}

const importsToUse = routeImports.filter((item) => existingFiles.has(item.symbol));

for (const item of importsToUse) {
  const line = `import { ${item.symbol} } from "${item.path}";`;
  if (!s.includes(line)) {
    const matches = [...s.matchAll(/^import[^\n]*\n/gm)];
    const idx = matches.length ? matches[matches.length - 1].index + matches[matches.length - 1][0].length : 0;
    s = s.slice(0, idx) + line + "\n" + s.slice(idx);
  }
}

const markerStart = "// NEXORA_FINAL_DIRECT_API_MOUNT_BEGIN";
const markerEnd = "// NEXORA_FINAL_DIRECT_API_MOUNT_END";

const calls = importsToUse.map((item) => `  ${item.symbol}(app);`);

const block = `
// NEXORA_FINAL_DIRECT_API_MOUNT_BEGIN
try {
${calls.join("\n")}
  console.log("[NEXORA_FINAL_DIRECT_API_MOUNT] Critical Nexora routes mounted in server/index.ts");
} catch (error) {
  console.error("[NEXORA_FINAL_DIRECT_API_MOUNT_ERROR]", error);
}
// NEXORA_FINAL_DIRECT_API_MOUNT_END
`;

if (s.includes(markerStart) && s.includes(markerEnd)) {
  s = s.replace(
    /\/\/ NEXORA_FINAL_DIRECT_API_MOUNT_BEGIN[\s\S]*?\/\/ NEXORA_FINAL_DIRECT_API_MOUNT_END/,
    block.trim()
  );
} else {
  const appMarker = "const app = express();";
  const idx = s.indexOf(appMarker);
  if (idx === -1) {
    console.error("Could not find const app = express();");
    process.exit(1);
  }
  const insertAt = idx + appMarker.length;
  s = s.slice(0, insertAt) + "\n" + block + s.slice(insertAt);
}

fs.writeFileSync(file, s);

console.log("Direct mounted route registrars:", importsToUse.map((x) => x.symbol).join(", "));

const fs = require("fs");

const files = [
  "server/services/intelligence/nexora/autonomy/unifiedAgentRuntime/types/nexoraAgentRuntimeTypes.ts",
  "server/services/intelligence/nexora/autonomy/unifiedAgentRuntime/storage/nexoraJsonRuntimeStore.ts",
  "server/services/intelligence/nexora/autonomy/unifiedAgentRuntime/agents/BaseNexoraAgent.ts",
  "server/services/intelligence/nexora/autonomy/unifiedAgentRuntime/registry/nexoraAgentRegistry.ts",
  "server/services/intelligence/nexora/autonomy/unifiedAgentRuntime/tasks/nexoraAgentTaskManager.ts",
  "server/services/intelligence/nexora/autonomy/unifiedAgentRuntime/loops/nexoraAgentRuntimeLoop.ts",
  "server/services/intelligence/nexora/autonomy/routes/nexoraUnifiedAgentRuntimeRoutes.ts",
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error("Missing", file);
    process.exit(1);
  }
}

const routeSource = fs.readFileSync("server/services/intelligence/nexora/autonomy/routes/nexoraUnifiedAgentRuntimeRoutes.ts", "utf8");
const routesTs = fs.readFileSync("server/routes.ts", "utf8");

const endpoints = [
  "/api/nexora/agent-runtime-v2/status",
  "/api/nexora/agent-runtime-v2/start",
  "/api/nexora/agent-runtime-v2/stop",
  "/api/nexora/agent-runtime-v2/tick",
  "/api/nexora/agent-runtime-v2/agents/seed",
  "/api/nexora/agent-runtime-v2/agents/register",
  "/api/nexora/agent-runtime-v2/agents",
  "/api/nexora/agent-runtime-v2/tasks/create",
  "/api/nexora/agent-runtime-v2/tasks",
  "/api/nexora/agent-runtime-v2/heartbeat",
  "/api/nexora/agent-runtime-v2/heartbeats",
  "/api/nexora/agent-runtime-v2/memory/set",
  "/api/nexora/agent-runtime-v2/memory/get",
  "/api/nexora/agent-runtime-v2/memory/search",
  "/api/nexora/agent-runtime-v2/events",
];

for (const endpoint of endpoints) {
  if (!routeSource.includes(endpoint)) {
    console.error("Missing endpoint:", endpoint);
    process.exit(1);
  }
}

if (!routesTs.includes("registerNexoraUnifiedAgentRuntimeRoutes")) {
  console.error("Unified runtime registrar is not mounted.");
  process.exit(1);
}

console.log("Nexora unified agent runtime build check passed.");

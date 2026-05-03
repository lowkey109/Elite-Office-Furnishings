import { getNexoraLocalCoreStatus } from "../localcore/nexoraLocalCore";
import { getNexoraPolicyPack } from "../policy/nexoraPolicyPack";
import { getNexoraTimeline } from "../timeline/nexoraTimeline";
import { getNexoraMetrics } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

export function getNexoraOfflineOpsConsole() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_offline_ops_console",
    generatedAt: now(),
    localCore: getNexoraLocalCoreStatus(),
    policy: getNexoraPolicyPack(),
    timeline: getNexoraTimeline({ limit: 20 }),
    metrics: getNexoraMetrics({ limit: 20 }),
    posture: {
      dbIndependent: true,
      postgresCanBeFull: true,
      fallbackSafe: true,
      deployLater: true,
    },
  };
}

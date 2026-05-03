import { getNexoraLocalCoreStatus } from "../localcore/nexoraLocalCore";
import { validateNexoraLocalData } from "../validation/nexoraLocalDataValidator";
import { createNexoraRouteGovernanceSnapshot } from "../routegovernance/nexoraRouteGovernance";
import { getNexoraV1ReadinessReport } from "../readiness/nexoraV1Readiness";

function now() {
  return new Date().toISOString();
}

export function runNexoraLocalMonitorCheck() {
  const localCore = getNexoraLocalCoreStatus();
  const validation = validateNexoraLocalData();
  const routes = createNexoraRouteGovernanceSnapshot();
  const readiness = getNexoraV1ReadinessReport();

  const warnings: string[] = [];

  if (!validation.ok) warnings.push("Local data validation has failures.");
  if (routes.snapshot.duplicateCount > 0) warnings.push("Duplicate routes detected.");
  if (readiness.score < 80) warnings.push("V1 readiness score below 80.");

  return {
    ok: warnings.length === 0,
    nexoraBrain: true,
    service: "nexora_local_monitor",
    generatedAt: now(),
    warnings,
    localCore,
    validation,
    routes,
    readiness,
  };
}

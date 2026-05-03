import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { inspectNexoraLocalStorage } from "../storageguard/nexoraLocalStorageGuard";
import { runNexoraLocalCompactionDryRun } from "../compaction/nexoraLocalCompactionEngine";
import { simulateNexoraWorkflow } from "../simulation/nexoraWorkflowSimulator";

function now() {
  return new Date().toISOString();
}

export function createNexoraMaintenancePlan(input: any = {}) {
  const planId = String(input.planId || nexoraLocalId("maintenance"));
  const storage = inspectNexoraLocalStorage({});
  const compaction = runNexoraLocalCompactionDryRun({});
  const simulation = simulateNexoraWorkflow({});

  const actions = [
    storage.warning ? "Review local storage and archive old files." : "Storage is acceptable.",
    compaction.plan.candidateCount > 0 ? "Run compaction dry-run review before applying any archive operation." : "No compaction candidates.",
    simulation.heldForApproval > 0 ? "Review approval-held workflow steps." : "Workflow simulation is hands-free.",
    "Do not deploy while Postgres is full.",
    "After Postgres upgrade, run migration/replay dry-runs.",
  ];

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_maintenance_planner",
    planId,
    createdAt: now(),
    storage,
    compaction,
    simulation,
    actions,
    safety: {
      noDeploy: true,
      noDelete: true,
      dryRunFirst: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("maintenance", `${planId}.json`), plan);

  return {
    ok: true,
    nexoraBrain: true,
    plan,
  };
}

export function getNexoraMaintenancePlannerStatus() {
  const plan = createNexoraMaintenancePlan({ planId: "latest" }).plan;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_maintenance_planner_status",
    actionCount: plan.actions.length,
    storageWarning: plan.storage.warning,
    compactionCandidates: plan.compaction.plan.candidateCount,
  };
}

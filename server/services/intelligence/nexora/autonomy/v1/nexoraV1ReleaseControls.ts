import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraV1ReadinessReport } from "../readiness/nexoraV1Readiness";
import { runNexoraLocalMonitorCheck } from "../localmonitor/nexoraLocalMonitor";
import { createNexoraMigrationChecklist } from "../migrationpack/nexoraMigrationPackBuilder";

function now() {
  return new Date().toISOString();
}

export function createNexoraV1ReleaseCandidate(input: any = {}) {
  const releaseId = String(input.releaseId || nexoraLocalId("release"));
  const readiness = getNexoraV1ReadinessReport();
  const monitor = runNexoraLocalMonitorCheck();
  const migrationChecklist = createNexoraMigrationChecklist();

  const blockers: string[] = [];

  if (readiness.score < 85) blockers.push("Readiness score below 85.");
  if (!monitor.ok) blockers.push("Local monitor has warnings.");
  if (input.postgresReady !== true) blockers.push("Postgres not marked ready.");

  const candidate = {
    ok: blockers.length === 0,
    nexoraBrain: true,
    releaseId,
    version: String(input.version || "v1-local-candidate"),
    createdAt: now(),
    blockers,
    readiness,
    monitor,
    migrationChecklist,
    safety: {
      deployBlockedWhilePostgresFull: input.postgresReady !== true,
      noLiveTrading: true,
      highRiskApprovalGated: true,
    },
  };

  const file = nexoraLocalPath("v1", `${releaseId}.json`);
  writeNexoraJson(file, candidate);

  return {
    ok: true,
    nexoraBrain: true,
    file,
    candidate,
  };
}

export function getNexoraV1ReleaseGate(input: any = {}) {
  const candidate = createNexoraV1ReleaseCandidate({
    version: input.version || "v1-local-gate-check",
    postgresReady: Boolean(input.postgresReady),
  }).candidate;

  return {
    ok: candidate.blockers.length === 0,
    nexoraBrain: true,
    service: "nexora_v1_release_gate",
    candidate,
    decision: candidate.blockers.length
      ? "blocked"
      : "ready_for_manual_review",
  };
}

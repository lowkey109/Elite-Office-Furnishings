import { getNexoraLocalCoreStatus } from "../localcore/nexoraLocalCore";
import { getNexoraLocalDataValidatorStatus, validateNexoraLocalData } from "../validation/nexoraLocalDataValidator";

function now() {
  return new Date().toISOString();
}

function optionalCall(label: string, loader: () => any) {
  try {
    return {
      ok: true,
      label,
      result: loader(),
    };
  } catch (error) {
    return {
      ok: false,
      label,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getNexoraV1ReadinessReport() {
  const localCore = optionalCall("local_core", () => getNexoraLocalCoreStatus());
  const validatorStatus = optionalCall("validator_status", () => getNexoraLocalDataValidatorStatus());
  const validation = optionalCall("local_data_validation", () => validateNexoraLocalData({}));

  const optionalSystems = [
    optionalCall("workflow_templates", () => require("../localworkflows/nexoraWorkflowTemplates").getNexoraWorkflowStatus()),
    optionalCall("local_scoring", () => require("../scoring/nexoraLocalScoring").getNexoraLocalScoringStatus()),
    optionalCall("security_scaffold", () => require("../security/nexoraLocalSecurityScaffold").getNexoraSecurityScaffoldStatus()),
    optionalCall("route_governance", () => require("../routegovernance/nexoraRouteGovernance").listNexoraRouteGovernanceSnapshots({ limit: 5 })),
  ];

  const checks = [
    localCore,
    validatorStatus,
    validation,
    ...optionalSystems,
  ];

  const passed = checks.filter((check: any) => check.ok).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    ok: score >= 60,
    nexoraBrain: true,
    service: "nexora_v1_readiness",
    generatedAt: now(),
    score,
    checks,
    remainingBeforeV1: [
      "Postgres storage upgrade",
      "Replay migration dry-runs",
      "Auth enforcement hardening",
      "Production backup and restore verification",
      "Final admin cockpit polish",
    ],
    safety: {
      noDeployWhilePostgresFull: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
    },
  };
}

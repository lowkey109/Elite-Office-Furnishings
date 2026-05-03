import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";

function now() {
  return new Date().toISOString();
}

export function simulateNexoraWorkflow(input: any = {}) {
  const simulationId = String(input.simulationId || nexoraLocalId("workflow_sim"));
  const steps = Array.isArray(input.steps) && input.steps.length
    ? input.steps
    : [
        { name: "capture_lead", area: "office", action: "capture_lead", risk: "safe" },
        { name: "draft_quote", area: "office", action: "draft_quote", risk: "medium", customerFacing: true },
        { name: "supplier_sweep", area: "procurement", action: "supplier_sweep", risk: "medium" },
        { name: "approval_gate", area: "safety", action: "approve_quote_or_supplier_commitment", risk: "high", bindingCommitment: true },
        { name: "crm_followup", area: "crm", action: "followup", risk: "safe" },
      ];

  const simulated = steps.map((step: any, index: number) => {
    const policy = evaluateNexoraPolicy(step);
    const approvalRequired = Boolean(step.approvalRequired || policy.approvalRequired || step.risk === "high" || step.risk === "critical");

    return {
      index,
      step,
      policy,
      approvalRequired,
      handsFree: !approvalRequired,
      status: approvalRequired ? "held_for_approval" : "safe_to_queue",
    };
  });

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_workflow_simulator",
    simulationId,
    generatedAt: now(),
    stepCount: simulated.length,
    handsFree: simulated.filter((row: any) => row.handsFree).length,
    heldForApproval: simulated.filter((row: any) => row.approvalRequired).length,
    simulated,
    safety: {
      dryRunOnly: true,
      noExecution: true,
      approvalGatesPreserved: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("simulation", `${simulationId}.json`), report);

  return report;
}

export function getNexoraWorkflowSimulatorStatus() {
  const report = simulateNexoraWorkflow({ simulationId: "latest" });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_workflow_simulator_status",
    handsFree: report.handsFree,
    heldForApproval: report.heldForApproval,
  };
}

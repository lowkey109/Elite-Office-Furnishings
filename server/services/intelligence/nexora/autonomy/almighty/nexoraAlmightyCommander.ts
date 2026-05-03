import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { compileNexoraGoal } from "../goalcompiler/nexoraGoalCompiler";
import { createNexoraPlaybook, runNexoraPlaybookDryRun } from "../playbooks/nexoraPlaybookRunner";
import { runNexoraRiskSimulation } from "../risksim/nexoraRiskSimulator";
import { createNexoraMaintenancePlan } from "../maintenance/nexoraMaintenancePlanner";
import { inspectNexoraLocalStorage } from "../storageguard/nexoraLocalStorageGuard";

function now() {
  return new Date().toISOString();
}

export function createNexoraAlmightyCommand(input: any = {}) {
  const commandId = String(input.commandId || nexoraLocalId("almighty"));
  const intent = String(input.intent || "full_empire_local");

  const goal = compileNexoraGoal({
    intent,
    budget: input.budget || 25000,
  });

  const playbook = createNexoraPlaybook({
    name: `Almighty command playbook: ${intent}`,
    goal: {
      intent,
      budget: input.budget || 25000,
    },
  });

  const dryRun = runNexoraPlaybookDryRun({
    playbookId: playbook.playbookId,
  });

  const riskSimulation = runNexoraRiskSimulation({});
  const maintenance = createNexoraMaintenancePlan({});
  const storage = inspectNexoraLocalStorage({});

  const safeSteps = Number((dryRun as any)?.safeSteps || 0);
  const heldSteps = Number((dryRun as any)?.heldSteps || 0);
  const riskApprovalRequired = Number((riskSimulation as any)?.approvalRequired || 0);

  const command = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_almighty_commander",
    commandId,
    intent,
    createdAt: now(),
    goal,
    playbook,
    dryRun,
    riskSimulation,
    maintenance,
    storage,
    decision: {
      canRunHandsFree: heldSteps === 0 && riskApprovalRequired === 0,
      heldForApproval: heldSteps + riskApprovalRequired,
      deployAllowed: false,
      reason: "No deploy while Postgres is full. Local-only dry-run command prepared.",
    },
    safety: {
      noDeploy: true,
      dryRunOnly: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
    },
  };

  const file = nexoraLocalPath("almighty", `${commandId}.json`);
  writeNexoraJson(file, command);

  return {
    ok: true,
    nexoraBrain: true,
    file,
    command,
  };
}

export function getNexoraAlmightyStatus() {
  const command = createNexoraAlmightyCommand({
    commandId: "latest",
    intent: "full_empire_local",
  }).command;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_almighty_status",
    canRunHandsFree: command.decision.canRunHandsFree,
    heldForApproval: command.decision.heldForApproval,
    deployAllowed: false,
    postgresRequired: false,
  };
}

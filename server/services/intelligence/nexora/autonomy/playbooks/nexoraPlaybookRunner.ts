import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { compileNexoraGoal } from "../goalcompiler/nexoraGoalCompiler";
import { evaluateNexoraDecisionRules } from "../rules/nexoraDecisionRuleEngine";
import { simulateNexoraWorkflow } from "../simulation/nexoraWorkflowSimulator";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const PLAYBOOK_LOG = nexoraLocalPath("playbooks", "playbook-log.jsonl");

export function createNexoraPlaybook(input: any = {}) {
  const playbookId = String(input.playbookId || nexoraLocalId("playbook"));
  const name = String(input.name || "Nexora local empire playbook");
  const goal = compileNexoraGoal(input.goal || { intent: "full_empire_local" });

  const playbook = {
    ok: true,
    nexoraBrain: true,
    playbookId,
    name,
    createdAt: now(),
    goal,
    stages: [
      { name: "compile_goal", status: "planned" },
      { name: "simulate_risk", status: "planned" },
      { name: "evaluate_rules", status: "planned" },
      { name: "queue_safe_local_actions", status: "planned" },
      { name: "hold_high_risk_for_approval", status: "planned" },
      { name: "record_metrics", status: "planned" },
    ],
    safety: {
      noExecutionAgainstExternalSystems: true,
      localOnly: true,
      approvalGatesPreserved: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("playbooks", `${playbookId}.json`), playbook);
  appendNexoraJsonl(PLAYBOOK_LOG, {
    event: "playbook.created",
    playbook,
    createdAt: now(),
  });

  return playbook;
}

export function runNexoraPlaybookDryRun(input: any = {}) {
  const playbook = input.playbookId
    ? readNexoraJson(nexoraLocalPath("playbooks", `${input.playbookId}.json`), null)
    : createNexoraPlaybook(input);

  if (!playbook) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "Playbook not found.",
      playbookId: input.playbookId,
    };
  }

  const simulation = simulateNexoraWorkflow({
    steps: playbook.goal.steps,
  });

  const ruleEvaluations = playbook.goal.steps.map((step: any) =>
    evaluateNexoraDecisionRules(step),
  );

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_playbook_runner",
    runId: nexoraLocalId("playbook_run"),
    playbookId: playbook.playbookId,
    dryRun: true,
    createdAt: now(),
    simulation,
    ruleEvaluations,
    safeSteps: simulation.simulated.filter((row: any) => row.handsFree).length,
    heldSteps: simulation.simulated.filter((row: any) => row.approvalRequired).length,
  };

  appendNexoraJsonl(PLAYBOOK_LOG, {
    event: "playbook.dry_run",
    result,
    createdAt: now(),
  });

  recordNexoraMetric({
    name: "playbook_dry_run",
    value: 1,
    unit: "run",
    dimensions: {
      heldSteps: result.heldSteps,
      safeSteps: result.safeSteps,
    },
  });

  return result;
}

export function listNexoraPlaybooks(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(PLAYBOOK_LOG)
    .filter((row: any) => row.event === "playbook.created")
    .map((row: any) => row.playbook)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraPlaybookStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_playbook_runner_status",
    totalPlaybooks: listNexoraPlaybooks({ limit: 1000 }).count,
  };
}

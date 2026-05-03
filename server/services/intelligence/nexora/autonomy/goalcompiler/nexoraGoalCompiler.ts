import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const GOAL_LOG = nexoraLocalPath("goals", "goal-log.jsonl");

type GoalIntent =
  | "grow_sales"
  | "quote_faster"
  | "improve_supplier_confidence"
  | "recover_from_db_full"
  | "prepare_v1_release"
  | "run_safe_local_ops"
  | "full_empire_local";

function normaliseIntent(value: any): GoalIntent {
  const allowed: GoalIntent[] = [
    "grow_sales",
    "quote_faster",
    "improve_supplier_confidence",
    "recover_from_db_full",
    "prepare_v1_release",
    "run_safe_local_ops",
    "full_empire_local",
  ];

  const text = String(value || "full_empire_local");
  return allowed.includes(text as GoalIntent) ? text as GoalIntent : "full_empire_local";
}

export function compileNexoraGoal(input: any = {}) {
  const goalId = String(input.goalId || nexoraLocalId("goal"));
  const intent = normaliseIntent(input.intent);
  const budget = Number(input.budget || 25000);

  const steps: any[] = [];

  function add(step: any) {
    const policy = evaluateNexoraPolicy(step);
    steps.push({
      stepId: nexoraLocalId("goal_step"),
      ...step,
      policy,
      approvalRequired:
        Boolean(step.approvalRequired) ||
        Boolean(policy.approvalRequired) ||
        step.risk === "high" ||
        step.risk === "critical",
    });
  }

  add({
    name: "Capture operating baseline",
    area: "reporting",
    worker: "nexora_commander",
    action: "capture_local_status",
    risk: "safe",
    priority: 90,
  });

  if (["grow_sales", "quote_faster", "full_empire_local"].includes(intent)) {
    add({
      name: "Create lead-to-quote workflow",
      area: "office",
      worker: "office_receptionist",
      action: "prepare_lead_to_quote_path",
      risk: "medium",
      priority: 88,
      payload: { budget },
    });

    add({
      name: "Quote approval gate",
      area: "safety",
      worker: "nexora_execution_gate",
      action: "review_customer_facing_quote",
      risk: budget >= 25000 ? "high" : "medium",
      priority: 96,
      payload: { customerFacing: true, quoteTotal: budget, bindingCommitment: budget >= 25000 },
    });
  }

  if (["improve_supplier_confidence", "full_empire_local"].includes(intent)) {
    add({
      name: "Supplier confidence sweep",
      area: "procurement",
      worker: "supplier_negotiator",
      action: "collect_supplier_confidence_without_commitment",
      risk: "medium",
      priority: 86,
      payload: { purchaseOrder: false, bindingCommitment: false },
    });

    add({
      name: "Block purchase order without approval",
      area: "safety",
      worker: "nexora_execution_gate",
      action: "review_supplier_commitment",
      risk: "high",
      priority: 98,
      payload: { purchaseOrder: true, bindingCommitment: true },
    });
  }

  if (["recover_from_db_full", "prepare_v1_release", "full_empire_local"].includes(intent)) {
    add({
      name: "Create local recovery plan",
      area: "maintenance",
      worker: "nexora_maintenance_planner",
      action: "create_recovery_plan",
      risk: "safe",
      priority: 92,
    });

    add({
      name: "Create migration dry-run plan",
      area: "migration",
      worker: "nexora_migration_planner",
      action: "plan_local_to_postgres_replay",
      risk: "medium",
      priority: 90,
    });
  }

  if (["run_safe_local_ops", "full_empire_local"].includes(intent)) {
    add({
      name: "Run local workflow simulation",
      area: "simulation",
      worker: "nexora_workflow_simulator",
      action: "simulate_safe_local_operations",
      risk: "safe",
      priority: 84,
    });
  }

  const compiled = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_goal_compiler",
    goalId,
    intent,
    budget,
    createdAt: now(),
    stepCount: steps.length,
    approvalRequiredSteps: steps.filter((step: any) => step.approvalRequired).length,
    steps,
    safety: {
      localOnly: true,
      noDeploy: true,
      noPostgresRequired: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
    },
  };

  writeNexoraJson(nexoraLocalPath("goals", `${goalId}.json`), compiled);
  appendNexoraJsonl(GOAL_LOG, {
    event: "goal.compiled",
    compiled,
    createdAt: now(),
  });

  recordNexoraTimelineEvent({
    type: "goal",
    title: `Goal compiled: ${intent}`,
    severity: compiled.approvalRequiredSteps > 0 ? "warning" : "info",
    payload: { goalId, intent, approvalRequiredSteps: compiled.approvalRequiredSteps },
  });

  return compiled;
}

export function listNexoraCompiledGoals(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(GOAL_LOG)
    .filter((row: any) => row.event === "goal.compiled")
    .map((row: any) => row.compiled)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraGoalCompilerStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_goal_compiler_status",
    totalGoals: listNexoraCompiledGoals({ limit: 1000 }).count,
  };
}

import {
  createNexoraDelegation,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  sendNexoraWorkerMessage,
  upsertNexoraWorker,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";
import { governAndQueueNexoraAction } from "../governor/nexoraAutonomyGovernor";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function registerNexoraProjectWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_project_ops",
      area: "project",
      capabilities: ["project_plan", "milestone_tracking", "install_risk", "handover"],
    },
    {
      worker: "nexora_fitout_risk_mapper",
      area: "fitouts",
      capabilities: ["site_access", "install_constraints", "after_hours_risk", "delivery_path"],
    },
    {
      worker: "nexora_delivery_coordinator",
      area: "operations",
      capabilities: ["delivery_plan", "supplier_delivery", "customer_window", "handover_checklist"],
    },
  ];

  for (const worker of workers) {
    await upsertNexoraWorker({
      worker: worker.worker,
      area: worker.area,
      status: "idle",
      capabilities: worker.capabilities,
      metadata: {
        seededBy: "nexora_mega_build_17",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "project_workers",
    "info",
    "Nexora project ops workers registered",
    `Registered ${workers.length} project workers.`,
    { workers }
  );

  return { ok: true, nexoraBrain: true, workers };
}

export function createNexoraProjectPlan(input: any = {}) {
  const projectId = String(input.projectId || id("project"));
  const leadId = String(input.leadId || id("lead"));
  const complexity = String(input.complexity || "medium");

  const stages = [
    {
      stage: "Qualification",
      ownerWorker: "office_receptionist",
      exitCriteria: ["Customer contact confirmed", "Need captured", "Budget or range captured"],
    },
    {
      stage: "Scope",
      ownerWorker: "nexora_fitout_risk_mapper",
      exitCriteria: ["Location confirmed", "Site access captured", "Install constraints captured"],
    },
    {
      stage: "Quote",
      ownerWorker: "quote_builder",
      exitCriteria: ["Draft quote created", "Margin checked", "Approval state known"],
    },
    {
      stage: "Supplier",
      ownerWorker: "supplier_negotiator",
      exitCriteria: ["Stock confirmed", "Lead time confirmed", "Cost confirmed"],
    },
    {
      stage: "Delivery",
      ownerWorker: "nexora_delivery_coordinator",
      exitCriteria: ["Delivery window confirmed", "Access path confirmed", "Customer notified"],
    },
    {
      stage: "Handover",
      ownerWorker: "nexora_project_ops",
      exitCriteria: ["Completion confirmed", "Issues recorded", "Learning captured"],
    },
  ];

  const risk = complexity === "high" ? "high" : complexity === "low" ? "low" : "medium";

  return {
    ok: true,
    nexoraBrain: true,
    projectId,
    leadId,
    createdAt: now(),
    complexity,
    risk,
    approvalRequired: risk === "high",
    stages,
    safety: {
      installCommitmentsApprovalGated: risk === "high",
      supplierCommitmentsApprovalGated: true,
    },
  };
}

export async function queueNexoraProjectOps(input: any = {}) {
  await ensureNexoraDurableKernel();
  await registerNexoraProjectWorkers();

  const plan = createNexoraProjectPlan(input);

  const projectTask = await createNexoraDurableTask({
    worker: plan.approvalRequired ? "nexora_execution_gate" : "nexora_project_ops",
    area: plan.approvalRequired ? "safety" : "project",
    action: "register_project_plan_and_stage_tasks",
    risk: plan.risk as any,
    priority: plan.approvalRequired ? 94 : 80,
    payload: plan,
    approvalRequired: plan.approvalRequired,
    source: "nexora.project_ops",
  });

  for (const stage of plan.stages) {
    await createNexoraDurableTask({
      worker: stage.ownerWorker,
      area: stage.ownerWorker.includes("supplier") ? "procurement" : stage.ownerWorker.includes("fitout") ? "fitouts" : "project",
      action: `project_stage_${stage.stage.toLowerCase()}`,
      risk: "medium",
      priority: 72,
      payload: { projectId: plan.projectId, stage },
      source: "nexora.project_ops.stage",
    });

    await createNexoraMemoryGraphEdge({
      sourceType: "project",
      sourceId: plan.projectId,
      relation: "depends_on",
      targetType: "worker",
      targetId: stage.ownerWorker,
      weight: 1,
      payload: stage,
    });
  }

  await createNexoraDivisionObjective({
    area: "project",
    objective: `Move project ${plan.projectId} through staged delivery safely.`,
    metric: "project_stages_completed",
    target: `${plan.stages.length} stages with risk gates preserved`,
    ownerWorker: "nexora_project_ops",
    priority: 82,
    payload: plan,
  });

  await writeNexoraOperatingReport(
    "project_ops",
    plan.approvalRequired ? "warning" : "info",
    "Nexora project ops plan queued",
    `Project ${plan.projectId} queued with ${plan.stages.length} stages.`,
    { plan, projectTask }
  );

  return { ok: true, nexoraBrain: true, plan, projectTask };
}

export async function getNexoraProjectStatus() {
  await ensureNexoraDurableKernel();
  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_project_ops",
    capabilities: [
      "Project planning",
      "Fitout risk mapping",
      "Delivery coordination",
      "Stage task generation",
    ],
    snapshot,
  };
}

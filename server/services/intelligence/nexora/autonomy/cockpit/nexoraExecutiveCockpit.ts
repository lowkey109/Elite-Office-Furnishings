import {
  claimAndRunNexoraSafeTasks,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  upsertNexoraWorker,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";
import { forecastNexoraRevenue } from "../finance/nexoraFinanceQuoteIntelligence";
import { queueNexoraSupplierSweep } from "../supplier/nexoraSupplierCommand";
import { queueNexoraCrmPipeline } from "../crm/nexoraCrmPipelineEngine";
import { queueNexoraProjectOps } from "../project/nexoraProjectOpsEngine";
import { queueNexoraTraining } from "../academy/nexoraAcademyEngine";
import { executeCompiledNexoraStrategy, queryNexoraNeuralMemory } from "../strategy/nexoraStrategyCompiler";
import { executeNexoraSupremeMatrix } from "../supreme/nexoraSupremeOrchestrationMatrix";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function registerNexoraCockpitWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_executive_cockpit",
      area: "reporting",
      capabilities: ["executive_summary", "cross_layer_command", "business_operating_dashboard"],
    },
    {
      worker: "nexora_board_reporter",
      area: "reporting",
      capabilities: ["board_summary", "risk_summary", "growth_summary", "approval_summary"],
    },
  ];

  for (const worker of workers) {
    await upsertNexoraWorker({
      worker: worker.worker,
      area: worker.area,
      status: "idle",
      capabilities: worker.capabilities,
      metadata: {
        seededBy: "nexora_mega_build_19",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "cockpit_workers",
    "info",
    "Nexora Executive Cockpit workers registered",
    `Registered ${workers.length} cockpit workers.`,
    { workers }
  );

  return { ok: true, nexoraBrain: true, workers };
}

export async function getNexoraExecutiveCockpit(input: any = {}) {
  await ensureNexoraDurableKernel();
  await registerNexoraCockpitWorkers();

  const snapshot = await getNexoraDurableCommandSnapshot();
  const memory = await queryNexoraNeuralMemory({
    subject: "executive_cockpit",
    intent: "executive_next_best_action",
  });

  const revenue = await forecastNexoraRevenue({
    opportunities: input.opportunities,
  });

  const cockpit = {
    ok: true,
    nexoraBrain: true,
    cockpitId: id("cockpit"),
    generatedAt: now(),
    snapshot,
    memory,
    revenue,
    executiveSummary: {
      operatingPosture: "Nexora single-brain autonomous operating system",
      safety: "High-risk actions approval-gated. Phantom X paper/sandbox.",
      businessFocus: "Office furniture, fitouts, procurement, CRM, project delivery, learning, and reporting.",
      recommendedNextActions: memory.recommendations || [],
    },
  };

  await createNexoraDurableTask({
    worker: "nexora_board_reporter",
    area: "reporting",
    action: "record_executive_cockpit_snapshot",
    risk: "safe",
    priority: 80,
    payload: cockpit,
    source: "nexora.executive_cockpit",
  });

  await writeNexoraOperatingReport(
    "executive_cockpit",
    "info",
    "Nexora Executive Cockpit generated",
    `Executive cockpit ${cockpit.cockpitId} generated.`,
    cockpit
  );

  return cockpit;
}

export async function runNexoraExecutiveOperatingBurst(input: any = {}) {
  await ensureNexoraDurableKernel();
  await registerNexoraCockpitWorkers();

  const burstId = id("burst");

  const crm = await queueNexoraCrmPipeline(input.lead || {
    customerName: "Mega Build Lead",
    companyName: "Mega Build Office Pty Ltd",
    need: "Office furniture and fitout package",
    budget: 28000,
    urgency: "high",
    location: "Brisbane",
    email: "lead@example.com",
    timeline: "4 weeks",
  });

  const supplier = await queueNexoraSupplierSweep(input.supplier || {});
  const project = await queueNexoraProjectOps(input.project || {
    leadId: crm.lead.leadId,
    complexity: "medium",
  });
  const training = await queueNexoraTraining(input.training || {
    targetWorker: "office_receptionist",
    topic: "office furniture lead-to-quote pipeline",
  });

  const strategy = await executeCompiledNexoraStrategy({
    intent: input.intent || "full_business_empire",
    budget: input.budget || 28000,
    safeRunLimit: input.safeRunLimit || 80,
  });

  const supreme = await executeNexoraSupremeMatrix({
    mode: input.supremeMode || "full_matrix",
    budget: input.budget || 28000,
    safeRunLimit: input.safeRunLimit || 80,
  });

  const execution = await claimAndRunNexoraSafeTasks(Number(input.safeRunLimit || 90));
  const cockpit = await getNexoraExecutiveCockpit(input);

  await createNexoraDivisionObjective({
    area: "operations",
    objective: `Complete executive operating burst ${burstId}.`,
    metric: "executive_burst_safe_execution",
    target: `executed ${execution.executed}, held ${execution.held}`,
    ownerWorker: "nexora_executive_cockpit",
    priority: 96,
    payload: {
      burstId,
      execution,
    },
  });

  await writeNexoraOperatingReport(
    "executive_operating_burst",
    execution.held > 0 ? "warning" : "info",
    "Nexora executive operating burst completed",
    `Burst ${burstId} completed. Executed ${execution.executed}, held ${execution.held}.`,
    {
      burstId,
      crm,
      supplier,
      project,
      training,
      strategy,
      supreme,
      execution,
      cockpit,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    burstId,
    crm,
    supplier,
    project,
    training,
    strategy,
    supreme,
    execution,
    cockpit,
    safety: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      supplierCommitmentsApprovalGated: true,
      customerBindingCommitmentsApprovalGated: true,
      tradingMode: "paper/sandbox",
    },
  };
}

export async function getNexoraCockpitStatus() {
  await ensureNexoraDurableKernel();
  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_executive_cockpit",
    capabilities: [
      "Executive snapshot",
      "Operating burst",
      "Cross-layer command",
      "Board-style summary",
    ],
    snapshot,
  };
}

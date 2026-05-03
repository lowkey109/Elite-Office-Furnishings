import {
  createNexoraDelegation,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
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

function money(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function createNexoraBusinessPipeline(input: any = {}) {
  await ensureNexoraDurableKernel();

  const leadId = String(input.leadId || id("lead"));
  const need = String(input.need || "office furniture and fitout requirement");
  const budget = money(input.budget, 12000);
  const companyName = String(input.companyName || "Unknown company");
  const customerName = String(input.customerName || "Unknown customer");
  const urgency = String(input.urgency || "medium");
  const location = String(input.location || "unknown location");

  await upsertNexoraWorker({
    worker: "nexora_business_pipeline_engine",
    area: "operations",
    status: "busy",
    capabilities: ["lead_pipeline", "quote_pipeline", "procurement_pipeline", "crm_pipeline", "project_pipeline"],
    metadata: {
      activeLeadId: leadId,
      startedAt: now(),
    },
  });

  const quoteTotal = budget;
  const estimatedCost = Math.round(quoteTotal * 0.62 * 100) / 100;
  const marginAmount = Math.round((quoteTotal - estimatedCost) * 100) / 100;
  const marginPercent = quoteTotal > 0 ? Math.round((marginAmount / quoteTotal) * 10000) / 100 : 0;
  const gst = Math.round(quoteTotal * 0.1 * 100) / 100;

  const quoteDraft = {
    quoteId: id("quote"),
    leadId,
    customerName,
    companyName,
    need,
    location,
    urgency,
    currency: "AUD",
    subtotal: quoteTotal,
    estimatedCost,
    marginAmount,
    marginPercent,
    gst,
    total: Math.round((quoteTotal + gst) * 100) / 100,
    assumptions: [
      "Draft quote only until supplier confirmation.",
      "No customer-facing binding commitment until approval when thresholds apply.",
      "Delivery, installation, access, electrical, and after-hours constraints may change price.",
    ],
    createdAt: now(),
  };

  const crmAction = {
    crmActionId: id("crm"),
    leadId,
    status: "open",
    ownerWorker: "crm_pipeline_worker",
    nextAction: "Confirm scope, budget, decision maker, timeline, location, and installation constraints.",
    due: "next_business_cycle",
    createdAt: now(),
  };

  const procurementPlan = {
    procurementId: id("proc"),
    leadId,
    ownerWorker: "supplier_negotiator",
    supplierQuestions: [
      "Confirm stock availability.",
      "Confirm unit cost and volume discount.",
      "Confirm lead time.",
      "Confirm delivery cost.",
      "Confirm warranty.",
      "Confirm equivalent alternatives.",
    ],
    noBindingCommitment: true,
    createdAt: now(),
  };

  const projectPlan = {
    projectId: id("project"),
    leadId,
    stages: [
      "Qualification",
      "Scope capture",
      "Quote draft",
      "Supplier confirmation",
      "Approval gate",
      "Customer follow-up",
      "Project handover",
    ],
    createdAt: now(),
  };

  const governedQuote = await governAndQueueNexoraAction({
    area: "office",
    action: "prepare_customer_quote_draft",
    priority: urgency === "high" ? 92 : 82,
    payload: {
      leadId,
      quoteDraft,
      customerFacing: true,
      quoteTotal: quoteDraft.total,
      bindingCommitment: false,
    },
  });

  const governedProcurement = await governAndQueueNexoraAction({
    area: "procurement",
    action: "request_supplier_pricing_without_commitment",
    priority: 85,
    payload: {
      leadId,
      procurementPlan,
      bindingCommitment: false,
      purchaseOrder: false,
    },
  });

  const crmTask = await createNexoraDurableTask({
    worker: "crm_pipeline_worker",
    area: "crm",
    action: "create_or_update_crm_next_action",
    risk: "medium",
    priority: 78,
    payload: crmAction,
    source: "nexora.business_pipeline",
  });

  const projectTask = await createNexoraDurableTask({
    worker: "fitout_scope_worker",
    area: "fitouts",
    action: "prepare_fitout_scope_and_project_plan",
    risk: "medium",
    priority: 76,
    payload: projectPlan,
    source: "nexora.business_pipeline",
  });

  const messageToReception = await sendNexoraWorkerMessage({
    fromWorker: "nexora_business_pipeline_engine",
    toWorker: "office_receptionist",
    fromArea: "operations",
    toArea: "office",
    subject: `Lead pipeline ready: ${companyName}`,
    body: `Lead ${leadId} requires qualification and safe follow-up. Need: ${need}. Budget: ${budget}. Location: ${location}.`,
    priority: urgency === "high" ? 90 : 75,
    payload: {
      leadId,
      crmAction,
      quoteDraft,
    },
  });

  const delegation = await createNexoraDelegation({
    parentWorker: "nexora_business_pipeline_engine",
    childWorker: "supplier_negotiator",
    mission: `Collect supplier intelligence for lead ${leadId}.`,
    authorityScope: "Information gathering only. No purchase order. No binding supplier commitment.",
    risk: budget >= 15000 ? "high" : "medium",
    payload: {
      leadId,
      procurementPlan,
    },
  });

  const objective = await createNexoraDivisionObjective({
    area: "office",
    objective: `Move lead ${leadId} from enquiry to approved quote path.`,
    metric: "lead_to_quote_progress",
    target: "qualified scope, supplier confirmation, approval state, and next customer action",
    ownerWorker: "office_receptionist",
    priority: 88,
    payload: {
      leadId,
      companyName,
      quoteDraft,
    },
  });

  await createNexoraMemoryGraphEdge({
    sourceType: "lead",
    sourceId: leadId,
    relation: "depends_on",
    targetType: "worker",
    targetId: "supplier_negotiator",
    weight: 1.5,
    payload: {
      reason: "Supplier confirmation improves quote accuracy.",
    },
  });

  await createNexoraMemoryGraphEdge({
    sourceType: "lead",
    sourceId: leadId,
    relation: "serves",
    targetType: "customer",
    targetId: companyName,
    weight: 1,
    payload: {
      customerName,
      location,
      need,
    },
  });

  await upsertNexoraWorker({
    worker: "nexora_business_pipeline_engine",
    area: "operations",
    status: "idle",
    capabilities: ["lead_pipeline", "quote_pipeline", "procurement_pipeline", "crm_pipeline", "project_pipeline"],
    metadata: {
      completedLeadId: leadId,
      completedAt: now(),
    },
  });

  const result = {
    ok: true,
    nexoraBrain: true,
    leadId,
    quoteDraft,
    crmAction,
    procurementPlan,
    projectPlan,
    governedQuote,
    governedProcurement,
    crmTask,
    projectTask,
    messageToReception,
    delegation,
    objective,
    safety: {
      noBindingCustomerCommitment: true,
      noPurchaseOrder: true,
      highValueApprovalGated: true,
    },
  };

  await writeNexoraOperatingReport(
    "business_pipeline",
    budget >= 25000 ? "warning" : "info",
    "Nexora business pipeline created",
    `Business pipeline created for ${companyName} lead ${leadId}. Quote total AUD ${quoteDraft.total}.`,
    result
  );

  return result;
}

export async function runNexoraBulkBusinessPipeline(input: any = {}) {
  await ensureNexoraDurableKernel();

  const leads = Array.isArray(input.leads) && input.leads.length > 0
    ? input.leads
    : [
        {
          companyName: "Default Office Lead",
          customerName: "Operations Manager",
          need: "20 workstation furniture package with fitout support",
          budget: 18000,
          urgency: "high",
          location: "Brisbane",
        },
        {
          companyName: "Boardroom Upgrade Lead",
          customerName: "Facilities Manager",
          need: "Boardroom table, ergonomic chairs, delivery and installation",
          budget: 9500,
          urgency: "medium",
          location: "Gold Coast",
        },
      ];

  const pipelines = [];

  for (const lead of leads) {
    pipelines.push(await createNexoraBusinessPipeline(lead));
  }

  await writeNexoraOperatingReport(
    "business_pipeline_bulk",
    "info",
    "Nexora bulk business pipeline completed",
    `Created ${pipelines.length} business pipelines.`,
    {
      pipelines,
    }
  );

  return {
    ok: true,
    nexoraBrain: true,
    count: pipelines.length,
    pipelines,
  };
}

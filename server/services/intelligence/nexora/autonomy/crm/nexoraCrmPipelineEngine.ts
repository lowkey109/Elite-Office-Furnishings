import {
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

export async function registerNexoraCrmWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_crm_brainstem",
      area: "crm",
      capabilities: ["pipeline_state", "next_action", "followup_clock", "lead_temperature"],
    },
    {
      worker: "nexora_followup_writer",
      area: "crm",
      capabilities: ["email_draft", "call_script", "customer_response_plan"],
    },
    {
      worker: "nexora_pipeline_rescuer",
      area: "crm",
      capabilities: ["stale_lead_rescue", "lost_reason_capture", "reactivation"],
    },
  ];

  for (const worker of workers) {
    await upsertNexoraWorker({
      worker: worker.worker,
      area: worker.area,
      status: "idle",
      capabilities: worker.capabilities,
      metadata: {
        seededBy: "nexora_mega_build_16",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "crm_workers",
    "info",
    "Nexora CRM workers registered",
    `Registered ${workers.length} CRM workers.`,
    { workers }
  );

  return { ok: true, nexoraBrain: true, workers };
}

export function scoreNexoraLead(input: any = {}) {
  const leadId = String(input.leadId || id("lead"));
  let score = 20;

  if (input.email) score += 10;
  if (input.phone) score += 10;
  if (input.location) score += 10;
  if (input.budget) score += 15;
  if (input.timeline) score += 15;
  if (String(input.urgency || "").toLowerCase() === "high") score += 15;
  if (String(input.need || "").toLowerCase().includes("fitout")) score += 10;
  if (String(input.need || "").toLowerCase().includes("workstation")) score += 10;

  const temperature = score >= 80 ? "hot" : score >= 55 ? "warm" : "cold";

  return {
    ok: true,
    nexoraBrain: true,
    leadId,
    score,
    temperature,
    createdAt: now(),
    missing: [
      input.email ? null : "email",
      input.phone ? null : "phone",
      input.location ? null : "location",
      input.budget ? null : "budget",
      input.timeline ? null : "timeline",
    ].filter(Boolean),
    nextAction:
      temperature === "hot"
        ? "Create quote path and supplier confirmation."
        : temperature === "warm"
          ? "Ask qualification questions and confirm buying timeline."
          : "Capture missing contact and requirement details.",
  };
}

export function draftNexoraFollowup(input: any = {}) {
  const lead = scoreNexoraLead(input);
  const name = String(input.customerName || "there");
  const company = input.companyName ? ` at ${input.companyName}` : "";
  const need = String(input.need || "office furniture or fitout support");

  const message = [
    `Hi ${name},`,
    "",
    `Thanks for your enquiry${company}. I have noted the requirement as: ${need}.`,
    lead.missing.length
      ? `To move this forward, could you confirm: ${lead.missing.join(", ")}?`
      : "We have enough to prepare the next quote pathway and supplier confirmation.",
    "",
    "The next step is to confirm scope, timing, location, and any install/access constraints so The Corporate Desk can prepare the right path.",
    "",
    "Regards,",
    "The Corporate Desk",
  ].join("\n");

  return {
    ok: true,
    nexoraBrain: true,
    followupId: id("followup"),
    lead,
    channel: input.email ? "email" : input.phone ? "phone" : "crm_task",
    message,
    approvalRequired: false,
  };
}

export async function queueNexoraCrmPipeline(input: any = {}) {
  await ensureNexoraDurableKernel();
  await registerNexoraCrmWorkers();

  const lead = scoreNexoraLead(input);
  const followup = draftNexoraFollowup(input);

  const crmTask = await createNexoraDurableTask({
    worker: "nexora_crm_brainstem",
    area: "crm",
    action: "record_lead_state_and_next_action",
    risk: "safe",
    priority: lead.temperature === "hot" ? 90 : 72,
    payload: { lead, input },
    source: "nexora.crm.pipeline",
  });

  const followupTask = await createNexoraDurableTask({
    worker: "nexora_followup_writer",
    area: "crm",
    action: "prepare_customer_followup_draft",
    risk: "safe",
    priority: lead.temperature === "hot" ? 88 : 70,
    payload: { followup, input },
    source: "nexora.crm.pipeline",
  });

  if (lead.temperature === "hot") {
    await sendNexoraWorkerMessage({
      fromWorker: "nexora_crm_brainstem",
      toWorker: "quote_builder",
      fromArea: "crm",
      toArea: "office",
      subject: "Hot lead ready for quote path",
      body: `Lead ${lead.leadId} is hot. Prepare quote path with margin and supplier assumptions.`,
      priority: 90,
      payload: { lead, input },
    });
  }

  await createNexoraMemoryGraphEdge({
    sourceType: "lead",
    sourceId: lead.leadId,
    relation: "serves",
    targetType: "worker",
    targetId: "nexora_crm_brainstem",
    weight: lead.score / 50,
    payload: lead,
  });

  await createNexoraDivisionObjective({
    area: "crm",
    objective: `Advance lead ${lead.leadId} with next-action discipline.`,
    metric: "crm_next_action_created",
    target: followup.channel,
    ownerWorker: "nexora_crm_brainstem",
    priority: 80,
    payload: { lead, followup },
  });

  await writeNexoraOperatingReport(
    "crm_pipeline",
    lead.temperature === "hot" ? "warning" : "info",
    "Nexora CRM pipeline queued",
    `Lead ${lead.leadId} scored ${lead.score} (${lead.temperature}).`,
    { lead, followup, crmTask, followupTask }
  );

  return { ok: true, nexoraBrain: true, lead, followup, crmTask, followupTask };
}

export async function getNexoraCrmStatus() {
  await ensureNexoraDurableKernel();
  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_crm_pipeline_engine",
    capabilities: [
      "Lead scoring",
      "Follow-up drafting",
      "Hot lead routing",
      "CRM next-action discipline",
    ],
    snapshot,
  };
}

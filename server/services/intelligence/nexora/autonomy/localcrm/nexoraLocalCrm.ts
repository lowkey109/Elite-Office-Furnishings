import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const CRM_LOG = nexoraLocalPath("crm", "crm-log.jsonl");

function leadFile(id: string) {
  return nexoraLocalPath("crm", `${id}.json`);
}

export function upsertNexoraLocalLead(input: any = {}) {
  const leadId = String(input.leadId || nexoraLocalId("lead"));
  const existing = readNexoraJson(leadFile(leadId), {});

  const lead = {
    ...existing,
    ok: true,
    nexoraBrain: true,
    leadId,
    customerName: String(input.customerName || existing.customerName || "Unknown customer"),
    companyName: String(input.companyName || existing.companyName || "Unknown company"),
    email: input.email || existing.email || null,
    phone: input.phone || existing.phone || null,
    location: input.location || existing.location || null,
    need: input.need || existing.need || null,
    budget: input.budget ?? existing.budget ?? null,
    urgency: input.urgency || existing.urgency || "medium",
    status: input.status || existing.status || "open",
    nextAction: input.nextAction || existing.nextAction || "Qualify lead.",
    updatedAt: now(),
    createdAt: existing.createdAt || now(),
  };

  writeNexoraJson(leadFile(leadId), lead);
  appendNexoraJsonl(CRM_LOG, {
    event: "lead.upserted",
    lead,
    createdAt: now(),
  });

  recordNexoraTimelineEvent({
    type: "crm",
    title: `Lead updated: ${lead.companyName}`,
    severity: "info",
    payload: lead,
  });

  return {
    ok: true,
    nexoraBrain: true,
    lead,
  };
}

export function getNexoraLocalLead(input: any = {}) {
  const leadId = String(input.leadId || "");
  const lead = readNexoraJson(leadFile(leadId), null);

  return {
    ok: Boolean(lead),
    nexoraBrain: true,
    leadId,
    lead,
  };
}

export function listNexoraLocalLeads(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);
  const leads = readNexoraJsonl(CRM_LOG)
    .filter((row: any) => row.event === "lead.upserted")
    .map((row: any) => row.lead)
    .filter((lead: any) => !status || lead.status === status)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: leads.length,
    rows: leads,
  };
}

export function getNexoraLocalCrmStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_crm",
    openLeads: listNexoraLocalLeads({ status: "open", limit: 1000 }).count,
    totalLeads: listNexoraLocalLeads({ limit: 1000 }).count,
  };
}

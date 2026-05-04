import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import {
  listNexoraLocalLeads,
  upsertNexoraLocalLead,
} from "../localcrm/nexoraLocalCrm";
import {
  createNexoraLocalQuote,
  listNexoraLocalQuotes,
} from "../localquotes/nexoraLocalQuoteBook";
import {
  listNexoraLocalSuppliers,
  upsertNexoraLocalSupplier,
} from "../localsuppliers/nexoraLocalSupplierCatalogue";
import {
  createNexoraLocalProject,
  listNexoraLocalProjects,
} from "../localprojects/nexoraLocalProjectBoard";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

function toNumber(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function detectUrgency(input: any = {}) {
  const text = JSON.stringify(input).toLowerCase();
  const budget = toNumber(input.budget, 0);

  if (
    text.includes("urgent") ||
    text.includes("asap") ||
    text.includes("this week") ||
    text.includes("tomorrow") ||
    text.includes("immediate") ||
    budget >= 50000
  ) {
    return "high";
  }

  if (
    text.includes("soon") ||
    text.includes("2 weeks") ||
    text.includes("two weeks") ||
    budget >= 15000
  ) {
    return "medium";
  }

  return "low";
}

function missingLeadFields(input: any = {}) {
  return [
    input.customerName ? null : "customerName",
    input.companyName ? null : "companyName",
    input.email || input.phone ? null : "email_or_phone",
    input.location ? null : "location",
    input.need ? null : "need",
    input.budget ? null : "budget",
    input.timeline ? null : "timeline",
  ].filter(Boolean);
}

function leadScore(input: any = {}) {
  let score = 20;
  if (input.customerName) score += 5;
  if (input.companyName) score += 10;
  if (input.email) score += 10;
  if (input.phone) score += 10;
  if (input.location) score += 10;
  if (input.need) score += 15;
  if (input.budget) score += 15;
  if (input.timeline) score += 15;

  const urgency = detectUrgency(input);
  if (urgency === "high") score += 15;
  if (urgency === "medium") score += 8;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    temperature: score >= 80 ? "hot" : score >= 55 ? "warm" : "cold",
    urgency,
  };
}

function journal(event: string, payload: any) {
  appendNexoraJsonl(nexoraLocalPath("office-agents", "journal", "office-agent-journal.jsonl"), {
    event,
    payload,
    createdAt: now(),
  });
}

export function getNexoraOfficeFurnitureAgentsStatus() {
  const leads = listNexoraLocalLeads({ limit: 1000 });
  const quotes = listNexoraLocalQuotes({ limit: 1000 });
  const suppliers = listNexoraLocalSuppliers({ limit: 1000 });
  const projects = listNexoraLocalProjects({ limit: 1000 });
  const events = readNexoraJsonl(nexoraLocalPath("office-agents", "journal", "office-agent-journal.jsonl"));

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_office_furniture_agents",
    generatedAt: now(),
    agents: [
      {
        key: "office_receptionist_agent",
        purpose: "Captures enquiries, qualifies lead, detects urgency, asks missing questions.",
      },
      {
        key: "quote_builder_agent",
        purpose: "Creates draft quote, margin check, GST estimate, assumptions, approval flag.",
      },
      {
        key: "supplier_scout_agent",
        purpose: "Checks supplier options, lead time, pricing request drafts, no purchase orders.",
      },
      {
        key: "crm_followup_agent",
        purpose: "Tracks next action, stale leads, follow-up message drafts.",
      },
      {
        key: "fitout_scope_agent",
        purpose: "Captures site/access/install constraints.",
      },
      {
        key: "project_handover_agent",
        purpose: "Turns approved quote into project stages.",
      },
    ],
    counts: {
      leads: leads.count,
      quotes: quotes.count,
      suppliers: suppliers.count,
      projects: projects.count,
      journalEvents: events.length,
    },
    safety: {
      nexoraOnlyBrain: true,
      noBindingCustomerQuoteWithoutApproval: true,
      noSupplierPurchaseOrderWithoutApproval: true,
      noAutonomousPayment: true,
      noAutonomousLegalCommitment: true,
    },
  };
}

export function runOfficeReceptionistAgent(input: any = {}) {
  const missing = missingLeadFields(input);
  const scoring = leadScore(input);

  const nextAction =
    missing.length > 0
      ? `Ask customer for missing fields: ${missing.join(", ")}.`
      : scoring.temperature === "hot"
        ? "Send to quote builder and supplier scout."
        : "Draft follow-up and continue qualification.";

  const lead = upsertNexoraLocalLead({
    ...input,
    urgency: input.urgency || scoring.urgency,
    status: input.status || "open",
    nextAction,
  });

  const result = {
    ok: true,
    nexoraBrain: true,
    agent: "office_receptionist_agent",
    createdAt: now(),
    lead,
    qualification: {
      missing,
      score: scoring.score,
      temperature: scoring.temperature,
      urgency: scoring.urgency,
      quoteReady: missing.length === 0 && scoring.score >= 55,
    },
    nextAction,
  };

  writeNexoraJson(
    nexoraLocalPath("office-agents", "leads", `${lead.lead.leadId || nexoraLocalId("lead")}.json`),
    result,
  );

  journal("office_receptionist_agent.intake", result);

  recordNexoraTimelineEvent({
    type: "office_agent",
    title: "Office receptionist intake completed",
    severity: scoring.urgency === "high" ? "warning" : "info",
    payload: result,
  });

  recordNexoraMetric({
    name: "office_agent_lead_score",
    value: scoring.score,
    unit: "score",
    dimensions: {
      temperature: scoring.temperature,
      urgency: scoring.urgency,
    },
  });

  return result;
}

export function runQuoteBuilderAgent(input: any = {}) {
  const budget = toNumber(input.budget ?? input.subtotal, 10000);
  const estimatedCost = toNumber(input.estimatedCost, budget * 0.62);
  const subtotal = budget;
  const gst = Math.round(subtotal * 0.1 * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;
  const marginAmount = Math.round((subtotal - estimatedCost) * 100) / 100;
  const marginPercent = subtotal > 0 ? Math.round((marginAmount / subtotal) * 10000) / 100 : 0;

  const approvalRequired =
    total >= 25000 ||
    marginPercent < 22 ||
    Boolean(input.customerFacing && input.bindingCommitment);

  const quote = createNexoraLocalQuote({
    ...input,
    subtotal,
    estimatedCost,
    bindingCommitment: false,
  });

  const result = {
    ok: true,
    nexoraBrain: true,
    agent: "quote_builder_agent",
    createdAt: now(),
    quote,
    quoteSummary: {
      subtotal,
      gst,
      total,
      estimatedCost,
      marginAmount,
      marginPercent,
      approvalRequired,
    },
    assumptions: [
      "Draft quote only until supplier confirmation.",
      "No customer-facing binding commitment without approval.",
      "Delivery, installation, site access, electrical, and after-hours constraints may change final pricing.",
    ],
    safety: {
      draftOnly: true,
      noBindingCommitment: true,
      approvalRequired,
    },
  };

  writeNexoraJson(
    nexoraLocalPath("office-agents", "quotes", `${quote.quote.quoteId}.json`),
    result,
  );

  journal("quote_builder_agent.draft", result);

  recordNexoraMetric({
    name: "office_agent_quote_total",
    value: total,
    unit: "aud",
    dimensions: {
      approvalRequired,
      marginPercent,
    },
  });

  return result;
}

export function runSupplierScoutAgent(input: any = {}) {
  const supplier = upsertNexoraLocalSupplier({
    supplierId: input.supplierId,
    name: input.name || input.supplierName || "Preferred Supplier Pool",
    category: input.category || "office furniture",
    leadTimeDays: input.leadTimeDays ?? 14,
    rating: input.rating ?? 7,
    status: input.status || "active",
    contact: input.contact || {},
    noPurchaseOrderWithoutApproval: true,
  });

  const policy = evaluateNexoraPolicy({
    ...input,
    purchaseOrder: false,
    bindingCommitment: false,
  });

  const requestDraft = {
    ok: true,
    nexoraBrain: true,
    nonBinding: true,
    noPurchaseOrder: true,
    message: [
      "Hello,",
      "",
      "We are preparing a non-binding supplier confirmation for an office furniture / fitout opportunity.",
      "Please confirm unit cost, available stock, lead time, delivery cost, warranty, and equivalent alternatives.",
      "",
      "This is an information request only and is not a purchase order or supplier commitment.",
      "",
      "Regards,",
      "The Corporate Desk",
    ].join("\n"),
  };

  const result = {
    ok: true,
    nexoraBrain: true,
    agent: "supplier_scout_agent",
    createdAt: now(),
    supplier,
    policy,
    requestDraft,
    safety: {
      noPurchaseOrder: true,
      noSupplierCommitment: true,
      approvalRequiredForCommitment: true,
    },
  };

  writeNexoraJson(
    nexoraLocalPath("office-agents", "suppliers", `${supplier.supplier.supplierId}.json`),
    result,
  );

  journal("supplier_scout_agent.request", result);

  return result;
}

export function runCrmFollowupAgent(input: any = {}) {
  const customerName = String(input.customerName || "there");
  const companyName = input.companyName ? ` at ${input.companyName}` : "";
  const need = String(input.need || "office furniture or fitout support");
  const missing = missingLeadFields(input);

  const draft = {
    ok: true,
    nexoraBrain: true,
    agent: "crm_followup_agent",
    followupId: nexoraLocalId("followup"),
    createdAt: now(),
    channel: input.email ? "email" : input.phone ? "phone" : "crm_task",
    missing,
    nextAction:
      missing.length > 0
        ? `Request missing details: ${missing.join(", ")}.`
        : "Move to quote path and supplier confirmation.",
    message: [
      `Hi ${customerName},`,
      "",
      `Thanks for your enquiry${companyName}. I have noted the requirement as: ${need}.`,
      missing.length
        ? `To move this forward, could you confirm: ${missing.join(", ")}?`
        : "We have enough to prepare the next quote pathway and supplier confirmation.",
      "",
      "The next step is to confirm scope, timing, location, and any install/access constraints so The Corporate Desk can prepare the right path.",
      "",
      "Regards,",
      "The Corporate Desk",
    ].join("\n"),
    safety: {
      draftOnly: true,
      noBindingCommitment: true,
    },
  };

  writeNexoraJson(
    nexoraLocalPath("office-agents", "followups", `${draft.followupId}.json`),
    draft,
  );

  journal("crm_followup_agent.draft", draft);

  return draft;
}

export function runFitoutScopeAgent(input: any = {}) {
  const scopeId = String(input.scopeId || nexoraLocalId("fitout_scope"));

  const checklist = {
    ok: true,
    nexoraBrain: true,
    agent: "fitout_scope_agent",
    scopeId,
    createdAt: now(),
    site: {
      location: input.location || null,
      access: input.access || null,
      liftAccess: input.liftAccess ?? null,
      loadingDock: input.loadingDock ?? null,
      stairs: input.stairs ?? null,
      afterHours: input.afterHours ?? null,
      installWindow: input.installWindow || input.timeline || null,
    },
    constraints: [
      input.location ? null : "Confirm site location.",
      input.access ? null : "Confirm access constraints.",
      input.installWindow || input.timeline ? null : "Confirm installation window.",
      input.loadingDock !== undefined ? null : "Confirm loading dock availability.",
      input.liftAccess !== undefined ? null : "Confirm lift access.",
      input.afterHours !== undefined ? null : "Confirm after-hours requirements.",
    ].filter(Boolean),
    risk: {
      siteAccessUnknown: !input.access,
      afterHoursUnknown: input.afterHours === undefined,
      installWindowUnknown: !input.installWindow && !input.timeline,
      riskLevel:
        !input.access || (!input.installWindow && !input.timeline)
          ? "medium"
          : "low",
    },
    safety: {
      scopeOnly: true,
      noProjectCommitment: true,
    },
  };

  writeNexoraJson(
    nexoraLocalPath("office-agents", "fitouts", `${scopeId}.json`),
    checklist,
  );

  journal("fitout_scope_agent.scope", checklist);

  return checklist;
}

export function runProjectHandoverAgent(input: any = {}) {
  const approved = Boolean(input.approved || input.quoteApproved);
  const approvalPolicy = evaluateNexoraPolicy({
    ...input,
    bindingCommitment: !approved,
  });

  const project = createNexoraLocalProject({
    leadId: input.leadId || null,
    quoteId: input.quoteId || null,
    name: input.name || "Office furniture / fitout handover project",
    status: approved ? "planned" : "approval_required",
    risk: input.risk || "medium",
    stages: [
      { name: "Qualification", status: "planned" },
      { name: "Scope confirmation", status: "planned" },
      { name: "Supplier confirmation", status: "planned" },
      { name: "Approval gate", status: approved ? "complete" : "required" },
      { name: "Delivery planning", status: "planned" },
      { name: "Installation / handover", status: "planned" },
      { name: "Post-project learning", status: "planned" },
    ],
  });

  const result = {
    ok: true,
    nexoraBrain: true,
    agent: "project_handover_agent",
    createdAt: now(),
    approved,
    approvalPolicy,
    project,
    safety: {
      requiresApprovedQuote: true,
      noHandoverIfApprovalMissing: !approved,
    },
  };

  writeNexoraJson(
    nexoraLocalPath("office-agents", "projects", `${project.project.projectId}.json`),
    result,
  );

  journal("project_handover_agent.handover", result);

  return result;
}

export function runNexoraOfficeAgentsTick(input: any = {}) {
  const tickId = String(input.tickId || nexoraLocalId("office_tick"));

  const payload = input.payload || input;

  const receptionist = payload.lead
    ? runOfficeReceptionistAgent(payload.lead)
    : null;

  const quote = payload.quote
    ? runQuoteBuilderAgent(payload.quote)
    : null;

  const supplier = payload.supplier
    ? runSupplierScoutAgent(payload.supplier)
    : null;

  const followup = payload.followup
    ? runCrmFollowupAgent(payload.followup)
    : null;

  const fitout = payload.fitout
    ? runFitoutScopeAgent(payload.fitout)
    : null;

  const project = payload.project
    ? runProjectHandoverAgent(payload.project)
    : null;

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_office_agents_tick",
    tickId,
    createdAt: now(),
    ran: {
      receptionist: Boolean(receptionist),
      quote: Boolean(quote),
      supplier: Boolean(supplier),
      followup: Boolean(followup),
      fitout: Boolean(fitout),
      project: Boolean(project),
    },
    results: {
      receptionist,
      quote,
      supplier,
      followup,
      fitout,
      project,
    },
  };

  journal("office_agents.tick", result);

  return result;
}

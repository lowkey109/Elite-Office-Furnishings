import {
  upsertNexoraLocalLead,
  getNexoraLocalCrmStatus,
} from "../localcrm/nexoraLocalCrm";
import {
  createNexoraLocalQuote,
  getNexoraLocalQuoteBookStatus,
} from "../localquotes/nexoraLocalQuoteBook";
import {
  upsertNexoraLocalSupplier,
  getNexoraLocalSupplierStatus,
} from "../localsuppliers/nexoraLocalSupplierCatalogue";
import {
  createNexoraLocalProject,
  getNexoraLocalProjectStatus,
} from "../localprojects/nexoraLocalProjectBoard";
import {
  evaluateNexoraPolicy,
} from "../policy/nexoraPolicyPack";
import {
  recordNexoraTimelineEvent,
} from "../timeline/nexoraTimeline";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

function now() {
  return new Date().toISOString();
}

function buildFollowupDraft(input: any = {}) {
  const customerName = String(input.customerName || "there");
  const companyName = input.companyName ? ` at ${input.companyName}` : "";
  const need = String(input.need || "office furniture or fitout support");
  const missing = [
    input.email ? null : "email",
    input.phone ? null : "phone",
    input.location ? null : "location",
    input.budget ? null : "budget",
    input.timeline ? null : "timeline",
  ].filter(Boolean);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_office_followup_adapter",
    createdAt: now(),
    channel: input.email ? "email" : input.phone ? "phone" : "crm_task",
    missing,
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
}

export function registerNexoraOfficeAgentAdapterRoutes(app: any) {
  app.get("/api/nexora/office-agents/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_office_agent_adapter",
        mode: "adapter_over_existing_modules",
        generatedAt: now(),
        crm: getNexoraLocalCrmStatus(),
        quotes: getNexoraLocalQuoteBookStatus(),
        suppliers: getNexoraLocalSupplierStatus(),
        projects: getNexoraLocalProjectStatus(),
        agents: [
          "office_receptionist_agent",
          "quote_builder_agent",
          "supplier_scout_agent",
          "crm_followup_agent",
          "fitout_scope_agent",
          "project_handover_agent",
        ],
        safety: {
          noBindingCustomerQuoteWithoutApproval: true,
          noSupplierPurchaseOrderWithoutApproval: true,
          noAutonomousPayment: true,
          noAutonomousLegalCommitment: true,
          nexoraOnlyBrain: true,
        },
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/tick", (_req: any, res: any) => {
    try {
      const event = recordNexoraTimelineEvent({
        type: "office_agents_tick",
        title: "Office agents ticked",
        severity: "info",
        payload: {
          mode: "adapter_tick",
          createdAt: now(),
        },
      });

      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_office_agents_tick",
        event,
        nextActions: [
          "Review open leads.",
          "Draft quote for qualified leads.",
          "Prepare supplier request without purchase order.",
          "Draft CRM follow-up.",
          "Capture project scope when quote path is active.",
        ],
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/lead/intake", (req: any, res: any) => {
    try {
      const body = req.body || {};
      const lead = upsertNexoraLocalLead({
        ...body,
        status: body.status || "open",
        nextAction: body.nextAction || "Qualify office furniture / fitout enquiry.",
      });

      res.json({
        ok: true,
        nexoraBrain: true,
        agent: "office_receptionist_agent",
        lead,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/quote/draft", (req: any, res: any) => {
    try {
      const body = req.body || {};
      const quote = createNexoraLocalQuote({
        ...body,
        bindingCommitment: false,
      });

      res.json({
        ok: true,
        nexoraBrain: true,
        agent: "quote_builder_agent",
        quote,
        safety: {
          draftOnly: true,
          noBindingCommitment: true,
          approvalRequiredWhenHighValueOrLowMargin: true,
        },
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/supplier/request", (req: any, res: any) => {
    try {
      const body = req.body || {};
      const supplier = upsertNexoraLocalSupplier({
        ...body,
        noPurchaseOrderWithoutApproval: true,
      });

      const policy = evaluateNexoraPolicy({
        ...body,
        purchaseOrder: false,
        bindingCommitment: false,
      });

      res.json({
        ok: true,
        nexoraBrain: true,
        agent: "supplier_scout_agent",
        supplier,
        policy,
        requestDraft: {
          message: "Please confirm unit cost, stock, lead time, delivery cost, warranty, and equivalent alternatives. This is not a purchase order or supplier commitment.",
          nonBinding: true,
          noPurchaseOrder: true,
        },
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/followup/draft", (req: any, res: any) => {
    try {
      const draft = buildFollowupDraft(req.body || {});

      res.json({
        ok: true,
        nexoraBrain: true,
        agent: "crm_followup_agent",
        draft,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/project/scope", (req: any, res: any) => {
    try {
      const body = req.body || {};
      const project = createNexoraLocalProject({
        ...body,
        name: body.name || "Office furniture / fitout project scope",
        risk: body.risk || "medium",
      });

      res.json({
        ok: true,
        nexoraBrain: true,
        agent: "fitout_scope_agent",
        project,
        scopeChecklist: [
          "Site location",
          "Access constraints",
          "Lift/stairs/loading dock",
          "After-hours requirements",
          "Installation window",
          "Supplier lead time",
          "Customer approval point",
        ],
      });
    } catch (error) {
      sendError(res, error);
    }
  });
}

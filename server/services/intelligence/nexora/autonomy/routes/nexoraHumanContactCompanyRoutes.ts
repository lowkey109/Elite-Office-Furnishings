import {
  createNexoraCommunicationDraft,
  createNexoraDailyHumanBriefing,
  createNexoraHumanApprovalRequest,
  createNexoraHumanContact,
  createNexoraHumanHandoff,
  createNexoraHumanInboxItem,
  decideNexoraHumanApproval,
  getNexoraHumanCompanyStatus,
  getNexoraOwnerCockpit,
  listNexoraHumanApprovals,
  listNexoraHumanContacts,
  listNexoraHumanHandoffs,
  listNexoraHumanInbox,
  listNexoraHumanTouchpoints,
  recordNexoraHumanTouchpoint,
} from "../humancompany/nexoraHumanContactCompanyEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraHumanContactCompanyRoutes(app: any) {
  app.get("/api/nexora/human-company/status", (_req: any, res: any) => {
    try { res.json(getNexoraHumanCompanyStatus()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-company/owner-cockpit", (req: any, res: any) => {
    try { res.json(getNexoraOwnerCockpit(req.query || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-company/contact/create", (req: any, res: any) => {
    try { res.json(createNexoraHumanContact(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-company/contacts", (req: any, res: any) => {
    try { res.json(listNexoraHumanContacts({ type: req.query?.type || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-company/communication/draft", (req: any, res: any) => {
    try { res.json(createNexoraCommunicationDraft(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-company/approval/request", (req: any, res: any) => {
    try { res.json(createNexoraHumanApprovalRequest(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-company/approval/decide", (req: any, res: any) => {
    try { res.json(decideNexoraHumanApproval(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-company/approvals", (req: any, res: any) => {
    try { res.json(listNexoraHumanApprovals({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-company/handoff/create", (req: any, res: any) => {
    try { res.json(createNexoraHumanHandoff(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-company/handoffs", (req: any, res: any) => {
    try { res.json(listNexoraHumanHandoffs({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-company/touchpoint/record", (req: any, res: any) => {
    try { res.json(recordNexoraHumanTouchpoint(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-company/touchpoints", (req: any, res: any) => {
    try { res.json(listNexoraHumanTouchpoints({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-company/inbox/create", (req: any, res: any) => {
    try { res.json(createNexoraHumanInboxItem(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-company/inbox", (req: any, res: any) => {
    try { res.json(listNexoraHumanInbox({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-company/briefing/daily", (req: any, res: any) => {
    try { res.json(createNexoraDailyHumanBriefing(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

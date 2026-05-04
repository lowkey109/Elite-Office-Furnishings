import {
  createNexoraHumanApprovedEmailDraft,
  getNexoraEmailApprovalStatus,
  listNexoraEmailApprovalRecords,
  markNexoraEmailHumanSent,
  queueNexoraEmailForHumanSend,
} from "../emailapproval/nexoraHumanApprovedEmailOutbox";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraHumanApprovedEmailOutboxRoutes(app: any) {
  app.get("/api/nexora/email-approval/status", (_req: any, res: any) => {
    try { res.json(getNexoraEmailApprovalStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/email-approval/draft", (req: any, res: any) => {
    try { res.json(createNexoraHumanApprovedEmailDraft(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/email-approval/outbox", (req: any, res: any) => {
    try { res.json(queueNexoraEmailForHumanSend(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/email-approval/mark-sent", (req: any, res: any) => {
    try { res.json(markNexoraEmailHumanSent(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/email-approval/list", (req: any, res: any) => {
    try { res.json(listNexoraEmailApprovalRecords({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

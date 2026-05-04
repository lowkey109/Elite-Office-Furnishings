import {
  createNexoraCustomerJourney,
  createNexoraEscalation,
  createNexoraHumanOpsBriefing,
  createNexoraInstallCoordinationPlan,
  createNexoraOwnerDecisionItem,
  createNexoraSupplierDeskRequest,
  getNexoraHumanOpsStatus,
  listNexoraCustomerJourneys,
  listNexoraEscalations,
  listNexoraInstallPlans,
  listNexoraOwnerDecisionQueue,
  listNexoraSupplierDeskRequests,
} from "../humanops/nexoraHumanLoopBusinessOps";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraHumanLoopBusinessOpsRoutes(app: any) {
  app.get("/api/nexora/human-ops/status", (_req: any, res: any) => {
    try { res.json(getNexoraHumanOpsStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-ops/customer-journey/create", (req: any, res: any) => {
    try { res.json(createNexoraCustomerJourney(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-ops/customer-journeys", (req: any, res: any) => {
    try { res.json(listNexoraCustomerJourneys({ stage: req.query?.stage || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-ops/supplier-desk/request", (req: any, res: any) => {
    try { res.json(createNexoraSupplierDeskRequest(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-ops/supplier-desk/requests", (req: any, res: any) => {
    try { res.json(listNexoraSupplierDeskRequests({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-ops/install/plan", (req: any, res: any) => {
    try { res.json(createNexoraInstallCoordinationPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-ops/install/plans", (req: any, res: any) => {
    try { res.json(listNexoraInstallPlans({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-ops/escalation/create", (req: any, res: any) => {
    try { res.json(createNexoraEscalation(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-ops/escalations", (req: any, res: any) => {
    try { res.json(listNexoraEscalations({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-ops/owner-decision/create", (req: any, res: any) => {
    try { res.json(createNexoraOwnerDecisionItem(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-ops/owner-decision/queue", (req: any, res: any) => {
    try { res.json(listNexoraOwnerDecisionQueue({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-ops/briefing", (req: any, res: any) => {
    try { res.json(createNexoraHumanOpsBriefing(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

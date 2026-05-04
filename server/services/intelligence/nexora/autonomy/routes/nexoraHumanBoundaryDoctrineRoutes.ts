import {
  classifyNexoraActionBoundary,
  createNexoraApprovalAction,
  createNexoraAutomationResponsibilityMap,
  createNexoraCommitmentAction,
  createNexoraHumanBoundaryDoctrine,
  createNexoraSignatureAction,
  getNexoraHumanBoundaryDoctrine,
  getNexoraHumanBoundaryStatus,
  listNexoraHumanBoundaryQueue,
} from "../humanboundary/nexoraHumanBoundaryDoctrine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraHumanBoundaryDoctrineRoutes(app: any) {
  app.get("/api/nexora/human-boundary/status", (_req: any, res: any) => {
    try { res.json(getNexoraHumanBoundaryStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-boundary/doctrine/create", (req: any, res: any) => {
    try { res.json(createNexoraHumanBoundaryDoctrine(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-boundary/doctrine", (_req: any, res: any) => {
    try { res.json(getNexoraHumanBoundaryDoctrine()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-boundary/classify", (req: any, res: any) => {
    try { res.json(classifyNexoraActionBoundary(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-boundary/approve/request", (req: any, res: any) => {
    try { res.json(createNexoraApprovalAction(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-boundary/sign/request", (req: any, res: any) => {
    try { res.json(createNexoraSignatureAction(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-boundary/commit/request", (req: any, res: any) => {
    try { res.json(createNexoraCommitmentAction(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/human-boundary/queue", (req: any, res: any) => {
    try { res.json(listNexoraHumanBoundaryQueue({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/human-boundary/responsibility-map", (req: any, res: any) => {
    try { res.json(createNexoraAutomationResponsibilityMap(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

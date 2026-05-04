import {
  createNexoraLocalCompanySimulator,
  createNexoraLocalOwnerBriefing,
  createNexoraLocalRouteRegistry,
  createNexoraNoDeployGuard,
  getNexoraLocalMasterStatus,
  getNexoraNoDeployGuard,
  runNexoraLocalMasterRun,
} from "../localmaster/nexoraLocalMasterControl";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraLocalMasterControlRoutes(app: any) {
  app.get("/api/nexora/local-master/status", (_req: any, res: any) => {
    try { res.json(getNexoraLocalMasterStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-master/run", (req: any, res: any) => {
    try { res.json(runNexoraLocalMasterRun(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-master/no-deploy-guard", (_req: any, res: any) => {
    try { res.json(getNexoraNoDeployGuard()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-master/no-deploy-guard", (req: any, res: any) => {
    try { res.json(createNexoraNoDeployGuard(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-master/route-registry", (_req: any, res: any) => {
    try { res.json(createNexoraLocalRouteRegistry()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-master/simulate", (req: any, res: any) => {
    try { res.json(createNexoraLocalCompanySimulator(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-master/owner-briefing", (req: any, res: any) => {
    try { res.json(createNexoraLocalOwnerBriefing(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

import {
  createNexoraNextBestPlan,
  getNexoraNextBestPlanStatus,
} from "../nbp/nexoraNextBestPlanEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraNextBestPlanRoutes(app: any) {
  app.get("/api/nexora/nbp/status", (_req: any, res: any) => {
    try { res.json(getNexoraNextBestPlanStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/nbp/create", (req: any, res: any) => {
    try { res.json(createNexoraNextBestPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

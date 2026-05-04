import {
  createMoonDevAdapterBuildPlan,
  getMoonDevAdapterStatus,
  scoreMoonDevSelectedForAdapters,
} from "../moondevadapter/nexoraMoonDevAdapterScorer";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraMoonDevAdapterRoutes(app: any) {
  app.get("/api/nexora/moondev-adapter/status", (_req: any, res: any) => {
    try { res.json(getMoonDevAdapterStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-adapter/score", (req: any, res: any) => {
    try { res.json(scoreMoonDevSelectedForAdapters(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-adapter/plan", (req: any, res: any) => {
    try { res.json(createMoonDevAdapterBuildPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

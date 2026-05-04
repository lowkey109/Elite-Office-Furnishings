import {
  createMoonDevSystemGapAnalysis,
  createMoonDevSystemInventory,
  createMoonDevSystemPhasePlan,
  createMoonDevSystemScore,
  getMoonDevSystemsStatus,
} from "../moondevsystems/nexoraMoonDevSystemsAccelerator";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraMoonDevSystemsAcceleratorRoutes(app: any) {
  app.get("/api/nexora/moondev-systems/status", (_req: any, res: any) => {
    try { res.json(getMoonDevSystemsStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-systems/inventory", (req: any, res: any) => {
    try { res.json(createMoonDevSystemInventory(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-systems/gap-analysis", (req: any, res: any) => {
    try { res.json(createMoonDevSystemGapAnalysis(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-systems/score", (req: any, res: any) => {
    try { res.json(createMoonDevSystemScore(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-systems/phase-plan", (req: any, res: any) => {
    try { res.json(createMoonDevSystemPhasePlan(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

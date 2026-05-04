import {
  createNexoraPolymarketFinalAudit,
  createNexoraPolymarketOperatorRunbook,
  createNexoraPolymarketReadinessScore,
  getNexoraPolymarketFinalStatus,
} from "../polymarketfinal/nexoraPolymarketFinalHardening";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolymarketFinalHardeningRoutes(app: any) {
  app.get("/api/nexora/polymarket-final/status", (_req: any, res: any) => {
    try { res.json(getNexoraPolymarketFinalStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-final/audit", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketFinalAudit(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-final/readiness", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketReadinessScore(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-final/runbook", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketOperatorRunbook(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

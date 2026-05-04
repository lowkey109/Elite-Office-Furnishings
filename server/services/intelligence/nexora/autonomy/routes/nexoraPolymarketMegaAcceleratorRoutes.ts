import {
  createNexoraPolymarketMegaEvidenceRunbook,
  createNexoraPolymarketMegaHealthReport,
  createNexoraPolymarketMegaSnapshot,
  getNexoraPolymarketMegaStatus,
} from "../polymarketmega/nexoraPolymarketMegaAccelerator";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolymarketMegaAcceleratorRoutes(app: any) {
  app.get("/api/nexora/polymarket-mega/status", (_req: any, res: any) => {
    try { res.json(getNexoraPolymarketMegaStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-mega/snapshot", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketMegaSnapshot(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-mega/runbook", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketMegaEvidenceRunbook(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-mega/health", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketMegaHealthReport(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

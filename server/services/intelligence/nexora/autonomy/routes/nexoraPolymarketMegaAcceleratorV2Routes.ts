import {
  createNexoraPolymarketMegaV2Health,
  createNexoraPolymarketMegaV2OperatorPack,
  getNexoraPolymarketMegaV2Status,
  rankNexoraPolymarketSignals,
  runNexoraPolymarketEvidenceFarm,
} from "../polymarketmega2/nexoraPolymarketMegaAcceleratorV2";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolymarketMegaAcceleratorV2Routes(app: any) {
  app.get("/api/nexora/polymarket-mega-v2/status", (_req: any, res: any) => {
    try { res.json(getNexoraPolymarketMegaV2Status()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-mega-v2/evidence-farm", (req: any, res: any) => {
    runNexoraPolymarketEvidenceFarm(req.body || {})
      .then((result) => res.json(result))
      .catch((error) => sendError(res, error));
  });

  app.post("/api/nexora/polymarket-mega-v2/rank-signals", (req: any, res: any) => {
    try { res.json(rankNexoraPolymarketSignals(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-mega-v2/health", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketMegaV2Health(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-mega-v2/operator-pack", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketMegaV2OperatorPack(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

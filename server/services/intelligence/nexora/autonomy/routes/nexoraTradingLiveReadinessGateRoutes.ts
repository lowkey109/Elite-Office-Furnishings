import {
  createNexoraTradingEvidencePack,
  createNexoraTradingOwnerReviewPacket,
  evaluateNexoraTradingPromotionGate,
  getNexoraTradingReadinessStatus,
} from "../tradingreadiness/nexoraTradingLiveReadinessGate";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraTradingLiveReadinessGateRoutes(app: any) {
  app.get("/api/nexora/trading-readiness/status", (_req: any, res: any) => {
    try { res.json(getNexoraTradingReadinessStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-readiness/evidence", (req: any, res: any) => {
    try { res.json(createNexoraTradingEvidencePack(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-readiness/gate", (req: any, res: any) => {
    try { res.json(evaluateNexoraTradingPromotionGate(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-readiness/owner-review", (req: any, res: any) => {
    try { res.json(createNexoraTradingOwnerReviewPacket(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

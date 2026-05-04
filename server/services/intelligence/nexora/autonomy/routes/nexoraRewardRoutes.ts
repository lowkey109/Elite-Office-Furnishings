import {
  captureNexoraSuccessPattern,
  createNexoraReward,
  getNexoraRewardStatus,
  listNexoraRewards,
  praiseNexoraWorker,
  recommendNexoraWorkerPromotion,
  updateNexoraWorkerConfidence,
} from "../rewards/nexoraRewardEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraRewardRoutes(app: any) {
  app.get("/api/nexora/rewards/status", (_req: any, res: any) => {
    try { res.json(getNexoraRewardStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/rewards/create", (req: any, res: any) => {
    try { res.json(createNexoraReward(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/rewards/praise", (req: any, res: any) => {
    try { res.json(praiseNexoraWorker(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/rewards/success-pattern", (req: any, res: any) => {
    try { res.json(captureNexoraSuccessPattern(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/rewards/confidence/update", (req: any, res: any) => {
    try { res.json(updateNexoraWorkerConfidence(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/rewards/promotion/recommend", (req: any, res: any) => {
    try { res.json(recommendNexoraWorkerPromotion(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/rewards/list", (req: any, res: any) => {
    try { res.json(listNexoraRewards({ worker: req.query?.worker || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

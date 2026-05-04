import {
  checkNexoraTradingExposure,
  createNexoraPaperPortfolioPosition,
  createNexoraTradingLabStrategy,
  evaluateNexoraSignalWithSwarm,
  getNexoraTradingLabDashboard,
  getNexoraTradingLabStatus,
  listNexoraTradingLabStrategies,
  mutateNexoraTradingLabStrategy,
  runNexoraStrategyTournament,
  settleNexoraPaperPortfolioPosition,
} from "../tradinglab/nexoraTradingIntelligenceLabV2";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraTradingIntelligenceLabV2Routes(app: any) {
  app.get("/api/nexora/trading-lab/status", (_req: any, res: any) => {
    try { res.json(getNexoraTradingLabStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-lab/strategy/create", (req: any, res: any) => {
    try { res.json(createNexoraTradingLabStrategy(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-lab/strategy/mutate", (req: any, res: any) => {
    try { res.json(mutateNexoraTradingLabStrategy(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/trading-lab/strategies", (req: any, res: any) => {
    try { res.json(listNexoraTradingLabStrategies({ family: req.query?.family || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-lab/exposure/check", (req: any, res: any) => {
    try { res.json(checkNexoraTradingExposure(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-lab/portfolio/open", (req: any, res: any) => {
    try { res.json(createNexoraPaperPortfolioPosition(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-lab/portfolio/settle", (req: any, res: any) => {
    try { res.json(settleNexoraPaperPortfolioPosition(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-lab/signal/swarm", (req: any, res: any) => {
    try { res.json(evaluateNexoraSignalWithSwarm(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-lab/tournament/run", (req: any, res: any) => {
    try { res.json(runNexoraStrategyTournament(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/trading-lab/dashboard", (req: any, res: any) => {
    try { res.json(getNexoraTradingLabDashboard({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });
}

import {
  createNexoraCopySignal,
  createNexoraPaperExecutionPlan,
  executeNexoraPaperPlan,
  getNexoraTradingMegaStatus,
  listNexoraTradingMegaRecords,
  recordNexoraTradingResearchNote,
  recordNexoraWhaleObservation,
  registerNexoraTradingStrategy,
  settleNexoraPaperExecution,
} from "../tradingmega/nexoraTradingMegaEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraTradingMegaRoutes(app: any) {
  app.get("/api/nexora/trading-mega/status", (_req: any, res: any) => {
    try { res.json(getNexoraTradingMegaStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-mega/strategy/register", (req: any, res: any) => {
    try { res.json(registerNexoraTradingStrategy(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-mega/paper/plan", (req: any, res: any) => {
    try { res.json(createNexoraPaperExecutionPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-mega/paper/execute", (req: any, res: any) => {
    try { res.json(executeNexoraPaperPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-mega/paper/settle", (req: any, res: any) => {
    try { res.json(settleNexoraPaperExecution(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-mega/whale/observe", (req: any, res: any) => {
    try { res.json(recordNexoraWhaleObservation(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-mega/copy/signal", (req: any, res: any) => {
    try { res.json(createNexoraCopySignal(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-mega/research/note", (req: any, res: any) => {
    try { res.json(recordNexoraTradingResearchNote(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/trading-mega/records", (req: any, res: any) => {
    try { res.json(listNexoraTradingMegaRecords({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

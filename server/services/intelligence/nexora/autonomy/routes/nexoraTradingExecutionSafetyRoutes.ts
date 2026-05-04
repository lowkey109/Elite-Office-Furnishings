import {
  createNexoraPaperOrderIntent,
  getNexoraTradingExecutionLimits,
  getNexoraTradingExecutionReport,
  getNexoraTradingExecutionStatus,
  getNexoraTradingKillSwitch,
  reconcileNexoraPaperFill,
  setNexoraTradingExecutionLimits,
  setNexoraTradingKillSwitch,
  simulateNexoraPaperFill,
} from "../tradingexecution/nexoraTradingExecutionSafety";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraTradingExecutionSafetyRoutes(app: any) {
  app.get("/api/nexora/trading-execution/status", (_req: any, res: any) => {
    try { res.json(getNexoraTradingExecutionStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-execution/kill-switch", (req: any, res: any) => {
    try { res.json(setNexoraTradingKillSwitch(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/trading-execution/kill-switch", (_req: any, res: any) => {
    try { res.json(getNexoraTradingKillSwitch()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-execution/limits", (req: any, res: any) => {
    try { res.json(setNexoraTradingExecutionLimits(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/trading-execution/limits", (_req: any, res: any) => {
    try { res.json(getNexoraTradingExecutionLimits()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-execution/intent", (req: any, res: any) => {
    try { res.json(createNexoraPaperOrderIntent(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-execution/fill/simulate", (req: any, res: any) => {
    try { res.json(simulateNexoraPaperFill(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trading-execution/reconcile", (req: any, res: any) => {
    try { res.json(reconcileNexoraPaperFill(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/trading-execution/report", (req: any, res: any) => {
    try { res.json(getNexoraTradingExecutionReport({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

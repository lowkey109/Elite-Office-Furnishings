import {
  createMoonDevStrategyAdapterPlan,
  createMoonDevStrategyImportReport,
  getMoonDevStrategyImportStatus,
  importMoonDevBacktestResults,
  importMoonDevStrategies,
  rankMoonDevImportedStrategies,
} from "../moondevstrategyimport/nexoraMoonDevStrategyBacktestImporter";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraMoonDevStrategyBacktestImporterRoutes(app: any) {
  app.get("/api/nexora/moondev-strategy-import/status", (_req: any, res: any) => {
    try { res.json(getMoonDevStrategyImportStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-strategy-import/strategies", (req: any, res: any) => {
    try { res.json(importMoonDevStrategies(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-strategy-import/backtests", (req: any, res: any) => {
    try { res.json(importMoonDevBacktestResults(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-strategy-import/rank", (req: any, res: any) => {
    try { res.json(rankMoonDevImportedStrategies(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-strategy-import/adapter-plan", (req: any, res: any) => {
    try { res.json(createMoonDevStrategyAdapterPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-strategy-import/report", (req: any, res: any) => {
    try { res.json(createMoonDevStrategyImportReport(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

import {
  createNexoraSyntheticBacktestDataset,
  getNexoraBacktestDataset,
  getNexoraBacktestStatus,
  listNexoraBacktestRuns,
  runNexoraBacktestSimulation,
} from "../backtesting/nexoraBacktestSimulationEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraBacktestSimulationRoutes(app: any) {
  app.get("/api/nexora/backtesting/status", (_req: any, res: any) => {
    try { res.json(getNexoraBacktestStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/backtesting/dataset/synthetic", (req: any, res: any) => {
    try { res.json(createNexoraSyntheticBacktestDataset(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/backtesting/dataset", (req: any, res: any) => {
    try { res.json(getNexoraBacktestDataset({ datasetId: req.query?.datasetId || "" })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/backtesting/run", (req: any, res: any) => {
    try { res.json(runNexoraBacktestSimulation(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/backtesting/runs", (req: any, res: any) => {
    try { res.json(listNexoraBacktestRuns({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

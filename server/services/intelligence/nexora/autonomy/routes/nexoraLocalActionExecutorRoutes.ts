import {
  getNexoraLocalActionExecutorReport,
  getNexoraLocalActionExecutorStatus,
  runNexoraLocalActionExecutor,
} from "../localexecutor/nexoraLocalActionExecutor";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraLocalActionExecutorRoutes(app: any) {
  app.get("/api/nexora/local-executor/status", (_req: any, res: any) => {
    try { res.json(getNexoraLocalActionExecutorStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-executor/run", (req: any, res: any) => {
    try { res.json(runNexoraLocalActionExecutor(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-executor/dry-run", (req: any, res: any) => {
    try { res.json(runNexoraLocalActionExecutor({ ...(req.body || {}), dryRun: true })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-executor/report", (req: any, res: any) => {
    try { res.json(getNexoraLocalActionExecutorReport({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });
}

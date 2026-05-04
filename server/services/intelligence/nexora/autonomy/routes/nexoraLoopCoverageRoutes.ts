import {
  auditNexoraLoopCoverage,
  createNexoraLoopCoverageReport,
  expandNexoraSafeLoopCoverage,
  getNexoraLoopCoverageRegistry,
  getNexoraLoopCoverageStatus,
} from "../loopcoverage/nexoraLoopCoverageEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraLoopCoverageRoutes(app: any) {
  app.get("/api/nexora/loop-coverage/status", (_req: any, res: any) => {
    try { res.json(getNexoraLoopCoverageStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/loop-coverage/audit", (_req: any, res: any) => {
    try { res.json(auditNexoraLoopCoverage()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/loop-coverage/expand-safe", (req: any, res: any) => {
    try { res.json(expandNexoraSafeLoopCoverage(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/loop-coverage/registry", (_req: any, res: any) => {
    try { res.json(getNexoraLoopCoverageRegistry()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/loop-coverage/report", (_req: any, res: any) => {
    try { res.json(createNexoraLoopCoverageReport()); } catch (error) { sendError(res, error); }
  });
}

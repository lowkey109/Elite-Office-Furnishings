import {
  createNexoraLocalCommandCenterReport,
  getNexoraLocalCommandCenterSnapshot,
  getNexoraLocalCommandCenterStatus,
} from "../localcommandcenter/nexoraLocalCommandCenter";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraLocalCommandCenterRoutes(app: any) {
  app.get("/api/nexora/local-command-center/status", (_req: any, res: any) => {
    try { res.json(getNexoraLocalCommandCenterStatus()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-command-center/snapshot", (req: any, res: any) => {
    try { res.json(getNexoraLocalCommandCenterSnapshot({ snapshotId: req.query?.snapshotId || undefined })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-command-center/report", (req: any, res: any) => {
    try { res.json(createNexoraLocalCommandCenterReport(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

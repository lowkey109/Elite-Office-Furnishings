import {
  createNexoraFinalLocalV1ReleasePack,
  getNexoraFinalLocalV1Status,
  runNexoraFinalLocalV1Checks,
} from "../localv1/nexoraFinalLocalV1ReleasePack";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraFinalLocalV1Routes(app: any) {
  app.get("/api/nexora/final-local-v1/status", (_req: any, res: any) => {
    try { res.json(getNexoraFinalLocalV1Status()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/final-local-v1/check", (_req: any, res: any) => {
    try { res.json(runNexoraFinalLocalV1Checks()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/final-local-v1/release-pack", (req: any, res: any) => {
    try { res.json(createNexoraFinalLocalV1ReleasePack(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

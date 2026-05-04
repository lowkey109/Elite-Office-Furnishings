import {
  getNexoraPaperAutopilotStatus,
  runNexoraPaperAutopilotBatch,
  runNexoraPaperAutopilotEvidenceCycle,
} from "../paperautopilot/nexoraPaperAutopilotEvidenceEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPaperAutopilotEvidenceRoutes(app: any) {
  app.get("/api/nexora/paper-autopilot/status", (_req: any, res: any) => {
    try { res.json(getNexoraPaperAutopilotStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/paper-autopilot/cycle", (req: any, res: any) => {
    runNexoraPaperAutopilotEvidenceCycle(req.body || {})
      .then((result) => res.json(result))
      .catch((error) => sendError(res, error));
  });

  app.post("/api/nexora/paper-autopilot/batch", (req: any, res: any) => {
    runNexoraPaperAutopilotBatch(req.body || {})
      .then((result) => res.json(result))
      .catch((error) => sendError(res, error));
  });
}

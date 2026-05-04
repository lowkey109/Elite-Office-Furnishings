import {
  getNexoraActiveLocalLoopStatus,
  runNexoraActiveLocalLoopTick,
  seedNexoraActiveLocalLoopDefaults,
  startNexoraActiveLocalLoop,
  stopNexoraActiveLocalLoop,
} from "../loopdaemon/nexoraActiveLocalLoopDaemon";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraActiveLocalLoopDaemonRoutes(app: any) {
  // Start immediately when routes are mounted.
  try {
    startNexoraActiveLocalLoop({
      enabled: true,
    });
  } catch (error) {
    console.error("[NEXORA_ACTIVE_LOCAL_LOOP_START_ERROR]", error);
  }

  app.get("/api/nexora/active-loop/status", (_req: any, res: any) => {
    try { res.json(getNexoraActiveLocalLoopStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/active-loop/start", (req: any, res: any) => {
    try { res.json(startNexoraActiveLocalLoop(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/active-loop/stop", (_req: any, res: any) => {
    try { res.json(stopNexoraActiveLocalLoop()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/active-loop/tick", (req: any, res: any) => {
    try {
      runNexoraActiveLocalLoopTick(req.body || {})
        .then((result) => res.json(result))
        .catch((error) => sendError(res, error));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/active-loop/seed", (_req: any, res: any) => {
    try { res.json(seedNexoraActiveLocalLoopDefaults()); } catch (error) { sendError(res, error); }
  });
}

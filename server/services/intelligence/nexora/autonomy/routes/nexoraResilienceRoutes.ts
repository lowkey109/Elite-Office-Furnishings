import {
  captureNexoraFallbackEvent,
  detectNexoraResilienceMode,
  getNexoraFallbackJournal,
  getNexoraMaintenanceConsole,
  replayNexoraFallbackJournal,
  runNexoraResilienceCycle,
  safeCreateNexoraTaskOrFallback,
} from "../resilience/nexoraResilienceCore";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraResilienceRoutes(app: any) {
  app.get("/api/nexora/resilience/status", async (_req: any, res: any) => {
    try {
      res.json(await detectNexoraResilienceMode());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/resilience/capture", async (req: any, res: any) => {
    try {
      res.json(await captureNexoraFallbackEvent(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/resilience/task", async (req: any, res: any) => {
    try {
      res.json(await safeCreateNexoraTaskOrFallback(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/resilience/journal", async (req: any, res: any) => {
    try {
      res.json(await getNexoraFallbackJournal({
        limit: Number(req.query?.limit || 50),
      }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/resilience/replay", async (req: any, res: any) => {
    try {
      res.json(await replayNexoraFallbackJournal(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/resilience/cycle", async (req: any, res: any) => {
    try {
      res.json(await runNexoraResilienceCycle(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/maintenance/console", async (_req: any, res: any) => {
    try {
      res.json(await getNexoraMaintenanceConsole());
    } catch (error) {
      sendError(res, error);
    }
  });
}

import {
  createNexoraOperatingCadence,
  executeNexoraMission,
  generateNexoraRunbook,
  getNexoraMissionControlStatus,
  queueNexoraRunbook,
  registerNexoraMissionControlWorkers,
} from "../mission/nexoraMissionControl";

export function registerNexoraMissionControlRoutes(server: any, app?: any) {
  const router = app || server;

  router.get("/api/nexora/mission/status", async (_req: any, res: any) => {
    try {
      const result = await getNexoraMissionControlStatus();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/mission/register-workers", async (_req: any, res: any) => {
    try {
      const result = await registerNexoraMissionControlWorkers();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/mission/runbook/generate", async (req: any, res: any) => {
    try {
      const result = generateNexoraRunbook(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/mission/runbook/queue", async (req: any, res: any) => {
    try {
      const result = await queueNexoraRunbook(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/mission/execute", async (req: any, res: any) => {
    try {
      const result = await executeNexoraMission(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/mission/cadence/create", async (req: any, res: any) => {
    try {
      const result = await createNexoraOperatingCadence(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

import {
  createNexoraAutopilotScenario,
  createNexoraKpiLedgerSnapshot,
  detectNexoraOperationalIncidents,
  getNexoraAutopilotCommandView,
  registerNexoraAutopilotWorkers,
  runNexoraAutopilotCycle,
  runNexoraPipelineForemanCycle,
} from "../autopilot/nexoraOperationalAutopilot";

export function registerNexoraOperationalAutopilotRoutes(server: any, app?: any) {
  const router = app || server;

  router.get("/api/nexora/autopilot/status", async (_req: any, res: any) => {
    try {
      const result = await getNexoraAutopilotCommandView();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/autopilot/register-workers", async (_req: any, res: any) => {
    try {
      const result = await registerNexoraAutopilotWorkers();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/autopilot/cycle", async (req: any, res: any) => {
    try {
      const result = await runNexoraAutopilotCycle(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/autopilot/incidents/detect", async (req: any, res: any) => {
    try {
      const result = await detectNexoraOperationalIncidents(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/autopilot/kpi/snapshot", async (req: any, res: any) => {
    try {
      const result = await createNexoraKpiLedgerSnapshot(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/autopilot/scenario", async (req: any, res: any) => {
    try {
      const result = await createNexoraAutopilotScenario(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/autopilot/pipeline-foreman", async (req: any, res: any) => {
    try {
      const result = await runNexoraPipelineForemanCycle(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

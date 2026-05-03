import {
  buildNexoraCapabilityGraph,
  executeNexoraSupremeMatrix,
  generateNexoraWorkerDance,
  getNexoraSupremeMatrixStatus,
  queueNexoraWorkerDance,
  recordNexoraDecision,
  registerNexoraSupremeWorkers,
  rehearseNexoraWorkerDance,
  runNexoraRedTeamSafetyDrill,
} from "../supreme/nexoraSupremeOrchestrationMatrix";

export function registerNexoraSupremeMatrixRoutes(server: any, app?: any) {
  const router = app || server;

  router.get("/api/nexora/supreme/status", async (_req: any, res: any) => {
    try {
      const result = await getNexoraSupremeMatrixStatus();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/supreme/register-workers", async (_req: any, res: any) => {
    try {
      const result = await registerNexoraSupremeWorkers();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/supreme/decision/record", async (req: any, res: any) => {
    try {
      const result = await recordNexoraDecision(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/supreme/capability-graph/build", async (req: any, res: any) => {
    try {
      const result = await buildNexoraCapabilityGraph(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/supreme/dance/generate", async (req: any, res: any) => {
    try {
      const result = generateNexoraWorkerDance(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/supreme/dance/rehearse", async (req: any, res: any) => {
    try {
      const result = await rehearseNexoraWorkerDance(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/supreme/dance/queue", async (req: any, res: any) => {
    try {
      const result = await queueNexoraWorkerDance(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/supreme/red-team/run", async (req: any, res: any) => {
    try {
      const result = await runNexoraRedTeamSafetyDrill(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/supreme/matrix/execute", async (req: any, res: any) => {
    try {
      const result = await executeNexoraSupremeMatrix(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

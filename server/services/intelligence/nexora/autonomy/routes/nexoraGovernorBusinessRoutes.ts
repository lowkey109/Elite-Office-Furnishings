import {
  classifyNexoraRisk,
  governAndQueueNexoraAction,
  runNexoraGovernorCycle,
  runNexoraSlaWatchdog,
  runNexoraWorkerEvolutionCycle,
} from "../governor/nexoraAutonomyGovernor";
import {
  createNexoraBusinessPipeline,
  runNexoraBulkBusinessPipeline,
} from "../business/nexoraBusinessPipelineEngine";

export function registerNexoraGovernorBusinessRoutes(server: any, app?: any) {
  const router = app || server;

  router.post("/api/nexora/governor/classify", async (req: any, res: any) => {
    try {
      const decision = classifyNexoraRisk(req.body || {});
      res.json({ ok: true, nexoraBrain: true, decision });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/governor/queue", async (req: any, res: any) => {
    try {
      const result = await governAndQueueNexoraAction(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/governor/cycle", async (req: any, res: any) => {
    try {
      const result = await runNexoraGovernorCycle(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/governor/sla-watchdog", async (req: any, res: any) => {
    try {
      const result = await runNexoraSlaWatchdog(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/governor/worker-evolution", async (_req: any, res: any) => {
    try {
      const result = await runNexoraWorkerEvolutionCycle();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/business/pipeline", async (req: any, res: any) => {
    try {
      const result = await createNexoraBusinessPipeline(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/business/pipeline/bulk", async (req: any, res: any) => {
    try {
      const result = await runNexoraBulkBusinessPipeline(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

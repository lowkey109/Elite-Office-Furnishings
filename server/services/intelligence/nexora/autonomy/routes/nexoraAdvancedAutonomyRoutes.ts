import {
  approveNexoraDurableTask,
  claimAndRunNexoraSafeTasks,
  createNexoraDelegation,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  runNexoraEmpireCycle,
  sendNexoraWorkerMessage,
  upsertNexoraWorker,
} from "../persistence/nexoraDurableKernel";

export function registerNexoraAdvancedAutonomyRoutes(server: any, app?: any) {
  const router = app || server;

  router.get("/api/nexora/advanced/status", async (_req: any, res: any) => {
    try {
      const kernel = await ensureNexoraDurableKernel();
      const snapshot = await getNexoraDurableCommandSnapshot();
      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_advanced_autonomy",
        kernel,
        snapshot,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/workers/upsert", async (req: any, res: any) => {
    try {
      const result = await upsertNexoraWorker(req.body || {});
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/tasks", async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createNexoraDurableTask({
        worker: String(body.worker || "office_receptionist"),
        area: String(body.area || "office"),
        action: String(body.action || "safe_next_action"),
        risk: body.risk || "safe",
        priority: Number(body.priority || 50),
        payload: body.payload || {},
        approvalRequired: Boolean(body.approvalRequired),
        source: body.source || "api",
        maxAttempts: Number(body.maxAttempts || 3),
      });
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/approvals/:approvalId/approve", async (req: any, res: any) => {
    try {
      const result = await approveNexoraDurableTask(
        req.params.approvalId,
        req.body?.decidedBy || "nexora-admin",
        req.body?.note || "Approved through Nexora gate."
      );
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/tasks/run-safe", async (req: any, res: any) => {
    try {
      const limit = Number(req.body?.limit || 20);
      const result = await claimAndRunNexoraSafeTasks(limit);
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/messages", async (req: any, res: any) => {
    try {
      const result = await sendNexoraWorkerMessage(req.body || {});
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/graph/edge", async (req: any, res: any) => {
    try {
      const result = await createNexoraMemoryGraphEdge(req.body || {});
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/delegations", async (req: any, res: any) => {
    try {
      const result = await createNexoraDelegation(req.body || {});
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/objectives", async (req: any, res: any) => {
    try {
      const result = await createNexoraDivisionObjective(req.body || {});
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/advanced/empire/cycle", async (_req: any, res: any) => {
    try {
      const result = await runNexoraEmpireCycle();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.get("/api/nexora/advanced/command/snapshot", async (_req: any, res: any) => {
    try {
      const result = await getNexoraDurableCommandSnapshot();
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

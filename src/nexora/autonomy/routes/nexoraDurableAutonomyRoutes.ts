import {
  approveNexoraTask,
  createNexoraDurableTask,
  getNexoraDurableSnapshot,
  initializeNexoraDurableAutonomy,
  rejectNexoraTask,
  seedNexoraDurableWorkers,
} from '../persistence/nexoraDurableAutonomyStore';
import { enqueueNexoraPgBossTask, getNexoraPgBoss } from '../persistence/nexoraPgBossBridge';
import {
  runNexoraDurableAutonomyCycle,
  startNexoraAutonomousLoopTimer,
} from '../loops/nexoraAutonomousLoopController';

export function registerNexoraDurableAutonomyRoutes(app: any): void {
  app.get('/api/nexora/autonomy/persistence/status', async (_req: any, res: any) => {
    try {
      const init = await initializeNexoraDurableAutonomy();
      const loop = startNexoraAutonomousLoopTimer();
      const boss = await getNexoraPgBoss();

      res.json({
        ok: true,
        nexoraBrain: true,
        persistent: init.persistent,
        pgBoss: Boolean(boss),
        loop,
        message: init.message,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/persistence/seed', async (_req: any, res: any) => {
    try {
      await initializeNexoraDurableAutonomy();
      await seedNexoraDurableWorkers();
      res.json({
        ok: true,
        seeded: true,
        message: 'Nexora durable workers seeded under the single Nexora brain.',
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/nexora/autonomy/persistence/snapshot', async (_req: any, res: any) => {
    try {
      const snapshot = await getNexoraDurableSnapshot();
      res.json({
        ok: true,
        nexoraBrain: true,
        snapshot,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/tasks', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const task = await createNexoraDurableTask({
        workerKey: String(body.workerKey || 'reporting.command-centre'),
        division: String(body.division || 'reporting'),
        kind: String(body.kind || 'operating_snapshot'),
        risk: body.risk || 'low',
        priority: Number(body.priority || 50),
        payload: body.payload || {},
        maxAttempts: Number(body.maxAttempts || 3),
        source: body.source || 'api',
        approvalRequired: Boolean(body.approvalRequired),
      });

      res.json({
        ok: true,
        task,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/tasks/enqueue', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await enqueueNexoraPgBossTask({
        workerKey: String(body.workerKey || 'office.receptionist'),
        division: String(body.division || 'office'),
        kind: String(body.kind || 'lead_followup'),
        risk: body.risk || 'low',
        priority: Number(body.priority || 60),
        payload: body.payload || {},
        maxAttempts: Number(body.maxAttempts || 3),
        source: body.source || 'api.pg-boss',
        approvalRequired: Boolean(body.approvalRequired),
      });

      res.json({
        ok: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/approvals/:approvalId/approve', async (req: any, res: any) => {
    try {
      await approveNexoraTask(
        req.params.approvalId,
        req.body?.decidedBy || 'nexora-admin',
        req.body?.note || 'Approved through Nexora approval gate.',
      );

      res.json({
        ok: true,
        approvalId: req.params.approvalId,
        status: 'approved',
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/approvals/:approvalId/reject', async (req: any, res: any) => {
    try {
      await rejectNexoraTask(
        req.params.approvalId,
        req.body?.decidedBy || 'nexora-admin',
        req.body?.note || 'Rejected through Nexora approval gate.',
      );

      res.json({
        ok: true,
        approvalId: req.params.approvalId,
        status: 'rejected',
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/loop/run', async (_req: any, res: any) => {
    try {
      const result = await runNexoraDurableAutonomyCycle();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/loop/start', async (_req: any, res: any) => {
    try {
      const result = startNexoraAutonomousLoopTimer();
      res.json({
        ok: true,
        ...result,
        note: result.started
          ? 'Nexora autonomous loop timer is active in this process.'
          : 'Set NEXORA_AUTONOMY_LOOP_ENABLED=true to enable automatic in-process loops.',
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

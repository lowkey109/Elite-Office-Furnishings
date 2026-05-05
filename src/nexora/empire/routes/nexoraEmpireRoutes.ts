import {
  actionNexoraWorkerMessage,
  createDivisionObjective,
  createMemoryGraphEdge,
  createNexoraDelegation,
  createNexoraWorkerMessage,
  createStrategicPlanningCycle,
  getNexoraEmpireSnapshot,
  runNexoraEmpireOperatingCycle,
  seedNexoraEmpireDivisions,
} from '../nexoraEmpireEngine';

export function registerNexoraEmpireRoutes(app: any): void {
  app.get('/api/nexora/empire/status', async (_req: any, res: any) => {
    try {
      const snapshot = await getNexoraEmpireSnapshot();
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/seed', async (_req: any, res: any) => {
    try {
      const result = await seedNexoraEmpireDivisions();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/cycle/run', async (_req: any, res: any) => {
    try {
      const result = await runNexoraEmpireOperatingCycle();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/messages', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createNexoraWorkerMessage({
        fromWorker: String(body.fromWorker || 'reporting.command-centre'),
        toWorker: String(body.toWorker || 'office.receptionist'),
        fromDivision: String(body.fromDivision || 'reporting'),
        toDivision: String(body.toDivision || 'office'),
        subject: String(body.subject || 'Nexora worker message'),
        body: String(body.body || 'Review this message and create next action if required.'),
        priority: Number(body.priority || 50),
        payload: body.payload || {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/messages/:messageId/action', async (req: any, res: any) => {
    try {
      const result = await actionNexoraWorkerMessage(
        req.params.messageId,
        req.body?.status || 'actioned',
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/delegations', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createNexoraDelegation({
        parentWorker: String(body.parentWorker || 'strategy.planning-engine'),
        childWorker: String(body.childWorker || 'office.receptionist'),
        parentDivision: String(body.parentDivision || 'strategy'),
        childDivision: String(body.childDivision || 'office'),
        mission: String(body.mission || 'Execute delegated Nexora mission.'),
        authorityScope: String(body.authorityScope || 'Low-risk planning only. No binding commitments.'),
        risk: body.risk || 'medium',
        payload: body.payload || {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/objectives', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createDivisionObjective({
        division: String(body.division || 'office'),
        objective: String(body.objective || 'Improve office furniture lead handling.'),
        metric: String(body.metric || 'qualified_leads'),
        target: String(body.target || 'increase safely'),
        ownerWorker: String(body.ownerWorker || 'office.receptionist'),
        priority: Number(body.priority || 50),
        payload: body.payload || {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/memory-graph/edges', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createMemoryGraphEdge({
        sourceType: String(body.sourceType || 'worker'),
        sourceId: String(body.sourceId || 'office.receptionist'),
        relation: body.relation || 'serves',
        targetType: String(body.targetType || 'division'),
        targetId: String(body.targetId || 'office'),
        weight: Number(body.weight || 1),
        payload: body.payload || {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/strategy/cycles', async (req: any, res: any) => {
    try {
      const result = await createStrategicPlanningCycle(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

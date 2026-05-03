import {
  getNexoraStorageGuardStatus,
  inspectNexoraLocalStorage,
} from "../storageguard/nexoraLocalStorageGuard";
import {
  getNexoraCompactionStatus,
  planNexoraLocalCompaction,
  runNexoraLocalCompactionDryRun,
} from "../compaction/nexoraLocalCompactionEngine";
import {
  getNexoraWorkflowSimulatorStatus,
  simulateNexoraWorkflow,
} from "../simulation/nexoraWorkflowSimulator";
import {
  createNexoraDecisionRule,
  evaluateNexoraDecisionRules,
  listNexoraDecisionRules,
} from "../rules/nexoraDecisionRuleEngine";
import {
  createNexoraMaintenancePlan,
  getNexoraMaintenancePlannerStatus,
} from "../maintenance/nexoraMaintenancePlanner";
import {
  listNexoraOperatingTraces,
  recordNexoraOperatingTrace,
} from "../trace/nexoraOperatingTrace";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraAdvancedLocalOpsRoutes(app: any) {
  app.get("/api/nexora/advanced-local/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        storage: getNexoraStorageGuardStatus(),
        compaction: getNexoraCompactionStatus(),
        simulation: getNexoraWorkflowSimulatorStatus(),
        maintenance: getNexoraMaintenancePlannerStatus(),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/storage/inspect", (req: any, res: any) => {
    try { res.json(inspectNexoraLocalStorage({ limitMb: Number(req.query?.limitMb || 250) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/compaction/plan", (req: any, res: any) => {
    try { res.json(planNexoraLocalCompaction(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/compaction/dry-run", (req: any, res: any) => {
    try { res.json(runNexoraLocalCompactionDryRun(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/workflow-simulator/run", (req: any, res: any) => {
    try { res.json(simulateNexoraWorkflow(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/rules/create", (req: any, res: any) => {
    try { res.json(createNexoraDecisionRule(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/rules/evaluate", (req: any, res: any) => {
    try { res.json(evaluateNexoraDecisionRules(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/rules/list", (req: any, res: any) => {
    try { res.json(listNexoraDecisionRules({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/maintenance/plan", (req: any, res: any) => {
    try { res.json(createNexoraMaintenancePlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/trace/record", (req: any, res: any) => {
    try { res.json(recordNexoraOperatingTrace(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/trace/list", (req: any, res: any) => {
    try { res.json(listNexoraOperatingTraces({ limit: Number(req.query?.limit || 100), severity: req.query?.severity || "" })); } catch (error) { sendError(res, error); }
  });
}

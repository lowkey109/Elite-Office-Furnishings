import {
  createNexoraExecutionPlan,
  createNexoraRunbook,
  getNexoraCommandDashboard,
  getNexoraCommandOrchestratorStatus,
  listNexoraCommands,
  queueNexoraCommand,
  registerNexoraCommand,
  runNexoraCommandDryRun,
  seedNexoraCommandTemplates,
} from "../commandorchestrator/nexoraCommandOrchestrator";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraCommandOrchestratorRoutes(app: any) {
  app.get("/api/nexora/command-orchestrator/status", (_req: any, res: any) => {
    try { res.json(getNexoraCommandOrchestratorStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/command-orchestrator/seed", (_req: any, res: any) => {
    try { res.json(seedNexoraCommandTemplates()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/command-orchestrator/register", (req: any, res: any) => {
    try { res.json(registerNexoraCommand(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/command-orchestrator/commands", (req: any, res: any) => {
    try { res.json(listNexoraCommands({ department: req.query?.department || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/command-orchestrator/plan", (req: any, res: any) => {
    try { res.json(createNexoraExecutionPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/command-orchestrator/runbook", (req: any, res: any) => {
    try { res.json(createNexoraRunbook(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/command-orchestrator/queue", (req: any, res: any) => {
    try { res.json(queueNexoraCommand(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/command-orchestrator/dry-run", (req: any, res: any) => {
    try { res.json(runNexoraCommandDryRun(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/command-orchestrator/dashboard", (_req: any, res: any) => {
    try { res.json(getNexoraCommandDashboard({})); } catch (error) { sendError(res, error); }
  });
}

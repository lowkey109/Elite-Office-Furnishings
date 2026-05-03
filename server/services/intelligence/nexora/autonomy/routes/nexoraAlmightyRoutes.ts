import {
  compileNexoraGoal,
  getNexoraGoalCompilerStatus,
  listNexoraCompiledGoals,
} from "../goalcompiler/nexoraGoalCompiler";
import {
  createNexoraPlaybook,
  getNexoraPlaybookStatus,
  listNexoraPlaybooks,
  runNexoraPlaybookDryRun,
} from "../playbooks/nexoraPlaybookRunner";
import {
  getNexoraRiskSimulatorStatus,
  listNexoraRiskSimulations,
  runNexoraRiskSimulation,
} from "../risksim/nexoraRiskSimulator";
import {
  createNexoraAlmightyCommand,
  getNexoraAlmightyStatus,
} from "../almighty/nexoraAlmightyCommander";
import { createNexoraBrainPack } from "../brainpack/nexoraBrainPack";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraAlmightyRoutes(app: any) {
  app.get("/api/nexora/almighty/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        almighty: getNexoraAlmightyStatus(),
        goals: getNexoraGoalCompilerStatus(),
        playbooks: getNexoraPlaybookStatus(),
        risk: getNexoraRiskSimulatorStatus(),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/goals/compile", (req: any, res: any) => {
    try { res.json(compileNexoraGoal(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/goals/list", (req: any, res: any) => {
    try { res.json(listNexoraCompiledGoals({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/playbooks/create", (req: any, res: any) => {
    try { res.json(createNexoraPlaybook(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/playbooks/dry-run", (req: any, res: any) => {
    try { res.json(runNexoraPlaybookDryRun(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/playbooks/list", (req: any, res: any) => {
    try { res.json(listNexoraPlaybooks({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/risk-sim/run", (req: any, res: any) => {
    try { res.json(runNexoraRiskSimulation(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/risk-sim/list", (req: any, res: any) => {
    try { res.json(listNexoraRiskSimulations({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/almighty/command", (req: any, res: any) => {
    try { res.json(createNexoraAlmightyCommand(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/brainpack/create", (req: any, res: any) => {
    try { res.json(createNexoraBrainPack(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

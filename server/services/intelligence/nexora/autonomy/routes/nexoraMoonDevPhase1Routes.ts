import {
  createMoonDevBaseAgentAdapterPlan,
  createMoonDevCopyWhaleAdapterPlan,
  createMoonDevPhase1MasterPlan,
  createMoonDevPolymarketAdapterPlan,
  createMoonDevRiskAdapterPlan,
  createMoonDevStrategyAdapterPlan,
  createMoonDevSwarmAdapterPlan,
  getMoonDevPhase1AdapterStatus,
} from "../moondevphase1/nexoraMoonDevPhase1Adapters";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraMoonDevPhase1Routes(app: any) {
  app.get("/api/nexora/moondev-phase1/status", (_req: any, res: any) => {
    try { res.json(getMoonDevPhase1AdapterStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-phase1/base-agent", (req: any, res: any) => {
    try { res.json(createMoonDevBaseAgentAdapterPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-phase1/swarm", (req: any, res: any) => {
    try { res.json(createMoonDevSwarmAdapterPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-phase1/risk", (req: any, res: any) => {
    try { res.json(createMoonDevRiskAdapterPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-phase1/strategy", (req: any, res: any) => {
    try { res.json(createMoonDevStrategyAdapterPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-phase1/polymarket", (req: any, res: any) => {
    try { res.json(createMoonDevPolymarketAdapterPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-phase1/copy-whale", (req: any, res: any) => {
    try { res.json(createMoonDevCopyWhaleAdapterPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/moondev-phase1/master-plan", (req: any, res: any) => {
    try { res.json(createMoonDevPhase1MasterPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

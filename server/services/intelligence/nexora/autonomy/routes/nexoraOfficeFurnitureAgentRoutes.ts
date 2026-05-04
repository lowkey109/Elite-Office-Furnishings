import {
  getNexoraOfficeFurnitureAgentsStatus,
  runCrmFollowupAgent,
  runFitoutScopeAgent,
  runNexoraOfficeAgentsTick,
  runOfficeReceptionistAgent,
  runProjectHandoverAgent,
  runQuoteBuilderAgent,
  runSupplierScoutAgent,
} from "../officeagents/nexoraOfficeFurnitureAgents";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraOfficeFurnitureAgentRoutes(app: any) {
  app.get("/api/nexora/office-agents/status", (_req: any, res: any) => {
    try {
      res.json(getNexoraOfficeFurnitureAgentsStatus());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/tick", (req: any, res: any) => {
    try {
      res.json(runNexoraOfficeAgentsTick(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/lead/intake", (req: any, res: any) => {
    try {
      res.json(runOfficeReceptionistAgent(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/quote/draft", (req: any, res: any) => {
    try {
      res.json(runQuoteBuilderAgent(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/supplier/request", (req: any, res: any) => {
    try {
      res.json(runSupplierScoutAgent(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/followup/draft", (req: any, res: any) => {
    try {
      res.json(runCrmFollowupAgent(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/project/scope", (req: any, res: any) => {
    try {
      res.json(runFitoutScopeAgent(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/office-agents/project/handover", (req: any, res: any) => {
    try {
      res.json(runProjectHandoverAgent(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });
}

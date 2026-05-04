import {
  createNexoraLiveExecutionPolicy,
  createNexoraLiveMoneyApprovalRequest,
  createNexoraLiveMoneyOperatorChecklist,
  createNexoraWalletPolicy,
  evaluateNexoraLiveMoneyReadiness,
  getNexoraLiveExecutionPolicy,
  getNexoraLiveMoneyStatus,
  getNexoraWalletPolicy,
} from "../livemoney/nexoraLiveMoneyReadiness";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraLiveMoneyReadinessRoutes(app: any) {
  app.get("/api/nexora/live-money/status", (_req: any, res: any) => {
    try { res.json(getNexoraLiveMoneyStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-money/wallet-policy", (req: any, res: any) => {
    try { res.json(createNexoraWalletPolicy(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/live-money/wallet-policy", (_req: any, res: any) => {
    try { res.json(getNexoraWalletPolicy()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-money/execution-policy", (req: any, res: any) => {
    try { res.json(createNexoraLiveExecutionPolicy(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/live-money/execution-policy", (_req: any, res: any) => {
    try { res.json(getNexoraLiveExecutionPolicy()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-money/readiness", (req: any, res: any) => {
    try { res.json(evaluateNexoraLiveMoneyReadiness(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-money/approval-request", (req: any, res: any) => {
    try { res.json(createNexoraLiveMoneyApprovalRequest(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-money/operator-checklist", (req: any, res: any) => {
    try { res.json(createNexoraLiveMoneyOperatorChecklist(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

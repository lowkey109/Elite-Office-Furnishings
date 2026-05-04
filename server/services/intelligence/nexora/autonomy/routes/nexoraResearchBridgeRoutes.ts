import {
  auditNexoraResearchRepo,
  createNexoraResearchTodoPlan,
  getNexoraResearchBridgeStatus,
} from "../researchbridge/nexoraResearchBridgeEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraResearchBridgeRoutes(app: any) {
  app.get("/api/nexora/research-bridge/status", (_req: any, res: any) => {
    try { res.json(getNexoraResearchBridgeStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/research-bridge/audit", (req: any, res: any) => {
    try { res.json(auditNexoraResearchRepo(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/research-bridge/todo-plan", (req: any, res: any) => {
    try { res.json(createNexoraResearchTodoPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

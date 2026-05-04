import {
  createNexoraCompanyObjective,
  createNexoraCompanyWorkOrder,
  createNexoraDivisionOperatingPlan,
  createNexoraExecutiveCompanyRunPack,
  getNexoraCompanyDivisionMap,
  getNexoraCompanyRunStatus,
  listNexoraCompanyObjectives,
  listNexoraCompanyWorkOrders,
  runNexoraCompanyDailyCycle,
  seedNexoraCompanyAgents,
} from "../companyrun/nexoraCompanyRunEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraCompanyRunRoutes(app: any) {
  app.get("/api/nexora/company-run/status", (_req: any, res: any) => {
    try { res.json(getNexoraCompanyRunStatus()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-run/divisions", (_req: any, res: any) => {
    try { res.json(getNexoraCompanyDivisionMap()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/company-run/agents/seed", (_req: any, res: any) => {
    try { res.json(seedNexoraCompanyAgents()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/company-run/work-order", (req: any, res: any) => {
    try { res.json(createNexoraCompanyWorkOrder(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-run/work-orders", (req: any, res: any) => {
    try {
      res.json(listNexoraCompanyWorkOrders({
        division: req.query?.division || "",
        status: req.query?.status || "",
        limit: Number(req.query?.limit || 100),
      }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/company-run/objective", (req: any, res: any) => {
    try { res.json(createNexoraCompanyObjective(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-run/objectives", (req: any, res: any) => {
    try {
      res.json(listNexoraCompanyObjectives({
        division: req.query?.division || "",
        limit: Number(req.query?.limit || 100),
      }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/company-run/division-plan", (req: any, res: any) => {
    try { res.json(createNexoraDivisionOperatingPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/company-run/daily-cycle", (req: any, res: any) => {
    try { res.json(runNexoraCompanyDailyCycle(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/company-run/executive-pack", (req: any, res: any) => {
    try { res.json(createNexoraExecutiveCompanyRunPack(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

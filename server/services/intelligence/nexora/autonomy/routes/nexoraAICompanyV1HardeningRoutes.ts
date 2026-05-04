import {
  createNexoraAdminAuthScaffold,
  createNexoraCompanyRunScheduler,
  createNexoraFinalV1ReadinessReport,
  createNexoraLocalDashboardSummary,
  createNexoraMigrationReplayDryRunControl,
  createNexoraOfficeAgentCommandPack,
  createNexoraPostgresRecoveryChecklist,
  createNexoraRouteAccessMap,
  getNexoraV1HardeningStatus,
} from "../v1hardening/nexoraAICompanyV1Hardening";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraAICompanyV1HardeningRoutes(app: any) {
  app.get("/api/nexora/v1-hardening/status", (_req: any, res: any) => {
    try { res.json(getNexoraV1HardeningStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1-hardening/auth/scaffold", (req: any, res: any) => {
    try { res.json(createNexoraAdminAuthScaffold(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1-hardening/access-map/create", (req: any, res: any) => {
    try { res.json(createNexoraRouteAccessMap(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1-hardening/office-command-pack", (req: any, res: any) => {
    try { res.json(createNexoraOfficeAgentCommandPack(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1-hardening/company-scheduler", (req: any, res: any) => {
    try { res.json(createNexoraCompanyRunScheduler(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1-hardening/dashboard-summary", (req: any, res: any) => {
    try { res.json(createNexoraLocalDashboardSummary(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1-hardening/postgres/checklist", (req: any, res: any) => {
    try { res.json(createNexoraPostgresRecoveryChecklist(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1-hardening/replay/dry-run", (req: any, res: any) => {
    try { res.json(createNexoraMigrationReplayDryRunControl(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1-hardening/readiness/final", (req: any, res: any) => {
    try { res.json(createNexoraFinalV1ReadinessReport(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

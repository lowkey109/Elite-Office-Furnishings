import {
  createNexoraAuthPolicy,
  evaluateNexoraAuthRequest,
  getNexoraAuthStatus,
  listNexoraAuthEvents,
} from "../auth/nexoraAuthEnforcement";
import {
  createNexoraRouteGovernanceSnapshot,
  evaluateNexoraRouteRisk,
  listNexoraRouteGovernanceSnapshots,
} from "../routegovernance/nexoraRouteGovernance";
import {
  createNexoraMigrationChecklist,
  createNexoraMigrationPack,
} from "../migrationpack/nexoraMigrationPackBuilder";
import {
  createNexoraRestorePoint,
  dryRunNexoraRestorePoint,
  listNexoraRestorePoints,
} from "../restore/nexoraRestoreControls";
import { runNexoraLocalMonitorCheck } from "../localmonitor/nexoraLocalMonitor";
import {
  createNexoraV1ReleaseCandidate,
  getNexoraV1ReleaseGate,
} from "../v1/nexoraV1ReleaseControls";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraProductionReadinessRoutes(app: any) {
  app.get("/api/nexora/prod-readiness/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        auth: getNexoraAuthStatus(),
        monitor: runNexoraLocalMonitorCheck(),
        releaseGate: getNexoraV1ReleaseGate({ postgresReady: false }),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/auth/policy/create", (req: any, res: any) => {
    try { res.json(createNexoraAuthPolicy(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/auth/evaluate", (req: any, res: any) => {
    try { res.json(evaluateNexoraAuthRequest(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/auth/events", (req: any, res: any) => {
    try { res.json(listNexoraAuthEvents({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/route-governance/snapshot", (_req: any, res: any) => {
    try { res.json(createNexoraRouteGovernanceSnapshot()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/route-governance/evaluate", (req: any, res: any) => {
    try { res.json(evaluateNexoraRouteRisk(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/route-governance/snapshots", (req: any, res: any) => {
    try { res.json(listNexoraRouteGovernanceSnapshots({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/migration-pack/create", (req: any, res: any) => {
    try { res.json(createNexoraMigrationPack(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/migration-pack/checklist", (_req: any, res: any) => {
    try { res.json(createNexoraMigrationChecklist()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/restore/point/create", (req: any, res: any) => {
    try { res.json(createNexoraRestorePoint(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/restore/dry-run", (req: any, res: any) => {
    try { res.json(dryRunNexoraRestorePoint(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/restore/points", (_req: any, res: any) => {
    try { res.json(listNexoraRestorePoints()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-monitor/check", (_req: any, res: any) => {
    try { res.json(runNexoraLocalMonitorCheck()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1/release-candidate", (req: any, res: any) => {
    try { res.json(createNexoraV1ReleaseCandidate(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/v1/release-gate", (req: any, res: any) => {
    try { res.json(getNexoraV1ReleaseGate(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

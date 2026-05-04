import {
  getClobSnapshotFillStatus,
  listClobSnapshotPaperFills,
  simulatePaperFillFromClobSnapshot,
} from "../polyfinalfive/clobfill/nexoraClobSnapshotFillSimulator";
import {
  createPaperPnlDashboard,
  getPaperPnlDashboardStatus,
  listPaperPnlDashboards,
} from "../polyfinalfive/pnldashboard/nexoraPaperPnlDashboardPolish";
import {
  getMoonDevImportedStrategyTournamentStatus,
  listMoonDevImportedStrategyTournaments,
  runMoonDevImportedStrategyTournament,
} from "../polyfinalfive/moondevtournament/nexoraMoonDevTournamentFromImported";
import {
  getKillSwitchStressStatus,
  listKillSwitchStressSuites,
  runKillSwitchStressSuite,
} from "../polyfinalfive/killtests/nexoraKillSwitchStressTests";
import {
  createFinalPaperTradingReadinessReport,
  getFinalPaperReadinessStatus,
  listFinalPaperReadinessReports,
} from "../polyfinalfive/readiness/nexoraFinalPaperReadiness";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolyFinalFivePackRoutes(app: any) {
  app.get("/api/nexora/poly-final-five/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_poly_final_five_pack",
        clobFill: getClobSnapshotFillStatus(),
        pnlDashboard: getPaperPnlDashboardStatus(),
        moondevTournament: getMoonDevImportedStrategyTournamentStatus(),
        killTests: getKillSwitchStressStatus(),
        finalReadiness: getFinalPaperReadinessStatus(),
      });
    } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-final-five/clob-fill/simulate", (req: any, res: any) => {
    try { res.json(simulatePaperFillFromClobSnapshot(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-final-five/clob-fill/list", (req: any, res: any) => {
    try { res.json(listClobSnapshotPaperFills({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-final-five/pnl-dashboard/create", (req: any, res: any) => {
    try { res.json(createPaperPnlDashboard(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-final-five/pnl-dashboard/list", (req: any, res: any) => {
    try { res.json(listPaperPnlDashboards({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-final-five/moondev-tournament/run", (req: any, res: any) => {
    try { res.json(runMoonDevImportedStrategyTournament(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-final-five/moondev-tournament/list", (req: any, res: any) => {
    try { res.json(listMoonDevImportedStrategyTournaments({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-final-five/kill-tests/run", (req: any, res: any) => {
    try { res.json(runKillSwitchStressSuite(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-final-five/kill-tests/list", (req: any, res: any) => {
    try { res.json(listKillSwitchStressSuites({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-final-five/readiness/create", (req: any, res: any) => {
    try { res.json(createFinalPaperTradingReadinessReport(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-final-five/readiness/list", (req: any, res: any) => {
    try { res.json(listFinalPaperReadinessReports({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });
}

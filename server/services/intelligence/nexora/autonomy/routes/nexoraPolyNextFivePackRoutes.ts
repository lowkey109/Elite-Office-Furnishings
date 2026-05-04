import {
  createPolyMarketDiscoveryQuery,
  getPolyMarketApiConfig,
  getPolyMarketApiDiscoveryStatus,
  importPolyGammaMarkets,
  listPolyMarketApiMarkets,
  normalizePolyGammaMarket,
  setPolyMarketApiConfig,
} from "../polynextfive/marketapi/nexoraPolyMarketApiDiscovery";
import {
  createClobOrderbookFetchPlan,
  getClobFetchDesignStatus,
  listClobFetchRecords,
  normalizeClobFetchedBook,
} from "../polynextfive/orderbook/nexoraPolyClobFetchDesign";
import {
  getPolyStrategyTournamentStatus,
  listPolyStrategyTournaments,
  runPolyStrategyTournament,
} from "../polynextfive/strategytournament/nexoraPolyStrategyTournament";
import {
  getPolyRiskStressStatus,
  listPolyRiskStressTests,
  runPolyRiskStressTest,
} from "../polynextfive/riskstress/nexoraPolyRiskStress";
import {
  createPolyEvidencePipelineReport,
  getPolyEvidencePipelineStatus,
  listPolyEvidencePipelineReports,
} from "../polynextfive/evidence/nexoraPolyEvidencePipeline";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolyNextFivePackRoutes(app: any) {
  app.get("/api/nexora/poly-next-five/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_poly_next_five_pack",
        marketApi: getPolyMarketApiDiscoveryStatus(),
        orderbook: getClobFetchDesignStatus(),
        tournament: getPolyStrategyTournamentStatus(),
        riskStress: getPolyRiskStressStatus(),
        evidence: getPolyEvidencePipelineStatus(),
      });
    } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-next-five/market-api/config", (req: any, res: any) => {
    try { res.json(setPolyMarketApiConfig(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-next-five/market-api/config", (_req: any, res: any) => {
    try { res.json(getPolyMarketApiConfig()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-next-five/market-api/query", (req: any, res: any) => {
    try { res.json(createPolyMarketDiscoveryQuery(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-next-five/market-api/import", (req: any, res: any) => {
    try { res.json(importPolyGammaMarkets(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-next-five/market-api/markets", (req: any, res: any) => {
    try { res.json(listPolyMarketApiMarkets({ asset: req.query?.asset || "", activeOnly: req.query?.activeOnly === "true", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-next-five/clob/fetch-plan", (req: any, res: any) => {
    try { res.json(createClobOrderbookFetchPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-next-five/clob/normalize", (req: any, res: any) => {
    try { res.json(normalizeClobFetchedBook(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-next-five/clob/records", (req: any, res: any) => {
    try { res.json(listClobFetchRecords({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-next-five/strategy/tournament", (req: any, res: any) => {
    try { res.json(runPolyStrategyTournament(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-next-five/strategy/tournaments", (req: any, res: any) => {
    try { res.json(listPolyStrategyTournaments({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-next-five/risk/stress", (req: any, res: any) => {
    try { res.json(runPolyRiskStressTest(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-next-five/risk/stress-tests", (req: any, res: any) => {
    try { res.json(listPolyRiskStressTests({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-next-five/evidence/report", (req: any, res: any) => {
    try { res.json(createPolyEvidencePipelineReport(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-next-five/evidence/reports", (req: any, res: any) => {
    try { res.json(listPolyEvidencePipelineReports({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });
}

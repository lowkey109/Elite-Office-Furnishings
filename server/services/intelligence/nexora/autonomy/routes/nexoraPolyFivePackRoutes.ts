import {
  extractMoonDevRiskRules,
  getPolyRiskExtractorStatus,
} from "../polyfive/risk/nexoraPolyRiskExtractor";
import {
  createDefaultPolymarketWatchMarkets,
  getPolyMarketDiscoveryStatus,
  importPolymarketDiscoveredMarkets,
  listPolymarketDiscoveredMarkets,
} from "../polyfive/discovery/nexoraPolyMarketDiscovery";
import {
  getPolyClobOrderBookStatus,
  listPolymarketClobBooks,
  normalizePolymarketClobOrderBook,
} from "../polyfive/clob/nexoraPolyClobOrderBook";
import {
  batchCreateNexoraStrategyCandidates,
  createNexoraStrategyCandidateFromMoonDev,
  getPolyStrategyFactoryStatus,
  listNexoraPolyStrategyCandidates,
} from "../polyfive/strategy/nexoraMoonDevStrategyFactory";
import {
  createPolyPnlAnalyticsReport,
  getPolyPnlAnalyticsStatus,
  listPolyPnlReports,
} from "../polyfive/pnl/nexoraPolyPnlAnalytics";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolyFivePackRoutes(app: any) {
  app.get("/api/nexora/poly-five/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_poly_five_pack",
        risk: getPolyRiskExtractorStatus(),
        discovery: getPolyMarketDiscoveryStatus(),
        clob: getPolyClobOrderBookStatus(),
        strategy: getPolyStrategyFactoryStatus(),
        pnl: getPolyPnlAnalyticsStatus(),
      });
    } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-five/risk/extract", (req: any, res: any) => {
    try { res.json(extractMoonDevRiskRules(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-five/risk/status", (_req: any, res: any) => {
    try { res.json(getPolyRiskExtractorStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-five/markets/default", (req: any, res: any) => {
    try { res.json(createDefaultPolymarketWatchMarkets(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-five/markets/import", (req: any, res: any) => {
    try { res.json(importPolymarketDiscoveredMarkets(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-five/markets", (req: any, res: any) => {
    try { res.json(listPolymarketDiscoveredMarkets({ asset: req.query?.asset || "", activeOnly: req.query?.activeOnly === "true", limit: Number(req.query?.limit || 200) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-five/clob/normalize", (req: any, res: any) => {
    try { res.json(normalizePolymarketClobOrderBook(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-five/clob/books", (req: any, res: any) => {
    try { res.json(listPolymarketClobBooks({ marketId: req.query?.marketId || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-five/clob/status", (_req: any, res: any) => {
    try { res.json(getPolyClobOrderBookStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-five/strategy/create", (req: any, res: any) => {
    try { res.json(createNexoraStrategyCandidateFromMoonDev(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-five/strategy/batch", (req: any, res: any) => {
    try { res.json(batchCreateNexoraStrategyCandidates(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-five/strategy/list", (req: any, res: any) => {
    try { res.json(listNexoraPolyStrategyCandidates({ family: req.query?.family || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-five/strategy/status", (_req: any, res: any) => {
    try { res.json(getPolyStrategyFactoryStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/poly-five/pnl/report", (req: any, res: any) => {
    try { res.json(createPolyPnlAnalyticsReport(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-five/pnl/reports", (req: any, res: any) => {
    try { res.json(listPolyPnlReports({ limit: Number(req.query?.limit || 50) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/poly-five/pnl/status", (_req: any, res: any) => {
    try { res.json(getPolyPnlAnalyticsStatus()); } catch (error) { sendError(res, error); }
  });
}

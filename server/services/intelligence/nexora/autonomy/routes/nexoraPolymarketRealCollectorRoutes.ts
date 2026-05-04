import {
  createNexoraCollectorHealthReport,
  getNexoraPolymarketCollectorConfig,
  getNexoraPolymarketCollectorStatus,
  listNexoraPolymarketCollectorMarkets,
  normalizeNexoraBinanceTicker,
  normalizeNexoraPolymarketClobSnapshot,
  registerNexoraPolymarketCollectorMarket,
  runNexoraCollectorEdgeScan,
  setNexoraPolymarketCollectorConfig,
} from "../polymarketcollector/nexoraPolymarketRealCollector";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolymarketRealCollectorRoutes(app: any) {
  app.get("/api/nexora/polymarket-collector/status", (_req: any, res: any) => {
    try { res.json(getNexoraPolymarketCollectorStatus()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/polymarket-collector/config", (_req: any, res: any) => {
    try { res.json(getNexoraPolymarketCollectorConfig()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-collector/config", (req: any, res: any) => {
    try { res.json(setNexoraPolymarketCollectorConfig(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-collector/market/register", (req: any, res: any) => {
    try { res.json(registerNexoraPolymarketCollectorMarket(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/polymarket-collector/markets", (req: any, res: any) => {
    try { res.json(listNexoraPolymarketCollectorMarkets({ asset: req.query?.asset || "", activeOnly: req.query?.activeOnly === "true", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-collector/binance/normalize", (req: any, res: any) => {
    try { res.json(normalizeNexoraBinanceTicker(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-collector/clob/normalize", (req: any, res: any) => {
    try { res.json(normalizeNexoraPolymarketClobSnapshot(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-collector/edge-scan", (req: any, res: any) => {
    try { res.json(runNexoraCollectorEdgeScan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/polymarket-collector/health", (_req: any, res: any) => {
    try { res.json(createNexoraCollectorHealthReport()); } catch (error) { sendError(res, error); }
  });
}

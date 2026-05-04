import {
  calculateNexoraMarketFairValue,
  createNexoraPaperSignal,
  detectNexoraMarketEdge,
  getNexoraMarketDataPaperStatus,
  listNexoraMarketData,
  recordNexoraBinanceTick,
  recordNexoraLatencyObservation,
  recordNexoraPolymarketSnapshot,
  runNexoraMarketDataPaperCycle,
} from "../marketdata/nexoraMarketDataPaperEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraMarketDataPaperRoutes(app: any) {
  app.get("/api/nexora/market-data/status", (_req: any, res: any) => {
    try { res.json(getNexoraMarketDataPaperStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/market-data/binance/tick", (req: any, res: any) => {
    try { res.json(recordNexoraBinanceTick(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/market-data/polymarket/snapshot", (req: any, res: any) => {
    try { res.json(recordNexoraPolymarketSnapshot(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/market-data/fair-value", (req: any, res: any) => {
    try { res.json(calculateNexoraMarketFairValue(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/market-data/latency", (req: any, res: any) => {
    try { res.json(recordNexoraLatencyObservation(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/market-data/edge", (req: any, res: any) => {
    try { res.json(detectNexoraMarketEdge(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/market-data/signal", (req: any, res: any) => {
    try { res.json(createNexoraPaperSignal(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/market-data/cycle", (req: any, res: any) => {
    try { res.json(runNexoraMarketDataPaperCycle(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/market-data/list", (req: any, res: any) => {
    try { res.json(listNexoraMarketData({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

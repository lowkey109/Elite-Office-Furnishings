import {
  createNexoraPolymarketWatchlist,
  createNexoraPolymarketSuperstackConfig,
  detectNexoraPolymarketEdge,
  getNexoraPolymarketSuperstackConfig,
  getNexoraPolymarketSuperstackStatus,
  listNexoraPolymarketMarkets,
  listNexoraPolymarketSuperstackRecords,
  recordNexoraBinanceMarketTick,
  recordNexoraPolymarketClobSnapshot,
  registerNexoraPolymarketMarket,
  runNexoraPolymarketSuperstackCycle,
  settleNexoraPolymarketPaperOrder,
} from "../polymarketsuperstack/nexoraPolymarketSuperstack";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolymarketSuperstackRoutes(app: any) {
  app.get("/api/nexora/polymarket-superstack/status", (_req: any, res: any) => {
    try { res.json(getNexoraPolymarketSuperstackStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-superstack/config", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketSuperstackConfig(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/polymarket-superstack/config", (_req: any, res: any) => {
    try { res.json(getNexoraPolymarketSuperstackConfig()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-superstack/market/register", (req: any, res: any) => {
    try { res.json(registerNexoraPolymarketMarket(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/polymarket-superstack/markets", (req: any, res: any) => {
    try { res.json(listNexoraPolymarketMarkets({ asset: req.query?.asset || "", activeOnly: req.query?.activeOnly === "true", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-superstack/watchlist", (req: any, res: any) => {
    try { res.json(createNexoraPolymarketWatchlist(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-superstack/binance/tick", (req: any, res: any) => {
    try { res.json(recordNexoraBinanceMarketTick(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-superstack/clob/snapshot", (req: any, res: any) => {
    try { res.json(recordNexoraPolymarketClobSnapshot(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-superstack/edge", (req: any, res: any) => {
    try { res.json(detectNexoraPolymarketEdge(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-superstack/cycle", (req: any, res: any) => {
    try { res.json(runNexoraPolymarketSuperstackCycle(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/polymarket-superstack/paper/settle", (req: any, res: any) => {
    try { res.json(settleNexoraPolymarketPaperOrder(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/polymarket-superstack/records", (req: any, res: any) => {
    try { res.json(listNexoraPolymarketSuperstackRecords({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

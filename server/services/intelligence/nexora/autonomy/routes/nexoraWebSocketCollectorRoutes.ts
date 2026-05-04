import {
  getNexoraCollectorStatus,
  listNexoraCollectorSamples,
  recordNexoraBinanceSampleTick,
  recordNexoraPolymarketSampleSnapshot,
  runNexoraCollectorSampleCycle,
  startNexoraSampleCollectors,
  stopNexoraSampleCollectors,
} from "../collectors/nexoraWebSocketCollectorRuntime";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraWebSocketCollectorRoutes(app: any) {
  app.get("/api/nexora/collectors/status", (_req: any, res: any) => {
    try { res.json(getNexoraCollectorStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/collectors/sample/start", (req: any, res: any) => {
    try { res.json(startNexoraSampleCollectors(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/collectors/sample/stop", (_req: any, res: any) => {
    try { res.json(stopNexoraSampleCollectors()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/collectors/binance/sample-tick", (req: any, res: any) => {
    try { res.json(recordNexoraBinanceSampleTick(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/collectors/polymarket/sample-snapshot", (req: any, res: any) => {
    try { res.json(recordNexoraPolymarketSampleSnapshot(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/collectors/sample-cycle", (req: any, res: any) => {
    try { res.json(runNexoraCollectorSampleCycle(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/collectors/samples", (req: any, res: any) => {
    try { res.json(listNexoraCollectorSamples({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

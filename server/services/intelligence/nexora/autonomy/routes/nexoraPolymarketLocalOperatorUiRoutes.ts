import {
  getNexoraPolymarketOperatorSummary,
  renderNexoraPolymarketBacktests,
  renderNexoraPolymarketDashboard,
  renderNexoraPolymarketExecution,
  renderNexoraPolymarketReadiness,
  renderNexoraPolymarketResearch,
  renderNexoraPolymarketSignals,
} from "../polymarketui/nexoraPolymarketLocalOperatorUi";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

function html(res: any, body: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(body);
}

export function registerNexoraPolymarketLocalOperatorUiRoutes(app: any) {
  app.get("/nexora/polymarket", (_req: any, res: any) => {
    try { html(res, renderNexoraPolymarketDashboard()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/polymarket/signals", (_req: any, res: any) => {
    try { html(res, renderNexoraPolymarketSignals()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/polymarket/backtests", (_req: any, res: any) => {
    try { html(res, renderNexoraPolymarketBacktests()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/polymarket/execution", (_req: any, res: any) => {
    try { html(res, renderNexoraPolymarketExecution()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/polymarket/research", (_req: any, res: any) => {
    try { html(res, renderNexoraPolymarketResearch()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/polymarket/readiness", (_req: any, res: any) => {
    try { html(res, renderNexoraPolymarketReadiness()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/polymarket-ui/summary", (_req: any, res: any) => {
    try { res.json(getNexoraPolymarketOperatorSummary()); } catch (error) { sendError(res, error); }
  });
}

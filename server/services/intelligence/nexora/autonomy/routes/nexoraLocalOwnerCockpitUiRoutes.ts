import {
  getNexoraApprovalSummary,
  getNexoraCompanySummary,
  getNexoraLocalUiStatus,
  getNexoraOfficeSummary,
  getNexoraOwnerSummary,
  getNexoraRecoverySummary,
  getNexoraRewardSummary,
  getNexoraTeachingSummary,
  renderNexoraApprovalsPage,
  renderNexoraCompanyPage,
  renderNexoraOfficePage,
  renderNexoraOwnerPage,
  renderNexoraRecoveryPage,
  renderNexoraRewardsPage,
  renderNexoraTeachingPage,
} from "../localui/nexoraLocalOwnerCockpitUi";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

function sendHtml(res: any, html: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}

export function registerNexoraLocalOwnerCockpitUiRoutes(app: any) {
  app.get("/nexora/owner", (_req: any, res: any) => {
    try { sendHtml(res, renderNexoraOwnerPage()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/company", (_req: any, res: any) => {
    try { sendHtml(res, renderNexoraCompanyPage()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/approvals", (_req: any, res: any) => {
    try { sendHtml(res, renderNexoraApprovalsPage()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/office", (_req: any, res: any) => {
    try { sendHtml(res, renderNexoraOfficePage()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/teaching", (_req: any, res: any) => {
    try { sendHtml(res, renderNexoraTeachingPage()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/rewards", (_req: any, res: any) => {
    try { sendHtml(res, renderNexoraRewardsPage()); } catch (error) { sendError(res, error); }
  });

  app.get("/nexora/recovery", (_req: any, res: any) => {
    try { sendHtml(res, renderNexoraRecoveryPage()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-ui/status", (_req: any, res: any) => {
    try { res.json(getNexoraLocalUiStatus()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-ui/owner-summary", (_req: any, res: any) => {
    try { res.json(getNexoraOwnerSummary()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-ui/company-summary", (_req: any, res: any) => {
    try { res.json(getNexoraCompanySummary()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-ui/approval-summary", (_req: any, res: any) => {
    try { res.json(getNexoraApprovalSummary()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-ui/office-summary", (_req: any, res: any) => {
    try { res.json(getNexoraOfficeSummary()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-ui/teaching-summary", (_req: any, res: any) => {
    try { res.json(getNexoraTeachingSummary()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-ui/reward-summary", (_req: any, res: any) => {
    try { res.json(getNexoraRewardSummary()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-ui/recovery-summary", (_req: any, res: any) => {
    try { res.json(getNexoraRecoverySummary()); } catch (error) { sendError(res, error); }
  });
}

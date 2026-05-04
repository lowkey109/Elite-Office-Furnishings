import {
  createNexoraDailyBriefingFinal,
  getNexoraCompanyCompletionStatus,
  getNexoraCompanyWorkQueueSummary,
  getNexoraCustomerSupplierBoard,
  getNexoraDepartmentDashboards,
  getNexoraHumanApprovalBoard,
  getNexoraLearningCaptureBoard,
  getNexoraOwnerCockpitFinal,
  getNexoraProjectDeliveryBoard,
  getNexoraResponsibilityMapFinal,
  getNexoraRevenueMarginBoard,
  runNexoraCompanyDailyRunFinal,
} from "../companycompletion/nexoraAICompanyOperatingCompletion";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraAICompanyOperatingCompletionRoutes(app: any) {
  app.get("/api/nexora/company-completion/status", (_req: any, res: any) => {
    try { res.json(getNexoraCompanyCompletionStatus()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/owner-cockpit", (_req: any, res: any) => {
    try { res.json(getNexoraOwnerCockpitFinal({})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/daily-briefing", (_req: any, res: any) => {
    try { res.json(createNexoraDailyBriefingFinal({ briefingId: "latest" })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/approval-board", (req: any, res: any) => {
    try { res.json(getNexoraHumanApprovalBoard({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/departments", (_req: any, res: any) => {
    try { res.json(getNexoraDepartmentDashboards()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/responsibility-map", (_req: any, res: any) => {
    try { res.json(getNexoraResponsibilityMapFinal()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/company-completion/daily-run", (req: any, res: any) => {
    try { res.json(runNexoraCompanyDailyRunFinal(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/work-queue", (req: any, res: any) => {
    try { res.json(getNexoraCompanyWorkQueueSummary({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/revenue-margin-board", (req: any, res: any) => {
    try { res.json(getNexoraRevenueMarginBoard({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/customer-supplier-board", (req: any, res: any) => {
    try { res.json(getNexoraCustomerSupplierBoard({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/project-delivery-board", (req: any, res: any) => {
    try { res.json(getNexoraProjectDeliveryBoard({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/company-completion/learning-board", (req: any, res: any) => {
    try { res.json(getNexoraLearningCaptureBoard({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

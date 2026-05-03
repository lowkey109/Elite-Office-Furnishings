import {
  createNexoraLocalApproval,
  decideNexoraLocalApproval,
  getNexoraLocalApprovalStatus,
  listNexoraLocalApprovals,
} from "../localapprovals/nexoraLocalApprovalGate";
import {
  getNexoraLocalCrmStatus,
  getNexoraLocalLead,
  listNexoraLocalLeads,
  upsertNexoraLocalLead,
} from "../localcrm/nexoraLocalCrm";
import {
  createNexoraLocalQuote,
  getNexoraLocalQuote,
  getNexoraLocalQuoteBookStatus,
  listNexoraLocalQuotes,
} from "../localquotes/nexoraLocalQuoteBook";
import {
  getNexoraLocalSupplierStatus,
  listNexoraLocalSuppliers,
  upsertNexoraLocalSupplier,
} from "../localsuppliers/nexoraLocalSupplierCatalogue";
import {
  createNexoraLocalProject,
  getNexoraLocalProjectStatus,
  listNexoraLocalProjects,
  updateNexoraLocalProjectStage,
} from "../localprojects/nexoraLocalProjectBoard";
import {
  createNexoraExportPack,
  getNexoraExportPack,
  listNexoraExportPacks,
} from "../exporter/nexoraExportPack";
import {
  createNexoraLocalSnapshot,
  getNexoraLocalSnapshot,
  listNexoraLocalSnapshots,
} from "../exporter/nexoraLocalSnapshotEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraLocalBusinessRoutes(app: any) {
  app.get("/api/nexora/local-business/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        approvals: getNexoraLocalApprovalStatus(),
        crm: getNexoraLocalCrmStatus(),
        quotes: getNexoraLocalQuoteBookStatus(),
        suppliers: getNexoraLocalSupplierStatus(),
        projects: getNexoraLocalProjectStatus(),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/local-approvals/create", (req: any, res: any) => {
    try { res.json(createNexoraLocalApproval(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-approvals/decide", (req: any, res: any) => {
    try { res.json(decideNexoraLocalApproval(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-approvals/list", (req: any, res: any) => {
    try { res.json(listNexoraLocalApprovals({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-crm/lead/upsert", (req: any, res: any) => {
    try { res.json(upsertNexoraLocalLead(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-crm/lead", (req: any, res: any) => {
    try { res.json(getNexoraLocalLead({ leadId: req.query?.leadId })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-crm/leads", (req: any, res: any) => {
    try { res.json(listNexoraLocalLeads({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-quotes/create", (req: any, res: any) => {
    try { res.json(createNexoraLocalQuote(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-quotes/quote", (req: any, res: any) => {
    try { res.json(getNexoraLocalQuote({ quoteId: req.query?.quoteId })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-quotes/list", (req: any, res: any) => {
    try { res.json(listNexoraLocalQuotes({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-suppliers/upsert", (req: any, res: any) => {
    try { res.json(upsertNexoraLocalSupplier(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-suppliers/list", (req: any, res: any) => {
    try { res.json(listNexoraLocalSuppliers({ category: req.query?.category || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-projects/create", (req: any, res: any) => {
    try { res.json(createNexoraLocalProject(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/local-projects/stage", (req: any, res: any) => {
    try { res.json(updateNexoraLocalProjectStage(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/local-projects/list", (req: any, res: any) => {
    try { res.json(listNexoraLocalProjects({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/export/create", (req: any, res: any) => {
    try { res.json(createNexoraExportPack(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/export/list", (_req: any, res: any) => {
    try { res.json(listNexoraExportPacks()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/export/get", (req: any, res: any) => {
    try { res.json(getNexoraExportPack({ exportId: req.query?.exportId })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/snapshot/create", (req: any, res: any) => {
    try { res.json(createNexoraLocalSnapshot(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/snapshot/list", (_req: any, res: any) => {
    try { res.json(listNexoraLocalSnapshots()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/snapshot/get", (req: any, res: any) => {
    try { res.json(getNexoraLocalSnapshot({ snapshotId: req.query?.snapshotId })); } catch (error) { sendError(res, error); }
  });
}

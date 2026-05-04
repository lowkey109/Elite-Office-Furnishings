import {
  createNexoraApprovalPacket,
  createNexoraCommunicationDraft,
  createNexoraCustomerQuoteDraft,
  createNexoraHumanSendQueueItem,
  createNexoraOutboxItem,
  createNexoraQuoteDocument,
  createNexoraSupplierPack,
  getNexoraCommsDocsStatus,
  listNexoraCommunicationTemplates,
  listNexoraCommsDocs,
  seedNexoraCommunicationTemplates,
} from "../commsdocs/nexoraCommsDocsEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraCommsDocsRoutes(app: any) {
  app.get("/api/nexora/comms-docs/status", (_req: any, res: any) => {
    try { res.json(getNexoraCommsDocsStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/comms-docs/templates/seed", (_req: any, res: any) => {
    try { res.json(seedNexoraCommunicationTemplates()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/comms-docs/templates", (req: any, res: any) => {
    try { res.json(listNexoraCommunicationTemplates({ type: req.query?.type || "" })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/comms-docs/draft", (req: any, res: any) => {
    try { res.json(createNexoraCommunicationDraft(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/comms-docs/outbox", (req: any, res: any) => {
    try { res.json(createNexoraOutboxItem(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/comms-docs/quote-document", (req: any, res: any) => {
    try { res.json(createNexoraQuoteDocument(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/comms-docs/customer-quote-draft", (req: any, res: any) => {
    try { res.json(createNexoraCustomerQuoteDraft(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/comms-docs/supplier-pack", (req: any, res: any) => {
    try { res.json(createNexoraSupplierPack(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/comms-docs/approval-packet", (req: any, res: any) => {
    try { res.json(createNexoraApprovalPacket(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/comms-docs/send-queue", (req: any, res: any) => {
    try { res.json(createNexoraHumanSendQueueItem(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/comms-docs/list", (req: any, res: any) => {
    try { res.json(listNexoraCommsDocs({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}

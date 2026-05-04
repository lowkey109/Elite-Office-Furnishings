import {
  createNexoraExternalSignerSpec,
  createNexoraLiveExecutionArchitecture,
  createNexoraLiveExecutionChecklist,
  createNexoraLiveExecutionDesignReport,
  createNexoraLiveOrderIntentDraft,
  createNexoraLiveOrderIntentSchema,
  getNexoraLiveExecutionDesignStatus,
} from "../liveexecutiondesign/nexoraPolymarketLiveExecutionDesign";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolymarketLiveExecutionDesignRoutes(app: any) {
  app.get("/api/nexora/live-execution-design/status", (_req: any, res: any) => {
    try { res.json(getNexoraLiveExecutionDesignStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-execution-design/architecture", (req: any, res: any) => {
    try { res.json(createNexoraLiveExecutionArchitecture(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-execution-design/intent-schema", (req: any, res: any) => {
    try { res.json(createNexoraLiveOrderIntentSchema(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-execution-design/intent-draft", (req: any, res: any) => {
    try { res.json(createNexoraLiveOrderIntentDraft(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-execution-design/external-signer", (req: any, res: any) => {
    try { res.json(createNexoraExternalSignerSpec(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-execution-design/checklist", (req: any, res: any) => {
    try { res.json(createNexoraLiveExecutionChecklist(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/live-execution-design/report", (req: any, res: any) => {
    try { res.json(createNexoraLiveExecutionDesignReport(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

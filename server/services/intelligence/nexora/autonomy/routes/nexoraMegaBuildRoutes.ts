import {
  analyseNexoraQuote,
  forecastNexoraRevenue,
  getNexoraFinanceStatus,
  queueNexoraQuoteAnalysis,
  registerNexoraFinanceWorkers,
} from "../finance/nexoraFinanceQuoteIntelligence";
import {
  buildNexoraSupplierMatrix,
  draftNexoraSupplierRfq,
  getNexoraSupplierStatus,
  queueNexoraSupplierSweep,
  registerNexoraSupplierWorkers,
} from "../supplier/nexoraSupplierCommand";
import {
  draftNexoraFollowup,
  getNexoraCrmStatus,
  queueNexoraCrmPipeline,
  registerNexoraCrmWorkers,
  scoreNexoraLead,
} from "../crm/nexoraCrmPipelineEngine";
import {
  createNexoraProjectPlan,
  getNexoraProjectStatus,
  queueNexoraProjectOps,
  registerNexoraProjectWorkers,
} from "../project/nexoraProjectOpsEngine";
import {
  createNexoraTrainingModule,
  getNexoraAcademyStatus,
  queueNexoraTraining,
  registerNexoraAcademyWorkers,
} from "../academy/nexoraAcademyEngine";
import {
  getNexoraCockpitStatus,
  getNexoraExecutiveCockpit,
  registerNexoraCockpitWorkers,
  runNexoraExecutiveOperatingBurst,
} from "../cockpit/nexoraExecutiveCockpit";

export function registerNexoraMegaBuildRoutes(server: any, app?: any) {
  const router = app || server;

  router.get("/api/nexora/mega/status", async (_req: any, res: any) => {
    try {
      const finance = await getNexoraFinanceStatus();
      const supplier = await getNexoraSupplierStatus();
      const crm = await getNexoraCrmStatus();
      const project = await getNexoraProjectStatus();
      const academy = await getNexoraAcademyStatus();
      const cockpit = await getNexoraCockpitStatus();

      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_mega_build_14_19",
        finance,
        supplier,
        crm,
        project,
        academy,
        cockpit,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/mega/register-workers", async (_req: any, res: any) => {
    try {
      const result = {
        finance: await registerNexoraFinanceWorkers(),
        supplier: await registerNexoraSupplierWorkers(),
        crm: await registerNexoraCrmWorkers(),
        project: await registerNexoraProjectWorkers(),
        academy: await registerNexoraAcademyWorkers(),
        cockpit: await registerNexoraCockpitWorkers(),
      };
      res.json({ ok: true, nexoraBrain: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/api/nexora/finance/quote/analyse", async (req: any, res: any) => {
    try { res.json(analyseNexoraQuote(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/finance/quote/queue", async (req: any, res: any) => {
    try { res.json(await queueNexoraQuoteAnalysis(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/finance/revenue/forecast", async (req: any, res: any) => {
    try { res.json(await forecastNexoraRevenue(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/supplier/matrix", async (req: any, res: any) => {
    try { res.json(buildNexoraSupplierMatrix(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/supplier/rfq/draft", async (req: any, res: any) => {
    try { res.json(draftNexoraSupplierRfq(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/supplier/sweep", async (req: any, res: any) => {
    try { res.json(await queueNexoraSupplierSweep(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/crm/lead/score", async (req: any, res: any) => {
    try { res.json(scoreNexoraLead(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/crm/followup/draft", async (req: any, res: any) => {
    try { res.json(draftNexoraFollowup(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/crm/pipeline/queue", async (req: any, res: any) => {
    try { res.json(await queueNexoraCrmPipeline(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/project/plan", async (req: any, res: any) => {
    try { res.json(createNexoraProjectPlan(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/project/queue", async (req: any, res: any) => {
    try { res.json(await queueNexoraProjectOps(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/academy/module/create", async (req: any, res: any) => {
    try { res.json(createNexoraTrainingModule(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/academy/training/queue", async (req: any, res: any) => {
    try { res.json(await queueNexoraTraining(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.get("/api/nexora/cockpit/status", async (_req: any, res: any) => {
    try { res.json(await getNexoraCockpitStatus()); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/cockpit/executive", async (req: any, res: any) => {
    try { res.json(await getNexoraExecutiveCockpit(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });

  router.post("/api/nexora/cockpit/burst", async (req: any, res: any) => {
    try { res.json(await runNexoraExecutiveOperatingBurst(req.body || {})); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });
}

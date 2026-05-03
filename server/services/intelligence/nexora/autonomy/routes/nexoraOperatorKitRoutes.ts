import {
  createNexoraApiCatalogue,
  getNexoraApiCatalogue,
  getNexoraApiCatalogueStatus,
} from "../apicatalogue/nexoraApiCatalogue";
import {
  createNexoraLocalTestPlan,
  listNexoraLocalTestRuns,
  runNexoraLocalTestPlanDryRun,
} from "../testharness/nexoraLocalTestHarness";
import {
  createNexoraSeedPack,
  getNexoraSeedPackStatus,
  listNexoraSeedPacks,
} from "../seedpacks/nexoraSeedPacks";
import { calculateNexoraHealthScore } from "../healthscore/nexoraHealthScoreEngine";
import {
  createNexoraOperatorPack,
  getNexoraOperatorPack,
} from "../operatorpacks/nexoraOperatorPacks";
import { createNexoraPackageManifest } from "../packagekit/nexoraPackageManifest";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraOperatorKitRoutes(app: any) {
  app.get("/api/nexora/operator-kit/status", (_req: any, res: any) => {
    try {
      res.json({
        ok: true,
        nexoraBrain: true,
        apiCatalogue: getNexoraApiCatalogueStatus(),
        seedPacks: getNexoraSeedPackStatus(),
        health: calculateNexoraHealthScore(),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/api-catalogue/create", (req: any, res: any) => {
    try { res.json(createNexoraApiCatalogue(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/api-catalogue/get", (req: any, res: any) => {
    try { res.json(getNexoraApiCatalogue({ catalogueId: req.query?.catalogueId })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/test-harness/plan", (req: any, res: any) => {
    try { res.json(createNexoraLocalTestPlan(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/test-harness/dry-run", (req: any, res: any) => {
    try { res.json(runNexoraLocalTestPlanDryRun(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/test-harness/runs", (req: any, res: any) => {
    try { res.json(listNexoraLocalTestRuns({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/seed-packs/create", (req: any, res: any) => {
    try { res.json(createNexoraSeedPack(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/seed-packs/list", (req: any, res: any) => {
    try { res.json(listNexoraSeedPacks({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/health-score", (_req: any, res: any) => {
    try { res.json(calculateNexoraHealthScore()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/operator-pack/create", (req: any, res: any) => {
    try { res.json(createNexoraOperatorPack(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/operator-pack/get", (req: any, res: any) => {
    try { res.json(getNexoraOperatorPack({ packId: req.query?.packId })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/package-manifest/create", (req: any, res: any) => {
    try { res.json(createNexoraPackageManifest(req.body || {})); } catch (error) { sendError(res, error); }
  });
}

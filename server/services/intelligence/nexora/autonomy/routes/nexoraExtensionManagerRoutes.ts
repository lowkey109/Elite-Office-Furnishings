import {
  getNexoraExtensionRegistryStatus,
  listNexoraExtensions,
  registerNexoraExtension,
} from "../extension/nexoraExtensionRegistry";
import {
  findNexoraMissingLocalImports,
  inspectNexoraDependencyGraph,
} from "../extension/nexoraDependencyGraphInspector";
import { inspectNexoraDuplicateRoutes } from "../extension/nexoraDuplicateRouteInspector";
import {
  applyNexoraSafePatch,
  planNexoraSafePatch,
} from "../extension/nexoraSafePatchFramework";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraExtensionManagerRoutes(app: any) {
  app.get("/api/nexora/extensions/status", (_req: any, res: any) => {
    try {
      res.json(getNexoraExtensionRegistryStatus());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/extensions/register", (req: any, res: any) => {
    try {
      res.json(registerNexoraExtension(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/extensions/list", (req: any, res: any) => {
    try {
      res.json(listNexoraExtensions({
        category: req.query?.category || "",
      }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/extensions/dependency-graph", (_req: any, res: any) => {
    try {
      res.json(inspectNexoraDependencyGraph());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/extensions/missing-imports", (_req: any, res: any) => {
    try {
      res.json(findNexoraMissingLocalImports());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/extensions/duplicate-routes", (_req: any, res: any) => {
    try {
      res.json(inspectNexoraDuplicateRoutes());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/extensions/patch/plan", (req: any, res: any) => {
    try {
      res.json(planNexoraSafePatch(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/extensions/patch/apply", (req: any, res: any) => {
    try {
      res.json(applyNexoraSafePatch(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });
}

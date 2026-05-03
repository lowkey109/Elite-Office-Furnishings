import { createNexoraBuildInventory } from "../buildplanner/nexoraBuildInventory";
import { planNexoraBuildCollisionCheck } from "../buildplanner/nexoraBuildCollisionPlanner";
import { runNexoraBuildPreflight } from "../buildplanner/nexoraBuildPreflight";
import { getNexoraFutureBuildRoadmap } from "../buildplanner/nexoraFutureBuildRoadmap";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraBuildPlannerRoutes(app: any) {
  app.get("/api/nexora/build-planner/inventory", (_req: any, res: any) => {
    try {
      res.json(createNexoraBuildInventory());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/build-planner/collision-check", (req: any, res: any) => {
    try {
      res.json(planNexoraBuildCollisionCheck(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/build-planner/preflight", (req: any, res: any) => {
    try {
      res.json(runNexoraBuildPreflight(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/build-planner/roadmap", (_req: any, res: any) => {
    try {
      res.json(getNexoraFutureBuildRoadmap());
    } catch (error) {
      sendError(res, error);
    }
  });
}

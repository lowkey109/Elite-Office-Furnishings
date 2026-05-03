import {
  claimAndRunNexoraSafeTasks,
  createNexoraDurableTask,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";
import { getNexoraCockpitStatus, getNexoraExecutiveCockpit, runNexoraExecutiveOperatingBurst } from "../cockpit/nexoraExecutiveCockpit";
import { getNexoraSupremeMatrixStatus, executeNexoraSupremeMatrix } from "../supreme/nexoraSupremeOrchestrationMatrix";
import { getNexoraFinanceStatus } from "../finance/nexoraFinanceQuoteIntelligence";
import { getNexoraSupplierStatus } from "../supplier/nexoraSupplierCommand";
import { getNexoraCrmStatus } from "../crm/nexoraCrmPipelineEngine";
import { getNexoraProjectStatus } from "../project/nexoraProjectOpsEngine";
import { getNexoraAcademyStatus } from "../academy/nexoraAcademyEngine";
import { getNexoraStrategyCompilerStatus } from "../strategy/nexoraStrategyCompiler";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraLiveVerificationRoutes(app: any) {
  app.get("/api/nexora/live/status", async (_req: any, res: any) => {
    try {
      const kernel = await ensureNexoraDurableKernel();
      const snapshot = await getNexoraDurableCommandSnapshot();

      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_live_route_mount",
        message: "Nexora live routes are mounted.",
        mountedRoutes: [
          "GET /api/nexora/live/status",
          "GET /api/nexora/advanced/status",
          "GET /api/nexora/mega/status",
          "GET /api/nexora/cockpit/status",
          "POST /api/nexora/cockpit/burst",
          "GET /api/nexora/supreme/status",
          "POST /api/nexora/supreme/matrix/execute",
          "GET /api/nexora/strategy/status",
          "POST /api/nexora/advanced/tasks/run-safe"
        ],
        kernel,
        snapshot,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/advanced/status", async (_req: any, res: any) => {
    try {
      const kernel = await ensureNexoraDurableKernel();
      const snapshot = await getNexoraDurableCommandSnapshot();

      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_advanced_autonomy_live",
        kernel,
        snapshot,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/advanced/tasks/run-safe", async (req: any, res: any) => {
    try {
      const limit = Number(req.body?.limit || 25);
      const result = await claimAndRunNexoraSafeTasks(limit);

      res.json({
        ok: true,
        nexoraBrain: true,
        result,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/advanced/tasks", async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createNexoraDurableTask({
        worker: String(body.worker || "nexora_command_centre"),
        area: String(body.area || "reporting"),
        action: String(body.action || "live_route_test_task"),
        risk: body.risk || "safe",
        priority: Number(body.priority || 50),
        payload: body.payload || {},
        approvalRequired: Boolean(body.approvalRequired),
        source: body.source || "nexora.live.route.mount",
      });

      res.json({
        ok: true,
        nexoraBrain: true,
        result,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/mega/status", async (_req: any, res: any) => {
    try {
      const [
        finance,
        supplier,
        crm,
        project,
        academy,
        cockpit,
        strategy,
      ] = await Promise.all([
        getNexoraFinanceStatus(),
        getNexoraSupplierStatus(),
        getNexoraCrmStatus(),
        getNexoraProjectStatus(),
        getNexoraAcademyStatus(),
        getNexoraCockpitStatus(),
        getNexoraStrategyCompilerStatus(),
      ]);

      res.json({
        ok: true,
        nexoraBrain: true,
        service: "nexora_mega_build_14_19_live",
        finance,
        supplier,
        crm,
        project,
        academy,
        cockpit,
        strategy,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/cockpit/status", async (_req: any, res: any) => {
    try {
      const result = await getNexoraCockpitStatus();
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/cockpit/executive", async (req: any, res: any) => {
    try {
      const result = await getNexoraExecutiveCockpit(req.body || {});
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/cockpit/burst", async (req: any, res: any) => {
    try {
      const result = await runNexoraExecutiveOperatingBurst(req.body || {});
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/supreme/status", async (_req: any, res: any) => {
    try {
      const result = await getNexoraSupremeMatrixStatus();
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/supreme/matrix/execute", async (req: any, res: any) => {
    try {
      const result = await executeNexoraSupremeMatrix(req.body || {});
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/strategy/status", async (_req: any, res: any) => {
    try {
      const result = await getNexoraStrategyCompilerStatus();
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/live/report", async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await writeNexoraOperatingReport(
        String(body.type || "live_route_report"),
        String(body.severity || "info"),
        String(body.title || "Nexora live route report"),
        String(body.summary || "Live route report recorded."),
        body.payload || {},
      );

      res.json({
        ok: true,
        nexoraBrain: true,
        result,
      });
    } catch (error) {
      sendError(res, error);
    }
  });
}

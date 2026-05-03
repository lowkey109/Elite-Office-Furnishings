import {
  enqueueNexoraFileBusMessage,
  getNexoraFileBusMessages,
  getNexoraFileBusStatus,
  processNexoraFileBus,
  purgeNexoraFileBusChannel,
  scheduleNexoraDelayedJob,
} from "../filebus/nexoraFileBus";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraFileBusRoutes(app: any) {
  app.get("/api/nexora/filebus/status", (_req: any, res: any) => {
    try {
      res.json(getNexoraFileBusStatus());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/filebus/enqueue", (req: any, res: any) => {
    try {
      res.json(enqueueNexoraFileBusMessage(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/filebus/delay", (req: any, res: any) => {
    try {
      res.json(scheduleNexoraDelayedJob(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/nexora/filebus/messages", (req: any, res: any) => {
    try {
      res.json(getNexoraFileBusMessages({
        channel: req.query?.channel || "inbox",
        limit: Number(req.query?.limit || 50),
      }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/filebus/process", async (req: any, res: any) => {
    try {
      res.json(await processNexoraFileBus(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/nexora/filebus/purge", (req: any, res: any) => {
    try {
      res.json(purgeNexoraFileBusChannel(req.body || {}));
    } catch (error) {
      sendError(res, error);
    }
  });
}

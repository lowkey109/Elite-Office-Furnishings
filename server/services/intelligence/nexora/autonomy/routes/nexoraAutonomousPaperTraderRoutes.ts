import type { Express } from "express";

import {
  getAutonomousPaperTrades,
  runAutonomousPaperTrade,
} from "../../coinbase/paperengine/nexoraAutonomousPaperTrader";

export function registerNexoraAutonomousPaperTraderRoutes(
  app: Express
) {
  app.post(
    "/api/nexora/autonomous-paper/run",
    (_req: any, res: any) => {
      res.json(runAutonomousPaperTrade());
    }
  );

  app.get(
    "/api/nexora/autonomous-paper/trades",
    (req: any, res: any) => {
      const limit = Number(req.query.limit || 50);

      res.json(getAutonomousPaperTrades(limit));
    }
  );
}

import type { Express, Request, Response } from "express";

import {
  getExecutionGuardState,
  registerLiveOrder,
  validateDuplicateOrderRisk,
} from "../../coinbase/execution/nexoraLiveExecutionGuard";

export function registerNexoraLiveExecutionGuardRoutes(app: Express) {
  app.get(
    "/api/nexora/live-execution-guard/status",
    (_req: Request, res: Response) => {
      res.json(getExecutionGuardState());
    }
  );

  app.post(
    "/api/nexora/live-execution-guard/check",
    (req: Request, res: Response) => {
      res.json(
        validateDuplicateOrderRisk({
          productId: req.body?.productId || "UNKNOWN",
          side: req.body?.side || "BUY",
        })
      );
    }
  );

  app.post(
    "/api/nexora/live-execution-guard/register",
    (req: Request, res: Response) => {
      res.json(
        registerLiveOrder({
          productId: req.body?.productId || "UNKNOWN",
          side: req.body?.side || "BUY",
        })
      );
    }
  );
}

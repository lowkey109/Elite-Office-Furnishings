import type { Express, Request, Response } from "express";

import {
  getLiveCapitalGovernorState,
  haltLiveTrading,
  releaseLiveTradingHalt,
  updateLivePnL,
  validateLiveTradingAllowed,
} from "../../coinbase/hardening/nexoraLiveCapitalSafetyGovernor";

export function registerNexoraLiveCapitalGovernorRoutes(app: Express) {
  app.get(
    "/api/nexora/live-capital-governor/status",
    (_req: Request, res: Response) => {
      res.json(getLiveCapitalGovernorState());
    }
  );

  app.post(
    "/api/nexora/live-capital-governor/halt",
    (req: Request, res: Response) => {
      haltLiveTrading(req.body?.reason || "manual_lock");

      res.json({
        ok: true,
        halted: true,
      });
    }
  );

  app.post(
    "/api/nexora/live-capital-governor/release",
    (_req: Request, res: Response) => {
      releaseLiveTradingHalt();

      res.json({
        ok: true,
        halted: false,
      });
    }
  );

  app.post(
    "/api/nexora/live-capital-governor/pnl",
    (req: Request, res: Response) => {
      updateLivePnL(req.body || {});

      res.json(getLiveCapitalGovernorState());
    }
  );

  app.get(
    "/api/nexora/live-capital-governor/validate",
    (_req: Request, res: Response) => {
      res.json(validateLiveTradingAllowed());
    }
  );
}

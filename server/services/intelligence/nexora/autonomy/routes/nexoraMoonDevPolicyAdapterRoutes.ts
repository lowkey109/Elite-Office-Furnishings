import type { Express, Request, Response } from "express";

import {
  getMoonDevPolicyStatus,
  getMoonDevPolicyPrompts,
  buildMoonDevCoinbasePaperPolicy,
} from "../moondevpolicy/nexoraMoonDevPolicyAdapter";

export function registerNexoraMoonDevPolicyAdapterRoutes(app: Express): void {
  app.get("/api/nexora/moondev-policy/status", (_req: Request, res: Response) => {
    res.json(getMoonDevPolicyStatus());
  });

  app.get("/api/nexora/moondev-policy/prompts", (_req: Request, res: Response) => {
    res.json(getMoonDevPolicyPrompts());
  });

  app.post("/api/nexora/moondev-policy/coinbase-paper", (req: Request, res: Response) => {
    res.json(buildMoonDevCoinbasePaperPolicy(req.body || {}));
  });
}

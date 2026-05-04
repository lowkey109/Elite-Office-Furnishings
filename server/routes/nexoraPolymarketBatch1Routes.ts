import type { Express } from "express";
import {
  getMoonDevBatch1AdapterPlan,
  getPolymarketBatch1Evidence,
  getPolymarketBatch1RouteAudit,
  getPolymarketBatch1Status,
} from "../services/intelligence/nexora/polymarket/polymarketBatch1Core";

export function registerNexoraPolymarketBatch1Routes(app: Express): void {
  app.get("/api/nexora/polymarket/status", (_req, res) => res.json(getPolymarketBatch1Status()));
  app.get("/api/nexora/polymarket/batch1/status", (_req, res) => res.json(getPolymarketBatch1Status()));
  app.get("/api/nexora/polymarket/batch1/routes/audit", (_req, res) => res.json(getPolymarketBatch1RouteAudit()));
  app.get("/api/nexora/polymarket/batch1/evidence", (_req, res) => res.json(getPolymarketBatch1Evidence()));
  app.get("/api/nexora/polymarket/batch1/moondev/adapter-plan", (_req, res) => res.json(getMoonDevBatch1AdapterPlan()));
}

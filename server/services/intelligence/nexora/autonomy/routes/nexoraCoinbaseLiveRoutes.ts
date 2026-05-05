import type { Express, Request, Response } from "express";

import { coinbaseSafetyEnvelope } from "../../coinbase/nexoraCoinbaseLiveConfig";
import { checkCoinbaseLiveReadiness } from "../../coinbase/nexoraCoinbaseLiveReadinessService";

import {
  createCoinbaseIntent,
  approveCoinbaseIntent,
  rejectCoinbaseIntent,
  listCoinbaseIntents,
} from "../../coinbase/nexoraCoinbaseLiveIntentStore";

import { placeCoinbaseLiveOrder } from "../../coinbase/nexoraCoinbaseLiveOrderEngine";

import {
  readRecentCoinbaseAuditEvents,
  writeCoinbaseAuditEvent,
} from "../../coinbase/nexoraCoinbaseLiveAuditLog";

import {
  createPaperTrade,
  closePaperTrade,
  listPaperTrades,
  paperStats,
} from "../../coinbase/nexoraCoinbasePaperLedger";

import {
  startCoinbasePaperAutopilot,
  stopCoinbasePaperAutopilot,
  coinbasePaperAutopilotState,
} from "../../coinbase/nexoraCoinbasePaperAutopilot";

import { coinbaseLearningSnapshot } from "../../coinbase/nexoraCoinbaseLearningEngine";
import { chooseCoinbasePaperStrategy } from "../../coinbase/nexoraCoinbaseStrategyEngine";
import { coinbaseMarketBias } from "../../coinbase/nexoraCoinbaseMarketBiasEngine";
import { coinbasePerformanceReport } from "../../coinbase/nexoraCoinbasePerformanceEngine";

function err500(res: Response, error: unknown) {
  res.status(500).json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    safety: coinbaseSafetyEnvelope(),
  });
}

export function registerNexoraCoinbaseLiveRoutes(app: Express) {
  app.get("/api/nexora/coinbase/live-readiness/status", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "nexora_coinbase_live_readiness",
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.post("/api/nexora/coinbase/live-readiness/check", async (_req: Request, res: Response) => {
    try {
      res.json(await checkCoinbaseLiveReadiness());
    } catch (e) {
      err500(res, e);
    }
  });

  app.get("/api/nexora/coinbase/live/intents", (req: Request, res: Response) => {
    const limit = Math.min(500, Number(req.query.limit || 100));
    res.json({
      ok: true,
      intents: listCoinbaseIntents(limit),
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.post("/api/nexora/coinbase/live/intents/create", (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      if (!body.notionalAud) {
        return res.status(400).json({ ok: false, error: "notionalAud required" });
      }

      if (!body.equityAud) {
        return res.status(400).json({ ok: false, error: "equityAud required" });
      }

      const intent = createCoinbaseIntent({
        productId: String(body.productId || "BTC-USD").toUpperCase(),
        side: String(body.side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY",
        notionalAud: Number(body.notionalAud),
        equityAud: Number(body.equityAud),
        reason: String(body.reason || "operator_manual_coinbase_intent"),
      });

      writeCoinbaseAuditEvent("INTENT_CREATED", intent.reason, {
        intentId: intent.id,
        productId: intent.productId,
        side: intent.side,
        notionalAud: intent.notionalAud,
      });

      res.json({
        ok: true,
        intent,
        safety: coinbaseSafetyEnvelope(),
      });
    } catch (e) {
      err500(res, e);
    }
  });

  app.post("/api/nexora/coinbase/live/intents/:id/approve", (req: Request, res: Response) => {
    const intent = approveCoinbaseIntent(
      String(req.params.id),
      String(req.body?.note || "admin_approved")
    );

    if (!intent) {
      return res.status(404).json({ ok: false, error: "intent_not_found" });
    }

    writeCoinbaseAuditEvent("INTENT_APPROVED", intent.approvalNote || "approved", {
      intentId: intent.id,
    });

    res.json({
      ok: true,
      intent,
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.post("/api/nexora/coinbase/live/intents/:id/reject", (req: Request, res: Response) => {
    const intent = rejectCoinbaseIntent(
      String(req.params.id),
      String(req.body?.note || "admin_rejected")
    );

    if (!intent) {
      return res.status(404).json({ ok: false, error: "intent_not_found" });
    }

    writeCoinbaseAuditEvent("INTENT_REJECTED", intent.rejectionNote || "rejected", {
      intentId: intent.id,
    });

    res.json({
      ok: true,
      intent,
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.post("/api/nexora/coinbase/live/order", async (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      if (!body.intentId) {
        return res.status(400).json({ ok: false, error: "intentId required" });
      }

      if (!body.quantityStr) {
        return res.status(400).json({ ok: false, error: "quantityStr required" });
      }

      if (!body.equityAud) {
        return res.status(400).json({
          ok: false,
          error: "equityAud required — current account equity in AUD",
        });
      }

      const result = await placeCoinbaseLiveOrder({
        intentId: String(body.intentId),
        productId: String(body.productId || "BTC-USD").toUpperCase(),
        side: String(body.side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY",
        quantityStr: String(body.quantityStr),
        equityAud: Number(body.equityAud),
      });

      const status = result.ok ? 200 : result.blocked ? 423 : 500;
      res.status(status).json(result);
    } catch (e) {
      err500(res, e);
    }
  });

  app.get("/api/nexora/coinbase/live/audit", (req: Request, res: Response) => {
    const limit = Math.min(500, Number(req.query.limit || 200));

    res.json({
      ok: true,
      service: "nexora_coinbase_live_audit",
      generatedAt: new Date().toISOString(),
      count: limit,
      events: readRecentCoinbaseAuditEvents(limit),
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.get("/api/nexora/coinbase/paper/stats", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      stats: paperStats(),
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.get("/api/nexora/coinbase/paper/trades", (req: Request, res: Response) => {
    const limit = Math.min(500, Number(req.query.limit || 100));

    res.json({
      ok: true,
      trades: listPaperTrades(limit),
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.post("/api/nexora/coinbase/paper/trades/create", (req: Request, res: Response) => {
    const body = req.body || {};

    const trade = createPaperTrade({
      productId: String(body.productId || "BTC-USD"),
      side: String(body.side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY",
      quantity: Number(body.quantity || 0.0001),
      entryPrice: Number(body.entryPrice || 100000),
      strategy: String(body.strategy || "manual_test"),
    });

    res.json({
      ok: true,
      trade,
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.post("/api/nexora/coinbase/paper/trades/:id/close", (req: Request, res: Response) => {
    const trade = closePaperTrade(
      String(req.params.id),
      Number(req.body?.exitPrice || 0)
    );

    if (!trade) {
      return res.status(404).json({
        ok: false,
        error: "trade_not_found",
      });
    }

    res.json({
      ok: true,
      trade,
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.get("/api/nexora/coinbase/paper/autopilot", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      state: coinbasePaperAutopilotState(),
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.post("/api/nexora/coinbase/paper/autopilot/start", (_req: Request, res: Response) => {
    res.json({
      ...startCoinbasePaperAutopilot(),
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.post("/api/nexora/coinbase/paper/autopilot/stop", (_req: Request, res: Response) => {
    res.json({
      ...stopCoinbasePaperAutopilot(),
      safety: coinbaseSafetyEnvelope(),
    });
  });

  app.get("/api/nexora/coinbase/paper/learning", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      learning: coinbaseLearningSnapshot(),
      safety: coinbaseSafetyEnvelope(),
    });
  });


  app.get("/api/nexora/coinbase/paper/strategy", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      strategy: chooseCoinbasePaperStrategy(),
      safety: coinbaseSafetyEnvelope(),
    });
  });


  app.get("/api/nexora/coinbase/paper/bias", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      bias: coinbaseMarketBias(),
      safety: coinbaseSafetyEnvelope(),
    });
  });



  app.get("/api/nexora/coinbase/paper/performance", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      performance: coinbasePerformanceReport(),
      safety: coinbaseSafetyEnvelope(),
    });
  });

}

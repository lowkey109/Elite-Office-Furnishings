import type {
  Express,
  Request,
  Response,
} from "express";

import {
  checkLiveReadiness,
  safetyEnvelope,
  setDryRun,
  setKillSwitch,
} from "../../binance/nexoraBinanceLiveReadinessService";

import {
  approveIntent,
  createIntent,
  listIntents,
  rejectIntent,
} from "../../binance/nexoraBinanceLiveIntentStore";

import {
  placeLiveBinanceOrder,
} from "../../binance/nexoraBinanceLiveOrderEngine";

import {
  readRecentAuditEvents,
  writeAuditEvent,
} from "../../binance/nexoraBinanceLiveAuditLog";

function err500(
  res: Response,
  error: unknown
) {
  res.status(500).json({
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : String(error),

    safety: safetyEnvelope(),
  });
}

export function registerNexoraBinanceLiveRoutes(
  app: Express
) {
  app.get(
    "/api/nexora/binance/live-readiness/status",
    (
      _req: Request,
      res: Response
    ) => {
      res.json({
        ok: true,
        service:
          "nexora_binance_live_readiness",
        safety: safetyEnvelope(),
      });
    }
  );

  app.post(
    "/api/nexora/binance/live-readiness/check",
    async (
      _req: Request,
      res: Response
    ) => {
      try {
        res.json(
          await checkLiveReadiness()
        );
      } catch (e) {
        err500(res, e);
      }
    }
  );

  app.get(
    "/api/nexora/binance/live/kill-switch",
    (
      _req: Request,
      res: Response
    ) => {
      res.json({
        ok: true,
        safety: safetyEnvelope(),
      });
    }
  );

  app.post(
    "/api/nexora/binance/live/kill-switch",
    (
      req: Request,
      res: Response
    ) => {
      const action =
        req.body?.action === "arm"
          ? "arm"
          : "clear";

      setKillSwitch(
        action === "arm"
      );

      res.json({
        ok: true,
        action,
        safety:
          safetyEnvelope(),
      });
    }
  );

  app.post(
    "/api/nexora/binance/live/dry-run",
    (
      req: Request,
      res: Response
    ) => {
      setDryRun(
        req.body?.enabled !== false
      );

      res.json({
        ok: true,
        safety:
          safetyEnvelope(),
      });
    }
  );

  app.get(
    "/api/nexora/binance/live/intents-v2",
    (
      req: Request,
      res: Response
    ) => {
      const limit = Math.min(
        500,
        Number(
          req.query.limit || 100
        )
      );

      res.json({
        ok: true,
        intents:
          listIntents(limit),
        safety:
          safetyEnvelope(),
      });
    }
  );

  app.post(
    "/api/nexora/binance/live/intents-v2/create",
    (
      req: Request,
      res: Response
    ) => {
      try {
        const body =
          req.body || {};

        if (
          !body.notionalAud
        ) {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                "notionalAud required",
            });
        }

        if (
          !body.equityAud
        ) {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                "equityAud required",
            });
        }

        const intent =
          createIntent({
            symbol: String(
              body.symbol ||
                "BTCUSDT"
            ).toUpperCase(),

            side:
              String(
                body.side ||
                  "BUY"
              ).toUpperCase() ===
              "SELL"
                ? "SELL"
                : "BUY",

            notionalAud:
              Number(
                body.notionalAud
              ),

            equityAud:
              Number(
                body.equityAud
              ),

            reason: String(
              body.reason ||
                "operator_manual_intent"
            ),
          });

        writeAuditEvent(
          "INTENT_CREATED",
          intent.reason,
          {
            intentId:
              intent.id,

            symbol:
              intent.symbol,

            side:
              intent.side,

            notionalAud:
              intent.notionalAud,
          }
        );

        res.json({
          ok: true,
          intent,
          safety:
            safetyEnvelope(),
        });
      } catch (e) {
        err500(res, e);
      }
    }
  );

  app.post(
    "/api/nexora/binance/live/intent/:id/approve",
    (
      req: Request,
      res: Response
    ) => {
      const intent =
        approveIntent(
          String(
            req.params.id
          ),
          String(
            req.body?.note ||
              "admin_approved"
          )
        );

      if (!intent) {
        return res
          .status(404)
          .json({
            ok: false,
            error:
              "intent_not_found",
          });
      }

      writeAuditEvent(
        "INTENT_APPROVED",
        intent.approvalNote ||
          "approved",
        {
          intentId:
            intent.id,
        }
      );

      res.json({
        ok: true,
        intent,
        safety:
          safetyEnvelope(),
      });
    }
  );

  app.post(
    "/api/nexora/binance/live/intent/:id/reject",
    (
      req: Request,
      res: Response
    ) => {
      const intent =
        rejectIntent(
          String(
            req.params.id
          ),
          String(
            req.body?.note ||
              "admin_rejected"
          )
        );

      if (!intent) {
        return res
          .status(404)
          .json({
            ok: false,
            error:
              "intent_not_found",
          });
      }

      writeAuditEvent(
        "INTENT_REJECTED",
        intent.rejectionNote ||
          "rejected",
        {
          intentId:
            intent.id,
        }
      );

      res.json({
        ok: true,
        intent,
        safety:
          safetyEnvelope(),
      });
    }
  );

  app.post(
    "/api/nexora/binance/live/order-v2",
    async (
      req: Request,
      res: Response
    ) => {
      try {
        const body =
          req.body || {};

        if (
          !body.intentId
        ) {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                "intentId required",
            });
        }

        if (
          !body.quantityStr
        ) {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                "quantityStr required",
            });
        }

        if (
          !body.equityAud
        ) {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                "equityAud required — current account equity in AUD",
            });
        }

        const result =
          await placeLiveBinanceOrder(
            {
              intentId:
                String(
                  body.intentId
                ),

              symbol: String(
                body.symbol ||
                  "BTCUSDT"
              ).toUpperCase(),

              side:
                String(
                  body.side ||
                    "BUY"
                ).toUpperCase() ===
                "SELL"
                  ? "SELL"
                  : "BUY",

              quantityStr:
                String(
                  body.quantityStr
                ),

              type:
                body.type ===
                "LIMIT"
                  ? "LIMIT"
                  : "MARKET",

              price:
                body.price
                  ? Number(
                      body.price
                    )
                  : undefined,

              equityAud:
                Number(
                  body.equityAud
                ),
            }
          );

        const status =
          result.ok
            ? 200
            : result.blocked
            ? 423
            : 500;

        res.status(status).json({
          ...result,
          safety:
            safetyEnvelope(),
        });
      } catch (error) {
        err500(res, error);
      }
    }
  );

  app.get(
    "/api/nexora/binance/live/audit",
    (
      req: Request,
      res: Response
    ) => {
      const limit =
        Math.min(
          500,
          Number(
            req.query.limit ||
              200
          )
        );

      res.json({
        ok: true,

        service:
          "nexora_binance_live_audit",

        generatedAt:
          new Date().toISOString(),

        count: limit,

        events:
          readRecentAuditEvents(
            limit
          ),

        safety:
          safetyEnvelope(),
      });
    }
  );
}

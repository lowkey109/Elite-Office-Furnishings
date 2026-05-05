import crypto from "crypto";

import {
  coinbaseSafetyEnvelope,
  assertCoinbaseProductAllowed,
} from "./nexoraCoinbaseLiveConfig";

import {
  findApprovedCoinbaseIntent,
  markCoinbaseIntentExecuted,
} from "./nexoraCoinbaseLiveIntentStore";

import {
  writeCoinbaseAuditEvent,
} from "./nexoraCoinbaseLiveAuditLog";

export type CoinbaseOrderRequest = {
  intentId: string;
  productId: string;
  side: "BUY" | "SELL";
  quantityStr: string;
  equityAud: number;
};

export async function placeCoinbaseLiveOrder(
  req: CoinbaseOrderRequest
) {
  const safety = coinbaseSafetyEnvelope();
  const gateLog: string[] = [];

  if (!safety.liveEnabled) {
    gateLog.push("live_trading_env_disabled");

    writeCoinbaseAuditEvent(
      "ORDER_GATE_BLOCK",
      "live_trading_env_disabled",
      {
        intentId: req.intentId,
        productId: req.productId,
      }
    );

    return {
      ok: false,
      blocked: true,
      reason: "live_trading_env_disabled",
      gateLog,
      safety,
    };
  }

  if (!safety.withdrawalsLocked) {
    gateLog.push("withdrawals_not_locked");

    writeCoinbaseAuditEvent(
      "ORDER_GATE_BLOCK",
      "withdrawals_not_locked",
      {
        intentId: req.intentId,
      }
    );

    return {
      ok: false,
      blocked: true,
      reason: "withdrawals_not_locked",
      gateLog,
      safety,
    };
  }

  const productCheck = assertCoinbaseProductAllowed(req.productId);

  if (!productCheck.ok) {
    gateLog.push(productCheck.reason);

    writeCoinbaseAuditEvent(
      "ORDER_GATE_BLOCK",
      productCheck.reason,
      {
        intentId: req.intentId,
        productId: req.productId,
      }
    );

    return {
      ok: false,
      blocked: true,
      reason: productCheck.reason,
      gateLog,
      safety,
    };
  }

  const approvedIntent = findApprovedCoinbaseIntent(req.intentId);

  if (!approvedIntent) {
    gateLog.push("approved_intent_missing");

    writeCoinbaseAuditEvent(
      "ORDER_GATE_BLOCK",
      "approved_intent_missing",
      {
        intentId: req.intentId,
      }
    );

    return {
      ok: false,
      blocked: true,
      reason: "approved_intent_missing",
      gateLog,
      safety,
    };
  }

  if (
    approvedIntent.notionalAud >
    approvedIntent.maxTradeAud
  ) {
    gateLog.push("capital_ladder_limit_exceeded");

    writeCoinbaseAuditEvent(
      "ORDER_GATE_BLOCK",
      "capital_ladder_limit_exceeded",
      {
        intentId: req.intentId,
        notionalAud: approvedIntent.notionalAud,
      }
    );

    return {
      ok: false,
      blocked: true,
      reason: "capital_ladder_limit_exceeded",
      gateLog,
      safety,
    };
  }

  if (safety.dryRunMode) {
    const simulatedOrderId = `coinbase_dryrun_${crypto.randomUUID()}`;

    writeCoinbaseAuditEvent(
      "DRY_RUN_SIMULATED",
      "coinbase_dry_run_order",
      {
        intentId: req.intentId,
        orderId: simulatedOrderId,
        productId: req.productId,
        side: req.side,
      }
    );

    markCoinbaseIntentExecuted(
      req.intentId,
      simulatedOrderId
    );

    return {
      ok: true,
      dryRun: true,
      orderId: simulatedOrderId,
      reason: "coinbase_dry_run_simulated",
      gateLog,
      safety,
    };
  }

  gateLog.push("live_execution_not_yet_enabled");

  writeCoinbaseAuditEvent(
    "ORDER_GATE_BLOCK",
    "live_execution_not_yet_enabled",
    {
      intentId: req.intentId,
    }
  );

  return {
    ok: false,
    blocked: true,
    reason: "live_execution_not_yet_enabled",
    gateLog,
    safety,
  };
}

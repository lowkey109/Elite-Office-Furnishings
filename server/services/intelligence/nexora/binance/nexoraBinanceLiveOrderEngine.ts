import crypto from "crypto";

import {
  safetyEnvelope,
  checkLiveReadiness,
} from "./nexoraBinanceLiveReadinessService";

import {
  findApprovedIntent,
  markIntentExecuted,
} from "./nexoraBinanceLiveIntentStore";

import {
  writeAuditEvent,
} from "./nexoraBinanceLiveAuditLog";

export async function placeLiveBinanceOrder(req: {
  intentId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantityStr: string;
  type?: "MARKET" | "LIMIT";
  price?: number;
  equityAud: number;
}) {
  const gateLog: string[] = [];

  const safety = safetyEnvelope();

  if (!safety.liveEnabled) {
    gateLog.push(
      "live_trading_env_disabled"
    );

    writeAuditEvent(
      "ORDER_GATE_BLOCK",
      "live_trading_env_disabled",
      {
        intentId: req.intentId,
        symbol: req.symbol,
      }
    );

    return {
      ok: false,
      blocked: true,
      reason:
        "live_trading_env_disabled",
      gateLog,
      safety,
    };
  }

  if (safety.killSwitchArmed) {
    gateLog.push("kill_switch_armed");

    writeAuditEvent(
      "ORDER_GATE_BLOCK",
      "kill_switch_armed",
      {
        intentId: req.intentId,
        symbol: req.symbol,
      }
    );

    return {
      ok: false,
      blocked: true,
      reason: "kill_switch_armed",
      gateLog,
      safety,
    };
  }

  const readiness =
    await checkLiveReadiness();

  if (!readiness.ready) {
    gateLog.push(
      ...readiness.blockedReasons
    );

    return {
      ok: false,
      blocked: true,
      reason:
        readiness.blockedReasons[0] ||
        "not_ready",
      gateLog,
      safety,
    };
  }

  const intent =
    findApprovedIntent(
      req.intentId
    );

  if (!intent) {
    gateLog.push(
      "approved_intent_missing"
    );

    writeAuditEvent(
      "ORDER_GATE_BLOCK",
      "approved_intent_missing",
      {
        intentId: req.intentId,
        symbol: req.symbol,
      }
    );

    return {
      ok: false,
      blocked: true,
      reason:
        "approved_intent_missing",
      gateLog,
      safety,
    };
  }

  if (
    intent.symbol !==
      req.symbol.toUpperCase() ||
    intent.side !== req.side
  ) {
    gateLog.push(
      "intent_order_mismatch"
    );

    return {
      ok: false,
      blocked: true,
      reason:
        "intent_order_mismatch",
      gateLog,
      safety,
    };
  }

  if (
    intent.notionalAud >
    intent.maxTradeAud
  ) {
    gateLog.push(
      "capital_ladder_limit_exceeded"
    );

    return {
      ok: false,
      blocked: true,
      reason:
        "capital_ladder_limit_exceeded",
      gateLog,
      safety,
    };
  }

  if (safety.dryRunMode) {
    const orderId = `dry_${crypto.randomUUID()}`;

    markIntentExecuted(
      req.intentId,
      orderId
    );

    writeAuditEvent(
      "DRY_RUN_SIMULATED",
      "dry_run_order_simulated",
      {
        intentId: req.intentId,
        orderId,
        symbol: req.symbol,
        side: req.side,
        notionalAud:
          intent.notionalAud,
      }
    );

    return {
      ok: true,
      dryRun: true,
      orderId,
      reason:
        "dry_run_order_simulated",
      gateLog,
      safety,
    };
  }

  return {
    ok: false,
    blocked: true,
    reason:
      "real_binance_submission_not_enabled_in_this_patch",
    gateLog,
    safety,
  };
}

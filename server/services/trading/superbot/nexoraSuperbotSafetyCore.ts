export function getNexoraSuperbotSafetyCore() {
  const liveTradingEnabled = process.env.NEXORA_LIVE_TRADING_ENABLED === "true";
  const manualApprovalRequired = process.env.NEXORA_MANUAL_APPROVAL_REQUIRED !== "false";

  return {
    ok: true,
    service: "nexora_superbot_safety_core",
    mode: liveTradingEnabled ? "LIVE_BLOCKED_BY_APPROVAL_LAYER" : "PAPER_ONLY",
    liveTradingEnabled,
    manualApprovalRequired,
    hardRules: [
      "No real-money order without explicit live flag.",
      "No real-money order without manual approval.",
      "No strategy goes live without paper proof.",
      "No trade if DB safety fails.",
      "No trade if liquidity, spread, resolution, correlation, or calibration fails.",
      "No trade if daily loss limit is reached.",
      "No duplicate orders.",
      "Emergency stop always wins.",
    ],
    requiredBeforeLive: [
      "paper sample size >= 1000",
      "positive expected value",
      "stable calibration",
      "controlled drawdown",
      "order-book fill proof",
      "manual approval",
      "audit log",
      "balance check",
      "kill switch",
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function validateNexoraSuperbotTrade(input: any = {}) {
  const reasons: string[] = [];

  if (process.env.NEXORA_LIVE_TRADING_ENABLED !== "true") {
    reasons.push("Live trading disabled.");
  }

  if (process.env.NEXORA_MANUAL_APPROVAL_REQUIRED !== "false" && input.manualApproval !== true) {
    reasons.push("Manual approval required.");
  }

  if (Number(input.paperSampleSize || 0) < 1000) {
    reasons.push("Paper sample size below 1000.");
  }

  if (Number(input.expectedValuePct || 0) <= 0) {
    reasons.push("Expected value is not positive.");
  }

  if (Number(input.maxDrawdownPct || 100) > 10) {
    reasons.push("Drawdown above 10% limit.");
  }

  if (input.dbSafe !== true) reasons.push("DB safety not proven.");
  if (input.resolutionClear !== true) reasons.push("Resolution clarity not proven.");
  if (input.correlationOk !== true) reasons.push("Correlation risk not cleared.");
  if (input.orderBookOk !== true) reasons.push("Order-book fill quality not proven.");
  if (input.calibrationOk !== true) reasons.push("Model calibration not proven.");

  return {
    ok: true,
    service: "nexora_superbot_trade_validator",
    paperOnlyDefault: true,
    liveAllowed: reasons.length === 0,
    action: reasons.length === 0 ? "LIVE_READY_PENDING_EXECUTION_ADAPTER" : "BLOCKED_MONITOR_ONLY",
    blockedReasons: reasons,
    updatedAt: new Date().toISOString(),
  };
}

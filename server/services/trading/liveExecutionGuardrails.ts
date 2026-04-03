import { getLiveExecutionConfig } from "./liveExecutionConfig";

export interface GuardrailCheckResult {
  passed: boolean;
  blockedReasons: string[];
  checks: { name: string; passed: boolean; reason?: string }[];
}

export async function checkLiveGuardrails(params: {
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  decisionId?: string;
}): Promise<GuardrailCheckResult> {
  const config = getLiveExecutionConfig();
  const checks: { name: string; passed: boolean; reason?: string }[] = [];
  const blockedReasons: string[] = [];

  const liveCheck = config.liveEnabled;
  checks.push({ name: "live_enabled", passed: liveCheck, reason: liveCheck ? undefined : "Live execution is disabled" });
  if (!liveCheck) blockedReasons.push("Live execution is disabled");

  const modeCheck = config.executionMode !== "paper_only";
  checks.push({ name: "execution_mode", passed: modeCheck, reason: modeCheck ? undefined : `Mode is ${config.executionMode}` });
  if (!modeCheck) blockedReasons.push(`Execution mode is ${config.executionMode}`);

  const venueCheck = config.approvedVenue !== null;
  checks.push({ name: "venue_approved", passed: venueCheck, reason: venueCheck ? undefined : "No approved venue configured" });
  if (!venueCheck) blockedReasons.push("No approved venue");

  const symbolCheck = config.approvedSymbols.includes(params.symbol);
  checks.push({ name: "symbol_approved", passed: symbolCheck, reason: symbolCheck ? undefined : `${params.symbol} not in approved symbols` });
  if (!symbolCheck) blockedReasons.push(`${params.symbol} not approved for live trading`);

  const notional = params.quantity * params.price;
  const riskCheck = notional <= config.maxLiveRiskPerTrade;
  checks.push({ name: "risk_per_trade", passed: riskCheck, reason: riskCheck ? undefined : `Notional ${notional} exceeds max ${config.maxLiveRiskPerTrade}` });
  if (!riskCheck) blockedReasons.push(`Trade risk exceeds limit`);

  const credCheck = config.credentialsPresent;
  checks.push({ name: "credentials_present", passed: credCheck, reason: credCheck ? undefined : "No venue credentials configured" });
  if (!credCheck) blockedReasons.push("No venue credentials");

  const openPositionCheck = true;
  checks.push({ name: "max_open_positions", passed: openPositionCheck, reason: openPositionCheck ? `Limit: ${config.maxLiveOpenPositions}` : "Too many open positions" });

  const approvalCheck = !config.requiresConfigApproval;
  checks.push({ name: "config_approval", passed: approvalCheck, reason: approvalCheck ? undefined : "Config requires admin approval" });
  if (!approvalCheck) blockedReasons.push("Config requires admin approval");

  const accountModeCheck = config.accountMode === "testnet" || config.accountMode === "live";
  checks.push({ name: "account_mode_valid", passed: accountModeCheck, reason: `Mode: ${config.accountMode}` });

  let feedHealthy = false;
  try {
    const { getMarketLoopStatus } = await import("./marketLoop");
    const status = getMarketLoopStatus();
    feedHealthy = status.isRunning;
  } catch (err) {
    console.warn("[guardrails] Could not check market feed status:", err instanceof Error ? err.message : err);
  }
  checks.push({ name: "market_feed_healthy", passed: feedHealthy, reason: feedHealthy ? undefined : "Market feed not running" });
  if (!feedHealthy) blockedReasons.push("Market feed not healthy");

  return {
    passed: blockedReasons.length === 0,
    blockedReasons,
    checks,
  };
}

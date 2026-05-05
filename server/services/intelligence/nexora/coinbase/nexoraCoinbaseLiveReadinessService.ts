import {
  coinbaseSafetyEnvelope,
} from "./nexoraCoinbaseLiveConfig";

import {
  writeCoinbaseAuditEvent,
} from "./nexoraCoinbaseLiveAuditLog";

export type CoinbaseReadinessResult = {
  ok: boolean;
  ready: boolean;
  generatedAt: string;
  checks: Record<string, boolean>;
  blockedReasons: string[];
  safety: ReturnType<typeof coinbaseSafetyEnvelope>;
};

export async function checkCoinbaseLiveReadiness(): Promise<CoinbaseReadinessResult> {
  const safety = coinbaseSafetyEnvelope();

  const liveEnabledEnv = safety.liveEnabled;
  const apiKeyPresent = safety.apiKeyPresent;
  const apiSecretPresent = safety.apiSecretPresent;
  const withdrawalsLocked = safety.withdrawalsLocked;
  const dryRunMode = safety.dryRunMode;

  const blockedReasons: string[] = [];

  if (!liveEnabledEnv) blockedReasons.push("live_trading_env_disabled");
  if (!apiKeyPresent) blockedReasons.push("coinbase_api_key_missing");
  if (!apiSecretPresent) blockedReasons.push("coinbase_api_secret_missing");
  if (!withdrawalsLocked) blockedReasons.push("withdrawals_not_locked");

  const ready = blockedReasons.length === 0;

  const result: CoinbaseReadinessResult = {
    ok: true,
    ready,
    generatedAt: new Date().toISOString(),
    checks: {
      liveEnabledEnv,
      apiKeyPresent,
      apiSecretPresent,
      withdrawalsLocked,
      dryRunMode,
    },
    blockedReasons,
    safety,
  };

  writeCoinbaseAuditEvent(
    "READINESS_CHECK",
    ready ? "all_gates_passed" : "gates_failed",
    { meta: { blockedReasons } }
  );

  return result;
}

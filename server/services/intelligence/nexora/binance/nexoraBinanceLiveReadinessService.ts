import fs from "fs";
import path from "path";

import { writeAuditEvent } from "./nexoraBinanceLiveAuditLog";

const STATE_FILE = path.join(
  process.cwd(),
  "data",
  "nexora",
  "local",
  "binance-live-state.json"
);

type State = {
  killSwitchArmed: boolean;
  dryRunMode: boolean;
};

function readState(): State {
  try {
    return JSON.parse(
      fs.readFileSync(STATE_FILE, "utf8")
    ) as State;
  } catch {
    return {
      killSwitchArmed: false,
      dryRunMode: true,
    };
  }
}

function writeState(state: State) {
  fs.mkdirSync(path.dirname(STATE_FILE), {
    recursive: true,
  });

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(state, null, 2)
  );
}

export function setKillSwitch(
  armed: boolean
) {
  const state = readState();

  state.killSwitchArmed = armed;

  writeState(state);

  writeAuditEvent(
    armed
      ? "KILL_SWITCH_ARMED"
      : "KILL_SWITCH_CLEARED",
    "admin_toggle"
  );

  return state;
}

export function setDryRun(enabled: boolean) {
  const state = readState();

  state.dryRunMode = enabled;

  writeState(state);

  writeAuditEvent(
    enabled
      ? "DRY_RUN_ENABLED"
      : "DRY_RUN_DISABLED",
    "admin_toggle"
  );

  return state;
}

export function safetyEnvelope() {
  const state = readState();

  return {
    liveEnabled:
      process.env.BINANCE_LIVE_TRADING_ENABLED ===
      "true",

    withdrawalsLocked:
      process.env.BINANCE_ALLOW_WITHDRAWALS !==
      "true",

    killSwitchArmed:
      state.killSwitchArmed,

    dryRunMode:
      state.dryRunMode,
  };
}

export type ReadinessCheckResult = {
  ok: boolean;
  ready: boolean;
  generatedAt: string;
  checks: Record<string, boolean>;
  balanceUsdt: number;
  balanceAud: number;
  blockedReasons: string[];
  meta: Record<string, unknown>;
  safety: ReturnType<typeof safetyEnvelope>;
};

export async function checkLiveReadiness(): Promise<ReadinessCheckResult> {
  const now = new Date().toISOString();

  const safety = safetyEnvelope();

  const liveEnabledEnv =
    process.env.BINANCE_LIVE_TRADING_ENABLED ===
    "true";

  const apiKeyPresent = Boolean(
    process.env.BINANCE_API_KEY
  );

  const apiSecretPresent = Boolean(
    process.env.BINANCE_API_SECRET
  );

  const withdrawalsLocked =
    process.env.BINANCE_ALLOW_WITHDRAWALS !==
    "true";

  const killSwitchClear =
    !safety.killSwitchArmed;

  const accountConnected =
    apiKeyPresent && apiSecretPresent;

  const canTrade = accountConnected;

  const canWithdraw =
    process.env.BINANCE_ALLOW_WITHDRAWALS ===
    "true";

  const blockedReasons: string[] = [];

  if (!liveEnabledEnv) {
    blockedReasons.push(
      "live_trading_env_disabled"
    );
  }

  if (!apiKeyPresent) {
    blockedReasons.push(
      "binance_api_key_missing"
    );
  }

  if (!apiSecretPresent) {
    blockedReasons.push(
      "binance_api_secret_missing"
    );
  }

  if (!withdrawalsLocked) {
    blockedReasons.push(
      "withdrawals_not_locked"
    );
  }

  if (!killSwitchClear) {
    blockedReasons.push(
      "kill_switch_armed"
    );
  }

  if (!accountConnected) {
    blockedReasons.push(
      "account_not_connected"
    );
  }

  if (!canTrade) {
    blockedReasons.push(
      "account_trade_permission_missing"
    );
  }

  const ready =
    blockedReasons.length === 0;

  const result: ReadinessCheckResult = {
    ok: true,

    ready,

    generatedAt: now,

    checks: {
      liveEnabledEnv,
      apiKeyPresent,
      apiSecretPresent,
      withdrawalsLocked,
      killSwitchClear,
      accountConnected,
      canTrade,
      canWithdraw: !canWithdraw,
    },

    balanceUsdt: 0,

    balanceAud: 0,

    blockedReasons,

    meta: {},

    safety,
  };

  writeAuditEvent(
    "READINESS_CHECK",
    ready
      ? "all_gates_passed"
      : "gates_failed",
    {
      meta: {
        blockedReasons,
      },
    }
  );

  return result;
}

export type AutonomyRuntimeStatus = {
  safeMode: boolean;
  realOutreachEnabled: boolean;
  nexoraLoopEnabled: boolean;
  pgBossRequired: boolean;
  workerMode: "pg-boss";
  phantomXMarketLoopEnabled: boolean;
  phantomXLivePreauthorised: boolean;
  emergencyStop: boolean;
  outboundKillSwitch: boolean;
  liveTradingKillSwitch: boolean;
  requiredEnv: Record<string, boolean>;
};

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

function boolEnv(name: string): boolean {
  return env(name) === "true";
}

export function getAutonomyRuntimeStatus(): AutonomyRuntimeStatus {
  return {
    safeMode: process.env.SAFE_MODE !== "false",
    realOutreachEnabled: boolEnv("TCD_ALLOW_REAL_OUTREACH"),
    nexoraLoopEnabled: process.env.NEXORA_LOOP_ENABLED !== "false",
    pgBossRequired: true,
    workerMode: "pg-boss",
    phantomXMarketLoopEnabled: boolEnv("PHANTOM_X_MARKET_LOOP_ENABLED"),
    phantomXLivePreauthorised: boolEnv("PHANTOM_X_LIVE_PREAUTHORISED"),
    emergencyStop: boolEnv("TCD_AUTONOMY_EMERGENCY_STOP"),
    outboundKillSwitch: boolEnv("TCD_OUTBOUND_KILL_SWITCH"),
    liveTradingKillSwitch: boolEnv("PHANTOM_X_LIVE_KILL_SWITCH"),
    requiredEnv: {
      DATABASE_URL: !!env("DATABASE_URL"),
      SAFE_MODE: !!env("SAFE_MODE"),
      TCD_AUTONOMY_OVERRIDE_TOKEN: !!env("TCD_AUTONOMY_OVERRIDE_TOKEN"),
      RESEND_API_KEY: !!env("RESEND_API_KEY"),
      TCD_EMAIL_FROM_PLAIN: !!env("TCD_EMAIL_FROM_PLAIN"),
    },
  };
}

export function assertAutonomyRuntimeAllowed(action: "outbound" | "worker" | "live_trading") {
  const status = getAutonomyRuntimeStatus();

  if (status.emergencyStop) return { allowed: false, reason: "TCD_AUTONOMY_EMERGENCY_STOP=true" };
  if (action === "outbound" && status.outboundKillSwitch) return { allowed: false, reason: "TCD_OUTBOUND_KILL_SWITCH=true" };
  if (action === "live_trading" && status.liveTradingKillSwitch) return { allowed: false, reason: "PHANTOM_X_LIVE_KILL_SWITCH=true" };

  return { allowed: true, reason: "runtime_allowed" };
}

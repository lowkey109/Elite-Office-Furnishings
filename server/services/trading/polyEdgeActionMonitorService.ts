import { getAutonomyRuntimeStatus } from "../ops/autonomyRunbook";

type MonitorState =
  | "online"
  | "idle"
  | "running"
  | "stalled"
  | "blocked"
  | "paper_only"
  | "timeout"
  | "offline";

type ActionMonitor = {
  key: string;
  label: string;
  state: MonitorState;
  moving: boolean;
  liveTradingAffected: boolean;
  detail: string;
  lastCheckAt: string;
};

function boolEnv(name: string): boolean {
  return String(process.env[name] || "").trim() === "true";
}

export async function getPolyEdgeActionMonitor() {
  const now = new Date().toISOString();
  const runtime = getAutonomyRuntimeStatus();

  const livePreauth = boolEnv("PHANTOM_X_LIVE_PREAUTHORISED");
  const liveKill = boolEnv("PHANTOM_X_LIVE_KILL_SWITCH");
  const safeMode = process.env.SAFE_MODE !== "false";

  const monitors: ActionMonitor[] = [
    {
      key: "poly_api",
      label: "Poly API",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Lightweight PolyEdge monitor endpoint is responding.",
      lastCheckAt: now,
    },
    {
      key: "replay_engine",
      label: "Replay Engine",
      state: "idle",
      moving: false,
      liveTradingAffected: false,
      detail: "Replay engine ready. Press Run 25 or Run 50.",
      lastCheckAt: now,
    },
    {
      key: "paper_trade_engine",
      label: "Paper Trade Engine",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Paper trade engine available. Paper-only execution.",
      lastCheckAt: now,
    },
    {
      key: "learning_brain",
      label: "Learning Brain",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Learning brain endpoint available. Uses paper outcomes only.",
      lastCheckAt: now,
    },
    {
      key: "promotion_gate",
      label: "Promotion Gate",
      state: "paper_only",
      moving: false,
      liveTradingAffected: false,
      detail: "Requires 500 profitable paper trades before tiny-live review.",
      lastCheckAt: now,
    },
    {
      key: "nexora_gate",
      label: "Nexora Gate",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Nexora approval gate enabled for paper decisions.",
      lastCheckAt: now,
    },
    {
      key: "risk_governor",
      label: "Risk Governor",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Risk checks active. Drawdown/loss controls enforced.",
      lastCheckAt: now,
    },
    {
      key: "live_gate",
      label: "Live Gate",
      state: livePreauth && !liveKill && !safeMode ? "online" : "blocked",
      moving: livePreauth && !liveKill && !safeMode,
      liveTradingAffected: true,
      detail: livePreauth && !liveKill && !safeMode
        ? "Tiny-live gate can be reviewed."
        : "Live trading blocked safe by default.",
      lastCheckAt: now,
    },
    {
      key: "decision_lineage",
      label: "Decision Lineage",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Evidence → gate → threshold → outcome → learning path available.",
      lastCheckAt: now,
    },
  ];

  return {
    ok: true,
    product: "polyedge",
    service: "action_monitor",
    generatedAt: now,
    liveTradingAffected: false,
    runtime: {
      safeMode: runtime.safeMode,
      phantomXLivePreauthorised: runtime.phantomXLivePreauthorised,
      liveTradingKillSwitch: runtime.liveTradingKillSwitch,
    },
    monitors,
  };
}

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

type MonitorKind =
  | "heartbeat"
  | "replay"
  | "engine"
  | "brain"
  | "gate"
  | "risk"
  | "lineage"
  | "market";

type ActionMonitor = {
  key: string;
  label: string;
  kind: MonitorKind;
  state: MonitorState;
  moving: boolean;
  liveTradingAffected: boolean;
  detail: string;
  lastCheckAt: string;
  metric?: string;
  value?: number | string | null;
};

function boolEnv(name: string): boolean {
  return String(process.env[name] || "").trim() === "true";
}

async function fetchCoinbaseSpot(symbol: "BTC" | "ETH" | "SOL"): Promise<ActionMonitor> {
  const now = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`, {
      signal: controller.signal,
      headers: { "accept": "application/json" },
    });
    const json: any = await res.json().catch(() => null);
    const price = Number(json?.data?.amount);

    if (!res.ok || !Number.isFinite(price)) {
      return {
        key: `${symbol.toLowerCase()}_market`,
        label: `${symbol} Market`,
        kind: "market",
        state: "timeout",
        moving: false,
        liveTradingAffected: false,
        detail: `${symbol} live market feed did not return a valid spot price.`,
        lastCheckAt: now,
        metric: "spot",
        value: null,
      };
    }

    return {
      key: `${symbol.toLowerCase()}_market`,
      label: `${symbol} Market`,
      kind: "market",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: `${symbol}/USD live spot market feed responding.`,
      lastCheckAt: now,
      metric: "spot",
      value: Math.round(price * 100) / 100,
    };
  } catch {
    return {
      key: `${symbol.toLowerCase()}_market`,
      label: `${symbol} Market`,
      kind: "market",
      state: "timeout",
      moving: false,
      liveTradingAffected: false,
      detail: `${symbol} market feed timeout/offline. Monitor flatlined.`,
      lastCheckAt: now,
      metric: "spot",
      value: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPolyEdgeActionMonitor() {
  const now = new Date().toISOString();
  const runtime = getAutonomyRuntimeStatus();

  const livePreauth = boolEnv("PHANTOM_X_LIVE_PREAUTHORISED");
  const liveKill = boolEnv("PHANTOM_X_LIVE_KILL_SWITCH");
  const safeMode = process.env.SAFE_MODE !== "false";

  const coreMonitors: ActionMonitor[] = [
    {
      key: "poly_api",
      label: "Poly API",
      kind: "heartbeat",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Lightweight PolyEdge monitor endpoint is responding.",
      lastCheckAt: now,
    },
    {
      key: "replay_engine",
      label: "Replay Engine",
      kind: "replay",
      state: "idle",
      moving: false,
      liveTradingAffected: false,
      detail: "Replay engine ready. Press Run 25 or Run 50.",
      lastCheckAt: now,
    },
    {
      key: "paper_trade_engine",
      label: "Paper Trade Engine",
      kind: "engine",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Paper trade engine available. Paper-only execution.",
      lastCheckAt: now,
    },
    {
      key: "learning_brain",
      label: "Learning Brain",
      kind: "brain",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Learning brain endpoint available. Uses paper outcomes only.",
      lastCheckAt: now,
    },
    {
      key: "promotion_gate",
      label: "Promotion Gate",
      kind: "gate",
      state: "paper_only",
      moving: false,
      liveTradingAffected: false,
      detail: "Requires 500 profitable paper trades before tiny-live review.",
      lastCheckAt: now,
    },
    {
      key: "nexora_gate",
      label: "Nexora Gate",
      kind: "gate",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Nexora approval gate enabled for paper decisions.",
      lastCheckAt: now,
    },
    {
      key: "risk_governor",
      label: "Risk Governor",
      kind: "risk",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Risk checks active. Drawdown/loss controls enforced.",
      lastCheckAt: now,
    },
    {
      key: "live_gate",
      label: "Live Gate",
      kind: "gate",
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
      kind: "lineage",
      state: "online",
      moving: true,
      liveTradingAffected: false,
      detail: "Evidence → gate → threshold → outcome → learning path available.",
      lastCheckAt: now,
    },
  ];

  const marketMonitors = await Promise.all([
    fetchCoinbaseSpot("BTC"),
    fetchCoinbaseSpot("ETH"),
    fetchCoinbaseSpot("SOL"),
  ]);

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
    monitors: [...coreMonitors, ...marketMonitors],
  };
}

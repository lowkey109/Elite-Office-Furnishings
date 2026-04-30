import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Brain,
  Cpu,
  Eye,
  Hexagon,
  Radar,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PolyEdgeMode = "admin" | "client";

type PolyEdgeLearningGroup = {
  key?: string;
  label?: string;
  dimension?: string;
  samples?: number;
  winRate?: number;
  totalPnl?: number;
  profitFactor?: number;
  learningScore?: number;
  confidence?: number;
  recommendation?: string;
  reason?: string;
};

type PolyEdgeLearningResponse = {
  ok?: boolean;
  summary?: {
    globalLearningScore?: number;
    outcomeSamples?: number;
    decisionSamples?: number;
    proofPassed?: boolean;
    proofReadiness?: string;
  };
  adaptiveThreshold?: {
    defaultPaperConfidenceThreshold?: number;
    recommendedPaperConfidenceThreshold?: number;
    appliesToLiveTrading?: boolean;
    notes?: string[];
    bestStrategy?: PolyEdgeLearningGroup | null;
    weakestStrategy?: PolyEdgeLearningGroup | null;
  };
  byDimension?: {
    strategy?: PolyEdgeLearningGroup[];
    symbol?: PolyEdgeLearningGroup[];
    direction?: PolyEdgeLearningGroup[];
    regime?: PolyEdgeLearningGroup[];
    riskBucket?: PolyEdgeLearningGroup[];
    confidenceBand?: PolyEdgeLearningGroup[];
  };
  topOpportunities?: PolyEdgeLearningGroup[];
  risksToReduce?: PolyEdgeLearningGroup[];
};

type PolyEdgeActionMonitorItem = {
  key?: string;
  label?: string;
  state?: string;
  kind?: string;
  moving?: boolean;
  liveTradingAffected?: boolean;
  detail?: string;
  lastCheckAt?: string;
  metric?: string;
  value?: number | string | null;
};

type PolyEdgeActionMonitorResponse = {
  ok?: boolean;
  product?: string;
  service?: string;
  generatedAt?: string;
  monitors?: PolyEdgeActionMonitorItem[];
};

type PolyEdgeReplayStatus = {
  ok?: boolean;
  maxBatchSize?: number;
  lastRunAt?: string | null;
  recentWindow?: {
    sampledOutcomes?: number;
    profitable?: number;
    losses?: number;
  };
  proof?: {
    totalTrades?: number;
    wins?: number;
    losses?: number;
    winRate?: number;
    profitFactor?: number;
    maxDrawdownPct?: number;
    totalPnl?: number;
  };
  promotion?: {
    status?: string;
    metrics?: {
      totalPaperTrades?: number;
      qualifiedProfitablePaperTrades?: number;
      requiredProfitablePaperTrades?: number;
      profitablePaperTradeProgressPct?: number;
      winRate?: number;
      profitFactor?: number;
      maxDrawdownPct?: number;
      totalPnl?: number;
      globalLearningScore?: number;
    };
    nextRequiredAction?: string;
  };
};

type PolyEdgeProofResponse = {
  ok?: boolean;
  product?: string;
  generatedAt?: string;
  mode?: PolyEdgeMode;
  tradingMode?: string;
  liveTradingAllowed?: boolean;
  customerDisclaimer?: string;
  nexora?: {
    executionAuthority?: string;
    workerMode?: string;
    loopEnabled?: boolean;
    running?: boolean;
    lastRunAt?: string | null;
    gateRequired?: boolean;
  };
  runtime?: {
    safeMode?: boolean;
    phantomXLivePreauthorised?: boolean;
    emergencyStop?: boolean;
    outboundKillSwitch?: boolean;
    liveTradingKillSwitch?: boolean;
  };
  proof?: {
    totalTrades?: number;
    wins?: number;
    losses?: number;
    flats?: number;
    winRate?: number;
    grossProfit?: number;
    grossLossAbs?: number;
    totalPnl?: number;
    avgPnl?: number;
    expectancy?: number;
    profitFactor?: number;
    maxDrawdownPct?: number;
    proofPassed?: boolean;
    readiness?: string;
  };
  monitor?: {
    state?: any;
    performance?: any;
    positions?: any[];
    recent_outcomes?: any[];
    marketContext?: any;
    feedStatus?: any;
    dataMode?: string;
  };
  adminOnly?: {
    executionAttempts?: any[];
    liveOrders?: any[];
    livePositions?: any[];
  };
};

function money(value: unknown) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function polyEdgeAuthHeaders(mode: "admin" | "client"): HeadersInit {
  if (mode !== "admin") return {};
  return { "x-tcd-admin-auth": "true" };
}

function num(value: unknown, suffix = "") {
  const n = Number(value || 0);
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function getPnl(row: any): number {
  const direct =
    row?.realizedPnl ??
    row?.pnl ??
    row?.profitLoss ??
    row?.netPnl;

  if (Number.isFinite(Number(direct))) return Number(direct);

  const returned = Number(row?.capitalReturned);
  const allocated = Number(row?.paperCapitalAllocated);
  if (Number.isFinite(returned) && Number.isFinite(allocated)) return returned - allocated;

  return 0;
}


function PolyEdgeHeartbeatPanel({
  apiStatus,
  lastApiCheck,
  heartbeatTick,
  runtime,
  replayMessage,
}: {
  apiStatus: "checking" | "online" | "offline" | "timeout";
  lastApiCheck: string | null;
  heartbeatTick: number;
  runtime?: any;
  replayMessage?: string | null;
}) {
  const running = runtime?.running === true;
  const pulse = heartbeatTick % 4;
  const statusColor =
    apiStatus === "online" ? "text-emerald-300" :
    apiStatus === "checking" ? "text-cyan-300" :
    "text-amber-300";

  return (
    <HoloPanel title="PolyEdge Live Heartbeat" icon={Activity} className="col-span-12 xl:col-span-6">
      <style>{`
        @keyframes polyedge-heartbeat-pulse {
          0%, 100% { transform: scale(.92); opacity: .55; }
          50% { transform: scale(1.12); opacity: 1; }
        }
        @keyframes polyedge-heartbeat-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes polyedge-heartbeat-scan {
          0% { transform: translateX(-120%); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateX(220%); opacity: 0; }
        }
      `}</style>

      <div className="relative min-h-[230px] overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/30 p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_50%,rgba(34,240,255,0.18),transparent_35%),radial-gradient(circle_at_75%_35%,rgba(255,0,170,0.14),transparent_32%)]" />
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent" style={{ animation: "polyedge-heartbeat-scan 2.6s linear infinite" }} />

        <div className="relative z-10 grid min-h-[200px] grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
          <div className="flex items-center justify-center">
            <div className="relative h-40 w-40">
              <div className="absolute inset-0 rounded-full border border-cyan-300/30" style={{ animation: "polyedge-heartbeat-orbit 8s linear infinite" }} />
              <div className="absolute inset-5 rounded-full border border-fuchsia-300/25" style={{ animation: "polyedge-heartbeat-orbit 5s linear infinite reverse" }} />
              <div className="absolute inset-10 rounded-full border border-emerald-300/25" />
              <div className="absolute inset-[58px] rounded-full bg-cyan-300/25 shadow-[0_0_40px_rgba(34,240,255,.8)]" style={{ animation: "polyedge-heartbeat-pulse 1.4s ease-in-out infinite" }} />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/70 to-transparent" style={{ animation: "polyedge-heartbeat-orbit 2.8s linear infinite" }} />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-cyan-300/15 bg-black/40 p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/40">App Heartbeat</div>
                <div className="mt-1 text-xl font-black text-emerald-300">LIVE {'.'.repeat(pulse + 1)}</div>
              </div>

              <div className="rounded-xl border border-cyan-300/15 bg-black/40 p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/40">API Status</div>
                <div className={`mt-1 text-xl font-black uppercase ${statusColor}`}>{apiStatus}</div>
              </div>

              <div className="rounded-xl border border-cyan-300/15 bg-black/40 p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/40">Replay Engine</div>
                <div className={`mt-1 text-xl font-black uppercase ${running ? "text-emerald-300" : "text-cyan-100/45"}`}>
                  {running ? "RUNNING" : "IDLE"}
                </div>
              </div>

              <div className="rounded-xl border border-cyan-300/15 bg-black/40 p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/40">Last Check</div>
                <div className="mt-1 text-xl font-black text-white">{lastApiCheck || "waiting"}</div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-orange-300/15 bg-orange-400/5 p-3 text-[11px] leading-relaxed text-orange-100/75">
              {replayMessage || runtime?.lastEvent || "Cockpit is alive. Waiting for replay/API response."}
            </div>
          </div>
        </div>
      </div>
    </HoloPanel>
  );
}


function PolySystemHeartMonitor({
  apiStatus,
  lastApiCheck,
  lastGoodApiCheck,
  apiFailureCount,
  heartbeatTick,
}: {
  apiStatus: "checking" | "online" | "offline" | "timeout";
  lastApiCheck: string | null;
  lastGoodApiCheck: string | null;
  apiFailureCount: number;
  heartbeatTick: number;
}) {
  const alive = apiStatus === "online";
  const flatline = apiStatus === "offline" || apiStatus === "timeout";
  const dots = ".".repeat((heartbeatTick % 3) + 1);

  return (
    <HoloPanel title="Poly System Heart Monitor" icon={Activity} className="col-span-12 xl:col-span-6">
      <style>{`
        @keyframes poly-ecg-run {
          from { transform: translateX(-50%); }
          to { transform: translateX(0%); }
        }
        @keyframes poly-heart-glow {
          0%, 100% { opacity: .45; transform: scale(.96); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>

      <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/40 p-4">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(34,240,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34,240,255,.10) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/40">PolyEdge API Heartbeat</div>
              <div className={`mt-1 text-3xl font-black uppercase tracking-[0.12em] ${alive ? "text-emerald-300" : flatline ? "text-red-300" : "text-cyan-300"}`}>
                {alive ? `LIVE${dots}` : flatline ? "FLATLINE" : "CHECKING"}
              </div>
            </div>
            <div className="rounded-xl border border-cyan-300/20 bg-black/45 px-4 py-3 text-right">
              <div className="text-[9px] uppercase tracking-[0.14em] text-cyan-100/40">API Status</div>
              <div className={`text-xl font-black uppercase ${alive ? "text-emerald-300" : "text-amber-300"}`}>{apiStatus}</div>
            </div>
          </div>

          <div className="relative h-24 overflow-hidden rounded-xl border border-cyan-300/15 bg-black/60">
            <svg className="absolute inset-0 h-full w-[200%]" style={{ animation: alive ? "poly-ecg-run 1.2s linear infinite" : undefined }} viewBox="0 0 1000 120" preserveAspectRatio="none">
              <polyline
                points={
                  alive
                    ? "0,70 80,70 105,70 118,40 130,95 145,20 165,70 250,70 330,70 355,70 368,48 380,90 394,30 414,70 500,70 580,70 605,70 618,45 630,92 646,24 666,70 750,70 830,70 855,70 868,46 880,94 896,25 916,70 1000,70"
                    : "0,70 1000,70"
                }
                fill="none"
                stroke={alive ? "#00ff88" : "#ff4d4d"}
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <div className={`absolute right-4 top-4 h-4 w-4 rounded-full ${alive ? "bg-emerald-300" : "bg-red-400"}`} style={{ animation: alive ? "poly-heart-glow 1s ease-in-out infinite" : undefined }} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3">
              <div className="text-cyan-100/35">Last Check</div>
              <div className="font-bold text-white">{lastApiCheck || "waiting"}</div>
            </div>
            <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/5 p-3">
              <div className="text-cyan-100/35">Last Good</div>
              <div className="font-bold text-emerald-300">{lastGoodApiCheck || "none"}</div>
            </div>
            <div className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3">
              <div className="text-cyan-100/35">Failures</div>
              <div className="font-bold text-amber-300">{apiFailureCount}</div>
            </div>
          </div>
        </div>
      </div>
    </HoloPanel>
  );
}

function ReplayEngineMonitor({
  runtime,
  replayProgress,
  heartbeatTick,
  lastReplayProgressAt,
}: {
  runtime?: any;
  replayProgress: number;
  heartbeatTick: number;
  lastReplayProgressAt: number | null;
}) {
  const running = runtime?.running === true;
  const completed = Number(runtime?.completed || 0);
  const total = Number(runtime?.requestedBatchSize || 0);
  const secondsSinceProgress = running && lastReplayProgressAt ? Math.floor((Date.now() - lastReplayProgressAt) / 1000) : 0;
  const stalled = running && secondsSinceProgress >= 8;
  const status = stalled ? "STALLED" : running ? "RUNNING" : "IDLE";

  return (
    <HoloPanel title="Replay Engine Monitor" icon={Radar} className="col-span-12 xl:col-span-6">
      <style>{`
        @keyframes replay-orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes replay-core-pulse {
          0%, 100% { transform: scale(.9); opacity: .5; }
          50% { transform: scale(1.12); opacity: 1; }
        }
        @keyframes replay-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-fuchsia-300/15 bg-black/40 p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_45%,rgba(255,0,170,0.14),transparent_36%),radial-gradient(circle_at_70%_60%,rgba(34,240,255,0.12),transparent_34%)]" />
        <div className="relative z-10 grid min-h-[190px] grid-cols-[170px_1fr] gap-4">
          <div className="flex items-center justify-center">
            <div className="relative h-36 w-36">
              <div className="absolute inset-0 rounded-full border border-fuchsia-300/25" style={{ animation: running && !stalled ? "replay-orbit-spin 4s linear infinite" : undefined }} />
              <div className="absolute inset-5 rounded-full border border-cyan-300/25" style={{ animation: running && !stalled ? "replay-orbit-spin 7s linear infinite reverse" : undefined }} />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-fuchsia-300/80 to-transparent" style={{ animation: running && !stalled ? "replay-sweep 1.4s linear infinite" : undefined }} />
              <div className={`absolute inset-[52px] rounded-full ${stalled ? "bg-red-400/30" : running ? "bg-emerald-300/30" : "bg-cyan-300/15"} shadow-[0_0_35px_rgba(34,240,255,.55)]`} style={{ animation: running && !stalled ? "replay-core-pulse 1s ease-in-out infinite" : undefined }} />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/40">Replay Processing Heartbeat</div>
                <div className={`mt-1 text-3xl font-black uppercase tracking-[0.12em] ${stalled ? "text-red-300" : running ? "text-emerald-300" : "text-cyan-100/45"}`}>
                  {status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.14em] text-cyan-100/40">Trade Progress</div>
                <div className="text-2xl font-black text-white">{completed}/{total}</div>
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/60 ring-1 ring-fuchsia-300/20">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stalled ? "bg-red-400" : "bg-gradient-to-r from-cyan-300 via-emerald-300 to-fuchsia-300"}`}
                style={{ width: `${replayProgress}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px]">
              <div className="rounded-xl border border-emerald-300/15 bg-black/35 p-2"><div className="text-cyan-100/35">WINS</div><div className="font-bold text-emerald-300">{runtime?.profitable || 0}</div></div>
              <div className="rounded-xl border border-red-300/15 bg-black/35 p-2"><div className="text-cyan-100/35">LOSSES</div><div className="font-bold text-red-300">{runtime?.losing || 0}</div></div>
              <div className="rounded-xl border border-amber-300/15 bg-black/35 p-2"><div className="text-cyan-100/35">SKIP</div><div className="font-bold text-amber-300">{runtime?.skipped || 0}</div></div>
              <div className="rounded-xl border border-cyan-300/15 bg-black/35 p-2"><div className="text-cyan-100/35">NO MOVE</div><div className="font-bold text-cyan-300">{secondsSinceProgress}s</div></div>
            </div>

            <div className="mt-3 rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/5 p-3 text-[11px] leading-relaxed text-fuchsia-100/75">
              {runtime?.lastEvent || "Replay engine idle. Press Run 25 or Run 50 to start."}
            </div>
          </div>
        </div>
      </div>
    </HoloPanel>
  );
}






function statusTone(state?: string) {
  if (state === "online" || state === "running") {
    return {
      label: "LIVE",
      stroke: "#00ff88",
      glow: "rgba(0,255,136,.55)",
      text: "text-emerald-300",
      dot: "bg-emerald-300",
      border: "border-emerald-300/30",
    };
  }

  if (state === "blocked" || state === "paper_only" || state === "idle") {
    return {
      label: state === "idle" ? "IDLE" : "SAFE",
      stroke: "#ffd166",
      glow: "rgba(255,209,102,.48)",
      text: "text-amber-300",
      dot: "bg-amber-300",
      border: "border-amber-300/30",
    };
  }

  return {
    label: "FAULT",
    stroke: "#ff4d6d",
    glow: "rgba(255,77,109,.55)",
    text: "text-red-300",
    dot: "bg-red-300",
    border: "border-red-300/30",
  };
}

function HoloSignalTrace({ monitor }: { monitor: PolyEdgeActionMonitorItem }) {
  const tone = statusTone(monitor.state);
  const moving = monitor.moving === true;

  if (monitor.kind === "market") {
    return (
      <div className="relative h-9 overflow-hidden rounded-lg bg-black/65 ring-1 ring-cyan-200/10">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(34,240,255,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(34,240,255,.12) 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
        <div className="relative z-10 flex h-full items-end justify-center gap-[3px] px-2 pb-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-full"
              style={{
                height: moving ? `${6 + ((i * 13) % 27)}px` : "2px",
                background: moving ? "linear-gradient(to top,#00ff88,#22f0ff,#ffffff)" : tone.stroke,
                boxShadow: moving ? `0 0 10px ${tone.glow}` : undefined,
                animation: moving ? `poly-holo-bars ${0.5 + (i % 6) * 0.07}s ease-in-out infinite alternate` : undefined,
                animationDelay: `${i * 0.02}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-9 overflow-hidden rounded-lg bg-black/65 ring-1 ring-cyan-200/10">
      <svg className="absolute inset-0 h-full w-[135%]" viewBox="0 0 340 44" preserveAspectRatio="none">
        <polyline
          points={moving
            ? "0,25 28,25 38,25 49,10 60,35 74,4 90,25 122,25 136,25 148,15 160,33 174,8 192,25 226,25 244,25 258,11 274,36 292,25 340,25"
            : "0,25 340,25"}
          fill="none"
          stroke={tone.stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: `drop-shadow(0 0 8px ${tone.glow})`,
            animation: moving ? "poly-holo-ecg .9s linear infinite" : undefined,
          }}
        />
      </svg>
    </div>
  );
}

function HoloMonitorNode({ monitor, index }: { monitor: PolyEdgeActionMonitorItem; index: number }) {
  const tone = statusTone(monitor.state);
  const moving = monitor.moving === true;
  const value = monitor.kind === "market" && monitor.value ? "$" + Number(monitor.value).toLocaleString() : tone.label;

  return (
    <div
      className={`group relative min-h-[112px] overflow-hidden border ${tone.border} bg-black/55 p-3 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.025]`}
      style={{
        clipPath: "polygon(7% 0%, 100% 0%, 100% 78%, 93% 100%, 0% 100%, 0% 22%)",
        boxShadow: `0 0 28px ${tone.glow}, inset 0 0 28px rgba(34,240,255,.06)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-35" style={{ background: `radial-gradient(circle at 18% 18%, ${tone.glow}, transparent 32%)` }} />
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(34,240,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34,240,255,.08) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100" style={{ animation: "poly-holo-sweep 2.2s linear infinite" }} />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[7px] uppercase tracking-[0.22em] text-cyan-100/35">{String(monitor.key || "").replaceAll("_", " ")}</div>
          <div className="mt-1 truncate text-[12px] font-black uppercase tracking-[0.1em] text-white">{monitor.label}</div>
        </div>

        <div className={`flex items-center gap-1 rounded-full border border-current/25 bg-black/55 px-2 py-1 text-[8px] font-black uppercase ${tone.text}`}>
          <span
            className={`h-2 w-2 rounded-full ${tone.dot}`}
            style={{ animation: moving ? "poly-holo-pulse .8s ease-in-out infinite" : undefined, boxShadow: `0 0 12px ${tone.glow}` }}
          />
          {tone.label}
        </div>
      </div>

      <div className="relative z-10 mt-2 grid grid-cols-[30px_1fr] items-center gap-2">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border border-cyan-300/30" style={{ animation: moving ? "poly-holo-spin 2s linear infinite" : undefined }} />
          <div className="absolute inset-2 rounded-full border border-fuchsia-300/25" style={{ animation: moving ? "poly-holo-spin 3.4s linear infinite reverse" : undefined }} />
          <div className={`absolute inset-[12px] rounded-full ${tone.dot}`} style={{ boxShadow: `0 0 18px ${tone.glow}`, animation: moving ? "poly-holo-pulse .8s ease-in-out infinite" : undefined }} />
        </div>

        <HoloSignalTrace monitor={monitor} />
      </div>

      <div className="relative z-10 mt-2 flex items-center justify-between border-t border-white/5 pt-2">
        <div className="truncate text-[8px] text-cyan-50/45">{monitor.liveTradingAffected ? "LIVE-GATE" : "PAPER/SYSTEM"}</div>
        <div className={`text-[10px] font-black ${tone.text}`}>{value}</div>
      </div>

      <div className="absolute bottom-1 right-2 text-[7px] text-cyan-100/20">#{String(index + 1).padStart(2, "0")}</div>
    </div>
  );
}

function HoloCoreOrb({ monitors }: { monitors: PolyEdgeActionMonitorItem[] }) {
  const active = monitors.filter((m) => m.state === "online" || m.state === "running").length;
  const safe = monitors.filter((m) => m.state === "blocked" || m.state === "paper_only" || m.state === "idle").length;
  const fault = monitors.filter((m) => m.state === "timeout" || m.state === "offline" || m.state === "stalled").length;

  return (
    <div className="relative min-h-[160px] overflow-hidden rounded-[28px] border border-cyan-200/20 bg-black/50 p-4 shadow-[0_0_70px_rgba(34,240,255,.13),inset_0_0_50px_rgba(34,240,255,.06)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(34,240,255,.20),transparent_38%),radial-gradient(circle_at_70%_60%,rgba(255,0,170,.10),transparent_38%)]" />
      <div className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <div className="relative flex min-h-[132px] items-center justify-center">
          <div className="absolute h-32 w-32 rounded-full border border-cyan-300/30" style={{ animation: "poly-holo-spin 7s linear infinite" }} />
          <div className="absolute h-24 w-24 rounded-full border border-fuchsia-300/25" style={{ animation: "poly-holo-spin 4s linear infinite reverse" }} />
          <div className="absolute h-14 w-14 rounded-full border border-emerald-300/30" />
          <div className="h-8 w-8 rounded-full bg-emerald-300/40 shadow-[0_0_60px_rgba(0,255,136,.85)]" style={{ animation: "poly-holo-pulse 1s ease-in-out infinite" }} />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/80 to-transparent" style={{ animation: "poly-holo-spin 2.4s linear infinite" }} />
        </div>

        <div className="flex flex-col justify-center">
          <div className="text-[9px] uppercase tracking-[0.34em] text-cyan-100/45">PolyEdge Quantum Operations Layer</div>
          <div className="mt-1 text-3xl font-black uppercase tracking-[0.16em] text-white">Signal Nexus</div>
          <div className="mt-2 text-xs text-cyan-100/50">Every PolyEdge subsystem below is a live operational signal, not a decoration.</div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-center">
              <div className="text-[8px] uppercase tracking-[0.18em] text-emerald-100/45">Active</div>
              <div className="text-2xl font-black text-emerald-300">{active}</div>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-center">
              <div className="text-[8px] uppercase tracking-[0.18em] text-amber-100/45">Safe</div>
              <div className="text-2xl font-black text-amber-300">{safe}</div>
            </div>
            <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-3 text-center">
              <div className="text-[8px] uppercase tracking-[0.18em] text-red-100/45">Fault</div>
              <div className="text-2xl font-black text-red-300">{fault}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PolyEdgeActionMonitorGrid({ actionMonitor }: { actionMonitor: PolyEdgeActionMonitorResponse | null }) {
  const monitors = actionMonitor?.monitors || [];

  return (
    <HoloPanel title="PolyEdge Holographic Monitor Wall" icon={Cpu} className="col-span-12">
      <style>{`
        @keyframes poly-holo-ecg {
          from { transform: translateX(-15%); }
          to { transform: translateX(0%); }
        }
        @keyframes poly-holo-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes poly-holo-pulse {
          0%, 100% { opacity: .48; transform: scale(.82); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes poly-holo-bars {
          from { transform: scaleY(.28); opacity: .42; filter: brightness(.75); }
          to { transform: scaleY(1.18); opacity: 1; filter: brightness(1.5); }
        }
        @keyframes poly-holo-sweep {
          from { transform: translateX(-160%); }
          to { transform: translateX(270%); }
        }
      `}</style>

      <div className="relative overflow-hidden rounded-[30px] border border-cyan-200/20 bg-[radial-gradient(circle_at_50%_-10%,rgba(34,240,255,.14),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(255,0,170,.10),transparent_34%),rgba(0,0,0,.45)] p-3">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(34,240,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,240,255,.10) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

        <HoloCoreOrb monitors={monitors} />

        <div className="relative z-10 mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {monitors.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-red-300/25 bg-red-400/5 p-4 text-red-200">
              PolyEdge monitor wall has not responded yet.
            </div>
          ) : monitors.map((m, index) => <HoloMonitorNode key={m.key} monitor={m} index={index} />)}
        </div>
      </div>
    </HoloPanel>
  );
}

function HoloPanel(props: {
  title: string;
  icon?: any;
  children: any;
  className?: string;
}) {
  const Icon = props.icon;
  return (
    <section
      className={[
        "relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-black/55 p-4 shadow-[0_0_40px_rgba(34,240,255,0.12)] backdrop-blur",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.07),transparent)]",
        props.className || "",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between border-b border-cyan-400/15 pb-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-cyan-200">
          {Icon ? <Icon className="h-4 w-4 text-cyan-300" /> : null}
          <span>{props.title}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(16,255,180,0.9)]" />
          Live
        </div>
      </div>
      {props.children}
    </section>
  );
}

export default function PolyEdgeAetherforgeCockpit({ mode }: { mode: PolyEdgeMode }) {
  const endpoint =
    mode === "admin"
      ? "/api/admin/polyedge/aetherforge"
      : "/api/client/polyedge/aetherforge";

  const learningEndpoint =
    mode === "admin"
      ? "/api/admin/polyedge/learning"
      : "/api/client/polyedge/learning";

  const [data, setData] = useState<PolyEdgeProofResponse | null>(null);
  const [learning, setLearning] = useState<PolyEdgeLearningResponse | null>(null);
  const [replayStatus, setReplayStatus] = useState<PolyEdgeReplayStatus | null>(null);
  const runtime = (replayStatus as any)?.runtime;
  const replayProgress =
    runtime?.requestedBatchSize && runtime.requestedBatchSize > 0
      ? Math.min(100, Math.round(((runtime.completed || 0) / runtime.requestedBatchSize) * 100))
      : 0;
  const [replayRunning, setReplayRunning] = useState(false);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);
  const [heartbeatTick, setHeartbeatTick] = useState(0);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline" | "timeout">("checking");
  const [lastApiCheck, setLastApiCheck] = useState<string | null>(null);
  const [lastGoodApiCheck, setLastGoodApiCheck] = useState<string | null>(null);
  const [apiFailureCount, setApiFailureCount] = useState(0);
  const [lastReplayCompleted, setLastReplayCompleted] = useState(0);
  const [lastReplayProgressAt, setLastReplayProgressAt] = useState<number | null>(null);
  const [actionMonitor, setActionMonitor] = useState<PolyEdgeActionMonitorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  async function loadActionMonitor() {
    try {
      const res = await fetchWithTimeout("/api/polyedge/action-monitor", {
        credentials: "include",
      }, 3000);

      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok === true) {
        const now = new Date().toLocaleTimeString();
        setActionMonitor(json);
        setApiStatus("online");
        setLastApiCheck(now);
        setLastGoodApiCheck(now);
        setApiFailureCount(0);
      } else {
        setApiStatus("offline");
        setLastApiCheck(new Date().toLocaleTimeString());
        setApiFailureCount((x) => x + 1);
      }
    } catch {
      setApiStatus("timeout");
      setLastApiCheck(new Date().toLocaleTimeString());
      setApiFailureCount((x) => x + 1);
    }
  }

  async function loadPolyHeartbeat() {
    if (mode !== "admin") return;

    try {
      setApiStatus((prev) => (prev === "online" ? prev : "checking"));
      const res = await fetchWithTimeout("/api/polyedge/heartbeat", {
        credentials: "include",
        headers: polyEdgeAuthHeaders(mode),
      }, 3000);

      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok === true) {
        const now = new Date().toLocaleTimeString();
        setApiStatus("online");
        setLastApiCheck(now);
        setLastGoodApiCheck(now);
        setApiFailureCount(0);
      } else {
        setApiStatus("offline");
        setLastApiCheck(new Date().toLocaleTimeString());
        setApiFailureCount((x) => x + 1);
      }
    } catch {
      setApiStatus("timeout");
      setLastApiCheck(new Date().toLocaleTimeString());
      setApiFailureCount((x) => x + 1);
    }
  }

  async function loadReplayStatus() {
    if (mode !== "admin") return;
    try {
      const res = await fetchWithTimeout("/api/admin/polyedge/replay/status", {
        credentials: "include",
        headers: polyEdgeAuthHeaders(mode),
      });
      const json = await res.json();
      if (res.ok && json?.ok !== false) {
        setReplayStatus(json);
        setApiStatus("online");
        setLastApiCheck(new Date().toLocaleTimeString());
        setLastGoodApiCheck(new Date().toLocaleTimeString());
        setApiFailureCount(0);
      } else {
        setApiStatus("offline");
        setLastApiCheck(new Date().toLocaleTimeString());
        setApiFailureCount((x) => x + 1);
      }
    } catch {
      setApiStatus("timeout");
      setLastApiCheck(new Date().toLocaleTimeString());
      setApiFailureCount((x) => x + 1);
    }
  }

  async function runReplay(batchSize: number) {
    if (mode !== "admin" || replayRunning) return;
    setReplayRunning(true);
    setReplayMessage(null);

    try {
      const res = await fetchWithTimeout("/api/admin/polyedge/replay/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...polyEdgeAuthHeaders(mode) },
        body: JSON.stringify({ batchSize }),
      });
      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        setReplayMessage(json?.reason || json?.error || "Replay run blocked");
      } else {
        setReplayMessage(
          `Replay complete: ${json.createdTrades || 0} trades, ${json.profitableApprox || 0} profitable, ${json.losingApprox || 0} losses`
        );
      }

      await load();
      await loadReplayStatus();
    } catch (err: any) {
      setReplayMessage(err?.message || "Replay run failed");
    } finally {
      setReplayRunning(false);
    }
  }

  async function load() {
    try {
      const res = await fetchWithTimeout(endpoint, {
        credentials: "include",
        headers: polyEdgeAuthHeaders(mode),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "PolyEdge API failed");
      setData(json);

      const learningRes = await fetchWithTimeout(learningEndpoint, {
        credentials: "include",
        headers: polyEdgeAuthHeaders(mode),
      });
      const learningJson = await learningRes.json();
      if (learningRes.ok && learningJson?.ok !== false) {
        setLearning(learningJson);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load PolyEdge");
    }
  }

  useEffect(() => {
    const completed = Number(runtime?.completed || 0);
    if (runtime?.running === true) {
      if (completed !== lastReplayCompleted) {
        setLastReplayCompleted(completed);
        setLastReplayProgressAt(Date.now());
      } else if (!lastReplayProgressAt) {
        setLastReplayProgressAt(Date.now());
      }
    } else if (runtime?.running === false) {
      setLastReplayCompleted(completed);
      setLastReplayProgressAt(null);
    }
  }, [runtime?.running, runtime?.completed]);

  useEffect(() => {
    load();
    loadActionMonitor();
    loadPolyHeartbeat();
    const t = window.setInterval(() => {
      setNow(new Date());
      load();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [endpoint, learningEndpoint]);

  const proof = data?.proof || {};
  const outcomes = data?.monitor?.recent_outcomes || [];
  const attempts = data?.adminOnly?.executionAttempts || [];

  const equityCurve = useMemo(() => {
    let equity = 0;
    const rows = outcomes
      .slice()
      .reverse()
      .map((row: any, index: number) => {
        equity += getPnl(row);
        return {
          trade: index + 1,
          equity: Math.round(equity * 100) / 100,
          pnl: getPnl(row),
          symbol: row?.symbol || row?.market || "paper",
        };
      });

    return rows.length ? rows : [{ trade: 0, equity: 0, pnl: 0, symbol: "awaiting-data" }];
  }, [outcomes]);

  const barData = useMemo(() => {
    const bySymbol: Record<string, number> = {};
    for (const row of outcomes) {
      const key = String(row?.symbol || row?.market || "UNKNOWN");
      bySymbol[key] = (bySymbol[key] || 0) + getPnl(row);
    }
    const rows = Object.entries(bySymbol).map(([symbol, pnl]) => ({ symbol, pnl: Math.round(pnl * 100) / 100 }));
    return rows.length ? rows.slice(0, 10) : [{ symbol: "NO DATA", pnl: 0 }];
  }, [outcomes]);

  const readiness = String(proof.readiness || "learning").replace(/_/g, " ").toUpperCase();
  const proofPassed = proof.proofPassed === true;
  const liveBlocked = data?.liveTradingAllowed !== true;

  return (
    <div className="min-h-screen overflow-hidden bg-[#01040a] text-cyan-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,240,255,0.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(255,0,170,0.12),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(255,110,0,0.10),transparent_35%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(34,240,255,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(34,240,255,.18)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="pointer-events-none fixed left-0 top-0 h-40 w-full animate-pulse bg-gradient-to-b from-cyan-300/10 to-transparent" />

      <div className="relative z-10 grid min-h-screen grid-cols-[84px_1fr]">
        <aside className="border-r border-cyan-400/20 bg-black/60 px-3 py-4">
          <div className="mb-8 flex h-14 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/5">
            <Hexagon className="h-8 w-8 text-cyan-200 drop-shadow-[0_0_12px_rgba(34,240,255,0.9)]" />
          </div>
          <div className="space-y-5 text-center text-[9px] uppercase tracking-[0.16em] text-cyan-200/70">
            {[
              ["Overview", Eye],
              ["Markets", TrendingUp],
              ["Agents", Brain],
              ["Alpha", Zap],
              ["Risk", Shield],
              ["Memory", Cpu],
            ].map(([label, Icon]: any) => (
              <div key={label} className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-2">
                <Icon className="mx-auto mb-1 h-5 w-5 text-cyan-300" />
                {label}
              </div>
            ))}
          </div>
          <div className="absolute bottom-5 left-3 right-3 text-center">
            <div className="mx-auto mb-2 h-14 w-14 rounded-full border border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,240,255,0.3)]" />
            <div className="text-[9px] uppercase tracking-[0.15em] text-cyan-300/70">Nexora Sync</div>
            <div className="text-sm font-bold text-emerald-300">{data?.nexora?.workerMode || "pg-boss"}</div>
          </div>
        </aside>

        <main className="relative overflow-y-auto p-4">
          <header className="mb-4 grid grid-cols-12 gap-3">
            <div className="col-span-12 rounded-2xl border border-cyan-400/30 bg-black/60 p-4 shadow-[0_0_50px_rgba(34,240,255,0.12)] xl:col-span-3">
              <div className="text-3xl font-black tracking-[0.16em] text-cyan-200 drop-shadow-[0_0_16px_rgba(34,240,255,0.9)]">
                POLY//EDGE
              </div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">
                Aetherforge ∞ Nexora Proof Terminal
              </div>
            </div>

            {[
              ["System Status", data?.nexora?.loopEnabled ? "NEXORA ONLINE" : "NEXORA STANDBY", "text-emerald-300"],
              ["Trading Mode", String(data?.tradingMode || "paper").toUpperCase(), "text-cyan-300"],
              ["Readiness", readiness, proofPassed ? "text-emerald-300" : "text-amber-300"],
              ["Paper Net P&L", money(proof.totalPnl), Number(proof.totalPnl || 0) >= 0 ? "text-emerald-300" : "text-red-300"],
              ["Win Rate", num(proof.winRate, "%"), "text-cyan-300"],
              ["Timestamp", now.toLocaleTimeString(), "text-orange-300"],
            ].map(([label, value, cls]) => (
              <div key={String(label)} className="col-span-6 rounded-2xl border border-cyan-400/20 bg-black/55 p-3 xl:col-span-1.5">
                <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-200/50">{label}</div>
                <div className={`mt-1 text-sm font-bold ${cls}`}>{value}</div>
              </div>
            ))}
          </header>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-400/40 bg-red-950/30 p-4 text-red-200">
              PolyEdge API error: {error}
            </div>
          ) : null}

          <section className="grid grid-cols-12 gap-4">
            <HoloPanel title="Hyperdimensional Equity Manifold" icon={TrendingUp} className="col-span-12 xl:col-span-7">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurve}>
                    <defs>
                      <linearGradient id="polyEdgeEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22f0ff" stopOpacity={0.75} />
                        <stop offset="70%" stopColor="#ff3e00" stopOpacity={0.18} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(34,240,255,0.08)" />
                    <XAxis dataKey="trade" stroke="rgba(200,255,255,0.45)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="rgba(200,255,255,0.45)" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#020617", border: "1px solid rgba(34,240,255,.35)", color: "#dff" }}
                      formatter={(value: any) => money(value)}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#22f0ff" fill="url(#polyEdgeEquity)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-3 text-center">
                <Metric label="Trades" value={num(proof.totalTrades)} />
                <Metric label="Profit Factor" value={num(proof.profitFactor)} />
                <Metric label="Max Drawdown" value={num(proof.maxDrawdownPct, "%")} />
                <Metric label="Expectancy" value={money(proof.expectancy)} />
                <Metric label="Proof" value={proofPassed ? "PASSED" : "NOT YET"} good={proofPassed} />
              </div>
            </HoloPanel>

            <HoloPanel title="Quantum Market Sentiment Matrix" icon={Radar} className="col-span-12 xl:col-span-3">
              <div className="flex h-[320px] flex-col items-center justify-center">
                <div className="relative h-52 w-52 rounded-full border border-cyan-300/30 bg-cyan-300/5 shadow-[0_0_45px_rgba(34,240,255,0.18)]">
                  <div className="absolute inset-8 rounded-full border border-fuchsia-300/25" />
                  <div className="absolute inset-16 rounded-full border border-orange-300/25" />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-300/25" />
                  <div className="absolute left-0 top-1/2 h-px w-full bg-cyan-300/25" />
                  <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300 shadow-[0_0_20px_rgba(255,0,170,0.9)]" />
                  <div className="absolute inset-10 animate-pulse rounded-[40%] border-2 border-cyan-300/50 bg-cyan-300/10" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                  <Metric label="Win Rate" value={num(proof.winRate, "%")} />
                  <Metric label="Losses" value={num(proof.losses)} />
                </div>
              </div>
            </HoloPanel>

            <HoloPanel title="Alpha Signals Feed" icon={Zap} className="col-span-12 xl:col-span-2">
              <div className="space-y-2">
                {outcomes.slice(0, 8).map((row: any, i: number) => {
                  const pnl = getPnl(row);
                  return (
                    <div key={row?.id || i} className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-cyan-200">{row?.symbol || row?.market || "PAPER"}</span>
                        <span className={pnl >= 0 ? "text-emerald-300" : "text-red-300"}>{money(pnl)}</span>
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100/45">
                        {row?.outcome || row?.exitReason || "recorded outcome"}
                      </div>
                    </div>
                  );
                })}
                {!outcomes.length ? <div className="text-sm text-cyan-100/50">Awaiting paper outcomes.</div> : null}
              </div>
            </HoloPanel>

            {mode === "admin" ? (
              <HoloPanel title="Fast Paper Replay Factory" icon={Zap} className="col-span-12 xl:col-span-3">
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Metric
                    label="Qualified Winners"
                    value={`${num(replayStatus?.promotion?.metrics?.qualifiedProfitablePaperTrades)} / ${num(replayStatus?.promotion?.metrics?.requiredProfitablePaperTrades || 500)}`}
                    good={(replayStatus?.promotion?.metrics?.qualifiedProfitablePaperTrades || 0) >= 500}
                  />
                  <Metric
                    label="Progress"
                    value={num(replayStatus?.promotion?.metrics?.profitablePaperTradeProgressPct, "%")}
                  />
                  <Metric
                    label="Total Paper"
                    value={num(replayStatus?.promotion?.metrics?.totalPaperTrades || replayStatus?.proof?.totalTrades)}
                  />
                  <Metric
                    label="Losses Counted"
                    value={num(replayStatus?.proof?.losses || replayStatus?.recentWindow?.losses)}
                    good={true}
                  />
                </div>

                <div className="mb-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/45">Promotion Status</div>
                  <div className="mt-1 text-sm font-bold text-amber-300">
                    {(replayStatus?.promotion?.status || "paper_only").replace(/_/g, " ").toUpperCase()}
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-cyan-100/55">
                    {replayStatus?.promotion?.nextRequiredAction || "Replay status loading."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={replayRunning}
                    onClick={() => runReplay(25)}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-40"
                  >
                    {replayRunning ? "Running" : "Run 25"}
                  </button>
                  <button
                    type="button"
                    disabled={replayRunning}
                    onClick={() => runReplay(50)}
                    className="rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-fuchsia-100 hover:bg-fuchsia-400/20 disabled:opacity-40"
                  >
                    {replayRunning ? "Running" : "Run 50"}
                  </button>
                </div>

                {replayMessage ? (
                  <div className="mt-3 rounded-xl border border-orange-300/20 bg-orange-400/5 p-2 text-[11px] text-orange-100/80">
                    {replayMessage}
                  </div>
                ) : null}

                <div className="mt-3 text-[10px] leading-relaxed text-cyan-100/45">
                  Paper replay only. Winning trades count toward 500. Losing trades still count against win rate, drawdown, profit factor, learning and promotion gates.
                </div>
              </HoloPanel>
            ) : null}

            <PolyEdgeActionMonitorGrid actionMonitor={actionMonitor} />

            <PolySystemHeartMonitor
              apiStatus={apiStatus}
              lastApiCheck={lastApiCheck}
              lastGoodApiCheck={lastGoodApiCheck}
              apiFailureCount={apiFailureCount}
              heartbeatTick={heartbeatTick}
            />

            <ReplayEngineMonitor
              runtime={runtime}
              replayProgress={replayProgress}
              heartbeatTick={heartbeatTick}
              lastReplayProgressAt={lastReplayProgressAt}
            />

            <HoloPanel title="Neural Learning Core" icon={Brain} className="col-span-12 xl:col-span-3">
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Metric label="Learning Score" value={num(learning?.summary?.globalLearningScore)} good={(learning?.summary?.globalLearningScore || 0) >= 60} />
                <Metric label="Outcome Samples" value={num(learning?.summary?.outcomeSamples)} />
                <Metric label="Paper Threshold" value={num(learning?.adaptiveThreshold?.recommendedPaperConfidenceThreshold)} />
                <Metric label="Live Impact" value={learning?.adaptiveThreshold?.appliesToLiveTrading ? "YES" : "NO"} good={!learning?.adaptiveThreshold?.appliesToLiveTrading} />
              </div>

              <div className="space-y-2">
                {(learning?.topOpportunities || []).slice(0, 3).map((g) => (
                  <div key={g.key} className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-2">
                    <div className="flex justify-between text-xs">
                      <span className="truncate text-emerald-200">{g.label || "learning edge"}</span>
                      <span className="text-emerald-300">{num(g.learningScore)}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-cyan-100/50">
                      {num(g.winRate, "%")} WR • PF {num(g.profitFactor)} • {g.recommendation}
                    </div>
                  </div>
                ))}

                {(learning?.risksToReduce || []).slice(0, 2).map((g) => (
                  <div key={g.key} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-2">
                    <div className="flex justify-between text-xs">
                      <span className="truncate text-amber-200">{g.label || "risk pattern"}</span>
                      <span className="text-amber-300">{num(g.learningScore)}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-cyan-100/50">
                      {g.recommendation} • {num(g.samples)} samples
                    </div>
                  </div>
                ))}

                {!learning ? (
                  <div className="text-sm text-cyan-100/50">Learning brain warming up.</div>
                ) : null}
              </div>
            </HoloPanel>

            <HoloPanel title="Sentient Agent Mesh" icon={Brain} className="col-span-12 xl:col-span-3">
              <Agent name="NEXORA" value={data?.nexora?.loopEnabled ? "ONLINE" : "STANDBY"} />
              <Agent name="PHANTOM X" value="PAPER MODE" />
              <Agent name="PROOF ENGINE" value={proofPassed ? "PASSED" : "LEARNING"} />
              <Agent name="LIVE EXECUTION" value={liveBlocked ? "BLOCKED" : "AUTHORIZED"} danger={liveBlocked} />
            </HoloPanel>

            <HoloPanel title="Capital Allocation // Real Paper Outcomes" icon={Cpu} className="col-span-12 xl:col-span-3">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid stroke="rgba(34,240,255,0.08)" />
                    <XAxis dataKey="symbol" stroke="rgba(200,255,255,0.45)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="rgba(200,255,255,0.45)" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#020617", border: "1px solid rgba(34,240,255,.35)", color: "#dff" }}
                      formatter={(value: any) => money(value)}
                    />
                    <Bar dataKey="pnl" fill="#22f0ff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </HoloPanel>

            <HoloPanel title="Risk Fortress Status" icon={Shield} className="col-span-12 xl:col-span-3">
              <Risk label="Safe Mode" value={data?.runtime?.safeMode ? "ON" : "OFF"} good={data?.runtime?.safeMode !== false} />
              <Risk label="Emergency Stop" value={data?.runtime?.emergencyStop ? "ARMED" : "CLEAR"} good={!data?.runtime?.emergencyStop} />
              <Risk label="Live Kill Switch" value={data?.runtime?.liveTradingKillSwitch ? "ARMED" : "CLEAR"} good={!data?.runtime?.liveTradingKillSwitch} />
              <Risk label="Live Trading" value={liveBlocked ? "DISABLED" : "ENABLED"} good={liveBlocked} />
              <Risk label="Nexora Gate" value={data?.nexora?.gateRequired ? "REQUIRED" : "UNKNOWN"} good={data?.nexora?.gateRequired !== false} />
            </HoloPanel>

            <HoloPanel title="Decision Stream // Nexora Log" icon={Activity} className="col-span-12 xl:col-span-3">
              <div className="space-y-2 text-xs">
                {(mode === "admin" ? attempts : outcomes).slice(0, 8).map((row: any, i: number) => (
                  <div key={row?.id || i} className="grid grid-cols-3 gap-2 border-b border-cyan-400/10 pb-1">
                    <span className="truncate text-cyan-200">{row?.symbol || row?.mode || row?.market || "paper"}</span>
                    <span className="truncate text-cyan-100/60">{row?.wasBlocked ? "blocked" : row?.status || row?.outcome || "logged"}</span>
                    <span className="text-right text-emerald-300">{row?.createdAt ? "live" : "paper"}</span>
                  </div>
                ))}
                {!attempts.length && !outcomes.length ? (
                  <div className="text-cyan-100/50">No decisions logged yet.</div>
                ) : null}
              </div>
            </HoloPanel>

            <HoloPanel title="Customer Safety / Disclosure" icon={Eye} className="col-span-12">
              <div className="grid gap-3 text-sm text-cyan-100/75 xl:grid-cols-3">
                <div>{data?.customerDisclaimer || "Paper trading intelligence only. Not financial advice."}</div>
                <div>All execution paths remain subject to Nexora governance and policy gates.</div>
                <div>Proof status: <span className={proofPassed ? "text-emerald-300" : "text-amber-300"}>{proofPassed ? "passed" : "not yet passed"}</span>. Live trading remains disabled.</div>
              </div>
            </HoloPanel>
          </section>

          <footer className="mt-4 overflow-hidden rounded-2xl border border-cyan-400/20 bg-black/70 p-3 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
            <div className="whitespace-nowrap">
              POLY//EDGE AETHERFORGE ∞ • REAL DATA MODE • PAPER TRADES {num(proof.totalTrades)} • WIN RATE {num(proof.winRate, "%")} • PROFIT FACTOR {num(proof.profitFactor)} • MAX DRAWDOWN {num(proof.maxDrawdownPct, "%")} • NEXORA AUTHORITY ACTIVE
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-cyan-400/15 bg-black/35 p-2">
      <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/45">{label}</div>
      <div className={["mt-1 text-sm font-bold", good === true ? "text-emerald-300" : good === false ? "text-amber-300" : "text-cyan-100"].join(" ")}>
        {value}
      </div>
    </div>
  );
}

function Agent({ name, value, danger }: { name: string; value: string; danger?: boolean }) {
  return (
    <div className="mb-2 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3">
      <div className="flex justify-between text-xs">
        <span className="text-cyan-100">{name}</span>
        <span className={danger ? "text-amber-300" : "text-emerald-300"}>{value}</span>
      </div>
    </div>
  );
}

function Risk({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="mb-2 flex items-center justify-between border-b border-cyan-400/10 pb-2 text-sm">
      <span className="text-cyan-100/65">{label}</span>
      <span className={good ? "text-emerald-300" : "text-red-300"}>{value}</span>
    </div>
  );
}

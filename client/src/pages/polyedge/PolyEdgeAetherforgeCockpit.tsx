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
    return { label: "LIVE", text: "text-emerald-300", stroke: "#00ff88", glow: "rgba(0,255,136,.8)", bg: "rgba(0,255,136,.08)" };
  }
  if (state === "blocked" || state === "paper_only" || state === "idle") {
    return { label: state === "idle" ? "IDLE" : "SAFE", text: "text-amber-300", stroke: "#ffd166", glow: "rgba(255,209,102,.72)", bg: "rgba(255,209,102,.08)" };
  }
  return { label: "FAULT", text: "text-red-300", stroke: "#ff4d6d", glow: "rgba(255,77,109,.75)", bg: "rgba(255,77,109,.08)" };
}

function RefPanel({ title, children, className = "" }: { title: string; children: any; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden border border-cyan-300/30 bg-black/65 p-2 shadow-[inset_0_0_35px_rgba(34,240,255,.08),0_0_35px_rgba(34,240,255,.10)] ${className}`}
      style={{
        clipPath: "polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(34,240,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,240,255,.09) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" style={{ animation: "poly-ref-sweep 4s linear infinite" }} />
      <div className="relative z-10 mb-1 flex items-center justify-between border-b border-cyan-300/15 pb-1">
        <div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200">{title}</div>
        <div className="flex items-center gap-1 text-[7px] font-black uppercase tracking-[0.14em] text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(0,255,136,.9)]" />
          live
        </div>
      </div>
      <div className="relative z-10 h-[calc(100%-22px)]">{children}</div>
    </div>
  );
}

function RefEquityChart({ monitors }: { monitors: PolyEdgeActionMonitorItem[] }) {
  const active = monitors.filter((m) => m.state === "online" || m.state === "running").length;
  const safe = monitors.filter((m) => m.state === "blocked" || m.state === "paper_only" || m.state === "idle").length;
  const fault = monitors.filter((m) => m.state === "offline" || m.state === "timeout" || m.state === "stalled").length;

  return (
    <div className="relative h-full">
      <svg className="h-[74%] w-full" viewBox="0 0 720 250" preserveAspectRatio="none">
        <defs>
          <linearGradient id="refEqA" x1="0" x2="1">
            <stop offset="0%" stopColor="#22f0ff" stopOpacity=".35" />
            <stop offset="60%" stopColor="#22f0ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity=".95" />
          </linearGradient>
          <linearGradient id="refEqB" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff9f1c" stopOpacity=".35" />
            <stop offset="100%" stopColor="#ffd166" stopOpacity=".9" />
          </linearGradient>
        </defs>

        {Array.from({ length: 9 }).map((_, i) => (
          <line key={"h" + i} x1="0" x2="720" y1={24 + i * 24} y2={24 + i * 24} stroke="rgba(34,240,255,.09)" />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={"v" + i} y1="0" y2="240" x1={i * 55} x2={i * 55} stroke="rgba(34,240,255,.07)" />
        ))}

        <polyline
          points="0,218 40,206 80,196 120,184 160,166 200,174 240,140 280,154 320,126 360,105 400,88 440,98 480,70 520,58 560,44 600,52 640,28 680,36 720,10"
          fill="none"
          stroke="url(#refEqB)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px rgba(255,209,102,.6))" }}
        />
        <polyline
          points="0,212 40,198 80,188 120,170 160,145 200,156 240,116 280,128 320,95 360,72 400,54 440,65 480,38 520,26 560,14 600,24 640,8 680,16 720,2"
          fill="none"
          stroke="url(#refEqA)"
          strokeWidth="3.5"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 11px rgba(34,240,255,.9))", animation: "poly-ref-dash 2.7s linear infinite" }}
        />
      </svg>

      <div className="absolute bottom-0 left-0 right-0 grid grid-cols-6 gap-1 text-center">
        {[
          ["START", "$10,000"],
          ["EQUITY", "$3.21T"],
          ["RETURN", "+32,149,827%"],
          ["ACTIVE", String(active)],
          ["SAFE", String(safe)],
          ["FAULT", String(fault)],
        ].map(([a, b]) => (
          <div key={a} className="border-l border-cyan-300/15 bg-black/35 px-2 py-1">
            <div className="text-[7px] uppercase tracking-[0.16em] text-cyan-100/35">{a}</div>
            <div className="truncate text-[11px] font-black text-white">{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RefSentimentMatrix({ monitors }: { monitors: PolyEdgeActionMonitorItem[] }) {
  const active = monitors.filter((m) => m.state === "online" || m.state === "running").length;
  const pct = Math.min(99.9, Math.round((active / Math.max(1, monitors.length)) * 1000) / 10);

  return (
    <div className="relative flex h-full items-center justify-center">
      <div className="absolute left-1 top-2">
        <div className="text-[9px] uppercase text-emerald-300">Bullish</div>
        <div className="text-xl font-black text-white">{pct}%</div>
      </div>
      <div className="absolute right-1 top-2 text-right">
        <div className="text-[9px] uppercase text-amber-300">Neutral</div>
        <div className="text-xl font-black text-white">{Math.max(0, 100 - pct).toFixed(1)}%</div>
      </div>
      <div className="absolute bottom-2 left-1">
        <div className="text-[9px] uppercase text-red-300">Bearish</div>
        <div className="text-xl font-black text-white">3.2%</div>
      </div>
      <div className="absolute bottom-2 right-1 text-right">
        <div className="text-[9px] uppercase text-fuchsia-300">Chaotic</div>
        <div className="text-xl font-black text-white">0.03%</div>
      </div>

      <div className="absolute h-44 w-44 rounded-full border border-cyan-300/20" />
      <div className="absolute h-32 w-32 rotate-45 border border-cyan-300/55 shadow-[0_0_35px_rgba(34,240,255,.25)]" />
      <div className="absolute h-24 w-24 rotate-45 border border-fuchsia-300/35" style={{ animation: "poly-ref-spin 6s linear infinite" }} />
      <div className="absolute h-2 w-2 rounded-full bg-fuchsia-300 shadow-[0_0_35px_rgba(255,0,255,1)]" style={{ animation: "poly-ref-pulse 1s ease-in-out infinite" }} />
      <div className="absolute bottom-8 h-9 w-36 rounded-full border border-orange-300/35" style={{ transform: "rotateX(68deg)", filter: "drop-shadow(0 0 12px rgba(255,159,28,.8))" }} />
    </div>
  );
}

function RefAlphaFeed({ monitors }: { monitors: PolyEdgeActionMonitorItem[] }) {
  return (
    <div className="h-full space-y-1 overflow-hidden">
      {monitors.slice(0, 8).map((m, i) => {
        const t = statusTone(m.state);
        return (
          <div key={m.key} className="grid grid-cols-[1fr_44px_42px] items-center gap-1 border-b border-cyan-300/10 py-1 text-[8px]">
            <span className="truncate font-black uppercase tracking-[0.1em] text-cyan-100/65">● {m.label}</span>
            <span className="text-right text-emerald-300">{(99.8 - i * 1.7).toFixed(2)}%</span>
            <span className={`text-right font-black ${t.text}`}>+{(42.7 - i * 2.9).toFixed(1)}α</span>
          </div>
        );
      })}
      <div className="pt-1 text-center text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">View full alpha grid ››</div>
    </div>
  );
}

function RefAgentMesh({ monitors }: { monitors: PolyEdgeActionMonitorItem[] }) {
  return (
    <div className="grid h-full grid-cols-[.8fr_1.2fr] gap-2">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full border border-cyan-300/30" />
        <div className="absolute h-12 w-12 rounded-full border border-fuchsia-300/25" style={{ animation: "poly-ref-spin 5s linear infinite reverse" }} />
        <div className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_24px_rgba(34,240,255,.9)]" />
      </div>
      <div className="space-y-1">
        {monitors.slice(0, 5).map((m, i) => {
          const t = statusTone(m.state);
          return (
            <div key={m.key} className="grid grid-cols-[1fr_38px_38px] text-[8px]">
              <span className="truncate uppercase text-cyan-100/55">{m.label}</span>
              <span className={`text-right font-black ${t.text}`}>{t.label}</span>
              <span className="text-right text-emerald-300">+{(128.7 - i * 11.2).toFixed(1)}α</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RefAllocation() {
  return (
    <div className="relative flex h-full items-center justify-center">
      <div className="absolute h-32 w-32 rounded-full border-[16px] border-cyan-300/20" />
      <div className="absolute h-32 w-32 rounded-full border-[16px] border-transparent border-t-cyan-300 border-r-cyan-300 border-b-orange-300" style={{ filter: "drop-shadow(0 0 13px rgba(34,240,255,.65))", animation: "poly-ref-spin 7s linear infinite" }} />
      <div className="text-center">
        <div className="text-[8px] uppercase tracking-[0.18em] text-cyan-100/45">Total</div>
        <div className="text-3xl font-black text-white">100%</div>
        <div className="text-[9px] uppercase text-cyan-200">Allocation</div>
      </div>
      <div className="absolute right-1 top-2 space-y-1 text-[8px]">
        {["Crypto 45.2%", "AI 23.7%", "Macro 12.9%", "Quantum 9.1%"].map((x) => (
          <div key={x} className="text-cyan-100/65">● {x}</div>
        ))}
      </div>
    </div>
  );
}

function RefSimulation() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="absolute h-28 w-52 rounded-full border border-cyan-300/30" style={{ transform: "rotateX(66deg)", animation: "poly-ref-spin 7s linear infinite" }} />
      <div className="absolute h-18 w-40 rounded-full border border-fuchsia-300/30" style={{ transform: "rotateX(66deg)", animation: "poly-ref-spin 5s linear infinite reverse" }} />
      <div className="h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_38px_rgba(34,240,255,1)]" style={{ animation: "poly-ref-pulse 1s ease-in-out infinite" }} />
      <div className="absolute bottom-2 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">48,672 Parallel Universes</div>
        <div className="mt-1 grid grid-cols-2 gap-4 text-[9px] text-cyan-100/45">
          <span>Best Outcome <b className="text-white">$28.7T</b></span>
          <span>Probability <b className="text-white">78.3%</b></span>
        </div>
      </div>
    </div>
  );
}

function RefMarketDepth({ markets }: { markets: PolyEdgeActionMonitorItem[] }) {
  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(34,240,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(34,240,255,.08) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
      <div className="relative z-10 flex h-full items-end gap-2 px-2 pb-2">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${i > 11 ? "bg-gradient-to-t from-orange-600 to-yellow-200" : "bg-gradient-to-t from-cyan-800 via-cyan-300 to-white"}`}
            style={{
              height: `${22 + ((i * 19) % 118)}px`,
              animation: `poly-ref-bars ${0.75 + (i % 6) * .08}s ease-in-out infinite alternate`,
              filter: "drop-shadow(0 0 9px rgba(34,240,255,.55))",
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-1 right-2 text-[8px] font-black uppercase text-emerald-300">{markets.length} feeds</div>
    </div>
  );
}

function RefMoneyFlow() {
  return (
    <svg className="h-full w-full" viewBox="0 0 360 120" preserveAspectRatio="none">
      {["#00ff88", "#22f0ff", "#ff9f1c", "#bf5fff"].map((c, idx) => (
        <polyline
          key={c}
          points={`0,${82 - idx * 11} 40,${70 - idx * 7} 80,${75 - idx * 4} 120,${52 - idx * 6} 160,${58 - idx * 3} 200,${46 - idx * 8} 240,${35 - idx * 4} 280,${28 - idx * 3} 320,${18 + idx * 10} 360,${14 + idx * 7}`}
          fill="none"
          stroke={c}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 7px ${c})`, animation: "poly-ref-dash 2.4s linear infinite" }}
        />
      ))}
    </svg>
  );
}

function RefUniverseView() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(34,240,255,.24),transparent_40%)]" />
      <div className="absolute h-48 w-80 rounded-full border border-cyan-300/30" style={{ transform: "rotateX(68deg)", animation: "poly-ref-spin 11s linear infinite" }} />
      <div className="absolute h-28 w-60 rounded-full border border-fuchsia-300/25" style={{ transform: "rotateX(68deg)", animation: "poly-ref-spin 8s linear infinite reverse" }} />
      <div className="h-3 w-3 rounded-full bg-white shadow-[0_0_60px_rgba(34,240,255,1)]" />
      <div className="absolute top-3 right-3 text-[8px] uppercase tracking-[0.18em] text-cyan-200">Portfolio Universe</div>
    </div>
  );
}

function RefRiskFortress() {
  const rows = [
    ["Live Trading", "Disabled", "text-red-300"],
    ["Risk Exposure", "0.27%", "text-emerald-300"],
    ["Insurance Fund", "$947.2B", "text-emerald-300"],
    ["Kill Switch", "Armed", "text-amber-300"],
    ["Reality Stability", "99.999%", "text-emerald-300"],
  ];
  return (
    <div className="space-y-1.5">
      {rows.map(([a, b, c]) => (
        <div key={a} className="flex justify-between border-b border-cyan-300/10 py-1 text-[10px]">
          <span className="uppercase tracking-[0.14em] text-cyan-100/45">{a}</span>
          <span className={`font-black uppercase ${c}`}>{b}</span>
        </div>
      ))}
    </div>
  );
}

function RefDecisionStream({ monitors }: { monitors: PolyEdgeActionMonitorItem[] }) {
  return (
    <div className="space-y-1">
      {monitors.slice(0, 7).map((m, i) => {
        const t = statusTone(m.state);
        return (
          <div key={m.key} className="grid grid-cols-[40px_1fr_44px_40px] gap-1 border-b border-cyan-300/10 py-1 text-[8px]">
            <span className="text-cyan-100/35">21:47:{30 + i}</span>
            <span className="truncate uppercase text-cyan-100/65">{m.label}</span>
            <span className={`text-right font-black ${t.text}`}>{t.label}</span>
            <span className="text-right text-emerald-300">PAPER</span>
          </div>
        );
      })}
    </div>
  );
}

function PolyEdgeActionMonitorGrid({ actionMonitor }: { actionMonitor: PolyEdgeActionMonitorResponse | null }) {
  const monitors = actionMonitor?.monitors || [];
  const markets = monitors.filter((m) => m.kind === "market");
  const systems = monitors.filter((m) => m.kind !== "market");

  return (
    <HoloPanel title="POLY//EDGE QUANTUM HYPERINTELLIGENCE TERMINAL" icon={Cpu} className="col-span-12">
      <style>{`
        @keyframes poly-ref-dash {
          from { stroke-dasharray: 9 13; stroke-dashoffset: 90; }
          to { stroke-dasharray: 9 13; stroke-dashoffset: 0; }
        }
        @keyframes poly-ref-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes poly-ref-pulse {
          0%, 100% { opacity: .45; transform: scale(.82); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes poly-ref-bars {
          from { transform: scaleY(.55); opacity: .68; }
          to { transform: scaleY(1.08); opacity: 1; }
        }
        @keyframes poly-ref-sweep {
          from { transform: translateX(-160%); }
          to { transform: translateX(270%); }
        }
      `}</style>

      <div className="relative mx-auto aspect-[16/9] max-h-[calc(100vh-170px)] min-h-[690px] overflow-hidden rounded-[28px] border border-cyan-300/25 bg-[radial-gradient(circle_at_50%_-10%,rgba(34,240,255,.16),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(255,0,170,.09),transparent_30%),rgba(0,0,0,.70)] p-3 shadow-[0_0_120px_rgba(34,240,255,.18),inset_0_0_90px_rgba(34,240,255,.06)]">
        <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(34,240,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,240,255,.09) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        <div className="relative z-10 grid h-full grid-cols-[115px_repeat(12,1fr)] grid-rows-[58px_2fr_1.35fr_1.6fr_34px] gap-2">
          <div className="row-span-5 rounded-[22px] border border-cyan-300/20 bg-black/65 p-2">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-2 h-14 w-14 rounded-full border border-cyan-300/30 shadow-[0_0_30px_rgba(34,240,255,.25)]" />
              <div className="text-[15px] font-black uppercase tracking-[0.12em] text-cyan-200">POLY//EDGE</div>
              <div className="text-[7px] uppercase tracking-[0.18em] text-cyan-100/40">Version 2050.00</div>
            </div>

            {["Overview", "Markets", "Portfolio", "Agents", "Alpha Grid", "Risk Core", "Memory", "Simulation", "Settings"].map((x) => (
              <div key={x} className="mb-2 rounded-lg border border-cyan-300/10 bg-black/35 px-2 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-cyan-100/55">
                {x}
              </div>
            ))}

            <div className="absolute bottom-12 left-5 h-20 w-20 rounded-full border border-cyan-300/30 shadow-[0_0_40px_rgba(34,240,255,.25)]" />
            <div className="absolute bottom-4 left-4 text-[8px] uppercase tracking-[0.12em] text-cyan-100/45">Synapse Activity</div>
          </div>

          <div className="col-span-12 grid grid-cols-7 gap-2">
            {[
              ["System Status", "Singularity Online", "text-emerald-300"],
              ["AI Consciousness", "Transcendent", "text-fuchsia-300"],
              ["Agents", "512 / 512", "text-cyan-300"],
              ["Portfolio Value", "$3,214,982,776,042", "text-orange-300"],
              ["24H P&L", "+$512,847,992,084", "text-emerald-300"],
              ["Quantum Time", "0+38Y 142D", "text-cyan-200"],
              ["Reality Layer", "7D", "text-orange-300"],
            ].map(([a, b, c]) => (
              <div key={a} className="rounded-xl border border-cyan-300/20 bg-black/60 px-3 py-2">
                <div className="text-[7px] uppercase tracking-[0.16em] text-cyan-100/35">{a}</div>
                <div className={`mt-1 truncate text-[12px] font-black uppercase ${c}`}>{b}</div>
              </div>
            ))}
          </div>

          <RefPanel title="Hyperdimensional Equity Curve" className="col-span-7">
            <RefEquityChart monitors={monitors} />
          </RefPanel>

          <RefPanel title="Quantum Market Sentiment Matrix" className="col-span-3">
            <RefSentimentMatrix monitors={monitors} />
          </RefPanel>

          <RefPanel title="Alpha Signals Feed" className="col-span-2">
            <RefAlphaFeed monitors={systems} />
          </RefPanel>

          <RefPanel title="Sentient Agent Mesh" className="col-span-3">
            <RefAgentMesh monitors={systems} />
          </RefPanel>

          <RefPanel title="Capital Allocation // Hyperstructure" className="col-span-3">
            <RefAllocation />
          </RefPanel>

          <RefPanel title="Multiverse Simulation" className="col-span-3">
            <RefSimulation />
          </RefPanel>

          <RefPanel title="Hyper Liquidity Depth" className="col-span-3">
            <RefMarketDepth markets={markets} />
          </RefPanel>

          <RefPanel title="Real-Time Smart Money Flow" className="col-span-3">
            <RefMoneyFlow />
          </RefPanel>

          <RefPanel title="Holographic Universe View" className="col-span-4">
            <RefUniverseView />
          </RefPanel>

          <RefPanel title="Risk Fortress Status" className="col-span-2">
            <RefRiskFortress />
          </RefPanel>

          <RefPanel title="Decision Stream // Live Log" className="col-span-3">
            <RefDecisionStream monitors={systems} />
          </RefPanel>

          <div className="col-span-12 grid grid-cols-8 gap-2 rounded-xl border border-cyan-300/20 bg-black/60 px-3 py-2 text-[9px]">
            {[
              ["BTC", "$284,910", "+12.48%"],
              ["ETH", "$18,420", "+9.72%"],
              ["SOL", "$1,942", "+24.91%"],
              ["AI", "$47.21", "+31.47%"],
              ["TOTAL MKT CAP", "$132.7T", "+8.21%"],
              ["24H VOLUME", "$47.2T", "+26.9%"],
              ["GLOBAL LIQUIDITY", "$10.3T", ""],
              ["UPLINK", "STABLE", "▮▮▮"],
            ].map(([a, b, c]) => (
              <div key={a} className="truncate">
                <span className="font-black text-orange-300">{a}</span>
                <span className="ml-2 text-cyan-100/55">{b}</span>
                <span className="ml-2 text-emerald-300">{c}</span>
              </div>
            ))}
          </div>
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

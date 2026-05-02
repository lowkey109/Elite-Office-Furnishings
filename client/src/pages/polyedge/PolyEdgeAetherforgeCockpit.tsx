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
import NexoraMicrofishPanel from "@/components/polyedge/NexoraMicrofishPanel";
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
    <NexoraMicrofishPanel />

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

      <div className="relative min-h-[230px] overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/30 p-2">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_50%,rgba(34,240,255,0.18),transparent_35%),radial-gradient(circle_at_75%_35%,rgba(255,0,170,0.14),transparent_32%)]" />
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent" style={{ animation: "polyedge-heartbeat-scan 2.6s linear infinite" }} />

        <div className="relative z-10 grid min-h-[200px] grid-cols-1 gap-2 md:grid-cols-[220px_1fr]">
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
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-xl border border-cyan-300/15 bg-black/40 p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/40">App Heartbeat</div>
                <div className="mt-1 text-sm font-black text-emerald-300">LIVE {'.'.repeat(pulse + 1)}</div>
              </div>

              <div className="rounded-xl border border-cyan-300/15 bg-black/40 p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/40">API Status</div>
                <div className={`mt-1 text-sm font-black uppercase ${statusColor}`}>{apiStatus}</div>
              </div>

              <div className="rounded-xl border border-cyan-300/15 bg-black/40 p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/40">Replay Engine</div>
                <div className={`mt-1 text-sm font-black uppercase ${running ? "text-emerald-300" : "text-cyan-100/45"}`}>
                  {running ? "RUNNING" : "IDLE"}
                </div>
              </div>

              <div className="rounded-xl border border-cyan-300/15 bg-black/40 p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/40">Last Check</div>
                <div className="mt-1 text-sm font-black text-white">{lastApiCheck || "waiting"}</div>
              </div>
            </div>

            <div className="mt-1.5 rounded-xl border border-orange-300/15 bg-orange-400/5 p-3 text-[11px] leading-relaxed text-orange-100/75">
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
  const beatRate =
    apiStatus === "online" && apiFailureCount === 0 ? 10 :
    apiStatus === "online" && apiFailureCount <= 2 ? 5 :
    apiStatus === "checking" ? 3 :
    0;
  const dots = beatRate === 0 ? "────────" : "♥".repeat(Math.max(1, beatRate));

  return (
    <HoloPanel title="Poly System Heart Monitor" icon={Activity} className=" col-span-12 xl:col-span-6">
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

      <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/40 p-2">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(34,240,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34,240,255,.10) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/40">PolyEdge API Heartbeat</div>
              <div className={`mt-1 text-sm font-black uppercase tracking-[0.12em] ${alive ? "text-emerald-300" : flatline ? "text-red-300" : "text-cyan-300"}`}>
                {alive ? `LIVE${dots}` : flatline ? "FLATLINE" : "CHECKING"}
              </div>
            </div>
            <div className="rounded-xl border border-cyan-300/20 bg-black/45 px-2.5 py-1.5 text-right">
              <div className="text-[9px] uppercase tracking-[0.14em] text-cyan-100/40">API Status</div>
              <div className={`text-sm font-black uppercase ${alive ? "text-emerald-300" : "text-amber-300"}`}>{apiStatus}</div>
            </div>
          </div>

          <div className="relative h-24 overflow-hidden rounded-xl border border-cyan-300/15 bg-black/60">
            <svg className="absolute inset-0 h-full w-[200%]" style={{ animation: alive ? `poly-ecg-run ${beatRate === 10 ? "0.55s" : beatRate === 5 ? "1.1s" : "1.8s"} linear infinite` : undefined }} viewBox="0 0 1000 120" preserveAspectRatio="none">
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
            <div className={`absolute right-4 top-2 h-4 w-4 rounded-full ${alive ? "bg-emerald-300" : "bg-red-400"}`} style={{ animation: alive ? `poly-heart-glow ${beatRate === 10 ? "0.35s" : beatRate === 5 ? "0.75s" : "1.4s"} ease-in-out infinite` : undefined }} />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
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
    <HoloPanel title="Replay Engine Monitor" icon={Radar} className=" col-span-12 xl:col-span-6">
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

      <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-fuchsia-300/15 bg-black/40 p-2">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_45%,rgba(255,0,170,0.14),transparent_36%),radial-gradient(circle_at_70%_60%,rgba(34,240,255,0.12),transparent_34%)]" />
        <div className="relative z-10 grid min-h-[190px] grid-cols-[170px_1fr] gap-2">
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
                <div className={`mt-1 text-sm font-black uppercase tracking-[0.12em] ${stalled ? "text-red-300" : running ? "text-emerald-300" : "text-cyan-100/45"}`}>
                  {status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.14em] text-cyan-100/40">Trade Progress</div>
                <div className="text-sm font-black text-white">{completed}/{total}</div>
              </div>
            </div>

            <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/60 ring-1 ring-fuchsia-300/20">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stalled ? "bg-red-400" : "bg-gradient-to-r from-cyan-300 via-emerald-300 to-fuchsia-300"}`}
                style={{ width: `${replayProgress}%` }}
              />
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[10px]">
              <div className="rounded-xl border border-emerald-300/15 bg-black/35 p-2"><div className="text-cyan-100/35">WINS</div><div className="font-bold text-emerald-300">{runtime?.profitable || 0}</div></div>
              <div className="rounded-xl border border-red-300/15 bg-black/35 p-2"><div className="text-cyan-100/35">LOSSES</div><div className="font-bold text-red-300">{runtime?.losing || 0}</div></div>
              <div className="rounded-xl border border-amber-300/15 bg-black/35 p-2"><div className="text-cyan-100/35">SKIP</div><div className="font-bold text-amber-300">{runtime?.skipped || 0}</div></div>
              <div className="rounded-xl border border-cyan-300/15 bg-black/35 p-2"><div className="text-cyan-100/35">NO MOVE</div><div className="font-bold text-cyan-300">{secondsSinceProgress}s</div></div>
            </div>

            <div className="mt-1.5 rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/5 p-3 text-[11px] leading-relaxed text-fuchsia-100/75">
              {runtime?.lastEvent || "Replay engine idle. Press Run 25 or Run 50 to start."}
            </div>
          </div>
        </div>
      </div>
    </HoloPanel>
  );
}












function realValue(value: unknown, fallback = "WAITING") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return String(value);
}

function realNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function realMoney(value: unknown, fallback = "WAITING") {
  const n = realNumber(value);
  if (n === null) return fallback;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n);
}

function realPct(value: unknown, fallback = "WAITING") {
  const n = realNumber(value);
  if (n === null) return fallback;
  return `${Math.round(n * 100) / 100}%`;
}

function statusTone(state?: string) {
  if (state === "online" || state === "running") {
    return {
      label: "LIVE",
      long: "ONLINE",
      text: "text-emerald-300",
      border: "border-emerald-300/45",
      dot: "bg-emerald-300",
      stroke: "#67f9c7",
      glow: "rgba(103,249,199,.85)",
      fill: "rgba(16,185,129,.13)",
    };
  }

  if (state === "blocked" || state === "paper_only" || state === "idle") {
    return {
      label: state === "idle" ? "IDLE" : "SAFE",
      long: state === "idle" ? "STANDBY" : "SAFE LOCKED",
      text: "text-amber-300",
      border: "border-amber-300/45",
      dot: "bg-amber-300",
      stroke: "#ffd166",
      glow: "rgba(255,209,102,.78)",
      fill: "rgba(255,209,102,.12)",
    };
  }

  return {
    label: "FAULT",
    long: "FAULT",
    text: "text-red-300",
    border: "border-red-300/45",
    dot: "bg-red-300",
    stroke: "#ff4d6d",
    glow: "rgba(255,77,109,.82)",
    fill: "rgba(255,77,109,.12)",
  };
}

function QuantumGlass({ children, className = "" }: { children: any; className?: string }) {
  return (
    <div className={`poly-final-glass relative overflow-hidden rounded-lg border border-cyan-300/35 bg-black/70 p-1.5 backdrop-blur-xl ${className}`}>
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(103,232,249,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(103,232,249,.08) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      <div className="poly-final-scan pointer-events-none absolute inset-0" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function QuantumTitle({ title, right }: { title: string; right?: any }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">{title}</div>
      {right || <span className="text-[9px] font-black uppercase text-emerald-300">LIVE</span>}
    </div>
  );
}






function monitorConnectionAgeMs(monitor: any): number | null {
  const raw = monitor?.lastCheckAt || monitor?.updatedAt || monitor?.generatedAt;
  if (!raw) return null;
  const t = Date.parse(String(raw));
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Date.now() - t);
}

function connectionSpeedSeconds(monitor: any): number {
  if (!monitor?.alive && !monitor?.moving && !monitor?.loopRunning) return 0;

  const latency = Number(monitor?.latencyMs ?? monitor?.responseTimeMs ?? monitor?.ageMs ?? 9999);

  if (latency <= 250) return 10; // good connection: 10 fast beats
  if (latency <= 1000) return 5; // normal connection: 5 beats
  return 3; // slow connection: 3 slow beats
}

function nexoraTradingHealth(state: any) {
  const learning = state?.learning ?? {};
  const winRate = Number(learning.winRate ?? 0);
  const profitFactor = Number(learning.profitFactor ?? 0);
  const pnl = Number(learning.totalPnl ?? 0);

  if (winRate >= 70 && profitFactor >= 2 && pnl > 0) return { beats: 10, color: "emerald", label: "NEXORA DOMINATING MARKET" };
  if (winRate >= 55 && profitFactor >= 1.2) return { beats: 6, color: "cyan", label: "NEXORA TRADING STABLE" };
  if (winRate >= 40) return { beats: 3, color: "amber", label: "NEXORA UNDER PRESSURE" };
  return { beats: 0, color: "red", label: "NEXORA CRITICAL" };
}

function connectionLabel(monitor: any): string {
  const beats = connectionSpeedSeconds(monitor);

  if (beats === 10) return "GOOD CONNECTION · 10 BEATS";
  if (beats === 5) return "NORMAL CONNECTION · 5 BEATS";
  if (beats === 3) return "SLOW CONNECTION · 3 BEATS";
  return "NO CONNECTION · FLATLINE";
}

function monitorRhythm(monitor: any) {
  const seedText = String(monitor?.key || monitor?.label || "polyedge");
  const seed = Array.from(seedText).reduce((sum, ch, i) => sum + ch.charCodeAt(0) * (i + 7), 0);
  const base = connectionSpeedSeconds(monitor);

  const liveDuration = base + (seed % 11) * 0.42;
  const idleDuration = Math.max(15, base * 2.1) + (seed % 9) * 0.8;

  return {
    seed,
    label: connectionLabel(monitor),
    liveAnim: `${liveDuration.toFixed(2)}s`,
    idleAnim: `${idleDuration.toFixed(2)}s`,
    liveDelay: `-${(((seed % 101) / 101) * liveDuration).toFixed(2)}s`,
    idleDelay: `-${(((seed % 97) / 97) * idleDuration).toFixed(2)}s`,
  };
}

function MiniTrace({ monitor }: { monitor: any }) {
  const state = String(monitor?.state || "offline");
  const kind = String(monitor?.kind || "module");
  const moving = monitor?.moving === true;
  const rhythm = monitorRhythm(monitor);

  const isMarket = kind === "market";
  const isFault =
    state === "offline" ||
    state === "timeout" ||
    state === "stalled" ||
    state === "fault" ||
    false;
  const isIdle = !isFault && (state === "idle" || state === "blocked" || state === "paper_only");
  const isLive = !isFault && !isIdle && (state === "online" || state === "running") && moving;

  if (isMarket) {
    return (
      <div className="mt-1 flex h-5 items-end gap-[2px] overflow-hidden rounded-md border border-cyan-300/10 bg-black/45 px-2 pb-1">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className={`w-1 rounded-t ${isFault ? "bg-red-400/45" : "bg-gradient-to-t from-fuchsia-700 via-cyan-300 to-white"}`}
            style={{
              height: `${7 + ((i * 13 + rhythm.seed) % 20)}px`,
              filter: isFault ? "none" : "drop-shadow(0 0 7px rgba(103,232,249,.75))",
              animation: isLive ? `poly-final-bars ${(1.8 + ((rhythm.seed + i) % 9) * 0.2).toFixed(2)}s ease-in-out infinite alternate` : undefined,
              animationDelay: isLive ? `-${((rhythm.seed + i * 17) % 90) / 10}s` : undefined,
            }}
          />
        ))}
      </div>
    );
  }

  if (isFault) {
    return (
      <div className="poly-beat-ecg mt-1 h-4 overflow-hidden rounded-md border border-red-300/25 bg-black/85 sm:h-5 xl:h-5">
        <div className="poly-beat-grid poly-beat-grid-red" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 44" preserveAspectRatio="none">
          <path d="M0 27 H320" fill="none" stroke="#ff4d6d" strokeWidth="2.8" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 8px rgba(255,77,109,.85))" }} />
        </svg>
        <div className="absolute right-2 top-1 text-[7px] font-black uppercase tracking-[0.14em] text-red-300">FLATLINE</div>
      </div>
    );
  }

  if (isIdle) {
    return (
      <div className="poly-beat-ecg mt-1 h-4 overflow-hidden rounded-md border border-amber-300/25 bg-black/85 sm:h-5 xl:h-5">
        <div className="poly-beat-grid poly-beat-grid-amber" />
        <div className="poly-conn-idle-sweep" style={{ animationDuration: rhythm.idleAnim, animationDelay: rhythm.idleDelay }} />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 44" preserveAspectRatio="none">
          <path
            className="poly-conn-idle-path"
            d="M0 27 H112 C120 27 124 25 130 27 H320"
            fill="none"
            stroke="#ffd166"
            strokeWidth="2.2"
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 0 7px rgba(255,209,102,.7))",
              animationDuration: rhythm.idleAnim,
              animationDelay: rhythm.idleDelay,
            }}
          />
        </svg>
        <div className="absolute right-2 top-1 text-[7px] font-black uppercase tracking-[0.14em] text-amber-300">STANDBY • {rhythm.label}</div>
      </div>
    );
  }

  return (
    <div className="poly-beat-ecg mt-1 h-4 overflow-hidden rounded-md border border-emerald-300/25 bg-black/85 sm:h-5 xl:h-5">
      <div className="poly-beat-grid" />
      <div className="poly-conn-beat-head" style={{ animationDuration: rhythm.liveAnim, animationDelay: rhythm.liveDelay }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 44" preserveAspectRatio="none">
        <path
          className="poly-conn-beat-path"
          d="M0 27 H30 C38 27 43 24 49 22 C56 20 62 24 68 27 H82 L90 34 L98 5 L107 39 L117 27 H142 C154 27 164 24 176 22 C190 20 204 24 218 27 H246 C254 27 259 24 265 22 C272 20 278 24 284 27 H298 L306 34 L314 5 L323 39 L333 27 H358 C370 27 380 24 392 22 C406 20 420 24 434 27 H520"
          fill="none"
          stroke="#00ff88"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: "drop-shadow(0 0 7px rgba(0,255,136,.95)) drop-shadow(0 0 16px rgba(0,255,136,.55))",
            animationDuration: rhythm.liveAnim,
            animationDelay: rhythm.liveDelay,
          }}
        />
      </svg>
      <div
        className="absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(0,255,136,.95)]"
        style={{
          animation: `poly-conn-dot ${rhythm.liveAnim} ease-in-out infinite`,
          animationDelay: rhythm.liveDelay,
        }}
      />
      <div className="absolute right-2 top-1 text-[7px] font-black uppercase tracking-[0.14em] text-emerald-300">{rhythm.label}</div>
    </div>
  );
}

function MonitorTile({ monitor }: { monitor: any }) {
  const t = statusTone(monitor?.state);
  const value =
    monitor?.kind === "market" && monitor?.value !== undefined
      ? realMoney(monitor.value)
      : t.label;

  return (
    <div className={`relative overflow-hidden rounded-md border ${t.border} bg-black/35 p-1`} style={{ boxShadow: `inset 0 0 22px ${t.fill}` }}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <div className="truncate text-[9px] font-black uppercase tracking-[0.10em] text-white">{realValue(monitor?.label, "UNKNOWN")}</div>
          <div className="truncate text-[8px] uppercase text-cyan-100/40">{realValue(monitor?.kind, "module")}</div>
        </div>
        <div className={`flex shrink-0 items-center gap-1 text-[8px] font-black uppercase ${t.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} style={{ animation: monitor?.moving ? "poly-final-pulse .85s ease-in-out infinite" : undefined, boxShadow: `0 0 10px ${t.glow}` }} />
          {value}
        </div>
      </div>
      <MiniTrace monitor={monitor} />
    </div>
  );
}

function EquityPanel({ monitors, metrics }: { monitors: any[]; metrics: any }) {
  const active = monitors.filter((m) => m.state === "online" || m.state === "running").length;
  const fault = monitors.filter((m) => m.state === "offline" || m.state === "timeout" || m.state === "stalled").length;

  return (
    <div className="h-full">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.08em] text-white">Hyperdimensional Equity Curve</div>
          <div className="text-[10px] text-slate-400">
            REAL PNL: {realMoney(metrics?.totalPnl)} • WIN RATE: {realPct(metrics?.winRate)} • PROFIT FACTOR: {realValue(metrics?.profitFactor)}
          </div>
        </div>
        <div className="text-xs font-black uppercase text-emerald-300">LIVE</div>
      </div>

      <div className="relative h-[calc(100%-42px)]">
        <svg className="h-full w-full" viewBox="0 0 920 260" preserveAspectRatio="none">
          <defs>
            <linearGradient id="polyFinalEquity" x1="0" x2="1">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity=".32" />
              <stop offset="65%" stopColor="#67e8f9" stopOpacity="1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity=".95" />
            </linearGradient>
            <linearGradient id="polyFinalFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity=".19" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
            </linearGradient>
          </defs>

          {Array.from({ length: 7 }).map((_, i) => (
            <line key={"h" + i} x1="0" x2="920" y1={28 + i * 32} y2={28 + i * 32} stroke="rgba(255,255,255,.055)" />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={"v" + i} x1={i * 84} x2={i * 84} y1="0" y2="260" stroke="rgba(255,255,255,.04)" />
          ))}

          <path
            d="M0 225 L60 211 L120 202 L180 188 L240 166 L300 174 L360 138 L420 149 L480 111 L540 94 L600 72 L660 83 L720 47 L780 39 L840 22 L900 29 L920 15 L920 260 L0 260 Z"
            fill="url(#polyFinalFill)"
          />

          <polyline
            points="0,225 60,211 120,202 180,188 240,166 300,174 360,138 420,149 480,111 540,94 600,72 660,83 720,47 780,39 840,22 900,29 920,15"
            fill="none"
            stroke="url(#polyFinalEquity)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 13px rgba(103,232,249,.95))", animation: "poly-final-dash 2.2s linear infinite" }}
          />

          <polyline
            points="0,238 60,224 120,217 180,206 240,190 300,197 360,172 420,181 480,155 540,141 600,123 660,130 720,98 780,91 840,76 900,83 920,70"
            fill="none"
            stroke="#c026d3"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(192,38,211,.85))" }}
          />
        </svg>

        <div className="absolute bottom-1 left-0 right-0 grid grid-cols-5 gap-1.5 text-[10px]">
          <div className="rounded-lg border border-cyan-400/20 bg-black/40 px-2 py-1">
            <div className="text-slate-400">TRADES</div>
            <div className="font-black text-white">{realValue(metrics?.totalPaperTrades)}</div>
          </div>
          <div className="rounded-lg border border-cyan-400/20 bg-black/40 px-2 py-1">
            <div className="text-slate-400">PNL</div>
            <div className="font-black text-cyan-300">{realMoney(metrics?.totalPnl)}</div>
          </div>
          <div className="rounded-lg border border-emerald-400/20 bg-black/40 px-2 py-1">
            <div className="text-slate-400">ACTIVE</div>
            <div className="font-black text-emerald-300">{active}</div>
          </div>
          <div className="rounded-lg border border-amber-400/20 bg-black/40 px-2 py-1">
            <div className="text-slate-400">WINS</div>
            <div className="font-black text-amber-300">{realValue(metrics?.qualifiedProfitablePaperTrades, "0")} / {realValue(metrics?.requiredProfitablePaperTrades, "500")}</div>
          </div>
          <div className="rounded-lg border border-red-400/20 bg-black/40 px-2 py-1">
            <div className="text-slate-400">FAULT</div>
            <div className="font-black text-red-300">{fault}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoneyFlowPanel() {
  return (
    <div className="h-full">
      <QuantumTitle title="Real-Time Smart Money Flow" />
      <div className="relative h-[calc(100%-28px)] overflow-hidden rounded-xl border border-cyan-400/10 bg-black/35 p-2">
        <div className="relative z-10 flex h-full items-end gap-1.5">
          {Array.from({ length: 26 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-fuchsia-800 via-fuchsia-500 to-cyan-200"
              style={{
                height: `${18 + ((i * 17) % 92)}px`,
                filter: "drop-shadow(0 0 10px rgba(192,38,211,.8))",
                animation: `poly-final-bars ${0.7 + (i % 7) * 0.07}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function UniversePanel() {
  return (
    <div className="h-full">
      <QuantumTitle title="Holographic Universe View" />
      <div className="relative h-[calc(100%-28px)] overflow-hidden rounded-xl border border-cyan-400/10 bg-black/35">
        <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-20">🌌</div>
        <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-purple-500 via-cyan-400 to-emerald-400 blur-3xl opacity-70" style={{ animation: "poly-final-soft 2.4s ease-in-out infinite" }} />
        <div className="absolute left-1/2 top-1/2 h-24 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30" style={{ transform: "translate(-50%,-50%) rotateX(68deg)", animation: "poly-final-orbit 8s linear infinite" }} />
        <div className="absolute inset-x-0 bottom-4 text-center text-[10px] text-cyan-300">POLYEDGE SYSTEM UNIVERSE • REAL MONITORS</div>
      </div>
    </div>
  );
}

function SentimentPanel({ monitors }: { monitors: any[] }) {
  const active = monitors.filter((m) => m.state === "online" || m.state === "running").length;
  const bullish = monitors.length > 0 ? Math.round((active / monitors.length) * 100) : 0;
  const neutral = Math.max(0, 100 - bullish);

  return (
    <div className="h-full">
      <QuantumTitle title="Quantum Market Sentiment Matrix" />
      <div className="flex h-[calc(100%-28px)] items-center justify-between">
        <div className="text-center">
          <div className="text-4xl font-black text-emerald-300">{bullish}%</div>
          <div className="text-[10px] text-emerald-300">ONLINE</div>
        </div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-purple-500 shadow-[0_0_36px_rgba(192,38,211,.65)]" style={{ animation: "poly-final-float 5s ease-in-out infinite" }}>
          <div className="h-4 w-4 rounded-full bg-white shadow-[0_0_30px_#c026d3]" style={{ animation: "poly-final-soft 1s ease-in-out infinite" }} />
          <div className="absolute inset-4 rotate-45 border border-cyan-300/35" />
        </div>
        <div className="text-center">
          <div className="text-4xl font-black text-amber-300">{neutral}%</div>
          <div className="text-[10px] text-amber-300">WAIT/SAFE</div>
        </div>
      </div>
    </div>
  );
}

function AllocationPanel({ metrics }: { metrics: any }) {
  return (
    <div className="h-full">
      <QuantumTitle title="Promotion Gate // 500-Win Progress" />
      <div className="flex h-[calc(100%-28px)] items-center justify-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-[14px] border-cyan-300/15" />
          <div className="absolute inset-0 rounded-full border-[14px] border-transparent border-t-cyan-300 border-r-fuchsia-500 border-b-emerald-400" style={{ filter: "drop-shadow(0 0 16px rgba(103,232,249,.8))", animation: "poly-final-spin 7s linear infinite" }} />
          <div className="text-center">
            <div className="text-sm font-black text-white">{realPct(metrics?.profitablePaperTradeProgressPct)}</div>
            <div className="text-[8px] uppercase text-cyan-300">REAL</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlphaPanel({ monitors }: { monitors: any[] }) {
  return (
    <div className="h-full text-[10px]">
      <QuantumTitle title="Alpha Signals Feed" />
      <div className="space-y-2">
        {monitors.slice(0, 9).map((m) => {
          const t = statusTone(m.state);
          return (
            <div key={m.key} className="flex justify-between border-b border-cyan-300/10 pb-1">
              <span className="truncate pr-3 uppercase text-cyan-50/70">{realValue(m.label)}</span>
              <span className={`shrink-0 font-black ${t.text}`}>{t.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BottomStatusBar({ monitors, metrics }: { monitors: any[]; metrics: any }) {
  const replay = monitors.find((m) => m.key === "replay_engine");
  const replayTone = statusTone(replay?.state);

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-cyan-400/30 bg-slate-950/65 px-2.5 py-1.5 text-[9px] backdrop-blur-xl lg:flex-nowrap">
      <div className="flex gap-2">
        <div><span className="text-emerald-400">MAX DD:</span> {realPct(metrics?.maxDrawdownPct)}</div>
        <div><span className="text-emerald-400">WIN RATE:</span> {realPct(metrics?.winRate)}</div>
        <div><span className="text-purple-400">PROFIT FACTOR:</span> {realValue(metrics?.profitFactor)}</div>
      </div>
      <div className="font-mono text-cyan-400">POLY HEART MONITOR • REAL DATA</div>
      <div className={`${replayTone.text}`}>REPLAY ENGINE • {replayTone.label}</div>
    </div>
  );
}

function PolyEdgeActionMonitorGrid({
  actionMonitor,
  replayStatus,
}: {
  actionMonitor: PolyEdgeActionMonitorResponse | null;
  replayStatus?: PolyEdgeReplayStatus | null;
}) {
  const monitors = actionMonitor?.monitors || [];
  const markets = monitors.filter((m: any) => m.kind === "market");
  const systems = monitors.filter((m: any) => m.kind !== "market");
  const active = monitors.filter((m: any) => m.state === "online" || m.state === "running").length;
  const metrics = (replayStatus as any)?.promotion?.metrics || {};
  const lastRealCheck = (replayStatus as any)?.lastRunAt || (actionMonitor as any)?.generatedAt || null;
  const apiTone = statusTone(monitors.find((m: any) => m.key === "poly_api")?.state);

  const replay = monitors.find((m: any) => m.key === "replay_engine");
  const learning = monitors.find((m: any) => m.key === "learning_brain");
  const promotion = monitors.find((m: any) => m.key === "promotion_gate");
  const risk = monitors.find((m: any) => m.key === "risk_governor");
  const priority = [replay, learning, promotion, risk].filter(Boolean);

  return (
    <HoloPanel title="POLY//EDGE • REAL DATA QUANTUM TERMINAL" icon={Cpu} className="col-span-12 !m-0 !p-0">
      <style>{`
        .poly-final-root {
          background: radial-gradient(circle at center, #0a0a1f 0%, #000000 100%);
        }
        .poly-final-root::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(#22d3ee 0.5px, transparent 1px);
          background-size: 40px 40px;
          opacity: .10;
          animation: poly-final-stars 18s linear infinite;
        }
        .poly-final-glass {
          box-shadow: 0 0 0 rgba(103,232,249,0);
          transition: all .35s cubic-bezier(.23,1,.32,1);
        }
        .poly-final-glass:hover {
          transform: translateY(-2px);
          border-color: rgba(192,38,211,.60);
          box-shadow: 0 0 35px -5px rgb(103 232 249);
        }
        .poly-final-scan::after {
          content: "";
          position: absolute;
          top: -100%;
          left: 0;
          width: 100%;
          height: 300%;
          background: linear-gradient(transparent, rgba(103,232,249,.12), transparent);
          animation: poly-final-scan 9s linear infinite;
        }
        @keyframes poly-final-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes poly-final-stars {
          from { transform: translate3d(0,0,0); }
          to { transform: translate3d(40px,40px,0); }
        }
        @keyframes poly-final-dash {
          from { stroke-dasharray: 10 12; stroke-dashoffset: 110; }
          to { stroke-dasharray: 10 12; stroke-dashoffset: 0; }
        }
        @keyframes poly-final-ecg {
          from { transform: translateX(-18%); }
          to { transform: translateX(0%); }
        }
        @keyframes poly-real-ecg-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes poly-real-ecg-beat {
          0%, 100% { opacity: .45; transform: scale(.75); }
          42% { opacity: 1; transform: scale(1.45); }
          58% { opacity: .72; transform: scale(.95); }
        }
        .poly-real-ecg {
          position: relative;
        }
        .poly-real-ecg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,255,136,.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,.12) 1px, transparent 1px);
          background-size: 10px 10px;
        }
        .poly-real-ecg-line {
          position: absolute;
          left: 0;
          top: 0;
          width: 200%;
          height: 100%;
        }
        .poly-real-ecg-sweep {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 18px;
          background: linear-gradient(90deg, transparent, rgba(0,255,136,.28), transparent);
          animation: poly-real-ecg-sweep 1.35s linear infinite;
        }
        @keyframes poly-real-ecg-sweep {
          from { left: -24px; }
          to { left: 100%; }
        }

        @keyframes poly-real-ecg-draw {
          from { transform: translateX(0); }
          to { transform: translateX(-35.55%); }
        }

        @keyframes poly-real-ecg-beat {
          0%, 100% { opacity: .42; transform: scale(.72); }
          42% { opacity: .85; transform: scale(1.15); }
          48% { opacity: 1; transform: scale(1.55); }
          62% { opacity: .68; transform: scale(.92); }
        }

        @keyframes poly-real-ecg-sweep {
          from { left: -28px; }
          to { left: 100%; }
        }

        @keyframes poly-real-ecg-idle-drift {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        .poly-real-ecg {
          position: relative;
        }

        .poly-real-ecg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,255,136,.13) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,.10) 1px, transparent 1px);
          background-size: 10px 10px;
          opacity: .9;
        }

        .poly-real-ecg-grid-amber {
          background-image:
            linear-gradient(rgba(255,209,102,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,209,102,.08) 1px, transparent 1px);
        }

        .poly-real-ecg-grid-red {
          background-image:
            linear-gradient(rgba(255,77,109,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,77,109,.08) 1px, transparent 1px);
        }

        .poly-real-ecg-line {
          position: absolute;
          left: 0;
          top: 0;
          width: 300%;
          height: 100%;
          animation: poly-real-ecg-draw 1.55s linear infinite;
        }

        .poly-real-ecg-line-idle {
          position: absolute;
          left: 0;
          top: 0;
          width: 200%;
          height: 100%;
          animation: poly-real-ecg-idle-drift 5.6s linear infinite;
        }

        .poly-real-ecg-sweep {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 26px;
          background: linear-gradient(90deg, transparent, rgba(0,255,136,.32), transparent);
          animation: poly-real-ecg-sweep 1.55s linear infinite;
        }

        .poly-real-ecg-idle-sweep {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 18px;
          background: linear-gradient(90deg, transparent, rgba(255,209,102,.18), transparent);
          animation: poly-real-ecg-sweep 5.6s linear infinite;
        }

        @keyframes poly-beat-draw {
          0% { stroke-dashoffset: 860; opacity: .15; }
          8% { opacity: 1; }
          74% { stroke-dashoffset: 0; opacity: 1; }
          88% { stroke-dashoffset: 0; opacity: .95; }
          100% { stroke-dashoffset: 0; opacity: .08; }
        }

        @keyframes poly-beat-head {
          0% { left: -18px; opacity: 0; }
          8% { opacity: 1; }
          74% { left: 100%; opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }

        @keyframes poly-beat-dot {
          0%, 37%, 100% { opacity: .35; transform: scale(.78); }
          42% { opacity: 1; transform: scale(1.45); }
          48% { opacity: .8; transform: scale(.95); }
        }

        @keyframes poly-beat-idle {
          0%, 78%, 100% { stroke-dashoffset: 520; opacity: .28; }
          82% { opacity: .75; }
          95% { stroke-dashoffset: 0; opacity: .75; }
        }

        @keyframes poly-beat-idle-sweep {
          0%, 76% { left: -20px; opacity: 0; }
          82% { opacity: .75; }
          98% { left: 100%; opacity: .6; }
          100% { opacity: 0; }
        }

        .poly-beat-ecg {
          position: relative;
        }

        .poly-beat-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,255,136,.13) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,.10) 1px, transparent 1px);
          background-size: 10px 10px;
          opacity: .9;
        }

        .poly-beat-grid-amber {
          background-image:
            linear-gradient(rgba(255,209,102,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,209,102,.08) 1px, transparent 1px);
        }

        .poly-beat-grid-red {
          background-image:
            linear-gradient(rgba(255,77,109,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,77,109,.08) 1px, transparent 1px);
        }

        .poly-beat-live-path {
          stroke-dasharray: 860;
          stroke-dashoffset: 860;
          animation: poly-beat-draw 1.42s linear infinite;
        }

        .poly-beat-head {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 22px;
          background: linear-gradient(90deg, transparent, rgba(0,255,136,.34), transparent);
          animation: poly-beat-head 1.42s linear infinite;
        }

        .poly-beat-idle-path {
          stroke-dasharray: 520;
          stroke-dashoffset: 520;
          animation: poly-beat-idle 4.8s linear infinite;
        }

        .poly-beat-idle-sweep {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 16px;
          background: linear-gradient(90deg, transparent, rgba(255,209,102,.18), transparent);
          animation: poly-beat-idle-sweep 4.8s linear infinite;
        }

        @keyframes poly-conn-beat-draw {
          0% { stroke-dashoffset: 860; opacity: .08; }
          10% { opacity: 1; }
          84% { stroke-dashoffset: 0; opacity: 1; }
          94% { stroke-dashoffset: 0; opacity: .78; }
          100% { stroke-dashoffset: 0; opacity: .05; }
        }

        @keyframes poly-conn-head {
          0% { left: -24px; opacity: 0; }
          10% { opacity: 1; }
          84% { left: 100%; opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }

        @keyframes poly-conn-dot {
          0%, 22%, 48%, 74%, 100% { opacity: .22; transform: scale(.70); }
          31% { opacity: 1; transform: scale(1.38); }
          39% { opacity: .62; transform: scale(.90); }
          66% { opacity: 1; transform: scale(1.38); }
          74% { opacity: .62; transform: scale(.90); }
        }

        @keyframes poly-conn-idle {
          0%, 76%, 100% { stroke-dashoffset: 520; opacity: .18; }
          82% { opacity: .68; }
          96% { stroke-dashoffset: 0; opacity: .68; }
        }

        @keyframes poly-conn-idle-sweep {
          0%, 76% { left: -20px; opacity: 0; }
          82% { opacity: .65; }
          98% { left: 100%; opacity: .5; }
          100% { opacity: 0; }
        }

        .poly-conn-beat-path {
          stroke-dasharray: 860;
          stroke-dashoffset: 860;
          animation-name: poly-conn-beat-draw;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .poly-conn-beat-head {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 22px;
          background: linear-gradient(90deg, transparent, rgba(0,255,136,.34), transparent);
          animation-name: poly-conn-head;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .poly-conn-idle-path {
          stroke-dasharray: 520;
          stroke-dashoffset: 520;
          animation-name: poly-conn-idle;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .poly-conn-idle-sweep {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 16px;
          background: linear-gradient(90deg, transparent, rgba(255,209,102,.18), transparent);
          animation-name: poly-conn-idle-sweep;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes poly-final-bars {
          from { transform: scaleY(.45); opacity: .55; }
          to { transform: scaleY(1.12); opacity: 1; }
        }
        @keyframes poly-final-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes poly-final-orbit {
          from { rotate: 0deg; }
          to { rotate: 360deg; }
        }
        @keyframes poly-final-pulse {
          0%, 100% { opacity: .52; transform: scale(.9); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes poly-final-soft {
          0%, 100% { opacity: .55; transform: scale(.92); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        
        .polyedge-whole-app-onepage {
          height: calc(100vh - 24px);
          max-height: calc(100vh - 24px);
          overflow: hidden;
        }
        . {
          display: none !important;
        }

        .polyedge-desktop-no-scroll-fix { display: none; }

        @media (min-width: 1024px) {
          body:has(.polyedge-responsive-onepage) {
            overflow: hidden !important;
          }

          .polyedge-responsive-onepage {
            height: calc(100dvh - 16px) !important;
            max-height: calc(100dvh - 16px) !important;
            overflow: hidden !important;
          }

          .polyedge-responsive-onepage .poly-final-glass {
            min-height: 0 !important;
          }
        }

        .polyedge-route-no-scroll-final { display: none; }

        @media (min-width: 1024px) {
          html:has(.polyedge-responsive-onepage),
          body:has(.polyedge-responsive-onepage),
          #root:has(.polyedge-responsive-onepage) {
            height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }

          body:has(.polyedge-responsive-onepage) {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
          }

          .polyedge-responsive-onepage {
            height: calc(100dvh - 16px) !important;
            max-height: calc(100dvh - 16px) !important;
            overflow: hidden !important;
          }
        }

        .polyedge-reference-fit-final { display: none; }

        . {
          display: none !important;
        }

        @media (min-width: 1024px) {
          html:has(.polyedge-fit-reference),
          body:has(.polyedge-fit-reference),
          #root:has(.polyedge-fit-reference) {
            width: 100% !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
            background: #000 !important;
          }

          body:has(.polyedge-fit-reference) {
            position: fixed !important;
            inset: 0 !important;
          }

          .polyedge-fit-reference {
            transform-origin: top left;
          }

          .polyedge-fit-reference .poly-final-glass {
            min-height: 0 !important;
          }

          .polyedge-fit-reference canvas,
          .polyedge-fit-reference svg {
            max-height: 100% !important;
          }
        }

        @media (max-width: 1023px) {
          .polyedge-fit-reference {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
        }

        .polyedge-true-fullscreen-final { display: none; }

        . {
          display: none !important;
        }

        @media (min-width: 1024px) {
          html:has(.polyedge-true-fullscreen),
          body:has(.polyedge-true-fullscreen),
          #root:has(.polyedge-true-fullscreen) {
            width: 100vw !important;
            height: 100dvh !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
            background: #000 !important;
          }

          body:has(.polyedge-true-fullscreen) {
            position: fixed !important;
            inset: 0 !important;
          }

          .polyedge-true-fullscreen {
            background:
              radial-gradient(circle at 25% 15%, rgba(34, 211, 238, .18), transparent 32%),
              radial-gradient(circle at 75% 35%, rgba(192, 38, 211, .16), transparent 35%),
              #000;
          }

          .polyedge-true-fullscreen .poly-final-glass {
            min-height: 0 !important;
          }

          .polyedge-true-fullscreen * {
            box-sizing: border-box;
          }
        }

        @media (max-width: 1023px) {
          .polyedge-true-fullscreen {
            position: relative !important;
            height: auto !important;
            min-height: 100dvh !important;
            overflow: visible !important;
          }
        }

        .polyedge-kiosk-final-fix { display: none; }

        . {
          display: none !important;
        }

        @media (min-width: 1024px) {
          html:has(.polyedge-kiosk-root),
          body.polyedge-kiosk-mode,
          body.polyedge-kiosk-mode #root {
            width: 100vw !important;
            height: 100dvh !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
            background: #000 !important;
          }

          body.polyedge-kiosk-mode {
            position: fixed !important;
            inset: 0 !important;
          }

          body.polyedge-kiosk-mode #root,
          body.polyedge-kiosk-mode #root *:has(.polyedge-kiosk-root) {
            transform: none !important;
            contain: none !important;
            perspective: none !important;
            filter: none !important;
          }

          body.polyedge-kiosk-mode .polyedge-kiosk-root {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2147483647 !important;
            width: 100vw !important;
            height: 100dvh !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            margin: 0 !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            background:
              radial-gradient(circle at 25% 15%, rgba(34, 211, 238, .18), transparent 32%),
              radial-gradient(circle at 75% 35%, rgba(192, 38, 211, .16), transparent 35%),
              #000 !important;
          }

          body.polyedge-kiosk-mode aside,
          body.polyedge-kiosk-mode [class*="Sidebar"],
          body.polyedge-kiosk-mode [class*="sidebar"] {
            pointer-events: none !important;
          }

          body.polyedge-kiosk-mode .polyedge-kiosk-root * {
            pointer-events: auto;
            box-sizing: border-box;
          }

          body.polyedge-kiosk-mode .polyedge-kiosk-root .poly-final-glass {
            min-height: 0 !important;
          }
        }

        @media (max-width: 1023px) {
          body.polyedge-kiosk-mode {
            position: static !important;
            overflow: auto !important;
          }

          .polyedge-kiosk-root {
            position: relative !important;
            height: auto !important;
            min-height: 100dvh !important;
            overflow: visible !important;
          }
        }

        .polyedge-fullscreen-page-final { display: none; }

        . {
          display: none !important;
        }

        .polyedge-fullscreen-page {
          background:
            radial-gradient(circle at 25% 15%, rgba(34, 211, 238, .18), transparent 32%),
            radial-gradient(circle at 75% 35%, rgba(192, 38, 211, .16), transparent 35%),
            #000;
        }

        @media (min-width: 1024px) {
          html,
          body,
          #root {
            width: 100vw;
            height: 100vh;
            overflow: hidden;
          }

          .polyedge-fullscreen-page {
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            overflow: hidden !important;
          }

          .polyedge-fullscreen-page .poly-final-glass {
            min-height: 0 !important;
          }
        }

        @media (max-width: 1023px) {
          html,
          body,
          #root {
            height: auto;
            overflow: auto;
          }

          .polyedge-fullscreen-page {
            width: 100%;
            min-height: 100vh;
            height: auto;
            max-height: none;
            overflow: visible;
          }
        }

        .polyedge-cockpit-only-final { display: none; }

        . {
          display: none !important;
        }

        .polyedge-fullscreen-page {
          background:
            radial-gradient(circle at 25% 15%, rgba(34, 211, 238, .18), transparent 32%),
            radial-gradient(circle at 75% 35%, rgba(192, 38, 211, .16), transparent 35%),
            #000 !important;
        }

        @media (min-width: 768px) {
          html:has(.polyedge-fullscreen-page),
          body:has(.polyedge-fullscreen-page),
          #root:has(.polyedge-fullscreen-page) {
            width: 100vw !important;
            height: 100dvh !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
            background: #000 !important;
          }

          body:has(.polyedge-fullscreen-page) {
            position: fixed !important;
            inset: 0 !important;
          }

          .polyedge-cockpit-only-stage {
            --polyedge-fit-scale: .78;
            width: calc(100vw / var(--polyedge-fit-scale)) !important;
            height: calc(100dvh / var(--polyedge-fit-scale)) !important;
            max-width: none !important;
            max-height: none !important;
            transform: scale(var(--polyedge-fit-scale));
            transform-origin: top left;
          }

          .polyedge-cockpit-only-stage .poly-final-glass {
            min-height: 0 !important;
          }
        }

        @media (min-width: 1400px) {
          .polyedge-cockpit-only-stage {
            --polyedge-fit-scale: .86;
          }
        }

        @media (max-width: 767px) {
          .polyedge-fullscreen-page {
            position: relative !important;
            height: auto !important;
            min-height: 100dvh !important;
            overflow: auto !important;
          }

          .polyedge-cockpit-only-stage {
            width: 100% !important;
            height: auto !important;
            transform: none !important;
          }

          html,
          body,
          #root {
            height: auto !important;
            overflow: auto !important;
          }
        }

        .polyedge-safe-fit-final { display: none; }

        @media (min-width: 768px) {
          html,
          body,
          #root {
            overflow: hidden !important;
            background: #000 !important;
          }

          .polyedge-safe-fit-page {
            --polyedge-safe-scale: .72;
            transform: scale(var(--polyedge-safe-scale));
            transform-origin: top left;
            width: calc(100vw / var(--polyedge-safe-scale)) !important;
            min-height: calc(100dvh / var(--polyedge-safe-scale)) !important;
            max-width: none !important;
            overflow: hidden !important;
          }

          .polyedge-safe-fit-page .poly-final-glass,
          .polyedge-safe-fit-page [class*="Holo"],
          .polyedge-safe-fit-page [class*="holo"] {
            min-height: 0 !important;
          }
        }

        @media (min-width: 1400px) {
          .polyedge-safe-fit-page {
            --polyedge-safe-scale: .78;
          }
        }

        @media (max-width: 767px) {
          .polyedge-safe-fit-page {
            transform: none !important;
            width: 100% !important;
            min-height: 100dvh !important;
            overflow: visible !important;
          }

          html,
          body,
          #root {
            overflow: auto !important;
          }
        }

        @keyframes poly-final-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>

      <div className="polyedge-safe-fit-page poly-final-root polyedge-cockpit-only-root h-screen w-screen overflow-hidden bg-black p-0 text-white">
        <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-cyan-400/30 bg-slate-950/70 px-2.5 py-1.5 backdrop-blur-xl lg:flex-nowrap">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-600 text-sm font-bold text-white shadow-[0_0_30px_rgba(103,232,249,.4)]">P/E</div>
              <div>
                <h1 className="text-sm font-bold tracking-tighter text-cyan-100 drop-shadow-[0_0_18px_rgba(103,232,249,.8)]">POLY//EDGE</h1>
                <p className="text-[10px] uppercase tracking-[4px] text-cyan-400">REAL DATA ONLY • NO SIMULATED VALUES</p>
              </div>
            </div>

            <div className="hidden gap-8 text-sm xl:flex">
              <div className="text-center">
                <div className="font-mono text-sm text-emerald-400">{apiTone.long}</div>
                <div className="text-[10px] text-gray-400">POLY API STATUS</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-sm font-bold text-white">{realMoney(metrics?.totalPnl)}</div>
                <div className="text-[10px] text-emerald-400">REAL TOTAL PNL</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-cyan-400">{realValue(lastRealCheck)}</div>
                <div className="text-[10px] text-purple-400">LAST REAL CHECK</div>
              </div>
            </div>

            <div className={`flex items-center gap-1.5 rounded-2xl border px-5 py-1.5 text-xs ${apiTone.border} bg-slate-950/60`}>
              <span className={`h-3 w-3 rounded-full ${apiTone.dot} animate-pulse`} />
              <span>{active} / {monitors.length || 0} MODULES LIVE</span>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-1.5 overflow-visible lg:grid-cols-12 lg:overflow-hidden">
            <div className="col-span-1 min-h-0 lg:col-span-2 lg:overflow-hidden">
              <QuantumGlass className="h-full">
                <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-cyan-400">Navigation</div>
                <ul className="space-y-1 text-[11px]">
                  {["Overview", "Markets", "Portfolio", "Agents", "Alpha Grid", "Risk Core"].map((x, i) => (
                    <li key={x} className={`cursor-pointer rounded-xl px-2.5 py-1.5 transition hover:bg-white/10 ${i === 0 ? "bg-white/5" : ""}`}>{x}</li>
                  ))}
                </ul>

                <div className="mt-2 grid grid-cols-1 gap-1.5">
                  {priority.map((m: any) => <MonitorTile key={m.key} monitor={m} />)}
                </div>
              </QuantumGlass>
            </div>

            <div className="col-span-1 grid min-h-0 gap-1.5 lg:col-span-7 lg:grid-rows-[1.1fr_.62fr_.9fr] lg:overflow-hidden">
              <QuantumGlass>
                <EquityPanel monitors={monitors} metrics={metrics} />
              </QuantumGlass>

              <div className="grid min-h-0 grid-cols-1 gap-1.5 sm:grid-cols-2">
                <QuantumGlass>
                  <MoneyFlowPanel />
                </QuantumGlass>

                <QuantumGlass>
                  <UniversePanel />
                </QuantumGlass>
              </div>

              <QuantumGlass>
                <QuantumTitle title="All PolyEdge Action Monitors" right={<span className="text-[9px] text-cyan-300">{monitors.length} modules</span>} />
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
                  {monitors.slice(0, 12).map((m: any) => <MonitorTile key={m.key} monitor={m} />)}
                </div>
              </QuantumGlass>
            </div>

            <div className="col-span-1 grid min-h-0 gap-1.5 lg:col-span-3 lg:grid-rows-[.7fr_.72fr_.95fr] lg:overflow-hidden">
              <QuantumGlass>
                <SentimentPanel monitors={monitors} />
              </QuantumGlass>

              <QuantumGlass>
                <AllocationPanel metrics={metrics} />
              </QuantumGlass>

              <QuantumGlass>
                <AlphaPanel monitors={systems.concat(markets)} />
              </QuantumGlass>
            </div>
          </div>

          <BottomStatusBar monitors={monitors} metrics={metrics} />
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
        "relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-black/55 p-2 shadow-[0_0_40px_rgba(34,240,255,0.12)] backdrop-blur",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.07),transparent)]",
        props.className || "",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between border-b border-cyan-400/15 pb-2">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] text-cyan-200">
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
  useEffect(() => {
    document.body.classList.add("polyedge-kiosk-mode");
    return () => document.body.classList.remove("polyedge-kiosk-mode");
  }, []);

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

  // STAGE_6Q_COCKPIT_ONLY_RETURN
  // Admin PolyEdge now renders the real cockpit only.
  // This keeps ECG/heartbeat logic but removes the old top/status page that was pushing the cockpit down.
  if (false) {
    return (
      <div className="polyedge-cockpit-only-root h-screen w-screen overflow-hidden bg-black p-0 text-white">
        <style>{`
          .polyedge-cockpit-only-root {
            background:
              radial-gradient(circle at 25% 15%, rgba(34, 211, 238, .18), transparent 32%),
              radial-gradient(circle at 75% 35%, rgba(192, 38, 211, .16), transparent 35%),
              #000;
          }

          html,
          body,
          #root {
            width: 100vw !important;
            height: 100vh !important;
            overflow: hidden !important;
            background: #000 !important;
          }

          . {
            display: none !important;
          }

          .polyedge-cockpit-only-root .poly-final-glass {
            min-height: 0 !important;
          }

          @media (max-width: 767px) {
            html,
            body,
            #root {
              height: auto !important;
              overflow: auto !important;
            }

            .polyedge-cockpit-only-root {
              height: auto !important;
              min-height: 100vh !important;
              overflow: auto !important;
            }
          }
        `}</style>

        <div className="grid h-full w-full grid-cols-12 gap-1 overflow-hidden p-1">
          <PolyEdgeActionMonitorGrid actionMonitor={actionMonitor} replayStatus={replayStatus} />
        </div>
      </div>
    );
  }


  return (
    <div className="polyedge-safe-fit-page min-h-screen overflow-hidden bg-[#01040a] text-cyan-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,240,255,0.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(255,0,170,0.12),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(255,110,0,0.10),transparent_35%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(34,240,255,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(34,240,255,.18)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="pointer-events-none fixed left-0 top-0 h-40 w-full animate-pulse bg-gradient-to-b from-cyan-300/10 to-transparent" />

      <div className="relative z-10 grid min-h-screen grid-cols-[84px_1fr]">
        <aside className="border-r border-cyan-400/20 bg-black/60 px-2.5 py-4">
          <div className="mb-2 flex h-14 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/5">
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

        <main className="relative overflow-y-auto p-2">
          <header className="mb-4 grid grid-cols-12 gap-1.5">
            <div className="col-span-12 rounded-2xl border border-cyan-400/30 bg-black/60 p-2 shadow-[0_0_50px_rgba(34,240,255,0.12)] xl:col-span-3">
              <div className="text-sm font-black tracking-[0.16em] text-cyan-200 drop-shadow-[0_0_16px_rgba(34,240,255,0.9)]">
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
            <div className="mb-4 rounded-2xl border border-red-400/40 bg-red-950/30 p-2 text-red-200">
              PolyEdge API error: {error}
            </div>
          ) : null}

          <section className="grid grid-cols-12 gap-2">
            <HoloPanel title="Hyperdimensional Equity Manifold" icon={TrendingUp} className=" col-span-12 xl:col-span-7">
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
              <div className="mt-1.5 grid grid-cols-5 gap-1.5 text-center">
                <Metric label="Trades" value={num(proof.totalTrades)} />
                <Metric label="Profit Factor" value={num(proof.profitFactor)} />
                <Metric label="Max Drawdown" value={num(proof.maxDrawdownPct, "%")} />
                <Metric label="Expectancy" value={money(proof.expectancy)} />
                <Metric label="Proof" value={proofPassed ? "PASSED" : "NOT YET"} good={proofPassed} />
              </div>
            </HoloPanel>

            <HoloPanel title="Quantum Market Sentiment Matrix" icon={Radar} className=" col-span-12 xl:col-span-3">
              <div className="flex h-[320px] flex-col items-center justify-center">
                <div className="relative h-52 w-52 rounded-full border border-cyan-300/30 bg-cyan-300/5 shadow-[0_0_45px_rgba(34,240,255,0.18)]">
                  <div className="absolute inset-8 rounded-full border border-fuchsia-300/25" />
                  <div className="absolute inset-16 rounded-full border border-orange-300/25" />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-300/25" />
                  <div className="absolute left-0 top-1/2 h-px w-full bg-cyan-300/25" />
                  <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300 shadow-[0_0_20px_rgba(255,0,170,0.9)]" />
                  <div className="absolute inset-10 animate-pulse rounded-[40%] border-2 border-cyan-300/50 bg-cyan-300/10" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <Metric label="Win Rate" value={num(proof.winRate, "%")} />
                  <Metric label="Losses" value={num(proof.losses)} />
                </div>
              </div>
            </HoloPanel>

            <HoloPanel title="Alpha Signals Feed" icon={Zap} className=" col-span-12 xl:col-span-2">
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

            {false ? (
              <HoloPanel title="Fast Paper Replay Factory" icon={Zap} className=" col-span-12 xl:col-span-3">
                <div className="mb-3 grid grid-cols-2 gap-1.5">
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

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={replayRunning}
                    onClick={() => runReplay(25)}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-40"
                  >
                    {replayRunning ? "Running" : "Run 25"}
                  </button>
                  <button
                    type="button"
                    disabled={replayRunning}
                    onClick={() => runReplay(50)}
                    className="rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-fuchsia-100 hover:bg-fuchsia-400/20 disabled:opacity-40"
                  >
                    {replayRunning ? "Running" : "Run 50"}
                  </button>
                </div>

                {replayMessage ? (
                  <div className="mt-1.5 rounded-xl border border-orange-300/20 bg-orange-400/5 p-2 text-[11px] text-orange-100/80">
                    {replayMessage}
                  </div>
                ) : null}

                <div className="mt-1.5 text-[10px] leading-relaxed text-cyan-100/45">
                  Paper replay only. Winning trades count toward 500. Losing trades still count against win rate, drawdown, profit factor, learning and promotion gates.
                </div>
              </HoloPanel>
            ) : null}

            <PolyEdgeActionMonitorGrid actionMonitor={actionMonitor} replayStatus={replayStatus} />

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

            <HoloPanel title="Neural Learning Core" icon={Brain} className=" col-span-12 xl:col-span-3">
              <div className="mb-3 grid grid-cols-2 gap-1.5">
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

            <HoloPanel title="Sentient Agent Mesh" icon={Brain} className=" col-span-12 xl:col-span-3">
              <Agent name="NEXORA" value={data?.nexora?.loopEnabled ? "ONLINE" : "STANDBY"} />
              <Agent name="PHANTOM X" value="PAPER MODE" />
              <Agent name="PROOF ENGINE" value={proofPassed ? "PASSED" : "LEARNING"} />
              <Agent name="LIVE EXECUTION" value={liveBlocked ? "BLOCKED" : "AUTHORIZED"} danger={liveBlocked} />
            </HoloPanel>

            <HoloPanel title="Capital Allocation // Real Paper Outcomes" icon={Cpu} className=" col-span-12 xl:col-span-3">
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

            <HoloPanel title="Risk Fortress Status" icon={Shield} className=" col-span-12 xl:col-span-3">
              <Risk label="Safe Mode" value={data?.runtime?.safeMode ? "ON" : "OFF"} good={data?.runtime?.safeMode !== false} />
              <Risk label="Emergency Stop" value={data?.runtime?.emergencyStop ? "ARMED" : "CLEAR"} good={!data?.runtime?.emergencyStop} />
              <Risk label="Live Kill Switch" value={data?.runtime?.liveTradingKillSwitch ? "ARMED" : "CLEAR"} good={!data?.runtime?.liveTradingKillSwitch} />
              <Risk label="Live Trading" value={liveBlocked ? "DISABLED" : "ENABLED"} good={liveBlocked} />
              <Risk label="Nexora Gate" value={data?.nexora?.gateRequired ? "REQUIRED" : "UNKNOWN"} good={data?.nexora?.gateRequired !== false} />
            </HoloPanel>

            <HoloPanel title="Decision Stream // Nexora Log" icon={Activity} className=" col-span-12 xl:col-span-3">
              <div className="space-y-2 text-xs">
                {outcomes.slice(0, 8).map((row: any, i: number) => (
                  <div key={row?.id || i} className="grid grid-cols-3 gap-1.5 border-b border-cyan-400/10 pb-1">
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

            <HoloPanel title="Customer Safety / Disclosure" icon={Eye} className=" col-span-12 !m-0 !p-0">
              <div className="grid gap-1.5 text-sm text-cyan-100/75 xl:grid-cols-3">
                <div>{data?.customerDisclaimer || "Paper trading intelligence only. Not financial advice."}</div>
                <div>All execution paths remain subject to Nexora governance and policy gates.</div>
                <div>Proof status: <span className={proofPassed ? "text-emerald-300" : "text-amber-300"}>{proofPassed ? "passed" : "not yet passed"}</span>. Live trading remains disabled.</div>
              </div>
            </HoloPanel>
          </section>

          <footer className="mt-2 overflow-hidden rounded-2xl border border-cyan-400/20 bg-black/70 p-3 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
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

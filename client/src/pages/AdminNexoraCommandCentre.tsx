import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Zap, Play, Square, RefreshCw, Clock, Activity, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Brain, TrendingUp, DollarSign,
  MessageSquare, Building2, MapPin, Info, Inbox,
  ThumbsUp, ThumbsDown, Radio, Sliders, BookOpen,
  Send, Database, Lock, Unlock, AlertOctagon, RotateCcw,
  HeartPulse, ListChecks, CheckCheck, BarChart3, History,
  Settings, ArrowUpRight, FileText,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoopStatus {
  enabled: boolean; running: boolean;
  status: "idle" | "running" | "success" | "failed";
  intervalMs: number; nextRunAt: string | null;
  lastStartedAt: string | null; lastFinishedAt: string | null;
  lastMessage: string; lastTrigger: "manual" | "auto" | null;
}

interface NexoraRun {
  id: number; startedAt: string; finishedAt: string | null;
  success: boolean; processed: number; outreachRuns: number;
  outreachFailed: number; radarSignals: number; dealSignals: number;
  message: string; durationMs: number; createdAt: string;
}

interface NexoraDecision {
  id: string; runId: string; signalId: string;
  companyName: string | null; signalType: string | null;
  action: string; priority: string; confidence: number;
  reasoning: string | null; autoApproved: boolean | null;
  pushedPipeline: boolean | null; pushedRadar: boolean | null;
  outreachQueued: boolean | null; anomalyFlagged: boolean | null;
  createdAt: string;
}

interface OutcomeStats {
  total: number; wins: number; losses: number; ignored: number;
  winRate: number; avgDeal: number; byOutcome: Record<string, number>;
  recent: Array<{ id: string; signalId: string; companyName: string | null; outcome: string; createdAt: string; dealValue: number | null }>;
}

interface NexoraThreshold {
  id: string; version: number; strongMove: number; criticalValue: number;
  highValue: number; bothMinValue: number; strongPipeline: number;
  highIntentMin: number; learningRate: number; changeReason: string | null;
  triggeredByOutcomes: number | null; winRate: number | null;
  isActive: boolean; createdAt: string;
}

interface KnowledgeEntry {
  id: string; entryKey: string; companyName: string; signalType: string;
  city: string; industry: string; action: string; priority: string;
  confidence: number; winRate: number; successCount: number;
  failCount: number; totalCount: number; lastUpdatedAt: string;
}

interface SignalSummary {
  totalActiveSignals: number; radarSignals: number; dealSignals: number;
  inboundLeadsThisWeek: number; newRadarSignalsThisWeek: number;
  highConfidence: number; mediumConfidence: number; lowConfidence: number;
  topSignalTypes: { type: string; count: number }[];
  topCities: { city: string; count: number }[];
}

interface PendingOutreach {
  id: number; companyName: string; contactName: string | null;
  phone: string; channel: string; messagePreview: string;
  createdAt: string; signalContext: string | null; priority: string;
}

interface NexoraRunResult {
  ok: boolean; runId: string; trigger: string;
  startedAt: string; finishedAt: string;
  totals: { scanned: number; valid: number; invalid: number; duplicates: number; aiCallsUsed: number; pushedPipeline: number; pushedRadar: number; webhooksSent: number; whatsappSent: number; vectorsSynced: number; reviewed: number };
  learning: { sampleSize: number; avgWinRate: number; appliedDeltaStrongPipeline: number; maxDriftPerRun: number };
  errors: string[];
}

interface HealthCheck {
  healthy: boolean; status: "healthy" | "degraded" | "critical";
  failCount: number; passCount: number; checkedAt: string;
  checks: Record<string, { pass: boolean; detail: string }>;
}

interface RuntimeState {
  isLocked: boolean;
  activeLock: { id: number; lockKey: string; runId: string; acquiredAt: string; expiresAt: string | null } | null;
  loopEnabled: boolean; loopRunning: boolean; loopIntervalMs: number;
  loopRunCount: number; loopLastRunAt: string | null; loopLastError: string | null;
  lastRunResult: { success: boolean; message: string; totals?: { scanned: number; pushedPipeline: number; pushedRadar: number } } | null;
  bgLastRunId: string | null; bgLastStartedAt: string | null;
  bgLastFinishedAt: string | null; bgLastError: string | null;
  failedJobs: { name: string; state: string; retryCount: number; createdOn: string }[];
  failedJobCount: number; retryJobCount: number; approvalQueueCount: number;
  latestRunId: string | null; latestRunDecisions: NexoraDecision[];
}

interface FinancialSummary {
  generatedAt: string;
  pipeline: {
    totalOpportunities: number; openOpportunities: number; wonOpportunities: number;
    totalPipelineValue: number; wonValue: number;
    topOpportunities: { id: string; companyName: string; stage: string; estimatedValue: number; createdAt: string }[];
  };
  outcomes: {
    totalWins: number; totalLosses: number; winRate: number;
    avgDealValue: number; revenueThisMonth: number;
  };
  quotes: { totalQuotes: number; acceptedQuotes: number; totalQuoteValue: number; avgQuoteValue: number };
  signals: { total: number; todayCount: number; thisWeekCount: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function fmt$(v: number) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v.toLocaleString()}`;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function actionBadge(action: string) {
  if (action === "push_pipeline" || action === "pipeline" || action === "both")
    return "bg-blue-500/15 text-blue-300 border-blue-500/25";
  if (action === "push_radar" || action === "radar")
    return "bg-purple-500/15 text-purple-300 border-purple-500/25";
  if (action === "review")
    return "bg-yellow-500/15 text-yellow-300 border-yellow-500/25";
  return "bg-white/8 text-white/35 border-white/10";
}

function actionLabel(action: string) {
  if (action === "push_pipeline") return "pipeline";
  if (action === "push_radar") return "radar";
  return action;
}

function signalTypeBadge(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("reloc") || t.includes("move")) return "bg-red-500/10 text-red-300 border-red-500/20";
  if (t.includes("expan") || t.includes("growth") || t.includes("hiring")) return "bg-orange-500/10 text-orange-300 border-orange-500/20";
  if (t.includes("lease") || t.includes("property")) return "bg-blue-500/10 text-blue-300 border-blue-500/20";
  if (t.includes("fund") || t.includes("invest")) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  return "bg-white/8 text-white/35 border-white/10";
}

const GOLD = "hsl(43,78%,52%)";
const TABS = ["Overview", "Finance", "Signals", "Decisions", "Actions", "Reviews", "Outcomes", "Runtime", "Settings"] as const;
type Tab = typeof TABS[number];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminNexoraCommandCentre() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");
  const [intervalInput, setIntervalInput] = useState("30");
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({
    signalId: "", companyName: "", outcome: "won",
    channel: "email", dealValue: "", notes: "",
  });
  const [lastRunResult, setLastRunResult] = useState<NexoraRunResult | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: loopStatus } = useQuery<LoopStatus>({
    queryKey: ["/api/nexora/loop/status"],
    refetchInterval: 5000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<NexoraRun[]>({
    queryKey: ["/api/nexora/history"],
    refetchInterval: 15000,
  });

  const { data: decisions, isLoading: decisionsLoading } = useQuery<{ decisions: NexoraDecision[]; total: number }>({
    queryKey: ["/api/nexora/decisions"],
    refetchInterval: 30000,
  });

  const { data: outcomeStats } = useQuery<OutcomeStats>({
    queryKey: ["/api/nexora/outcomes/stats"],
    refetchInterval: 60000,
  });

  const { data: thresholdsData } = useQuery<{ current: NexoraThreshold | null; history: NexoraThreshold[] }>({
    queryKey: ["/api/nexora/thresholds/current"],
    refetchInterval: 120000,
  });

  const { data: signalSummary } = useQuery<SignalSummary>({
    queryKey: ["/api/nexora/signals/summary"],
    refetchInterval: 120000,
  });

  const { data: pendingOutreach, isLoading: outreachLoading } = useQuery<{ pending: PendingOutreach[]; total: number }>({
    queryKey: ["/api/nexora/outreach/pending"],
    refetchInterval: 30000,
  });

  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery<{ entries: KnowledgeEntry[]; total: number }>({
    queryKey: ["/api/nexora/knowledge"],
    refetchInterval: 120000,
  });

  const { data: runtimeState, isLoading: runtimeLoading } = useQuery<RuntimeState>({
    queryKey: ["/api/nexora/runtime-state"],
    refetchInterval: 8000,
  });

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthCheck>({
    queryKey: ["/api/nexora/health"],
    refetchInterval: 30000,
  });

  const { data: financialSummary, isLoading: financeLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/nexora/financial-summary"],
    refetchInterval: 60000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/nexora/run"),
    onSuccess: (data: NexoraRunResult) => {
      setLastRunResult(data);
      const t = data.totals;
      toast({
        title: data.ok ? "Nexora run complete" : "Nexora run finished with errors",
        description: `Scanned ${t.scanned} · ${t.pushedPipeline} pipeline · ${t.pushedRadar} radar`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/decisions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/signals/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/runtime-state"] });
    },
    onError: (err: any) => toast({ title: "Run failed", description: err?.message, variant: "destructive" }),
  });

  const startLoopMutation = useMutation({
    mutationFn: (intervalMs: number) => apiRequest("POST", "/api/nexora/loop/start", { intervalMs }),
    onSuccess: () => {
      toast({ title: "Automation enabled" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
    },
  });

  const stopLoopMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/nexora/loop/stop"),
    onSuccess: () => {
      toast({ title: "Automation paused" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
    },
  });

  const configMutation = useMutation({
    mutationFn: (intervalMs: number) => apiRequest("PATCH", "/api/nexora/loop/config", { intervalMs }),
    onSuccess: () => {
      toast({ title: "Interval updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
    },
  });

  const recordOutcomeMutation = useMutation({
    mutationFn: (data: typeof outcomeForm) => apiRequest("POST", "/api/nexora/outcomes", {
      ...data, dealValue: data.dealValue ? Number(data.dealValue) : undefined,
    }),
    onSuccess: () => {
      toast({ title: "Outcome recorded", description: "Nexora will recalibrate thresholds from this feedback." });
      setShowOutcomeForm(false);
      setOutcomeForm({ signalId: "", companyName: "", outcome: "won", channel: "email", dealValue: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/outcomes/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/thresholds/current"] });
    },
    onError: (err: any) => toast({ title: "Failed to record outcome", description: err?.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      apiRequest("PATCH", `/api/nexora/outreach/${id}/approve`, { action }),
    onSuccess: (_data, { action }) => {
      toast({ title: action === "approve" ? "Outreach approved" : "Outreach rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/outreach/pending"] });
    },
  });

  const batchApproveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/nexora/outreach/approve-batch", { riskLevel: "low" }),
    onSuccess: (data: any) => {
      toast({ title: `Batch approved ${data.approved} messages`, description: `${data.remaining} still pending.` });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/outreach/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/runtime-state"] });
    },
    onError: (err: any) => toast({ title: "Batch approve failed", description: err?.message, variant: "destructive" }),
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const isRunning = runMutation.isPending || runtimeState?.loopRunning;
  const isLocked = runtimeState?.isLocked ?? false;
  const failedJobs = runtimeState?.failedJobCount ?? 0;
  const pendingApprovals = runtimeState?.approvalQueueCount ?? 0;
  const todayDecisions = decisions?.decisions ?? [];
  const pushedRadarToday = todayDecisions.filter(d => d.pushedRadar).length;
  const pushedPipelineToday = todayDecisions.filter(d => d.pushedPipeline).length;
  const executedActions = todayDecisions.filter(d => d.pushedRadar || d.pushedPipeline);

  // Alert conditions
  const hasAlert = isLocked || failedJobs > 0 || pendingApprovals > 20;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">

      {/* ── Header ── */}
      <div className="border-b border-white/8 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h1 className="text-lg font-light text-white">Nexora</h1>
            <span className="text-white/20 text-sm">·</span>
            <span className="text-white/35 text-xs">signal → decision → action → outcome → learning</span>
            {isRunning && (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse text-[10px]">
                <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> Running
              </Badge>
            )}
            {hasAlert && !isRunning && (
              <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Alert
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {loopStatus?.enabled ? (
              <Button
                onClick={() => stopLoopMutation.mutate()}
                disabled={stopLoopMutation.isPending}
                data-testid="button-loop-pause"
                variant="outline"
                className="border-white/15 text-white/50 hover:bg-white/5 rounded-none text-sm"
              >
                {stopLoopMutation.isPending
                  ? <><Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" /> Pausing...</>
                  : <><Square className="mr-2 w-3.5 h-3.5" /> Pause Automation</>}
              </Button>
            ) : (
              <Button
                onClick={() => startLoopMutation.mutate(Number(intervalInput) * 60000)}
                disabled={startLoopMutation.isPending}
                data-testid="button-loop-resume"
                variant="outline"
                className="border-white/15 text-white/50 hover:bg-white/5 rounded-none text-sm"
              >
                {startLoopMutation.isPending
                  ? <><Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" /> Starting...</>
                  : <><Play className="mr-2 w-3.5 h-3.5" /> Resume Automation</>}
              </Button>
            )}
            <Button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              data-testid="button-nexora-run"
              className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none"
            >
              {runMutation.isPending
                ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Running...</>
                : <><Zap className="mr-2 w-4 h-4" /> Run Nexora</>}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Last Run Result Banner ── */}
      {lastRunResult && (
        <div className={`px-6 py-3 border-b ${lastRunResult.ok ? "border-[hsl(43,78%,52%)]/15 bg-[hsl(43,78%,52%)]/5" : "border-red-500/20 bg-red-500/5"}`}>
          <div className="max-w-6xl mx-auto flex items-center gap-6 text-xs">
            {lastRunResult.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
              : <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
            <span className="text-white/50 font-mono">Run {lastRunResult.runId.slice(0, 8)}…</span>
            <span className="text-white/40">{lastRunResult.totals.scanned} scanned</span>
            <span className="text-blue-300 font-medium">{lastRunResult.totals.pushedPipeline} → pipeline</span>
            <span className="text-purple-300 font-medium">{lastRunResult.totals.pushedRadar} → radar</span>
            <span className="text-white/30">{lastRunResult.totals.aiCallsUsed} AI calls</span>
            {lastRunResult.errors.length > 0 && (
              <span className="text-red-300/70 truncate">{lastRunResult.errors[0]}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="border-b border-white/8 px-6">
        <div className="max-w-6xl mx-auto flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              data-testid={`tab-${t.toLowerCase()}`}
              className={`px-4 py-3 text-xs uppercase tracking-wide whitespace-nowrap transition-colors border-b-2 ${
                tab === t
                  ? "border-[hsl(43,78%,52%)] text-[hsl(43,78%,52%)]"
                  : "border-transparent text-white/35 hover:text-white/60"
              }`}
            >
              {t}
              {t === "Reviews" && pendingApprovals > 0 && (
                <span className="ml-1.5 bg-yellow-500/20 text-yellow-300 text-[9px] px-1.5 py-0.5 rounded-full">{pendingApprovals}</span>
              )}
              {t === "Runtime" && failedJobs > 0 && (
                <span className="ml-1.5 bg-red-500/20 text-red-300 text-[9px] px-1.5 py-0.5 rounded-full">{failedJobs}</span>
              )}
            </button>
          ))}
          <Link href="/admin/nexora/advanced" className="ml-auto px-4 py-3 text-xs text-white/20 hover:text-white/40 flex items-center gap-1 whitespace-nowrap">
            Advanced <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ════════════════ OVERVIEW ════════════════ */}
        {tab === "Overview" && (
          <div className="space-y-5">

            {/* Section 1: System Status */}
            <div className="border border-white/8 bg-white/[0.02]">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                <span className="text-sm font-medium text-white">System Status</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
                <div className="px-5 py-4">
                  <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">Automation</div>
                  <div className={`text-base font-light mb-1 ${loopStatus?.enabled ? "text-green-400" : "text-white/40"}`}>
                    {loopStatus?.enabled ? "ON" : "OFF"}
                  </div>
                  {loopStatus?.enabled && (
                    <div className="text-[10px] text-white/25">Every {Math.round((loopStatus.intervalMs) / 60000)}min · {runtimeState?.loopRunCount ?? 0} runs</div>
                  )}
                </div>
                <div className="px-5 py-4">
                  <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">Last Run</div>
                  <div className="text-base font-light text-white mb-1">{timeAgo(loopStatus?.lastFinishedAt ?? null)}</div>
                  <div className={`text-[10px] ${loopStatus?.status === "failed" ? "text-red-400" : loopStatus?.status === "success" ? "text-green-400/60" : "text-white/25"}`}>
                    {loopStatus?.status ?? "idle"}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">Engine Lock</div>
                  <div className={`text-base font-light mb-1 flex items-center gap-1.5 ${isLocked ? "text-orange-400" : "text-white/40"}`}>
                    {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {isLocked ? "Locked" : "Free"}
                  </div>
                  {isLocked && runtimeState?.activeLock && (
                    <div className="text-[10px] text-white/25 truncate">{runtimeState.activeLock.lockKey}</div>
                  )}
                </div>
                <div className="px-5 py-4">
                  <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">Errors</div>
                  <div className={`text-base font-light mb-1 ${failedJobs > 0 ? "text-red-400" : "text-white/40"}`}>
                    {failedJobs} failed jobs
                  </div>
                  {runtimeState?.retryJobCount != null && runtimeState.retryJobCount > 0 && (
                    <div className="text-[10px] text-yellow-400/60">{runtimeState.retryJobCount} retrying</div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Execution Summary */}
            <div className="border border-white/8 bg-white/[0.02]">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                <span className="text-sm font-medium text-white">Execution Summary</span>
                {runtimeLoading && <Loader2 className="w-3 h-3 animate-spin text-white/30 ml-1" />}
                <span className="ml-auto text-[10px] text-white/20">Live · 8s refresh</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
                {[
                  { label: "Pushed to Radar", value: pushedRadarToday, color: "text-purple-300" },
                  { label: "Pushed to Pipeline", value: pushedPipelineToday, color: "text-blue-300" },
                  { label: "Total Decisions", value: decisions?.total ?? "—", color: "text-white" },
                  { label: "Failed Jobs", value: failedJobs, color: failedJobs > 0 ? "text-red-400" : "text-white/40" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-5 py-4 text-center">
                    <div className={`text-2xl font-light mb-1 ${color}`}>{value}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Bottlenecks */}
            <div className="border border-white/8 bg-white/[0.02]">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-white/40" />
                <span className="text-sm font-medium text-white">Bottlenecks</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
                {[
                  { label: "Pending Approvals", value: pendingApprovals, color: pendingApprovals > 0 ? "text-yellow-400" : "text-white/40", action: () => setTab("Reviews") },
                  { label: "Failed Jobs", value: failedJobs, color: failedJobs > 0 ? "text-red-400" : "text-white/40", action: () => setTab("Runtime") },
                  { label: "Retrying Jobs", value: runtimeState?.retryJobCount ?? 0, color: (runtimeState?.retryJobCount ?? 0) > 0 ? "text-yellow-400" : "text-white/40", action: null },
                  { label: "Outcomes Recorded", value: outcomeStats?.total ?? 0, color: "text-white/60", action: () => setTab("Outcomes") },
                ].map(({ label, value, color, action }) => (
                  <div
                    key={label}
                    className={`px-5 py-4 text-center ${action ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
                    onClick={() => action?.()}
                  >
                    <div className={`text-2xl font-light mb-1 ${color}`}>{value}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wide">{label}</div>
                    {action && <div className="text-[9px] text-white/20 mt-0.5">click to view →</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Alerts */}
            {(isLocked || failedJobs > 0 || pendingApprovals > 20 || loopStatus?.status === "failed") ? (
              <div className="border border-red-500/20 bg-red-500/[0.04] px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-white">Active Alerts</span>
                </div>
                <div className="space-y-2">
                  {isLocked && <p className="text-xs text-red-300">Engine lock active — run may be stuck. Check Runtime tab.</p>}
                  {failedJobs > 0 && <p className="text-xs text-red-300">{failedJobs} failed jobs detected. Check Runtime tab.</p>}
                  {pendingApprovals > 20 && <p className="text-xs text-yellow-300">{pendingApprovals} outreach messages awaiting approval — backlog building. Review or batch approve.</p>}
                  {loopStatus?.status === "failed" && <p className="text-xs text-red-300">Last automation run failed: {loopStatus.lastMessage}</p>}
                </div>
              </div>
            ) : (
              <div className="border border-green-500/15 bg-green-500/[0.03] px-5 py-4 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-400/80">No alerts — system operating normally</span>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ SIGNALS ════════════════ */}
        {tab === "Signals" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Signal Intelligence
              </h2>
              <span className="text-xs text-white/25">{signalSummary?.totalActiveSignals ?? 0} active signals</span>
            </div>
            {signalSummary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {[
                    { label: "Radar", value: signalSummary.radarSignals, color: "text-blue-300" },
                    { label: "Deal", value: signalSummary.dealSignals, color: "text-orange-300" },
                    { label: "Leads (7d)", value: signalSummary.inboundLeadsThisWeek, color: "text-purple-300" },
                    { label: "New (7d)", value: signalSummary.newRadarSignalsThisWeek, color: "text-[hsl(43,78%,52%)]" },
                    { label: "High Conf.", value: signalSummary.highConfidence, color: "text-green-300" },
                    { label: "Medium Conf.", value: signalSummary.mediumConfidence, color: "text-yellow-300" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center p-4 border border-white/5 bg-white/[0.015]">
                      <div className={`text-2xl font-light ${color}`}>{value}</div>
                      <div className="text-[10px] text-white/30 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-5 p-5 border border-white/5 bg-white/[0.01]">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Top Signal Types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {signalSummary.topSignalTypes.map(({ type, count }) => (
                        <span key={type} className={`text-[10px] px-2 py-0.5 border ${signalTypeBadge(type)}`}>{type} ({count})</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Top Cities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {signalSummary.topCities.map(({ city, count }) => (
                        <span key={city} className="text-[10px] px-2 py-0.5 border bg-white/5 text-white/40 border-white/10">{city} ({count})</span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-white/25 text-sm border border-white/5">
                No signal data. Run Nexora to process signals.
              </div>
            )}
          </div>
        )}

        {/* ════════════════ DECISIONS ════════════════ */}
        {tab === "Decisions" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-medium text-white">Brain Decisions</h2>
              <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-[9px] ml-1">{decisions?.total ?? 0} total</Badge>
              <span className="ml-auto text-xs text-white/25">Latest 20 shown</span>
            </div>
            {decisionsLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/30 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading decisions...
              </div>
            ) : !decisions?.decisions.length ? (
              <div className="py-12 text-center border border-white/5 text-white/25 text-sm">
                No decisions yet. Run Nexora to process signals.
              </div>
            ) : (
              <div className="space-y-1.5">
                {decisions.decisions.slice(0, 20).map((d) => (
                  <div key={d.id} data-testid={`row-decision-${d.id}`} className="flex items-start gap-3 px-4 py-3 border border-white/5 hover:border-white/10 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white/80 font-medium">{d.companyName ?? "Unknown"}</span>
                        {d.signalType && (
                          <Badge className={`text-[9px] px-1.5 h-4 ${signalTypeBadge(d.signalType)}`}>{d.signalType}</Badge>
                        )}
                      </div>
                      {d.reasoning && <p className="text-[10px] text-white/30 truncate">{d.reasoning}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-[9px] px-1.5 h-4 capitalize ${actionBadge(d.action)}`}>{actionLabel(d.action)}</Badge>
                      <Badge className={`text-[9px] px-1.5 h-4 capitalize ${
                        d.priority === "critical" ? "bg-red-500/15 text-red-300 border-red-500/25" :
                        d.priority === "high" ? "bg-orange-500/15 text-orange-300 border-orange-500/25" :
                        d.priority === "medium" ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" :
                        "bg-white/8 text-white/35 border-white/10"
                      }`}>{d.priority}</Badge>
                      <span className="text-white/30 w-7 text-right">{Math.round((d.confidence ?? 0) * 100)}%</span>
                      {d.pushedPipeline && <span className="text-[9px] px-1 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20">pipe</span>}
                      {d.pushedRadar && <span className="text-[9px] px-1 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20">radar</span>}
                      <span className="text-white/20 text-[10px]">{timeAgo(d.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ ACTIONS ════════════════ */}
        {tab === "Actions" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-sm font-medium text-white">Executed Actions</h2>
              <Badge className="bg-white/8 text-white/40 border-white/10 text-[9px] ml-1">{executedActions.length} executed</Badge>
              <span className="ml-auto text-xs text-white/25">Decisions where an action was taken</span>
            </div>
            {decisionsLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/30 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading actions...
              </div>
            ) : !executedActions.length ? (
              <div className="py-12 text-center border border-white/5 text-white/25 text-sm">
                No actions executed yet. Run Nexora to process signals and push to radar or pipeline.
              </div>
            ) : (
              <div className="space-y-1.5">
                {executedActions.map((d) => (
                  <div key={d.id} data-testid={`row-action-${d.id}`} className="flex items-center gap-3 px-4 py-3 border border-white/5 hover:border-white/10 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-white/80 font-medium">{d.companyName ?? "Unknown"}</span>
                      {d.signalType && <span className="text-white/30 ml-2">{d.signalType}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {d.pushedPipeline && (
                        <span className="text-[9px] px-2 py-0.5 bg-blue-500/15 text-blue-300 border border-blue-500/25">→ Pipeline</span>
                      )}
                      {d.pushedRadar && (
                        <span className="text-[9px] px-2 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/25">→ Radar</span>
                      )}
                      <span className="text-white/25">{Math.round((d.confidence ?? 0) * 100)}% conf</span>
                      <span className="text-white/20 text-[10px]">{timeAgo(d.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ REVIEWS ════════════════ */}
        {tab === "Reviews" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-medium text-white">Outreach Approval Queue</h2>
              {pendingOutreach && pendingOutreach.total > 0 && (
                <Badge className="bg-yellow-500/15 text-yellow-300 border-yellow-500/25 ml-1">{pendingOutreach.total}</Badge>
              )}
              <Button
                onClick={() => batchApproveMutation.mutate()}
                disabled={batchApproveMutation.isPending || pendingApprovals === 0}
                size="sm"
                data-testid="button-batch-approve"
                className="ml-auto h-7 text-[10px] bg-yellow-700/20 hover:bg-yellow-700/35 text-yellow-300 border border-yellow-700/30 rounded-none"
              >
                {batchApproveMutation.isPending
                  ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Approving…</>
                  : <><CheckCheck className="w-3 h-3 mr-1" /> Approve All Low-Risk</>}
              </Button>
            </div>
            {outreachLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/30 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading queue...
              </div>
            ) : !pendingOutreach?.pending?.length ? (
              <div className="py-12 text-center border border-white/5 text-white/25 text-sm">
                Queue clear — no outreach pending approval.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingOutreach.pending.map((msg) => (
                  <div key={msg.id} data-testid={`card-outreach-${msg.id}`} className="p-4 border border-white/6 bg-white/[0.02]">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-4 h-4 text-yellow-400/60 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">{msg.companyName}</span>
                          {msg.contactName && <span className="text-xs text-white/40">· {msg.contactName}</span>}
                          <Badge className={`text-[9px] px-1.5 py-0 h-4 capitalize ml-auto ${msg.priority === "high" ? "bg-red-500/15 text-red-300 border-red-500/20" : "bg-white/5 text-white/30 border-white/8"}`}>
                            {msg.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-white/50 mb-1 line-clamp-2">{msg.messagePreview}</p>
                        {msg.signalContext && (
                          <p className="text-[10px] text-[hsl(43,78%,52%)]/50 flex items-center gap-1">
                            <Info className="w-2.5 h-2.5" /> {msg.signalContext}
                          </p>
                        )}
                        <p className="text-[10px] text-white/25 mt-1">{msg.phone} · {timeAgo(msg.createdAt)}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" onClick={() => approveMutation.mutate({ id: msg.id, action: "approve" })}
                          disabled={approveMutation.isPending} data-testid={`button-approve-outreach-${msg.id}`}
                          className="bg-green-700/30 hover:bg-green-700/50 text-green-300 border border-green-700/40 rounded-none h-7 text-xs">
                          <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" onClick={() => approveMutation.mutate({ id: msg.id, action: "reject" })}
                          disabled={approveMutation.isPending} data-testid={`button-reject-outreach-${msg.id}`}
                          variant="outline" className="border-red-700/40 text-red-300 hover:bg-red-700/20 rounded-none h-7 text-xs">
                          <ThumbsDown className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ OUTCOMES ════════════════ */}
        {tab === "Outcomes" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-medium text-white">Outcome Intelligence</h2>
              <span className="ml-auto text-xs text-white/25">Closed-loop learning</span>
              <Button size="sm" onClick={() => setShowOutcomeForm(!showOutcomeForm)}
                data-testid="button-record-outcome"
                className="ml-2 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 border border-emerald-700/40 rounded-none h-7 text-xs">
                <Send className="w-3 h-3 mr-1" /> Record Outcome
              </Button>
            </div>

            {showOutcomeForm && (
              <div className="p-4 border border-emerald-500/20 bg-emerald-900/10 space-y-3">
                <p className="text-xs text-white/40">Record a sales outcome to train Nexora's adaptive thresholds</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Signal ID *", field: "signalId", placeholder: "signal id...", testId: "input-outcome-signal-id" },
                    { label: "Company", field: "companyName", placeholder: "company name...", testId: "input-outcome-company" },
                    { label: "Deal Value ($)", field: "dealValue", placeholder: "e.g. 85000", testId: "input-outcome-deal-value", type: "number" },
                    { label: "Notes", field: "notes", placeholder: "optional notes...", testId: "input-outcome-notes" },
                  ].map(({ label, field, placeholder, testId, type }) => (
                    <div key={field}>
                      <label className="block text-[10px] text-white/30 uppercase mb-1">{label}</label>
                      <input type={type ?? "text"} data-testid={testId}
                        className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                        placeholder={placeholder}
                        value={(outcomeForm as any)[field]}
                        onChange={e => setOutcomeForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] text-white/30 uppercase mb-1">Outcome *</label>
                    <select data-testid="select-outcome-type"
                      className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none"
                      value={outcomeForm.outcome} onChange={e => setOutcomeForm(f => ({ ...f, outcome: e.target.value }))}>
                      {["won","lost","replied","ignored","bounced","meeting_booked","no_response"].map(o => (
                        <option key={o} value={o} className="bg-black">{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/30 uppercase mb-1">Channel</label>
                    <select data-testid="select-outcome-channel"
                      className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none"
                      value={outcomeForm.channel} onChange={e => setOutcomeForm(f => ({ ...f, channel: e.target.value }))}>
                      {["email","whatsapp","phone","in_person"].map(c => (
                        <option key={c} value={c} className="bg-black">{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={!outcomeForm.signalId || recordOutcomeMutation.isPending}
                    onClick={() => recordOutcomeMutation.mutate(outcomeForm)} data-testid="button-submit-outcome"
                    className="bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-200 border border-emerald-600/40 rounded-none h-7 text-xs">
                    {recordOutcomeMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving...</> : "Submit"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowOutcomeForm(false)} className="text-white/30 rounded-none h-7 text-xs">Cancel</Button>
                </div>
              </div>
            )}

            {outcomeStats && outcomeStats.total > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "Total", value: outcomeStats.total, color: "text-white", icon: BarChart3 },
                    { label: "Wins", value: outcomeStats.wins, color: "text-emerald-400", icon: CheckCircle2 },
                    { label: "Losses", value: outcomeStats.losses, color: "text-red-400", icon: XCircle },
                    { label: "Win Rate", value: `${(outcomeStats.winRate * 100).toFixed(0)}%`, color: outcomeStats.winRate >= 0.5 ? "text-emerald-400" : "text-yellow-400", icon: TrendingUp },
                    { label: "Avg Deal", value: outcomeStats.avgDeal > 0 ? fmt$(outcomeStats.avgDeal) : "—", color: "text-[hsl(43,78%,52%)]", icon: DollarSign },
                  ].map(({ label, value, color, icon: Icon }) => (
                    <div key={label} data-testid={`stat-outcome-${label.toLowerCase().replace(/ /g, "-")}`}
                      className="p-4 border border-white/5 bg-white/[0.015] text-center">
                      <Icon className="w-3.5 h-3.5 text-white/25 mx-auto mb-1" />
                      <div className={`text-xl font-light ${color}`}>{value}</div>
                      <div className="text-[9px] text-white/30 uppercase tracking-wide mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
                {outcomeStats.recent.length > 0 && (
                  <div className="border border-white/5 bg-white/[0.01]">
                    <div className="px-4 py-2 border-b border-white/5">
                      <span className="text-[10px] text-white/30 uppercase tracking-wide">Recent Outcomes</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {outcomeStats.recent.slice(0, 8).map((o) => (
                        <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                          <Badge className={`text-[9px] px-1.5 h-4 flex-shrink-0 ${
                            ["won","meeting_booked","replied"].includes(o.outcome) ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" :
                            ["lost","bounced"].includes(o.outcome) ? "bg-red-500/15 text-red-300 border-red-500/25" :
                            "bg-white/8 text-white/35 border-white/10"
                          }`}>{o.outcome}</Badge>
                          <span className="text-white/60 flex-1 truncate">{o.companyName ?? "Unknown"}</span>
                          {o.dealValue && <span className="text-[hsl(43,78%,52%)] text-[10px]">{fmt$(o.dealValue)}</span>}
                          <span className="text-white/25 text-[10px]">{timeAgo(o.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-white/25 text-sm border border-white/5">
                No outcomes recorded. Use "Record Outcome" to start training Nexora.
              </div>
            )}
          </div>
        )}

        {/* ════════════════ RUNTIME ════════════════ */}
        {tab === "Runtime" && (
          <div className="space-y-5">

            {/* Health Scorecard */}
            <div className="border border-white/8 bg-white/[0.02]">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                <h2 className="text-sm font-medium text-white">System Health</h2>
                {healthData && (
                  <Badge className={`ml-2 text-[10px] px-2 h-5 ${
                    healthData.status === "healthy" ? "bg-green-500/15 text-green-300 border-green-500/25" :
                    healthData.status === "degraded" ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" :
                    "bg-red-500/15 text-red-300 border-red-500/25"
                  }`}>{healthData.status.toUpperCase()} — {healthData.passCount}/{healthData.passCount + healthData.failCount} pass</Badge>
                )}
                <Button onClick={() => refetchHealth()} size="sm" variant="ghost" data-testid="button-health-refresh"
                  className="ml-auto h-7 px-2 text-white/30 hover:text-white/60 hover:bg-white/5">
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
              {healthLoading ? (
                <div className="p-6 text-center text-white/30 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking…
                </div>
              ) : healthData ? (
                <div className="divide-y divide-white/5">
                  {Object.entries(healthData.checks).map(([key, check]) => (
                    <div key={key} data-testid={`health-check-${key}`} className="flex items-start gap-3 px-5 py-2.5">
                      {check.pass
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono text-white/50">{key}</span>
                        <p className="text-[10px] text-white/30 mt-0.5">{check.detail}</p>
                      </div>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 border flex-shrink-0 ${
                        check.pass ? "border-green-500/20 text-green-400 bg-green-500/5" : "border-red-500/20 text-red-400 bg-red-500/5"
                      }`}>{check.pass ? "PASS" : "FAIL"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-white/25 text-sm">Health data unavailable</div>
              )}
              <div className="flex items-center gap-3 px-5 py-3 border-t border-white/5 bg-white/[0.01]">
                <ListChecks className="w-3.5 h-3.5 text-white/30" />
                <span className="text-xs text-white/40">Outreach Queue</span>
                <span className={`text-xs font-medium ${pendingApprovals > 0 ? "text-yellow-300" : "text-white/30"}`}>{pendingApprovals} pending</span>
                <Button onClick={() => batchApproveMutation.mutate()} disabled={batchApproveMutation.isPending || pendingApprovals === 0}
                  size="sm" data-testid="button-batch-approve-runtime"
                  className="ml-auto h-7 text-[10px] bg-yellow-700/20 hover:bg-yellow-700/35 text-yellow-300 border border-yellow-700/30 rounded-none">
                  {batchApproveMutation.isPending
                    ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Approving…</>
                    : <><CheckCheck className="w-3 h-3 mr-1" /> Approve Low-Risk Drafts</>}
                </Button>
              </div>
            </div>

            {/* Jobs */}
            <div className="border border-white/8 bg-white/[0.02]">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-white/40" />
                <h2 className="text-sm font-medium text-white">Jobs</h2>
                {runtimeLoading && <Loader2 className="w-3 h-3 animate-spin text-white/30" />}
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/5">
                <div className="px-5 py-3 text-center">
                  <div className={`text-xl font-light mb-1 ${failedJobs > 0 ? "text-red-400" : "text-white/40"}`}>{failedJobs}</div>
                  <div className="text-[10px] text-white/25">Failed</div>
                </div>
                <div className="px-5 py-3 text-center">
                  <div className={`text-xl font-light mb-1 ${(runtimeState?.retryJobCount ?? 0) > 0 ? "text-yellow-400" : "text-white/40"}`}>{runtimeState?.retryJobCount ?? 0}</div>
                  <div className="text-[10px] text-white/25">Retrying</div>
                </div>
                <div className="px-5 py-3 text-center">
                  <div className={`text-xl font-light mb-1 ${isLocked ? "text-orange-400" : "text-white/40"}`}>{isLocked ? "Locked" : "Free"}</div>
                  <div className="text-[10px] text-white/25">Engine</div>
                </div>
              </div>
              {runtimeState?.failedJobs && runtimeState.failedJobs.length > 0 && (
                <div className="border-t border-white/5 divide-y divide-white/5">
                  {runtimeState.failedJobs.slice(0, 5).map((j, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-2 text-xs">
                      <RotateCcw className="w-3 h-3 text-red-400/60 flex-shrink-0" />
                      <span className="text-white/50 flex-1 truncate">{j.name}</span>
                      <span className="text-red-300/60 text-[10px]">×{j.retryCount} retries</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Run History */}
            <div>
              <h2 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
                <History className="w-4 h-4 text-white/40" /> Run History
              </h2>
              {historyLoading ? (
                <div className="p-8 text-center text-white/30 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center border border-white/8 text-white/30 text-sm">No runs recorded.</div>
              ) : (
                <div className="space-y-1.5">
                  {history.map(run => (
                    <div key={run.id} data-testid={`row-nexora-run-${run.id}`}
                      className="flex items-center gap-4 px-4 py-3 border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-xs">
                      {run.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-white/60 truncate">{run.message}</div>
                        <div className="text-[10px] text-white/25 mt-0.5">{new Date(run.startedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                      <div className="flex items-center gap-4 text-white/35 flex-shrink-0">
                        <span data-testid={`text-run-signals-${run.id}`}>{run.radarSignals + run.dealSignals} signals</span>
                        <span className="text-white/20">{formatMs(run.durationMs)}</span>
                        <Badge className={run.success ? "bg-green-500/10 text-green-400 border-green-500/20 text-[9px]" : "bg-red-500/10 text-red-400 border-red-500/20 text-[9px]"}>
                          {run.success ? "OK" : "Failed"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ SETTINGS ════════════════ */}
        {tab === "Settings" && (
          <div className="space-y-6">

            {/* Loop interval */}
            <div className="border border-white/8 bg-white/[0.02]">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Settings className="w-4 h-4 text-white/40" />
                <h2 className="text-sm font-medium text-white">Automation Controls</h2>
              </div>
              <div className="px-5 py-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Interval (minutes)</label>
                    <input type="number" value={intervalInput} onChange={e => setIntervalInput(e.target.value)}
                      min={1} max={1440} data-testid="input-nexora-interval"
                      className="w-24 bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20" />
                  </div>
                  <Button onClick={() => configMutation.mutate(Number(intervalInput) * 60000)}
                    disabled={configMutation.isPending || !loopStatus?.enabled}
                    data-testid="button-loop-config" variant="outline"
                    className="border-white/15 text-white/50 hover:bg-white/5 rounded-none">
                    <RefreshCw className="mr-2 w-3.5 h-3.5" /> Update Interval
                  </Button>
                </div>
                <p className="mt-3 text-[11px] text-white/25">Current: every {loopStatus ? Math.round(loopStatus.intervalMs / 60000) : "—"} minutes · {runtimeState?.loopRunCount ?? 0} total runs</p>
              </div>
            </div>

            {/* Adaptive Thresholds */}
            <div className="border border-white/8 bg-white/[0.02]">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-white/40" />
                <h2 className="text-sm font-medium text-white">Adaptive Decision Thresholds</h2>
                {thresholdsData?.current && (
                  <Badge className="ml-1 bg-white/8 text-white/40 border-white/10 text-[9px]">v{thresholdsData.current.version}</Badge>
                )}
                {thresholdsData?.current?.winRate != null && (
                  <span className="ml-auto text-xs text-white/25">
                    Win rate: <span className={thresholdsData.current.winRate >= 0.5 ? "text-emerald-400" : "text-yellow-400"}>
                      {(thresholdsData.current.winRate * 100).toFixed(0)}%
                    </span>
                  </span>
                )}
              </div>
              <div className="px-5 py-4">
                {thresholdsData?.current ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Strong Move Score", value: thresholdsData.current.strongMove, color: "text-white" },
                        { label: "Critical Value", value: fmt$(thresholdsData.current.criticalValue), color: "text-red-300" },
                        { label: "High Value", value: fmt$(thresholdsData.current.highValue), color: "text-orange-300" },
                        { label: "Pipeline Min Conf.", value: `${Math.round(thresholdsData.current.strongPipeline * 100)}%`, color: "text-blue-300" },
                        { label: "High Intent Min", value: `${Math.round(thresholdsData.current.highIntentMin * 100)}%`, color: "text-purple-300" },
                        { label: "Both Min Value", value: fmt$(thresholdsData.current.bothMinValue), color: "text-[hsl(43,78%,52%)]" },
                        { label: "Learning Rate", value: thresholdsData.current.learningRate, color: "text-emerald-300" },
                        { label: "Outcomes Used", value: thresholdsData.current.triggeredByOutcomes ?? 0, color: "text-white/50" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="p-3 border border-white/5 bg-white/[0.01]">
                          <div className="text-[9px] text-white/25 uppercase tracking-wide mb-1">{label}</div>
                          <div className={`text-sm font-light ${color}`}>{value}</div>
                        </div>
                      ))}
                    </div>
                    {thresholdsData.current.changeReason && (
                      <p className="mt-3 text-[10px] text-white/25 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Last change: {thresholdsData.current.changeReason}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="py-4 text-sm text-white/25">Using defaults — record outcomes to enable threshold learning.</div>
                )}
              </div>
            </div>

            {/* Knowledge Map */}
            <div className="border border-white/8 bg-white/[0.02]">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-medium text-white">Knowledge Map</h2>
                <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-[9px] ml-1">{knowledgeData?.total ?? 0} companies</Badge>
              </div>
              <div className="px-5 py-4">
                {knowledgeLoading ? (
                  <div className="flex items-center gap-2 text-sm text-white/30 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : !knowledgeData?.entries?.length ? (
                  <div className="py-4 text-center text-white/25 text-sm">
                    No knowledge entries yet. Builds automatically as Nexora processes signals and outcomes.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {knowledgeData.entries.map((e) => (
                      <div key={e.id} data-testid={`row-knowledge-${e.entryKey}`}
                        className="flex items-center gap-3 px-3 py-2.5 border border-white/5 hover:border-white/10 text-xs">
                        <Building2 className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-white/80 font-medium truncate capitalize">{e.companyName || e.entryKey}</span>
                            {e.city && <span className="text-[10px] text-white/30 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{e.city}</span>}
                          </div>
                          {e.signalType && <p className="text-[10px] text-white/25">{e.signalType}</p>}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Badge className={`text-[9px] px-1.5 h-4 capitalize ${actionBadge(e.action)}`}>{actionLabel(e.action)}</Badge>
                          <div className="text-center">
                            <div className={`text-xs font-medium ${e.winRate >= 0.6 ? "text-emerald-400" : e.winRate >= 0.4 ? "text-yellow-400" : "text-white/40"}`}>
                              {(e.winRate * 100).toFixed(0)}%
                            </div>
                            <div className="text-[9px] text-white/20">win</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-white/50">{e.totalCount}</div>
                            <div className="text-[9px] text-white/20">signals</div>
                          </div>
                          <span className="text-[10px] text-white/20">{timeAgo(e.lastUpdatedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ FINANCE ════════════════ */}
        {tab === "Finance" && (
          <div className="space-y-5">
            {financeLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/30 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading financial intelligence...
              </div>
            ) : !financialSummary ? (
              <div className="py-8 text-center text-white/25 text-sm">Financial summary unavailable.</div>
            ) : (
              <>
                {/* Top KPI row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-white/8">
                  {[
                    { label: "Pipeline Value", value: fmt$(financialSummary.pipeline.totalPipelineValue), sub: `${financialSummary.pipeline.totalOpportunities} opportunities`, color: "text-[hsl(43,78%,52%)]" },
                    { label: "Revenue Won", value: fmt$(financialSummary.pipeline.wonValue), sub: `${financialSummary.pipeline.wonOpportunities} closed`, color: "text-emerald-400" },
                    { label: "Win Rate", value: `${financialSummary.outcomes.winRate.toFixed(1)}%`, sub: `${financialSummary.outcomes.totalWins}W / ${financialSummary.outcomes.totalLosses}L`, color: financialSummary.outcomes.winRate >= 50 ? "text-emerald-400" : "text-yellow-400" },
                    { label: "Avg Deal Size", value: fmt$(financialSummary.outcomes.avgDealValue), sub: "from closed outcomes", color: "text-white/70" },
                  ].map((kpi, i) => (
                    <div key={i} className={`px-5 py-4 bg-white/[0.02] ${i < 3 ? "border-r border-white/5" : ""}`}>
                      <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">{kpi.label}</div>
                      <div className={`text-xl font-light mb-1 ${kpi.color}`} data-testid={`stat-finance-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>{kpi.value}</div>
                      <div className="text-[10px] text-white/25">{kpi.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Quotes + Signals row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="border border-white/8 bg-white/[0.02]">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                      <span className="text-sm font-medium text-white">Quotes</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-white/5">
                      <div className="px-5 py-4">
                        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">Total Quotes</div>
                        <div className="text-2xl font-light text-white mb-1" data-testid="stat-finance-total-quotes">{financialSummary.quotes.totalQuotes}</div>
                        <div className="text-[10px] text-white/25">{financialSummary.quotes.acceptedQuotes} accepted</div>
                      </div>
                      <div className="px-5 py-4">
                        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">Total Quote Value</div>
                        <div className="text-2xl font-light text-[hsl(43,78%,52%)] mb-1" data-testid="stat-finance-quote-value">{fmt$(financialSummary.quotes.totalQuoteValue)}</div>
                        <div className="text-[10px] text-white/25">avg {fmt$(financialSummary.quotes.avgQuoteValue)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-white/8 bg-white/[0.02]">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-sm font-medium text-white">Signals Processed</span>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-white/5">
                      <div className="px-4 py-4">
                        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">Total</div>
                        <div className="text-2xl font-light text-white" data-testid="stat-finance-signals-total">{financialSummary.signals.total}</div>
                      </div>
                      <div className="px-4 py-4">
                        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">Today</div>
                        <div className="text-2xl font-light text-white/70">{financialSummary.signals.todayCount}</div>
                      </div>
                      <div className="px-4 py-4">
                        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">This Week</div>
                        <div className="text-2xl font-light text-white/70">{financialSummary.signals.thisWeekCount}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Opportunities */}
                {financialSummary.pipeline.topOpportunities.length > 0 && (
                  <div className="border border-white/8 bg-white/[0.02]">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-sm font-medium text-white">Top Pipeline Opportunities</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {financialSummary.pipeline.topOpportunities.map((opp) => (
                        <div key={opp.id} className="flex items-center gap-4 px-5 py-3 text-xs hover:bg-white/[0.02]" data-testid={`row-opp-${opp.id}`}>
                          <Building2 className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-white/80 font-medium truncate">{opp.companyName || "Unknown"}</div>
                            <div className="text-white/30 text-[10px]">{timeAgo(opp.createdAt)}</div>
                          </div>
                          <Badge className="text-[9px] px-2 bg-blue-500/10 text-blue-300 border-blue-500/20 capitalize">{opp.stage}</Badge>
                          <div className="text-[hsl(43,78%,52%)] font-medium">{fmt$(opp.estimatedValue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {financialSummary.pipeline.topOpportunities.length === 0 && (
                  <div className="border border-white/8 bg-white/[0.02] px-5 py-8 text-center text-white/25 text-sm">
                    No pipeline opportunities yet. Run Nexora to start pushing signals into the pipeline.
                  </div>
                )}

                <div className="text-[10px] text-white/20 text-right">
                  Generated {timeAgo(financialSummary.generatedAt)}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

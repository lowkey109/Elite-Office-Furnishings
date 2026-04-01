import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Play, Square, RefreshCw, Clock, Activity, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Settings, History, BarChart3,
  ShieldCheck, TrendingUp, DollarSign, Flame, Target, ChevronRight,
  MessageSquare, Eye, EyeOff, Building2, MapPin, Info, Inbox,
  ThumbsUp, ThumbsDown, Radio, Layers, Brain, BookOpen, Sliders,
  TrendingDown, Award, Send, Database, Scan, ArrowUpRight,
  Lock, Unlock, AlertOctagon, RotateCcw, GitBranch, Cpu,
} from "lucide-react";
import { Link } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoopStatus {
  enabled: boolean;
  running: boolean;
  status: "idle" | "running" | "success" | "failed";
  intervalMs: number;
  nextRunAt: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastMessage: string;
  lastTrigger: "manual" | "auto" | null;
}

interface NexoraRun {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  success: boolean;
  processed: number;
  outreachRuns: number;
  outreachFailed: number;
  radarSignals: number;
  dealSignals: number;
  message: string;
  durationMs: number;
  createdAt: string;
}

interface Opportunity {
  id: string;
  source: string;
  companyName: string;
  city: string | null;
  signalType: string;
  score: number;
  estimatedValue: number;
  confidence: string;
  whyItMatters: string;
  nextAction: string;
  detectedAt: string;
  status: string;
}

interface SignalSummary {
  totalActiveSignals: number;
  radarSignals: number;
  dealSignals: number;
  inboundLeadsThisWeek: number;
  newRadarSignalsThisWeek: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  topSignalTypes: { type: string; count: number }[];
  topCities: { city: string; count: number }[];
}

interface PendingOutreach {
  id: number;
  companyName: string;
  contactName: string | null;
  phone: string;
  channel: string;
  messagePreview: string;
  createdAt: string;
  signalContext: string | null;
  priority: string;
}

interface NexoraDecision {
  id: string;
  runId: string;
  signalId: string;
  companyName: string | null;
  signalType: string | null;
  action: string;
  priority: string;
  confidence: number;
  reasoning: string | null;
  autoApproved: boolean | null;
  pushedPipeline: boolean | null;
  pushedRadar: boolean | null;
  outreachQueued: boolean | null;
  anomalyFlagged: boolean | null;
  createdAt: string;
}

interface OutcomeStats {
  total: number;
  wins: number;
  losses: number;
  ignored: number;
  winRate: number;
  avgDeal: number;
  byOutcome: Record<string, number>;
  recent: Array<{
    id: string; signalId: string; companyName: string | null;
    outcome: string; createdAt: string; dealValue: number | null;
  }>;
}

interface NexoraThreshold {
  id: string;
  version: number;
  strongMove: number;
  criticalValue: number;
  highValue: number;
  bothMinValue: number;
  strongPipeline: number;
  highIntentMin: number;
  learningRate: number;
  changeReason: string | null;
  triggeredByOutcomes: number | null;
  winRate: number | null;
  isActive: boolean;
  createdAt: string;
}

interface KnowledgeEntry {
  id: string;
  entryKey: string;
  companyName: string;
  signalType: string;
  city: string;
  industry: string;
  action: string;
  priority: string;
  confidence: number;
  winRate: number;
  successCount: number;
  failCount: number;
  totalCount: number;
  lastUpdatedAt: string;
}

interface NexoraRunResult {
  ok: boolean;
  runId: string;
  trigger: string;
  startedAt: string;
  finishedAt: string;
  totals: {
    scanned: number;
    valid: number;
    invalid: number;
    duplicates: number;
    aiCallsUsed: number;
    pushedPipeline: number;
    pushedRadar: number;
    webhooksSent: number;
    whatsappSent: number;
    vectorsSynced: number;
    reviewed: number;
  };
  learning: {
    sampleSize: number;
    avgWinRate: number;
    appliedDeltaStrongPipeline: number;
    maxDriftPerRun: number;
  };
  errors: string[];
}

interface RuntimeState {
  isLocked: boolean;
  activeLock: { id: number; lockKey: string; runId: string; acquiredAt: string; expiresAt: string | null } | null;
  loopEnabled: boolean;
  loopRunning: boolean;
  loopIntervalMs: number;
  loopRunCount: number;
  loopLastRunAt: string | null;
  loopLastError: string | null;
  lastRunResult: { success: boolean; message: string; totals?: { scanned: number; pushedPipeline: number; pushedRadar: number } } | null;
  bgLastRunId: string | null;
  bgLastStartedAt: string | null;
  bgLastFinishedAt: string | null;
  bgLastError: string | null;
  failedJobs: { name: string; state: string; retryCount: number; createdOn: string }[];
  failedJobCount: number;
  retryJobCount: number;
  approvalQueueCount: number;
  latestRunId: string | null;
  latestRunDecisions: NexoraDecision[];
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

function confidenceBadge(conf: string | number) {
  const c = typeof conf === "number" ? (conf >= 70 ? "high" : conf >= 40 ? "medium" : "low") : conf;
  if (c === "high" || c === "very_high") return "bg-green-500/15 text-green-300 border-green-500/25";
  if (c === "medium") return "bg-yellow-500/15 text-yellow-300 border-yellow-500/25";
  return "bg-white/8 text-white/40 border-white/10";
}

function signalTypeBadge(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("reloc") || t.includes("move")) return "bg-red-500/10 text-red-300 border-red-500/20";
  if (t.includes("expan") || t.includes("growth") || t.includes("hiring")) return "bg-orange-500/10 text-orange-300 border-orange-500/20";
  if (t.includes("lease") || t.includes("property")) return "bg-blue-500/10 text-blue-300 border-blue-500/20";
  if (t.includes("fund") || t.includes("invest")) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (t.includes("inbound")) return "bg-purple-500/10 text-purple-300 border-purple-500/20";
  return "bg-white/8 text-white/35 border-white/10";
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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminNexoraCommandCentre() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [intervalInput, setIntervalInput] = useState("30");
  const [expandedOpp, setExpandedOpp] = useState<string | null>(null);
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({
    signalId: "", companyName: "", outcome: "won",
    channel: "email", dealValue: "", notes: "",
  });
  const [lastRunResult, setLastRunResult] = useState<NexoraRunResult | null>(null);
  const [scanResult, setScanResult] = useState<{ saved: number; processed: number } | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: loopStatus, isLoading: statusLoading } = useQuery<LoopStatus>({
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

  const { data: topOpps, isLoading: oppsLoading } = useQuery<{ opportunities: Opportunity[]; total: number }>({
    queryKey: ["/api/nexora/opportunities/top"],
    refetchInterval: 60000,
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
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/opportunities/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/signals/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/runtime-state"] });
    },
    onError: (err: any) => toast({ title: "Run failed", description: err?.message, variant: "destructive" }),
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/office-move-radar/scan-all"),
    onSuccess: (data: any) => {
      setScanResult({ saved: data.saved ?? 0, processed: data.processed ?? 0 });
      toast({
        title: "Scan complete",
        description: `${data.saved ?? 0} new signals saved from ${data.processed ?? 0} articles`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/signals/summary"] });
    },
    onError: (err: any) => toast({ title: "Scan failed", description: err?.message, variant: "destructive" }),
  });

  const startLoopMutation = useMutation({
    mutationFn: (intervalMs: number) => apiRequest("POST", "/api/nexora/loop/start", { intervalMs }),
    onSuccess: () => {
      toast({ title: "Autonomous loop started" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
    },
  });

  const stopLoopMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/nexora/loop/stop"),
    onSuccess: () => {
      toast({ title: "Autonomous loop stopped" });
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
      ...data,
      dealValue: data.dealValue ? Number(data.dealValue) : undefined,
    }),
    onSuccess: () => {
      toast({ title: "Outcome recorded", description: "Nexora brain will recalibrate based on this feedback." });
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

  // ── Status badge ──────────────────────────────────────────────────────────

  const statusBadge = () => {
    if (runMutation.isPending || scanMutation.isPending)
      return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse">Running</Badge>;
    if (!loopStatus) return <Badge variant="outline" className="text-white/40 border-white/10">Unknown</Badge>;
    if (loopStatus.running) return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Running</Badge>;
    if (loopStatus.status === "success") return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Ready</Badge>;
    if (loopStatus.status === "failed") return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Failed</Badge>;
    return <Badge className="bg-white/10 text-white/40 border-white/10">Idle</Badge>;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              <h1 className="text-2xl font-light text-white">Nexora Command Centre</h1>
              {statusBadge()}
              {pendingOutreach && pendingOutreach.total > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 ml-1">
                  {pendingOutreach.total} awaiting approval
                </Badge>
              )}
            </div>
            <p className="text-white/40 text-sm">Autonomous OS · signal → decision → action → outcome → learning</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending || runMutation.isPending}
              data-testid="button-scan-now"
              variant="outline"
              className="border-white/15 text-white/50 hover:bg-white/5 rounded-none"
            >
              {scanMutation.isPending
                ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Scanning...</>
                : <><Scan className="mr-2 w-4 h-4" /> Scan Signals</>}
            </Button>
            <Button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || scanMutation.isPending}
              data-testid="button-nexora-run"
              className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none"
            >
              {runMutation.isPending
                ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Running...</>
                : <><Play className="mr-2 w-4 h-4" /> Run Nexora</>}
            </Button>
          </div>
        </div>

        {/* ── Last Run Result Banner ── */}
        {lastRunResult && (
          <div className={`mb-6 p-4 border ${lastRunResult.ok ? "border-[hsl(43,78%,52%)]/20 bg-[hsl(43,78%,52%)]/5" : "border-red-500/20 bg-red-500/5"}`}>
            <div className="flex items-center gap-3 mb-3">
              {lastRunResult.ok
                ? <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                : <AlertTriangle className="w-4 h-4 text-red-400" />}
              <span className="text-sm font-medium text-white">
                Run {lastRunResult.runId} · {new Date(lastRunResult.finishedAt).toLocaleString("en-AU")}
              </span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {[
                { label: "Scanned", value: lastRunResult.totals.scanned },
                { label: "Valid", value: lastRunResult.totals.valid },
                { label: "Duplicates", value: lastRunResult.totals.duplicates },
                { label: "AI Calls", value: lastRunResult.totals.aiCallsUsed },
                { label: "→ Pipeline", value: lastRunResult.totals.pushedPipeline, color: "text-blue-300" },
                { label: "→ Radar", value: lastRunResult.totals.pushedRadar, color: "text-purple-300" },
                { label: "Webhooks", value: lastRunResult.totals.webhooksSent },
                { label: "Win Rate", value: `${(lastRunResult.learning.avgWinRate * 100).toFixed(0)}%`, color: "text-emerald-300" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-base font-light ${color ?? "text-white"}`}>{value}</div>
                  <div className="text-[9px] text-white/25 uppercase tracking-wide mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {lastRunResult.errors.length > 0 && (
              <div className="mt-3 text-xs text-red-300/70 font-mono">{lastRunResult.errors.slice(0, 3).join(" · ")}</div>
            )}
          </div>
        )}

        {/* Scan result pill */}
        {scanResult && !scanMutation.isPending && (
          <div className="mb-6 p-3 border border-blue-500/20 bg-blue-500/5 flex items-center gap-3 text-sm">
            <Scan className="w-4 h-4 text-blue-400" />
            <span className="text-white/70">Scan complete: <span className="text-blue-300 font-medium">{scanResult.saved} new signals</span> saved from {scanResult.processed} articles</span>
            <span className="ml-auto text-[10px] text-white/25">Run Nexora above to process them</span>
          </div>
        )}

        {/* ── Status Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Loop Status", value: loopStatus?.enabled ? "Enabled" : "Disabled",
              sub: loopStatus?.enabled ? `Every ${(loopStatus.intervalMs / 60000).toFixed(0)}min` : "Manual only",
              icon: Activity, color: loopStatus?.enabled ? "text-green-400" : "text-white/40",
            },
            {
              label: "Last Run", value: timeAgo(loopStatus?.lastFinishedAt || null),
              sub: loopStatus?.lastTrigger ? `Via ${loopStatus.lastTrigger}` : "No runs yet",
              icon: Clock, color: "text-white",
            },
            {
              label: "Brain Decisions", value: decisions?.total ?? "—",
              sub: `${decisions?.decisions?.filter(d => d.pushedPipeline).length ?? 0} pushed to pipeline`,
              icon: Brain, color: "text-violet-300",
            },
            {
              label: "Win Rate", value: outcomeStats ? `${(outcomeStats.winRate * 100).toFixed(0)}%` : "—",
              sub: outcomeStats ? `${outcomeStats.total} outcomes recorded` : "No outcomes yet",
              icon: TrendingUp, color: outcomeStats && outcomeStats.winRate >= 0.5 ? "text-emerald-400" : "text-yellow-400",
            },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="p-4 border border-white/8 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-white/30" />
                <span className="text-xs text-white/40">{label}</span>
              </div>
              <div className={`text-xl font-light mb-1 ${color}`}>{value}</div>
              <div className="text-xs text-white/30">{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Runtime Control State ── */}
        <div className="mb-6 border border-[hsl(43,78%,52%)]/15 bg-[hsl(43,78%,52%)]/[0.02]">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-white/5">
            <Cpu className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h2 className="text-sm font-medium text-white">Runtime Control State</h2>
            {runtimeLoading && <Loader2 className="w-3 h-3 animate-spin text-white/30 ml-1" />}
            <span className="ml-auto text-[10px] text-white/20 uppercase tracking-wide">Live · 8s refresh</span>
          </div>

          {/* ── 5 State Tiles ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-white/5">

            {/* Tile 1: Automation Mode */}
            <div data-testid="tile-automation-mode" className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <GitBranch className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/30 uppercase tracking-wide">Automation Mode</span>
              </div>
              <div className={`text-sm font-medium mb-2 ${runtimeState?.loopEnabled ? "text-green-400" : "text-white/50"}`}>
                {runtimeState?.loopEnabled ? "Auto" : "Manual"}
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { key: "pipeline", label: "Pipeline", enabled: true },
                  { key: "radar", label: "Radar", enabled: true },
                  { key: "webhook", label: "Webhook", enabled: true },
                  { key: "learning", label: "Learning", enabled: true },
                ].map(({ key, label, enabled }) => (
                  <span key={key} className={`text-[9px] px-1.5 py-0.5 border ${enabled ? "border-green-500/20 text-green-400/70 bg-green-500/5" : "border-white/10 text-white/25"}`}>
                    {enabled ? "✓" : "✗"} {label}
                  </span>
                ))}
              </div>
              {runtimeState?.loopEnabled && (
                <p className="mt-1.5 text-[10px] text-white/25">
                  Every {Math.round((runtimeState.loopIntervalMs ?? 1800000) / 60000)}min · {runtimeState.loopRunCount ?? 0} runs
                </p>
              )}
            </div>

            {/* Tile 2: Lock / Run State */}
            <div data-testid="tile-lock-state" className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                {runtimeState?.isLocked ? <Lock className="w-3 h-3 text-orange-400" /> : <Unlock className="w-3 h-3 text-white/30" />}
                <span className="text-[10px] text-white/30 uppercase tracking-wide">Engine Lock</span>
              </div>
              {runtimeState?.isLocked ? (
                <>
                  <div className="text-sm font-medium text-orange-400 mb-1">Locked</div>
                  <p className="text-[10px] text-white/40 break-all">{runtimeState.activeLock?.lockKey}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Since {timeAgo(runtimeState.activeLock?.acquiredAt ?? null)}</p>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-white/50 mb-1">Idle</div>
                  <p className="text-[10px] text-white/25">No active lock — engine is free</p>
                  {(runtimeState?.loopRunning) && (
                    <Badge className="mt-1 bg-blue-500/15 text-blue-300 border-blue-500/20 text-[9px] animate-pulse">
                      <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> Cycle running
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Tile 3: Failed Jobs */}
            <div data-testid="tile-failed-jobs" className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertOctagon className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/30 uppercase tracking-wide">Failed Jobs</span>
              </div>
              {runtimeState ? (
                <>
                  <div className={`text-sm font-medium mb-1.5 ${runtimeState.failedJobCount > 0 ? "text-red-400" : "text-white/40"}`}>
                    {runtimeState.failedJobCount} failed
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 border ${runtimeState.retryJobCount > 0 ? "border-yellow-500/25 text-yellow-400 bg-yellow-500/5" : "border-white/10 text-white/30"}`}>
                      <RotateCcw className="w-2.5 h-2.5 inline mr-0.5" />{runtimeState.retryJobCount} retry
                    </span>
                  </div>
                  {runtimeState.failedJobs.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {runtimeState.failedJobs.slice(0, 3).map((j, i) => (
                        <p key={i} className="text-[9px] text-white/30 truncate">{j.name} · ×{j.retryCount}</p>
                      ))}
                    </div>
                  )}
                  {runtimeState.failedJobCount === 0 && runtimeState.retryJobCount === 0 && (
                    <p className="text-[10px] text-white/25">All jobs clean</p>
                  )}
                </>
              ) : (
                <div className="text-white/25 text-xs">—</div>
              )}
            </div>

            {/* Tile 4: Approval Queue */}
            <div data-testid="tile-approval-queue" className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Inbox className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/30 uppercase tracking-wide">Approval Queue</span>
              </div>
              <div className={`text-sm font-medium mb-1 ${(runtimeState?.approvalQueueCount ?? 0) > 0 ? "text-yellow-400" : "text-white/40"}`}>
                {runtimeState?.approvalQueueCount ?? "—"} pending
              </div>
              {(runtimeState?.approvalQueueCount ?? 0) > 0 ? (
                <p className="text-[10px] text-yellow-400/60">Outreach awaiting review</p>
              ) : (
                <p className="text-[10px] text-white/25">Queue clear</p>
              )}
            </div>

            {/* Tile 5: Last Run Result */}
            <div data-testid="tile-last-run-result" className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/30 uppercase tracking-wide">Last Run Result</span>
              </div>
              {runtimeState?.lastRunResult ? (
                <>
                  <div className={`text-sm font-medium mb-1 ${runtimeState.lastRunResult.success ? "text-emerald-400" : "text-red-400"}`}>
                    {runtimeState.lastRunResult.success ? "Success" : "Failed"}
                  </div>
                  {runtimeState.lastRunResult.totals && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-white/40">
                      <span>{runtimeState.lastRunResult.totals.scanned} scanned</span>
                      <span className="text-blue-400">{runtimeState.lastRunResult.totals.pushedPipeline} → pipe</span>
                      <span className="text-purple-400">{runtimeState.lastRunResult.totals.pushedRadar} → radar</span>
                    </div>
                  )}
                  <p className="mt-1 text-[10px] text-white/25">{timeAgo(runtimeState.bgLastFinishedAt ?? runtimeState.loopLastRunAt)}</p>
                  {(runtimeState.bgLastError || runtimeState.loopLastError) && (
                    <p className="mt-1 text-[9px] text-red-400/70 truncate">{runtimeState.bgLastError || runtimeState.loopLastError}</p>
                  )}
                </>
              ) : (
                <div>
                  <div className="text-sm text-white/30 mb-1">{runtimeState?.bgLastFinishedAt ? "Complete" : "No runs yet"}</div>
                  <p className="text-[10px] text-white/25">{timeAgo(runtimeState?.bgLastFinishedAt ?? runtimeState?.loopLastRunAt ?? null)}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Latest Actions Executed ── */}
          {runtimeState?.latestRunDecisions && runtimeState.latestRunDecisions.length > 0 && (
            <div className="border-t border-white/5 px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wide">Latest Actions Executed</span>
                {runtimeState.latestRunId && (
                  <span className="text-[9px] text-white/20 font-mono">run {runtimeState.latestRunId.slice(0, 8)}…</span>
                )}
                <span className="ml-auto text-[9px] text-white/20">{runtimeState.latestRunDecisions.length} decisions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {runtimeState.latestRunDecisions.map((d) => (
                  <div
                    key={d.id}
                    data-testid={`badge-runtime-decision-${d.id}`}
                    className="flex items-center gap-1.5 px-2 py-1 border border-white/8 bg-white/[0.02] text-xs"
                  >
                    <span className="text-white/60 max-w-[120px] truncate">{d.companyName ?? "Unknown"}</span>
                    <Badge className={`text-[9px] px-1.5 h-4 ${actionBadge(d.action)}`}>{actionLabel(d.action)}</Badge>
                    <span className={`text-[9px] ${d.confidence >= 0.7 ? "text-emerald-400" : d.confidence >= 0.4 ? "text-yellow-400" : "text-white/30"}`}>
                      {Math.round(d.confidence * 100)}%
                    </span>
                    {d.pushedPipeline && <span className="text-[8px] text-blue-400/60">✓pipe</span>}
                    {d.pushedRadar && <span className="text-[8px] text-purple-400/60">✓radar</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Signal Intelligence Summary ── */}
        {signalSummary && (
          <div className="mb-6 p-5 border border-[hsl(43,78%,52%)]/12 bg-[hsl(43,78%,52%)]/3">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-sm font-medium text-white">Signal Intelligence Summary</h2>
              <span className="ml-auto text-xs text-white/25">{signalSummary.totalActiveSignals} active signals</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
              {[
                { label: "Radar", value: signalSummary.radarSignals, color: "text-blue-300" },
                { label: "Deal", value: signalSummary.dealSignals, color: "text-orange-300" },
                { label: "Leads (7d)", value: signalSummary.inboundLeadsThisWeek, color: "text-purple-300" },
                { label: "New (7d)", value: signalSummary.newRadarSignalsThisWeek, color: "text-[hsl(43,78%,52%)]" },
                { label: "High Conf.", value: signalSummary.highConfidence, color: "text-green-300" },
                { label: "Medium Conf.", value: signalSummary.mediumConfidence, color: "text-yellow-300" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-3 border border-white/5 bg-white/[0.015]">
                  <div className={`text-xl font-light ${color}`}>{value}</div>
                  <div className="text-[10px] text-white/30 mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Top Signal Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {signalSummary.topSignalTypes.map(({ type, count }) => (
                    <span key={type} className={`text-[10px] px-2 py-0.5 border ${signalTypeBadge(type)}`}>
                      {type} ({count})
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Top Cities</p>
                <div className="flex flex-wrap gap-1.5">
                  {signalSummary.topCities.map(({ city, count }) => (
                    <span key={city} className="text-[10px] px-2 py-0.5 border bg-white/5 text-white/40 border-white/10">
                      {city} ({count})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Top Opportunities ── */}
        <div className="mb-6 p-5 border border-white/8 bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h2 className="text-sm font-medium text-white">Top Opportunities</h2>
            <span className="text-xs text-white/25 ml-1">— ranked by Nexora score</span>
            <Link href="/admin/deal-hunter" className="ml-auto text-xs text-[hsl(43,78%,52%)]/60 hover:text-[hsl(43,78%,52%)] flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {oppsLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/30 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading opportunities...
            </div>
          ) : !topOpps?.opportunities?.length ? (
            <div className="py-6 text-center border border-white/5 text-white/30 text-sm">
              No active opportunities. Run a signal scan, then run Nexora.
            </div>
          ) : (
            <div className="space-y-2">
              {topOpps.opportunities.map((opp, i) => (
                <div
                  key={opp.id}
                  data-testid={`card-opportunity-${opp.id}`}
                  className="border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedOpp(expandedOpp === opp.id ? null : opp.id)}
                  >
                    <span className="text-xs text-white/20 w-5 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-medium text-white truncate">{opp.companyName}</span>
                        <Badge className={`text-[9px] px-1.5 py-0 h-4 capitalize ${signalTypeBadge(opp.signalType)}`}>{opp.signalType}</Badge>
                        <Badge className={`text-[9px] px-1.5 py-0 h-4 capitalize ${confidenceBadge(opp.confidence)}`}>{opp.confidence}</Badge>
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-white/5 text-white/30 border-white/8">{opp.source}</Badge>
                      </div>
                      {opp.city && (
                        <div className="flex items-center gap-1 text-[10px] text-white/30">
                          <MapPin className="w-2.5 h-2.5" />{opp.city}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 text-right">
                      <div className="text-xs">
                        <div className="text-[hsl(43,78%,52%)] font-semibold">{opp.score}</div>
                        <div className="text-white/25 text-[9px]">score</div>
                      </div>
                      {opp.estimatedValue > 0 && (
                        <div className="text-sm font-light text-white">{fmt$(opp.estimatedValue)}</div>
                      )}
                      {expandedOpp === opp.id
                        ? <EyeOff className="w-3.5 h-3.5 text-white/20" />
                        : <Eye className="w-3.5 h-3.5 text-white/20" />}
                    </div>
                  </div>
                  {expandedOpp === opp.id && (
                    <div className="px-4 pb-3 pt-0 border-t border-white/5 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Why It Matters</p>
                        <p className="text-xs text-white/60">{opp.whyItMatters}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Recommended Action</p>
                        <p className="text-xs text-[hsl(43,78%,52%)]/80">{opp.nextAction}</p>
                        <p className="text-[10px] text-white/25 mt-1">Detected {timeAgo(opp.detectedAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Outreach Pending Approval ── */}
        <div className="mb-6 p-5 border border-yellow-500/12 bg-yellow-500/[0.025]">
          <div className="flex items-center gap-2 mb-4">
            <Inbox className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-medium text-white">Outreach Pending Approval</h2>
            {pendingOutreach && pendingOutreach.total > 0 && (
              <Badge className="bg-yellow-500/15 text-yellow-300 border-yellow-500/25 ml-1">{pendingOutreach.total}</Badge>
            )}
            <span className="ml-auto text-xs text-white/25">Review before sending</span>
          </div>
          {outreachLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/30 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading pending outreach...
            </div>
          ) : !pendingOutreach?.pending?.length ? (
            <div className="py-4 text-center border border-white/5 text-white/30 text-sm">
              No outreach pending. Nexora will queue messages here after processing signals.
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
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ id: msg.id, action: "approve" })}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-outreach-${msg.id}`}
                        className="bg-green-700/30 hover:bg-green-700/50 text-green-300 border border-green-700/40 rounded-none h-7 text-xs"
                      >
                        <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ id: msg.id, action: "reject" })}
                        disabled={approveMutation.isPending}
                        data-testid={`button-reject-outreach-${msg.id}`}
                        variant="outline"
                        className="border-red-700/40 text-red-300 hover:bg-red-700/20 rounded-none h-7 text-xs"
                      >
                        <ThumbsDown className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Brain Decisions ── */}
        <div className="mb-6 p-5 border border-violet-500/12 bg-violet-500/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-medium text-white">Brain Decisions</h2>
            <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-[9px] ml-1">{decisions?.total ?? 0} total</Badge>
            <span className="ml-auto text-xs text-white/25">DB-backed · last 15 shown</span>
          </div>
          {decisionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/30 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading decisions...
            </div>
          ) : !decisions?.decisions.length ? (
            <div className="py-6 text-center text-white/25 text-sm border border-white/5">
              No decisions yet. Run Nexora after scanning signals to generate decisions.
            </div>
          ) : (
            <div className="space-y-1.5">
              {decisions.decisions.slice(0, 15).map((d) => (
                <div key={d.id} data-testid={`row-decision-${d.id}`} className="flex items-center gap-3 px-3 py-2.5 border border-white/5 hover:border-white/10 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white/80 font-medium truncate">{d.companyName ?? "Unknown"}</span>
                      {d.signalType && (
                        <Badge className={`text-[9px] px-1.5 h-4 ${signalTypeBadge(d.signalType)}`}>{d.signalType}</Badge>
                      )}
                    </div>
                    {d.reasoning && <p className="text-[10px] text-white/30 truncate">{d.reasoning}</p>}
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <Badge className={`text-[9px] px-1.5 h-4 capitalize ${actionBadge(d.action)}`}>
                      {actionLabel(d.action)}
                    </Badge>
                    <Badge className={`text-[9px] px-1.5 h-4 capitalize ${
                      d.priority === "critical" ? "bg-red-500/15 text-red-300 border-red-500/25" :
                      d.priority === "high" ? "bg-orange-500/15 text-orange-300 border-orange-500/25" :
                      d.priority === "medium" ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" :
                      "bg-white/8 text-white/35 border-white/10"
                    }`}>{d.priority}</Badge>
                    <span className="text-white/25 w-8 text-right">{Math.round((d.confidence ?? 0) * 100)}%</span>
                    <div className="flex gap-1">
                      {d.pushedPipeline && <span className="text-[9px] px-1 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20">pipe</span>}
                      {d.pushedRadar && <span className="text-[9px] px-1 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20">radar</span>}
                      {d.anomalyFlagged && <span className="text-[9px] px-1 py-0.5 bg-red-500/10 text-red-300 border border-red-500/20">⚠</span>}
                    </div>
                    <span className="text-white/20 text-[10px]">{timeAgo(d.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Outcome Intelligence ── */}
        <div className="mb-6 p-5 border border-emerald-500/12 bg-emerald-500/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-medium text-white">Outcome Intelligence</h2>
            <span className="ml-auto text-xs text-white/25">Closed-loop learning</span>
            <Button
              size="sm"
              onClick={() => setShowOutcomeForm(!showOutcomeForm)}
              data-testid="button-record-outcome"
              className="ml-2 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 border border-emerald-700/40 rounded-none h-7 text-xs"
            >
              <Send className="w-3 h-3 mr-1" /> Record Outcome
            </Button>
          </div>

          {showOutcomeForm && (
            <div className="mb-4 p-4 border border-emerald-500/20 bg-emerald-900/10 space-y-3">
              <p className="text-xs text-white/40">Record a sales outcome to train Nexora's adaptive thresholds</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-white/30 uppercase mb-1">Signal ID *</label>
                  <input
                    data-testid="input-outcome-signal-id"
                    className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    placeholder="signal id..."
                    value={outcomeForm.signalId}
                    onChange={e => setOutcomeForm(f => ({ ...f, signalId: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 uppercase mb-1">Company</label>
                  <input
                    data-testid="input-outcome-company"
                    className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    placeholder="company name..."
                    value={outcomeForm.companyName}
                    onChange={e => setOutcomeForm(f => ({ ...f, companyName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 uppercase mb-1">Outcome *</label>
                  <select
                    data-testid="select-outcome-type"
                    className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none"
                    value={outcomeForm.outcome}
                    onChange={e => setOutcomeForm(f => ({ ...f, outcome: e.target.value }))}
                  >
                    {["won","lost","replied","ignored","bounced","meeting_booked","no_response"].map(o => (
                      <option key={o} value={o} className="bg-black">{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 uppercase mb-1">Deal Value ($)</label>
                  <input
                    data-testid="input-outcome-deal-value"
                    type="number"
                    className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none"
                    placeholder="e.g. 85000"
                    value={outcomeForm.dealValue}
                    onChange={e => setOutcomeForm(f => ({ ...f, dealValue: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 uppercase mb-1">Channel</label>
                  <select
                    data-testid="select-outcome-channel"
                    className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none"
                    value={outcomeForm.channel}
                    onChange={e => setOutcomeForm(f => ({ ...f, channel: e.target.value }))}
                  >
                    {["email","whatsapp","phone","in_person"].map(c => (
                      <option key={c} value={c} className="bg-black">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 uppercase mb-1">Notes</label>
                  <input
                    data-testid="input-outcome-notes"
                    className="w-full bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs focus:outline-none"
                    placeholder="optional notes..."
                    value={outcomeForm.notes}
                    onChange={e => setOutcomeForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!outcomeForm.signalId || recordOutcomeMutation.isPending}
                  onClick={() => recordOutcomeMutation.mutate(outcomeForm)}
                  data-testid="button-submit-outcome"
                  className="bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-200 border border-emerald-600/40 rounded-none h-7 text-xs"
                >
                  {recordOutcomeMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving...</> : "Submit"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowOutcomeForm(false)} className="text-white/30 rounded-none h-7 text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {outcomeStats && outcomeStats.total > 0 ? (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                {[
                  { label: "Total", value: outcomeStats.total, color: "text-white", icon: BarChart3 },
                  { label: "Wins", value: outcomeStats.wins, color: "text-emerald-400", icon: CheckCircle2 },
                  { label: "Losses", value: outcomeStats.losses, color: "text-red-400", icon: XCircle },
                  { label: "Win Rate", value: `${(outcomeStats.winRate * 100).toFixed(0)}%`, color: outcomeStats.winRate >= 0.5 ? "text-emerald-400" : "text-yellow-400", icon: TrendingUp },
                  { label: "Avg Deal", value: outcomeStats.avgDeal > 0 ? fmt$(outcomeStats.avgDeal) : "—", color: "text-[hsl(43,78%,52%)]", icon: DollarSign },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} data-testid={`stat-outcome-${label.toLowerCase().replace(/ /g, "-")}`} className="p-3 border border-white/5 bg-white/[0.015] text-center">
                    <Icon className="w-3.5 h-3.5 text-white/25 mx-auto mb-1" />
                    <div className={`text-lg font-light ${color}`}>{value}</div>
                    <div className="text-[9px] text-white/30 uppercase tracking-wide mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {outcomeStats.recent.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wide mb-2">Recent Outcomes</p>
                  <div className="space-y-1">
                    {outcomeStats.recent.slice(0, 8).map((o) => (
                      <div key={o.id} className="flex items-center gap-3 text-xs py-1 border-b border-white/5 last:border-0">
                        <Badge className={`text-[9px] px-1.5 h-4 ${
                          ["won","meeting_booked","replied"].includes(o.outcome)
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                            : ["lost","bounced"].includes(o.outcome)
                              ? "bg-red-500/15 text-red-300 border-red-500/25"
                              : "bg-white/8 text-white/35 border-white/10"
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
            <div className="py-4 text-center text-white/25 text-sm">
              No outcomes yet. Use "Record Outcome" to start training the brain.
            </div>
          )}
        </div>

        {/* ── Adaptive Thresholds ── */}
        <div className="mb-6 p-5 border border-white/8 bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-4">
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
            <div className="py-3 text-sm text-white/25">
              Using defaults — no calibrations recorded yet. Record outcomes to enable threshold learning.
            </div>
          )}

          {/* Threshold history mini-chart */}
          {thresholdsData?.history && thresholdsData.history.length > 1 && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <p className="text-[10px] text-white/25 uppercase tracking-wide mb-2">Version History</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {thresholdsData.history.slice(0, 10).map((h) => (
                  <div key={h.id} className={`flex-shrink-0 p-2 border text-center min-w-[80px] ${h.isActive ? "border-[hsl(43,78%,52%)]/30 bg-[hsl(43,78%,52%)]/5" : "border-white/5"}`}>
                    <div className="text-[9px] text-white/25 mb-0.5">v{h.version}</div>
                    {h.winRate != null && (
                      <div className={`text-xs font-light ${h.winRate >= 0.5 ? "text-emerald-400" : "text-yellow-400"}`}>
                        {(h.winRate * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Knowledge Map ── */}
        <div className="mb-6 p-5 border border-blue-500/12 bg-blue-500/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-medium text-white">Knowledge Map</h2>
            <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-[9px] ml-1">
              {knowledgeData?.total ?? 0} companies
            </Badge>
            <span className="ml-auto text-[10px] text-white/25">Company-level learning</span>
          </div>
          {knowledgeLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/30 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading knowledge...
            </div>
          ) : !knowledgeData?.entries?.length ? (
            <div className="py-4 text-center text-white/25 text-sm border border-white/5">
              No knowledge entries yet. Knowledge builds automatically as Nexora processes signals and records outcomes.
            </div>
          ) : (
            <div className="space-y-1.5">
              {knowledgeData.entries.map((e) => (
                <div key={e.id} data-testid={`row-knowledge-${e.entryKey}`} className="flex items-center gap-3 px-3 py-2.5 border border-white/5 hover:border-white/10 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white/80 font-medium truncate capitalize">{e.companyName || e.entryKey}</span>
                      {e.city && (
                        <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />{e.city}
                        </span>
                      )}
                    </div>
                    {e.signalType && <p className="text-[10px] text-white/25">{e.signalType}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge className={`text-[9px] px-1.5 h-4 capitalize ${actionBadge(e.action)}`}>
                      {actionLabel(e.action)}
                    </Badge>
                    <div className="text-center">
                      <div className={`text-xs font-medium ${e.winRate >= 0.6 ? "text-emerald-400" : e.winRate >= 0.4 ? "text-yellow-400" : "text-white/40"}`}>
                        {(e.winRate * 100).toFixed(0)}%
                      </div>
                      <div className="text-[9px] text-white/20">win rate</div>
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

        {/* ── Loop Controls ── */}
        <div className="p-5 border border-white/8 bg-white/[0.02] mb-6">
          <h2 className="flex items-center gap-2 text-sm font-medium text-white mb-5">
            <Settings className="w-4 h-4 text-white/40" />
            Autonomous Loop Controls
          </h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Interval (minutes)</label>
              <input
                type="number"
                value={intervalInput}
                onChange={e => setIntervalInput(e.target.value)}
                min={1}
                max={1440}
                data-testid="input-nexora-interval"
                className="w-24 bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
            <Button
              onClick={() => startLoopMutation.mutate(Number(intervalInput) * 60000)}
              disabled={startLoopMutation.isPending || loopStatus?.enabled}
              data-testid="button-loop-start"
              className="bg-green-700/30 hover:bg-green-700/50 text-green-300 border border-green-700/40 rounded-none"
            >
              <Play className="mr-2 w-3.5 h-3.5" /> Start Loop
            </Button>
            <Button
              onClick={() => stopLoopMutation.mutate()}
              disabled={stopLoopMutation.isPending || !loopStatus?.enabled}
              data-testid="button-loop-stop"
              variant="outline"
              className="border-red-700/40 text-red-300 hover:bg-red-700/20 rounded-none"
            >
              <Square className="mr-2 w-3.5 h-3.5" /> Stop Loop
            </Button>
            <Button
              onClick={() => configMutation.mutate(Number(intervalInput) * 60000)}
              disabled={configMutation.isPending || !loopStatus?.enabled}
              data-testid="button-loop-config"
              variant="outline"
              className="border-white/15 text-white/50 hover:bg-white/5 rounded-none"
            >
              <RefreshCw className="mr-2 w-3.5 h-3.5" /> Update Interval
            </Button>
          </div>
          <p className="mt-4 text-xs text-white/20">
            Loop state is process-memory based. pg-boss scheduler runs independently.
          </p>
        </div>

        {/* ── Run History ── */}
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-medium text-white mb-4">
            <History className="w-4 h-4 text-white/40" />
            Recent Run History
          </h2>
          {historyLoading ? (
            <div className="p-8 text-center text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center border border-white/8 text-white/30 text-sm">
              No runs recorded yet. Trigger a run above.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(run => (
                <div key={run.id} data-testid={`row-nexora-run-${run.id}`} className="flex items-center gap-4 p-4 border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="flex-shrink-0">
                    {run.success ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/70 truncate">{run.message}</div>
                    <div className="text-xs text-white/30 mt-0.5">{new Date(run.startedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-6 text-xs text-white/40">
                    <span data-testid={`text-run-signals-${run.id}`}>{run.radarSignals + run.dealSignals} signals</span>
                    <span>{run.outreachRuns} outreach</span>
                    <span className="text-white/25">{formatMs(run.durationMs)}</span>
                    <Badge className={run.success ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}>
                      {run.success ? "OK" : "Failed"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

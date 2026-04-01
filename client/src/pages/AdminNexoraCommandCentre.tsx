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
  ThumbsUp, ThumbsDown, Radio, Layers,
} from "lucide-react";
import { Link } from "wouter";

type SystemRunStep = { step: string; status: string; detail?: string; count?: number };
type TopDeal = { id: string; clientCompany: string; status: string; estimatedValue: number; aiFitScore?: number; aiNextBestAction?: string };
type AtRiskDeal = { id: string; clientCompany: string; status: string; estimatedValue: number; reason: string };
type UrgentLead = { name: string; value: number; score?: number; status: string };
type SystemRunResult = {
  ok: boolean;
  ranAt: string;
  durationMs: number;
  steps: SystemRunStep[];
  staleLeads: string[];
  urgentLeads?: UrgentLead[];
  overdueComs: number;
  predictive?: {
    totalPipelineValue: number;
    totalRevenue: number;
    predicted30: number;
    predicted60: number;
    predicted90: number;
    topDeals: TopDeal[];
    atRisk: AtRiskDeal[];
    totalActive: number;
  };
};

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

function confidenceBadge(conf: string) {
  if (conf === "high" || conf === "very_high") return "bg-green-500/15 text-green-300 border-green-500/25";
  if (conf === "medium") return "bg-yellow-500/15 text-yellow-300 border-yellow-500/25";
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

export default function AdminNexoraCommandCentre() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [intervalInput, setIntervalInput] = useState("30");
  const [systemRunResult, setSystemRunResult] = useState<SystemRunResult | null>(null);
  const [expandedOpp, setExpandedOpp] = useState<string | null>(null);

  const { data: loopStatus, isLoading: statusLoading } = useQuery<LoopStatus>({
    queryKey: ["/api/nexora/loop/status"],
    refetchInterval: 5000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<NexoraRun[]>({
    queryKey: ["/api/nexora/history"],
    refetchInterval: 15000,
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

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/nexora/loop/run-now"),
    onSuccess: () => {
      toast({ title: "Nexora started", description: "Cycle is running — results will appear in history." });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/nexora/history"] });
        queryClient.invalidateQueries({ queryKey: ["/api/nexora/opportunities/top"] });
        queryClient.invalidateQueries({ queryKey: ["/api/nexora/signals/summary"] });
      }, 8000);
    },
    onError: (err: any) => toast({ title: "Run failed", description: err?.message, variant: "destructive" }),
  });

  const startLoopMutation = useMutation({
    mutationFn: (intervalMs: number) => apiRequest("POST", "/api/nexora/loop/start", { intervalMs }),
    onSuccess: () => {
      toast({ title: "Autonomous loop started" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
    },
    onError: () => toast({ title: "Failed to start loop", variant: "destructive" }),
  });

  const stopLoopMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/nexora/loop/stop"),
    onSuccess: () => {
      toast({ title: "Autonomous loop stopped" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
    },
    onError: () => toast({ title: "Failed to stop loop", variant: "destructive" }),
  });

  const configMutation = useMutation({
    mutationFn: (intervalMs: number) => apiRequest("PATCH", "/api/nexora/loop/config", { intervalMs }),
    onSuccess: () => {
      toast({ title: "Interval updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
    },
    onError: (err: any) => toast({ title: "Invalid interval", description: err?.message, variant: "destructive" }),
  });

  const systemRunMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/system/run"),
    onSuccess: (data: SystemRunResult) => {
      setSystemRunResult(data);
      toast({ title: "Predictive engine complete", description: `${data.steps?.length || 0} checks · ${data.durationMs}ms` });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/opportunities/top"] });
    },
    onError: (err: any) => toast({ title: "System run failed", description: err?.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      apiRequest("PATCH", `/api/nexora/outreach/${id}/approve`, { action }),
    onSuccess: (_data, { action }) => {
      toast({ title: action === "approve" ? "Outreach approved" : "Outreach rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/outreach/pending"] });
    },
    onError: (err: any) => toast({ title: "Action failed", description: err?.message, variant: "destructive" }),
  });

  const statusBadge = () => {
    if (!loopStatus) return <Badge variant="outline" className="text-white/40 border-white/10">Unknown</Badge>;
    if (loopStatus.running) return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Running</Badge>;
    if (loopStatus.status === "success") return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Success</Badge>;
    if (loopStatus.status === "failed") return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Failed</Badge>;
    return <Badge className="bg-white/10 text-white/40 border-white/10">Idle</Badge>;
  };

  const pred = systemRunResult?.predictive;

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
            <p className="text-white/40 text-sm">Autonomous intelligence loop · top opportunities · outreach approval · signal analytics</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => systemRunMutation.mutate()}
              disabled={systemRunMutation.isPending}
              data-testid="button-system-run"
              className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none"
            >
              {systemRunMutation.isPending ? (
                <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Analysing...</>
              ) : (
                <><ShieldCheck className="mr-2 w-4 h-4" /> Run Predictive Engine</>
              )}
            </Button>
            <Button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || loopStatus?.running}
              data-testid="button-nexora-run-now"
              variant="outline"
              className="border-white/15 text-white/50 hover:bg-white/5 rounded-none"
            >
              {runMutation.isPending || loopStatus?.running ? (
                <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Running...</>
              ) : (
                <><Play className="mr-2 w-4 h-4" /> Run Nexora</>
              )}
            </Button>
          </div>
        </div>

        {/* ── Loop Status Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Loop Status", value: loopStatus?.enabled ? "Enabled" : "Disabled",
              sub: loopStatus?.enabled ? `Every ${(loopStatus.intervalMs / 60000).toFixed(0)}min` : "Manual only",
              icon: Activity, color: loopStatus?.enabled ? "text-green-400" : "text-white/40",
            },
            { label: "Last Run", value: timeAgo(loopStatus?.lastFinishedAt || null), sub: loopStatus?.lastTrigger ? `Via ${loopStatus.lastTrigger}` : "No runs yet", icon: Clock, color: "text-white" },
            { label: "Next Auto Run", value: loopStatus?.nextRunAt ? timeAgo(loopStatus.nextRunAt) : "—", sub: loopStatus?.enabled ? "Scheduled" : "Not scheduled", icon: RefreshCw, color: "text-white" },
            { label: "Total Runs", value: history.length, sub: `${history.filter(r => r.success).length} successful`, icon: BarChart3, color: "text-white" },
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

        {loopStatus?.lastMessage && (
          <div className="p-4 border border-white/8 bg-white/[0.02] mb-6 text-sm text-white/50 font-mono">
            {loopStatus.lastMessage}
          </div>
        )}

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
                { label: "Radar Signals", value: signalSummary.radarSignals, color: "text-blue-300" },
                { label: "Deal Signals", value: signalSummary.dealSignals, color: "text-orange-300" },
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

        {/* ── Top 10 Opportunities Today ── */}
        <div className="mb-6 p-5 border border-white/8 bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h2 className="text-sm font-medium text-white">Top Opportunities Today</h2>
            <span className="text-xs text-white/25 ml-1">— ranked by Nexora score across all signal sources</span>
            <Link href="/admin/deal-hunter" className="ml-auto text-xs text-[hsl(43,78%,52%)]/60 hover:text-[hsl(43,78%,52%)] flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {oppsLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/30 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading live opportunities...
            </div>
          ) : !topOpps?.opportunities?.length ? (
            <div className="py-6 text-center border border-white/5 text-white/30 text-sm">
              No active opportunities. Run Nexora to discover signals.
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
                        <Badge className={`text-[9px] px-1.5 py-0 h-4 capitalize ${signalTypeBadge(opp.signalType)}`}>
                          {opp.signalType}
                        </Badge>
                        <Badge className={`text-[9px] px-1.5 py-0 h-4 capitalize ${confidenceBadge(opp.confidence)}`}>
                          {opp.confidence}
                        </Badge>
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-white/5 text-white/30 border-white/8">
                          {opp.source}
                        </Badge>
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
                        : <Eye className="w-3.5 h-3.5 text-white/20" />
                      }
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
            <div className="py-6 text-center border border-white/5 text-white/30 text-sm">
              No outreach pending approval. Nexora will queue messages here.
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

        {/* ── PREDICTIVE ENGINE RESULTS ── */}
        {systemRunResult && pred && (
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Total Pipeline", value: fmt$(pred.totalPipelineValue), icon: DollarSign, sub: `${pred.totalActive} active deals`, color: "text-[hsl(43,78%,52%)]" },
                { label: "Revenue Won", value: fmt$(pred.totalRevenue), icon: CheckCircle2, sub: "All time", color: "text-green-400" },
                { label: "30-Day Forecast", value: fmt$(pred.predicted30), icon: TrendingUp, sub: "High-confidence pipeline", color: "text-blue-400" },
                { label: "60-Day Forecast", value: fmt$(pred.predicted60), icon: TrendingUp, sub: "Medium-confidence", color: "text-indigo-400" },
                { label: "90-Day Forecast", value: fmt$(pred.predicted90), icon: TrendingUp, sub: "Full pipeline", color: "text-purple-400" },
              ].map(({ label, value, icon: Icon, sub, color }) => (
                <div key={label} className="p-4 border border-white/8 bg-white/[0.02]" data-testid={`stat-predictive-${label.toLowerCase().replace(/ /g, "-")}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="w-3.5 h-3.5 text-white/25" />
                    <span className="text-[10px] text-white/35 uppercase tracking-wide">{label}</span>
                  </div>
                  <div className={`text-lg font-light ${color}`}>{value}</div>
                  <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>

            <div className="p-5 border border-[hsl(43,78%,52%)]/12 bg-[hsl(43,78%,52%)]/3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-sm font-medium text-white">
                  <ShieldCheck className="w-4 h-4 text-[hsl(43,78%,52%)]" /> System Checks
                </h2>
                <span className="text-xs text-white/25">{systemRunResult.durationMs}ms · {new Date(systemRunResult.ranAt).toLocaleString("en-AU")}</span>
              </div>
              <div className="space-y-2">
                {systemRunResult.steps?.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    {step.status === "ok" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    ) : step.status === "warning" ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    ) : step.status === "skipped" ? (
                      <RefreshCw className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-white/70 font-medium min-w-[200px] text-xs">{step.step}</span>
                    <span className="text-white/35 text-xs">{step.detail}</span>
                    {(step.count !== undefined && step.count > 0) && (
                      <span data-testid={`text-step-count-${i}`} className={`text-[10px] px-1.5 py-0.5 font-medium ml-auto ${step.status === "warning" ? "bg-yellow-500/15 text-yellow-300" : "bg-white/8 text-white/40"}`}>{step.count}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {pred.topDeals.length > 0 && (
              <div className="p-5 border border-white/8 bg-white/[0.02]">
                <h2 className="flex items-center gap-2 text-sm font-medium text-white mb-4">
                  <Flame className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  Top Deals to Close
                  <span className="ml-auto text-xs text-white/25 font-normal">Sorted by AI score</span>
                </h2>
                <div className="space-y-2.5">
                  {pred.topDeals.map((deal, i) => (
                    <div key={deal.id} data-testid={`card-top-deal-${deal.id}`} className="flex items-center gap-4 py-2.5 border-b border-white/5 last:border-0">
                      <span className="text-xs text-white/20 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-0.5">
                          <span className="text-sm font-medium text-white">{deal.clientCompany}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 h-4 capitalize ${
                            deal.status === "quoted" ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" :
                            deal.status === "qualified" ? "bg-purple-500/10 text-purple-300 border-purple-500/20" :
                            "bg-white/8 text-white/40 border-white/10"
                          }`}>{deal.status}</Badge>
                        </div>
                        {deal.aiNextBestAction && <p className="text-xs text-[hsl(43,78%,52%)]/60 truncate">{deal.aiNextBestAction}</p>}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 text-right">
                        {deal.aiFitScore && (
                          <div className="text-xs">
                            <div className="text-[hsl(43,78%,52%)] font-semibold">{deal.aiFitScore}</div>
                            <div className="text-white/25">AI score</div>
                          </div>
                        )}
                        <div className="text-sm font-light text-white">{fmt$(deal.estimatedValue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pred.atRisk.length > 0 && (
              <div className="p-5 border border-yellow-500/15 bg-yellow-500/3">
                <h2 className="flex items-center gap-2 text-sm font-medium text-white mb-4">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Deals At Risk
                  <Badge className="ml-1 bg-yellow-500/15 text-yellow-300 border-yellow-500/25">{pred.atRisk.length}</Badge>
                </h2>
                <div className="space-y-2">
                  {pred.atRisk.map(deal => (
                    <div key={deal.id} data-testid={`card-at-risk-${deal.id}`} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white">{deal.clientCompany}</span>
                        <span className="ml-2 text-xs text-white/35 capitalize">{deal.status}</span>
                      </div>
                      <span className="text-xs text-yellow-300/70">{deal.reason}</span>
                      <span className="text-sm font-light text-white/60">{fmt$(deal.estimatedValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {systemRunResult.urgentLeads && systemRunResult.urgentLeads.length > 0 && (
              <div className="p-5 border border-red-500/15 bg-red-500/3">
                <h2 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
                  <Zap className="w-4 h-4 text-red-400" />
                  Urgent — Submitted &gt;48h Ago
                  <Badge className="ml-1 bg-red-500/15 text-red-300 border-red-500/25">{systemRunResult.urgentLeads.length}</Badge>
                </h2>
                <div className="space-y-1.5">
                  {systemRunResult.urgentLeads.map((lead, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-red-300 font-medium">{lead.name}</span>
                      {lead.value > 0 && <span className="text-white/40">{fmt$(lead.value)}</span>}
                      {lead.score && <span className="text-xs text-[hsl(43,78%,52%)]">score {lead.score}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {systemRunResult.staleLeads?.length > 0 && (
              <div className="p-4 border border-yellow-500/10">
                <p className="text-xs text-yellow-300/70 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Stale leads (3+ days, unactioned):</p>
                <div className="flex flex-wrap gap-2">{systemRunResult.staleLeads.map((l, i) => <span key={i} className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-300/70 border border-yellow-500/20">{l}</span>)}</div>
              </div>
            )}
          </div>
        )}

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
            Loop state is process-memory based. pg-boss scheduler runs independently every 30 min.
          </p>
        </div>

        {/* ── Run History ── */}
        <div>
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
              No runs recorded yet. Trigger a manual run above.
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

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Brain, TrendingUp, Mail, Layout, Megaphone, Settings, DollarSign,
  CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw, ChevronRight,
  Activity, BarChart3, Target, Loader2, History, ArrowRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DepartmentResult {
  department: string;
  status: "completed" | "partial" | "blocked" | "failed" | "skipped";
  actionsTaken: string[];
  blockers: string[];
  metrics: Record<string, number | string>;
  recommendations: string[];
}

interface CompanyRunResult {
  runId: string;
  status: "completed" | "partial" | "failed";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  departments: DepartmentResult[];
  summary: string;
  totalActionsTaken: number;
  totalBlockers: number;
  allBlockers: string[];
  allRecommendations: string[];
}

interface StatusResponse {
  isRunning: boolean;
  currentRunId: string | null;
  latest: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    summary?: string;
    departmentResultsJson?: string;
    totalActionsTaken?: number;
    totalBlockers?: number;
  } | null;
}

interface RunHistoryItem {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  summary?: string;
  totalActionsTaken?: number;
  totalBlockers?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEPT_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Intelligence: { icon: Brain, color: "text-violet-400", bg: "bg-[rgba(139,92,246,0.1)] border-[rgba(139,92,246,0.2)]" },
  Sales: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.2)]" },
  Outreach: { icon: Mail, color: "text-blue-400", bg: "bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)]" },
  Workspace: { icon: Layout, color: "text-amber-400", bg: "bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]" },
  Marketing: { icon: Megaphone, color: "text-pink-400", bg: "bg-[rgba(244,114,182,0.1)] border-[rgba(244,114,182,0.2)]" },
  Operations: { icon: Settings, color: "text-cyan-400", bg: "bg-[rgba(34,211,238,0.1)] border-[rgba(34,211,238,0.2)]" },
  Finance: { icon: DollarSign, color: "text-green-400", bg: "bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]" },
};

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: "text-emerald-400", label: "Completed", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  partial: { icon: AlertTriangle, color: "text-amber-400", label: "Partial", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  blocked: { icon: XCircle, color: "text-red-400", label: "Blocked", badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed", badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  skipped: { icon: Clock, color: "text-white/40", label: "Skipped", badge: "bg-white/5 text-white/40 border-white/10" },
  running: { icon: Loader2, color: "text-blue-400", label: "Running", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminAlexDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const authedSession = sessionStorage.getItem("tcd_admin_auth") === "true";
    if (!authedSession) {
      window.location.href = "/admin";
    } else {
      setAuthed(true);
    }
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: statusData, refetch: refetchStatus } = useQuery<StatusResponse>({
    queryKey: ["/api/admin/alex/run-company/status"],
    refetchInterval: (query) => (query.state.data as StatusResponse | undefined)?.isRunning ? 3000 : 30000,
  });

  const { data: history, refetch: refetchHistory } = useQuery<RunHistoryItem[]>({
    queryKey: ["/api/admin/alex/run-company/history"],
    enabled: showHistory,
  });

  // Invalidate status query when a run finishes
  useEffect(() => {
    if (!statusData?.isRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alex/run-company/status"] });
    }
  }, [statusData?.isRunning]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/alex/run-company", { triggeredBy: "manual" }),
    onSuccess: () => {
      toast({ title: "TCD AI Company Running", description: "All 7 departments are executing. Results will appear below." });
      setTimeout(() => refetchStatus(), 1000);
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Run failed";
      if (msg.includes("already in progress")) {
        toast({ title: "Already Running", description: "A company run is already in progress.", variant: "destructive" });
      } else {
        toast({ title: "Run Failed", description: msg, variant: "destructive" });
      }
    },
  });

  // ── Parse latest run ─────────────────────────────────────────────────────────

  const latest = statusData?.latest;
  const departments: DepartmentResult[] = (() => {
    try { return JSON.parse(latest?.departmentResultsJson ?? "[]"); }
    catch { return []; }
  })();
  const isRunning = statusData?.isRunning ?? false;
  const latestStatus = isRunning ? "partial" : (latest?.status ?? null);

  // ── Aggregate company metrics ────────────────────────────────────────────────

  const allBlockers = departments.flatMap(d => d.blockers);
  const allRecs = departments.flatMap(d => d.recommendations);
  const activeMetrics = {
    totalLeads: (departments.find(d => d.department === "Intelligence")?.metrics?.totalLeads ?? 0) as number,
    activeDeals: (departments.find(d => d.department === "Sales")?.metrics?.activeDeals ?? 0) as number,
    totalSent: (departments.find(d => d.department === "Outreach")?.metrics?.totalSent ?? 0) as number,
    draftQueued: (departments.find(d => d.department === "Outreach")?.metrics?.draftQueued ?? 0) as number,
    workspaceRequests: (departments.find(d => d.department === "Workspace")?.metrics?.totalRequests ?? 0) as number,
    paidPlans: (departments.find(d => d.department === "Workspace")?.metrics?.paidUnlocked ?? 0) as number,
    revenue: (departments.find(d => d.department === "Finance")?.metrics?.totalRevenueAud ?? 0) as number,
    pipelineValue: (departments.find(d => d.department === "Sales")?.metrics?.pipelineValueAud ?? 0) as number,
  };

  const selectedDeptData = departments.find(d => d.department === selectedDept);

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white/40 text-sm">Verifying admin access...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <div className="border-b border-white/[0.08] bg-[hsl(220,20%,5%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.25)] flex items-center justify-center">
              <Brain className="w-5 h-5 text-[hsl(43,78%,65%)]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">TCD AI Company</h1>
              <p className="text-white/35 text-xs mt-0.5">Alex Executive Orchestrator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {latestStatus && (
              <Badge className={`text-xs border ${STATUS_CONFIG[latestStatus as keyof typeof STATUS_CONFIG]?.badge ?? "bg-white/5 text-white/40 border-white/10"}`}>
                {isRunning
                  ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running</>
                  : <>{latestStatus}</>}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white/60 hover:text-white"
              onClick={() => { setShowHistory(s => !s); refetchHistory(); }}
              data-testid="btn-toggle-history"
            >
              <History className="w-3.5 h-3.5 mr-1.5" />
              History
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white/60 hover:text-white"
              onClick={() => refetchStatus()}
              data-testid="btn-refresh-status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ONE BUTTON */}
        <div className="luxury-card rounded-2xl p-8 text-center space-y-5 border border-[rgba(201,168,76,0.15)]">
          <div className="space-y-1">
            <h2 className="text-2xl font-serif font-bold text-white">Run TCD AI Company</h2>
            <p className="text-white/40 text-sm max-w-lg mx-auto">
              Executes all 7 AI departments in sequence using real data. Intelligence → Sales → Outreach → Workspace → Marketing → Operations → Finance.
            </p>
          </div>

          <Button
            data-testid="btn-run-tcd-company"
            disabled={isRunning || runMutation.isPending}
            onClick={() => runMutation.mutate()}
            className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,5%)] font-bold px-10 py-4 h-auto text-base rounded-xl shadow-lg"
          >
            {isRunning || runMutation.isPending ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Running All Departments...</>
            ) : (
              <><Zap className="w-5 h-5 mr-2" /> RUN TCD AI COMPANY</>
            )}
          </Button>

          {isRunning && (
            <div className="flex items-center justify-center gap-2 text-blue-400 text-sm">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>Departments executing — auto-refreshing every 2.5s</span>
            </div>
          )}

          {latest && !isRunning && (
            <p className="text-white/25 text-xs">
              Last run: {new Date(latest.startedAt).toLocaleString("en-AU")}
              {latest.durationMs ? ` · ${(latest.durationMs / 1000).toFixed(1)}s` : ""}
              {` · ${latest.totalActionsTaken ?? 0} actions · ${latest.totalBlockers ?? 0} blockers`}
            </p>
          )}
        </div>

        {/* Alex Executive Summary */}
        {latest?.summary && !isRunning && (
          <div className="luxury-card rounded-xl p-6 border border-[rgba(201,168,76,0.12)]">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-[hsl(43,78%,65%)]" />
              <span className="text-[hsl(43,78%,65%)] font-semibold text-sm">Alex Executive Summary</span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">{latest.summary}</p>
          </div>
        )}

        {/* Company Metrics */}
        {departments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Leads", value: activeMetrics.totalLeads.toLocaleString(), icon: Target, color: "text-violet-400" },
              { label: "Active Deals", value: activeMetrics.activeDeals.toLocaleString(), icon: TrendingUp, color: "text-emerald-400" },
              { label: "Emails Sent", value: activeMetrics.totalSent.toLocaleString(), icon: Mail, color: "text-blue-400" },
              { label: "Queued to Send", value: activeMetrics.draftQueued.toLocaleString(), icon: Clock, color: "text-amber-400" },
              { label: "Workspace Requests", value: activeMetrics.workspaceRequests.toLocaleString(), icon: Layout, color: "text-pink-400" },
              { label: "Paid Plans", value: activeMetrics.paidPlans.toLocaleString(), icon: CheckCircle2, color: "text-green-400" },
              { label: "Revenue (AUD)", value: `$${(activeMetrics.revenue as number).toLocaleString("en-AU")}`, icon: DollarSign, color: "text-green-400" },
              { label: "Pipeline Value", value: `$${(activeMetrics.pipelineValue as number).toLocaleString("en-AU")}`, icon: BarChart3, color: "text-cyan-400" },
            ].map((m) => (
              <div key={m.label} className="luxury-card rounded-xl p-4" data-testid={`metric-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <m.icon className={`w-4 h-4 ${m.color} mb-2`} />
                <div className="text-white font-bold text-xl leading-none">{m.value}</div>
                <div className="text-white/40 text-xs mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Department Status Cards */}
        {departments.length > 0 && (
          <div>
            <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">Department Status</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {departments.map((dept) => {
                const meta = DEPT_META[dept.department];
                const sc = STATUS_CONFIG[dept.status] ?? STATUS_CONFIG.skipped;
                const Icon = meta?.icon ?? Activity;
                const StatusIcon = sc.icon;
                return (
                  <button
                    key={dept.department}
                    data-testid={`dept-card-${dept.department.toLowerCase()}`}
                    onClick={() => setSelectedDept(d => d === dept.department ? null : dept.department)}
                    className={`luxury-card rounded-xl p-4 text-left transition-all border-2 ${
                      selectedDept === dept.department ? "border-[hsl(43,78%,52%)]" : "border-transparent hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${meta?.bg ?? "bg-white/5 border-white/10"}`}>
                        <Icon className={`w-4 h-4 ${meta?.color ?? "text-white/60"}`} />
                      </div>
                      <Badge className={`text-xs border ${sc.badge}`}>
                        <StatusIcon className={`w-3 h-3 mr-1 ${dept.status === "partial" ? "animate-spin" : ""}`} />
                        {sc.label}
                      </Badge>
                    </div>
                    <div className="text-white font-semibold text-sm">{dept.department}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="text-white/40">{dept.actionsTaken.length} actions</span>
                      {dept.blockers.length > 0 && (
                        <span className="text-red-400/80">{dept.blockers.length} blockers</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Department Detail Drill-down */}
        {selectedDeptData && (
          <div className="luxury-card rounded-xl p-6 space-y-5" data-testid="panel-dept-detail">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const meta = DEPT_META[selectedDeptData.department];
                  const Icon = meta?.icon ?? Activity;
                  return <Icon className={`w-5 h-5 ${meta?.color ?? "text-white/60"}`} />;
                })()}
                <h3 className="text-white font-semibold">{selectedDeptData.department} AI — Detail</h3>
              </div>
              <button onClick={() => setSelectedDept(null)} className="text-white/30 hover:text-white/60 text-xs">
                Close ×
              </button>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {/* Actions */}
              <div className="sm:col-span-1">
                <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Actions Taken</div>
                <div className="space-y-1.5">
                  {selectedDeptData.actionsTaken.length === 0
                    ? <p className="text-white/25 text-xs">No actions recorded</p>
                    : selectedDeptData.actionsTaken.map((a, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-white/65 text-xs">{a}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Blockers */}
              <div>
                <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Blockers</div>
                <div className="space-y-1.5">
                  {selectedDeptData.blockers.length === 0
                    ? <p className="text-white/25 text-xs">No blockers</p>
                    : selectedDeptData.blockers.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="text-white/65 text-xs">{b}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Recommendations</div>
                <div className="space-y-1.5">
                  {selectedDeptData.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span className="text-white/65 text-xs">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics */}
            {Object.keys(selectedDeptData.metrics).length > 0 && (
              <div>
                <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Metrics</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(selectedDeptData.metrics).slice(0, 12).map(([k, v]) => (
                    <div key={k} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                      <div className="text-white font-semibold text-sm">{String(v)}</div>
                      <div className="text-white/35 text-xs mt-0.5">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Blockers Panel */}
        {allBlockers.length > 0 && !isRunning && (
          <div className="luxury-card rounded-xl p-6 border border-red-500/10" data-testid="panel-blockers">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-white font-semibold text-sm">Company Blockers ({allBlockers.length})</h3>
            </div>
            <div className="space-y-2">
              {allBlockers.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/65 text-xs">{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {departments.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: "View Outreach Queue", href: "/admin/leads", icon: Mail },
              { label: "Open Deal Pipeline", href: "/admin/command-centre", icon: TrendingUp },
              { label: "Workspace Requests", href: "/admin/planning-requests", icon: Layout },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="luxury-card rounded-xl p-4 flex items-center gap-3 hover:border-white/15 border border-transparent transition-all"
                data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <action.icon className="w-4 h-4 text-white/50" />
                <span className="text-white/70 text-sm">{action.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/25 ml-auto" />
              </a>
            ))}
          </div>
        )}

        {/* Run History */}
        {showHistory && (
          <div className="luxury-card rounded-xl p-6" data-testid="panel-run-history">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-white/60" />
              <h3 className="text-white font-semibold text-sm">Run History</h3>
              <button onClick={() => refetchHistory()} className="ml-auto text-white/30 hover:text-white/60">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {!history || history.length === 0 ? (
              <p className="text-white/25 text-sm">No runs recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((run) => {
                  const sc = STATUS_CONFIG[run.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.skipped;
                  const StatusIcon = sc.icon;
                  return (
                    <div key={run.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <StatusIcon className={`w-4 h-4 ${sc.color} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-xs font-medium">{new Date(run.startedAt).toLocaleString("en-AU")}</span>
                          <Badge className={`text-xs border ${sc.badge}`}>{run.status}</Badge>
                          {run.durationMs && <span className="text-white/30 text-xs">{(run.durationMs / 1000).toFixed(1)}s</span>}
                          {run.totalActionsTaken != null && <span className="text-white/30 text-xs">{run.totalActionsTaken} actions</span>}
                          {(run.totalBlockers ?? 0) > 0 && <span className="text-amber-400/60 text-xs">{run.totalBlockers} blockers</span>}
                        </div>
                        {run.summary && <p className="text-white/35 text-xs mt-1 leading-relaxed truncate">{run.summary}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {departments.length === 0 && !isRunning && (
          <div className="text-center py-12 text-white/25">
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No run data yet. Press the button above to execute the first company run.</p>
          </div>
        )}
      </div>
    </div>
  );
}

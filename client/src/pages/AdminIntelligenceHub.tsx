import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Brain, Activity, TrendingUp, AlertTriangle, FileText, Newspaper,
  RefreshCw, Play, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  ArrowLeft, Shield, Eye, Trash2, BarChart3, Zap, Globe,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


const JOB_TYPES = [
  { id: "system_health", label: "System Health Check", icon: Shield, color: "text-blue-400", interval: "Every 12 hours" },
  { id: "spending_trends", label: "Spending Trend Analysis", icon: TrendingUp, color: "text-emerald-400", interval: "Every 24 hours" },
  { id: "website_issues", label: "Website Issue Detection", icon: AlertTriangle, color: "text-amber-400", interval: "Every 24 hours" },
  { id: "seo_content", label: "SEO Blog Article Generation", icon: Newspaper, color: "text-purple-400", interval: "Every 7 days" },
  { id: "weekly_report", label: "Weekly Business Report", icon: BarChart3, color: "text-rose-400", interval: "Every 7 days" },
];

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; icon: any; label: string }> = {
    completed: { color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: CheckCircle, label: "Completed" },
    running: { color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: RefreshCw, label: "Running" },
    failed: { color: "bg-red-500/20 text-red-300 border-red-500/30", icon: XCircle, label: "Failed" },
    pending: { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: Clock, label: "Pending" },
  };
  const cfg = configs[status] || configs.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const configs: Record<string, string> = {
    critical: "bg-red-500/20 text-red-300 border-red-500/30",
    warning: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    info: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${configs[severity] || configs.info}`}>
      {severity}
    </span>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const configs: Record<string, string> = {
    growing: "bg-emerald-500/20 text-emerald-300",
    declining: "bg-red-500/20 text-red-300",
    stable: "bg-zinc-500/20 text-zinc-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${configs[trend] || configs.stable}`}>
      {trend === "growing" ? "↑" : trend === "declining" ? "↓" : "→"} {trend}
    </span>
  );
}

function JobsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/jobs"],
  });

  const triggerMutation = useMutation({
    mutationFn: (jobType: string) =>
      apiRequest("POST", "/api/admin/intelligence/jobs/trigger", { jobType }),
    onMutate: (jobType) => setTriggeringJob(jobType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/jobs"] });
      toast({ title: "Job triggered", description: "Intelligence job started in background" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    onSettled: () => setTriggeringJob(null),
  });

  const recentByType = (type: string) =>
    jobs.filter((j) => j.jobType === type).slice(0, 1)[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Autonomous Job Engine</h2>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/jobs"] })}
          className="text-zinc-400 hover:text-white text-sm flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {JOB_TYPES.map((job) => {
          const lastRun = recentByType(job.id);
          const Icon = job.icon;
          const isTriggering = triggeringJob === job.id;
          return (
            <div key={job.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg bg-zinc-900/60 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${job.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{job.label}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">{job.interval}</p>
                    {lastRun && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <StatusBadge status={lastRun.status} />
                        {lastRun.durationMs && (
                          <span className="text-zinc-500 text-xs">{(lastRun.durationMs / 1000).toFixed(1)}s</span>
                        )}
                        {lastRun.completedAt && (
                          <span className="text-zinc-500 text-xs">
                            {new Date(lastRun.completedAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        )}
                      </div>
                    )}
                    {lastRun?.result && (
                      <p className="text-zinc-400 text-xs mt-1 truncate">{lastRun.result}</p>
                    )}
                    {lastRun?.error && (
                      <p className="text-red-400 text-xs mt-1 truncate">Error: {lastRun.error}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => triggerMutation.mutate(job.id)}
                  disabled={isTriggering}
                  data-testid={`trigger-job-${job.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg border border-amber-500/20 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {isTriggering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {isTriggering ? "Starting..." : "Run Now"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/reports"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/intelligence/reports/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/reports"] });
      toast({ title: "Report updated" });
    },
  });

  if (isLoading) return <div className="text-zinc-500 text-sm">Loading reports...</div>;
  if (reports.length === 0)
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No reports yet — trigger Weekly Report job to generate one</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <div key={report.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-start justify-between gap-3 p-4 text-left"
            onClick={() => setExpanded(expanded === report.id ? null : report.id)}
            data-testid={`report-toggle-${report.id}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white text-sm font-medium">{report.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  report.status === "published"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-zinc-700/50 text-zinc-400 border-zinc-600/50"
                }`}>{report.status}</span>
              </div>
              <p className="text-zinc-500 text-xs mt-0.5">
                {report.period} · {new Date(report.generatedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            {expanded === report.id ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />}
          </button>
          {expanded === report.id && (
            <div className="border-t border-zinc-700/50 px-4 pb-4">
              <div className="prose prose-sm prose-invert max-w-none mt-3">
                <pre className="whitespace-pre-wrap text-zinc-300 text-xs font-mono bg-zinc-900/50 p-3 rounded-lg overflow-auto max-h-96">
                  {report.content}
                </pre>
              </div>
              <div className="flex gap-2 mt-3">
                {report.status === "draft" && (
                  <button
                    onClick={() => statusMutation.mutate({ id: report.id, status: "published" })}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors"
                  >
                    Publish
                  </button>
                )}
                {report.status === "published" && (
                  <button
                    onClick={() => statusMutation.mutate({ id: report.id, status: "draft" })}
                    className="px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded-lg border border-zinc-600/50 transition-colors"
                  >
                    Unpublish
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TrendsPanel() {
  const { data: trends = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/trends"],
  });

  if (isLoading) return <div className="text-zinc-500 text-sm">Loading trends...</div>;
  if (trends.length === 0)
    return (
      <div className="text-center py-8">
        <TrendingUp className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No trend data yet — trigger Spending Trend Analysis to generate insights</p>
      </div>
    );

  const grouped = trends.reduce((acc: Record<string, any[]>, t) => {
    const week = t.periodWeek;
    if (!acc[week]) acc[week] = [];
    acc[week].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([week, items]) => (
        <div key={week}>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">{week}</p>
          <div className="grid grid-cols-1 gap-3">
            {items.map((trend) => (
              <div key={trend.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-white text-sm font-medium">{trend.category}</p>
                      <TrendBadge trend={trend.trend} />
                      <span className={`text-xs px-1.5 py-0.5 rounded text-zinc-400 bg-zinc-900/60`}>
                        {trend.confidenceLevel} confidence
                      </span>
                    </div>
                    <p className="text-zinc-300 text-sm leading-relaxed">{trend.insight}</p>
                    {trend.sourceNotes && (
                      <p className="text-zinc-500 text-xs mt-2 italic">{trend.sourceNotes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function IssuesPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: issues = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/issues"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/intelligence/issues/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/issues"] });
      toast({ title: "Issue updated" });
    },
  });

  if (isLoading) return <div className="text-zinc-500 text-sm">Loading issues...</div>;
  if (issues.length === 0)
    return (
      <div className="text-center py-8">
        <Globe className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No website issues detected — trigger Website Issue Detection to audit</p>
      </div>
    );

  const open = issues.filter((i) => i.status === "open");
  const resolved = issues.filter((i) => i.status === "resolved");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-300 text-sm font-medium">{open.length} open</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-300 text-sm font-medium">{resolved.length} resolved</span>
        </div>
      </div>
      <div className="space-y-3">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className={`bg-zinc-800/50 border rounded-xl p-4 ${
              issue.status === "resolved" ? "border-zinc-700/30 opacity-60" : "border-zinc-700/50"
            }`}
            data-testid={`issue-${issue.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <SeverityBadge severity={issue.severity} />
                  <span className="text-xs text-zinc-500 font-mono bg-zinc-900/60 px-1.5 py-0.5 rounded">
                    {issue.issueType}
                  </span>
                  {issue.status === "resolved" && (
                    <span className="text-xs text-emerald-400">✓ Resolved</span>
                  )}
                </div>
                <p className="text-white text-sm font-medium">{issue.description}</p>
                {issue.affectedUrl && (
                  <p className="text-zinc-500 text-xs mt-1 font-mono">{issue.affectedUrl}</p>
                )}
                {issue.suggestion && (
                  <p className="text-amber-300/80 text-xs mt-2 italic">→ {issue.suggestion}</p>
                )}
              </div>
              {issue.status === "open" && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => statusMutation.mutate({ id: issue.id, status: "resolved" })}
                    className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs rounded-lg border border-emerald-500/20 transition-colors"
                    data-testid={`resolve-issue-${issue.id}`}
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ id: issue.id, status: "ignored" })}
                    className="px-2.5 py-1.5 bg-zinc-700/30 hover:bg-zinc-700/50 text-zinc-500 text-xs rounded-lg border border-zinc-600/30 transition-colors"
                  >
                    Ignore
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlogArticlesPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: articles = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/blog-articles"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/intelligence/blog-articles/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/blog-articles"] });
      toast({ title: "Article updated" });
    },
  });

  if (isLoading) return <div className="text-zinc-500 text-sm">Loading articles...</div>;
  if (articles.length === 0)
    return (
      <div className="text-center py-8">
        <Newspaper className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No blog articles generated yet — trigger SEO Blog Article Generation</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {articles.map((article) => (
        <div key={article.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-start justify-between gap-3 p-4 text-left"
            onClick={() => setExpanded(expanded === article.id ? null : article.id)}
            data-testid={`article-toggle-${article.id}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white text-sm font-medium">{article.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  article.status === "approved" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                  article.status === "published" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                  article.status === "rejected" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                  "bg-zinc-700/50 text-zinc-400 border-zinc-600/50"
                }`}>{article.status}</span>
                {article.qualityScore && (
                  <span className="text-xs text-zinc-400">Quality: {article.qualityScore}/100</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {article.category && <span className="text-zinc-500 text-xs">{article.category}</span>}
                <span className="text-zinc-600 text-xs">
                  {new Date(article.generatedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            </div>
            {expanded === article.id ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />}
          </button>
          {expanded === article.id && (
            <div className="border-t border-zinc-700/50 px-4 pb-4">
              {article.metaDescription && (
                <div className="mt-3 bg-zinc-900/40 rounded-lg p-3">
                  <p className="text-zinc-500 text-xs font-medium mb-1">META DESCRIPTION</p>
                  <p className="text-zinc-300 text-sm">{article.metaDescription}</p>
                </div>
              )}
              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {article.tags.map((tag: string) => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-zinc-700/50 text-zinc-400 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <pre className="whitespace-pre-wrap text-zinc-300 text-xs font-mono bg-zinc-900/50 p-3 rounded-lg overflow-auto max-h-64 mt-3">
                {article.content}
              </pre>
              <div className="flex gap-2 mt-3">
                {article.status === "draft" && (
                  <>
                    <button
                      onClick={() => statusMutation.mutate({ id: article.id, status: "approved" })}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => statusMutation.mutate({ id: article.id, status: "rejected" })}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/20 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {article.status === "approved" && (
                  <button
                    onClick={() => statusMutation.mutate({ id: article.id, status: "published" })}
                    className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium rounded-lg border border-blue-500/20 transition-colors"
                  >
                    Mark Published
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const TABS = [
  { id: "jobs", label: "Job Engine", icon: Zap },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "trends", label: "Spending Trends", icon: TrendingUp },
  { id: "issues", label: "Website Issues", icon: AlertTriangle },
  { id: "blog", label: "SEO Articles", icon: Newspaper },
];

export default function AdminIntelligenceHub() {
  const [tab, setTab] = useState("jobs");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-zinc-500 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h1 className="text-white font-semibold text-base">Intelligence Hub</h1>
                <p className="text-zinc-500 text-xs">Autonomous Business Intelligence Layer</p>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-px">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  data-testid={`tab-${t.id}`}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === t.id
                      ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "jobs" && <JobsPanel />}
        {tab === "reports" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Business Intelligence Reports</h2>
            <ReportsPanel />
          </div>
        )}
        {tab === "trends" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Market Spending Trends</h2>
            <TrendsPanel />
          </div>
        )}
        {tab === "issues" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Website & Conversion Issues</h2>
            <IssuesPanel />
          </div>
        )}
        {tab === "blog" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">AI-Generated SEO Articles</h2>
            <BlogArticlesPanel />
          </div>
        )}
      </div>
    </div>
  );
}

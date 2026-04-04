import { useQuery } from "@tanstack/react-query";
import { Loader2, Database, Key, Activity, ArrowLeft, Clock } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

interface RuntimeState {
  isLocked: boolean;
  activeLock: { id: number; lockKey: string; runId: string; acquiredAt: string; expiresAt: string | null } | null;
  loopEnabled: boolean; loopRunning: boolean; loopIntervalMs: number;
  loopRunCount: number; loopLastRunAt: string | null; loopLastError: string | null;
  lastRunResult: { success: boolean; message: string } | null;
  bgLastRunId: string | null; bgLastStartedAt: string | null;
  bgLastFinishedAt: string | null; bgLastError: string | null;
  failedJobs: { name: string; state: string; retryCount: number; createdOn: string }[];
  failedJobCount: number; retryJobCount: number; approvalQueueCount: number;
  latestRunId: string | null;
}

interface HealthCheck {
  healthy: boolean; status: string; failCount: number; passCount: number;
  checkedAt: string; checks: Record<string, { pass: boolean; detail: string }>;
}

export default function AdminNexoraAdvanced() {
  const { data: runtimeState, isLoading: runtimeLoading } = useQuery<RuntimeState>({
    queryKey: ["/api/nexora/runtime-state"],
    refetchInterval: 10000,
  });

  const { data: healthData, isLoading: healthLoading } = useQuery<HealthCheck>({
    queryKey: ["/api/nexora/health"],
    refetchInterval: 30000,
  });

  const { data: decisions, isLoading: decisionsLoading } = useQuery<{ decisions: any[]; total: number }>({
    queryKey: ["/api/nexora/decisions"],
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/admin/nexora" className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Nexora
          </Link>
          <span className="text-white/15">·</span>
          <span className="text-xs text-white/40">Advanced · audit logs · runtime state · diagnostics</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Raw Runtime State */}
        <div className="border border-white/8 bg-white/[0.02]">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm font-medium text-white">Raw Runtime State</span>
            {runtimeLoading && <Loader2 className="w-3 h-3 animate-spin text-white/30 ml-1" />}
            <span className="ml-auto text-[10px] text-white/20">10s refresh</span>
          </div>
          {runtimeState ? (
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5 border-b border-white/5">
              {[
                { label: "Loop Enabled", value: runtimeState.loopEnabled ? "true" : "false", color: runtimeState.loopEnabled ? "text-green-400" : "text-white/40" },
                { label: "Loop Running", value: runtimeState.loopRunning ? "true" : "false", color: runtimeState.loopRunning ? "text-blue-400" : "text-white/40" },
                { label: "Is Locked", value: runtimeState.isLocked ? "true" : "false", color: runtimeState.isLocked ? "text-orange-400" : "text-white/40" },
                { label: "Run Count", value: runtimeState.loopRunCount, color: "text-white" },
                { label: "Failed Jobs", value: runtimeState.failedJobCount, color: runtimeState.failedJobCount > 0 ? "text-red-400" : "text-white/40" },
                { label: "Retry Jobs", value: runtimeState.retryJobCount, color: runtimeState.retryJobCount > 0 ? "text-yellow-400" : "text-white/40" },
                { label: "Approval Queue", value: runtimeState.approvalQueueCount, color: runtimeState.approvalQueueCount > 0 ? "text-yellow-400" : "text-white/40" },
                { label: "Last Run", value: timeAgo(runtimeState.bgLastFinishedAt ?? runtimeState.loopLastRunAt), color: "text-white/60" },
              ].map(({ label, value, color }) => (
                <div key={label} className="px-4 py-3 text-center">
                  <div className={`text-sm font-light mb-0.5 ${color}`}>{value}</div>
                  <div className="text-[9px] text-white/25 uppercase tracking-wide">{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-white/25 text-sm">Loading runtime state…</div>
          )}
          {runtimeState?.activeLock && (
            <div className="px-5 py-3 bg-orange-500/5 border-t border-orange-500/15 text-xs">
              <span className="text-orange-400 font-medium">Active Lock: </span>
              <span className="text-white/50 font-mono">{runtimeState.activeLock.lockKey}</span>
              <span className="text-white/25 ml-3">Run: {runtimeState.activeLock.runId}</span>
              <span className="text-white/25 ml-3">Since: {timeAgo(runtimeState.activeLock.acquiredAt)}</span>
            </div>
          )}
          {runtimeState?.latestRunId && (
            <div className="px-5 py-2.5 border-t border-white/5 text-[11px] text-white/25 font-mono">
              Latest run ID: {runtimeState.latestRunId}
            </div>
          )}
          {runtimeState?.bgLastError && (
            <div className="px-5 py-2.5 border-t border-red-500/15 text-[11px] text-red-300/70">
              Last error: {runtimeState.bgLastError}
            </div>
          )}
        </div>

        {/* Health Checks — raw detail */}
        <div className="border border-white/8 bg-white/[0.02]">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm font-medium text-white">Health Check Detail</span>
            {healthData && (
              <Badge className={`ml-2 text-[10px] px-2 h-5 ${
                healthData.status === "healthy" ? "bg-green-500/15 text-green-300 border-green-500/25" :
                healthData.status === "degraded" ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" :
                "bg-red-500/15 text-red-300 border-red-500/25"
              }`}>{healthData.status} · {healthData.passCount}/{healthData.passCount + healthData.failCount}</Badge>
            )}
            {healthLoading && <Loader2 className="w-3 h-3 animate-spin text-white/30 ml-1" />}
            {healthData && (
              <span className="ml-auto text-[10px] text-white/20">
                <Clock className="w-3 h-3 inline mr-1" />{timeAgo(healthData.checkedAt)}
              </span>
            )}
          </div>
          {healthData ? (
            <div className="divide-y divide-white/5">
              {Object.entries(healthData.checks).map(([key, check]) => (
                <div key={key} className="px-5 py-3 text-xs">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-medium font-mono ${check.pass ? "text-green-400" : "text-red-400"}`}>{check.pass ? "PASS" : "FAIL"}</span>
                    <span className="text-white/50 font-mono">{key}</span>
                  </div>
                  <p className="text-[11px] text-white/30 pl-10">{check.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-white/25 text-sm">Health data unavailable</div>
          )}
        </div>

        {/* Decision Audit Log */}
        <div className="border border-white/8 bg-white/[0.02]">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm font-medium text-white">Decision Audit Log</span>
            {decisionsLoading && <Loader2 className="w-3 h-3 animate-spin text-white/30 ml-1" />}
            <span className="ml-auto text-[10px] text-white/20">{decisions?.total ?? 0} total rows</span>
          </div>
          {decisions?.decisions.length ? (
            <div className="divide-y divide-white/5 font-mono text-[11px]">
              {decisions.decisions.slice(0, 30).map((d) => (
                <div key={d.id} className="px-5 py-2.5 flex items-start gap-3 hover:bg-white/[0.02]">
                  <span className="text-white/20 w-14 flex-shrink-0 truncate">{d.id?.slice(0, 8) ?? "—"}</span>
                  <span className="text-white/50 flex-1 truncate">{d.companyName ?? "—"}</span>
                  <span className={`flex-shrink-0 ${d.action === "push_pipeline" ? "text-blue-300" : d.action === "push_radar" ? "text-purple-300" : "text-white/30"}`}>{d.action}</span>
                  <span className="text-white/30 flex-shrink-0 w-8 text-right">{Math.round((d.confidence ?? 0) * 100)}%</span>
                  <div className="flex gap-1 flex-shrink-0">
                    {d.pushedPipeline && <span className="text-blue-400/60">✓P</span>}
                    {d.pushedRadar && <span className="text-purple-400/60">✓R</span>}
                  </div>
                  <span className="text-white/20 flex-shrink-0">{timeAgo(d.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-white/25 text-sm">No decisions recorded.</div>
          )}
        </div>

        {/* Failed Jobs Detail */}
        {runtimeState?.failedJobs && runtimeState.failedJobs.length > 0 && (
          <div className="border border-red-500/15 bg-red-500/[0.02]">
            <div className="px-5 py-3 border-b border-red-500/15 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-red-400" />
              <span className="text-sm font-medium text-white">Failed Jobs Detail</span>
            </div>
            <div className="divide-y divide-white/5 font-mono text-xs">
              {runtimeState.failedJobs.map((j, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                  <span className="text-red-400 flex-shrink-0">{j.state}</span>
                  <span className="text-white/50 flex-1 truncate">{j.name}</span>
                  <span className="text-yellow-400/60 flex-shrink-0">×{j.retryCount} retries</span>
                  <span className="text-white/25 flex-shrink-0">{timeAgo(j.createdOn)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

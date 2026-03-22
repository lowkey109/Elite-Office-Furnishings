import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Play, Square, RefreshCw, Clock, Activity, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Settings, History, BarChart3,
} from "lucide-react";

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

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function AdminNexoraCommandCentre() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [intervalInput, setIntervalInput] = useState("30");

  const { data: loopStatus, isLoading: statusLoading } = useQuery<LoopStatus>({
    queryKey: ["/api/nexora/loop/status"],
    refetchInterval: 5000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<NexoraRun[]>({
    queryKey: ["/api/nexora/history"],
    refetchInterval: 15000,
  });

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/nexora/loop/run-now"),
    onSuccess: () => {
      toast({ title: "Nexora started", description: "Cycle is running — results will appear in history." });
      queryClient.invalidateQueries({ queryKey: ["/api/nexora/loop/status"] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/nexora/history"] }), 8000);
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

  const statusBadge = () => {
    if (!loopStatus) return <Badge variant="outline" className="text-white/40 border-white/10">Unknown</Badge>;
    if (loopStatus.running) return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Running</Badge>;
    if (loopStatus.status === "success") return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Success</Badge>;
    if (loopStatus.status === "failed") return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Failed</Badge>;
    return <Badge className="bg-white/10 text-white/40 border-white/10">Idle</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              <h1 className="text-2xl font-light text-white">Nexora Command Centre</h1>
              {statusBadge()}
            </div>
            <p className="text-white/40 text-sm">Autonomous intelligence loop — radar scanning, deal hunting, outreach</p>
          </div>
          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || loopStatus?.running}
            data-testid="button-nexora-run-now"
            className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none"
          >
            {runMutation.isPending || loopStatus?.running ? (
              <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Running...</>
            ) : (
              <><Play className="mr-2 w-4 h-4" /> Run Now</>
            )}
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Loop Status",
              value: loopStatus?.enabled ? "Enabled" : "Disabled",
              sub: loopStatus?.enabled ? `Every ${(loopStatus.intervalMs / 60000).toFixed(0)}min` : "Manual only",
              icon: Activity,
              color: loopStatus?.enabled ? "text-green-400" : "text-white/40",
            },
            {
              label: "Last Run",
              value: timeAgo(loopStatus?.lastFinishedAt || null),
              sub: loopStatus?.lastTrigger ? `Via ${loopStatus.lastTrigger}` : "No runs yet",
              icon: Clock,
              color: "text-white",
            },
            {
              label: "Next Auto Run",
              value: loopStatus?.nextRunAt ? timeAgo(loopStatus.nextRunAt) : "—",
              sub: loopStatus?.enabled ? "Scheduled" : "Not scheduled",
              icon: RefreshCw,
              color: "text-white",
            },
            {
              label: "Total Runs",
              value: history.length,
              sub: `${history.filter(r => r.success).length} successful`,
              icon: BarChart3,
              color: "text-white",
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

        {/* Last Message */}
        {loopStatus?.lastMessage && (
          <div className="p-4 border border-white/8 bg-white/[0.02] mb-8 text-sm text-white/50 font-mono">
            {loopStatus.lastMessage}
          </div>
        )}

        {/* Loop Controls */}
        <div className="p-6 border border-white/8 bg-white/[0.02] mb-8">
          <h2 className="flex items-center gap-2 text-base font-medium text-white mb-5">
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
          <p className="mt-4 text-xs text-white/25">
            Note: Loop state is process-memory based. It will reset on server restart.
            The pg-boss scheduler independently triggers every 30 minutes regardless of this toggle.
          </p>
        </div>

        {/* Run History */}
        <div>
          <h2 className="flex items-center gap-2 text-base font-medium text-white mb-4">
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
                <div key={run.id} data-testid={`row-nexora-run-${run.id}`} className="flex items-center gap-4 p-4 border border-white/8 bg-white/[0.02] hover:bg-white/5 transition-colors">
                  <div className="flex-shrink-0">
                    {run.success
                      ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                      : <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/70 truncate">{run.message}</div>
                    <div className="text-xs text-white/30 mt-0.5">
                      {new Date(run.startedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-6 text-xs text-white/40">
                    <span data-testid={`text-run-signals-${run.id}`}>{run.radarSignals + run.dealSignals} signals</span>
                    <span>{run.outreachRuns} outreach</span>
                    <span className="text-white/25">{formatMs(run.durationMs)}</span>
                    <Badge
                      className={run.success ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}
                    >
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

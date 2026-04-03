import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Brain, TrendingUp, Mail, Target, Clock,
  ChevronDown, ChevronRight, Shield, Zap, AlertTriangle,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

function formatAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatCurrency(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2" data-testid="confidence-bar">
      <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-white/60">{pct}%</span>
    </div>
  );
}

function DecisionRow({ decision, index }: { decision: any; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const actionColor: Record<string, string> = {
    pushed_pipeline: "text-emerald-400",
    pushed_radar: "text-blue-400",
    outreach_queued: "text-amber-400",
    skipped: "text-white/30",
  };

  const actionIcon: Record<string, any> = {
    pushed_pipeline: TrendingUp,
    pushed_radar: Target,
    outreach_queued: Mail,
  };

  const Icon = actionIcon[decision.action] || Brain;

  return (
    <div
      className={`border border-white/5 rounded-lg transition-all duration-300 ${index === 0 ? "ring-1 ring-[#C9A84C]/30 bg-white/[0.03]" : "bg-white/[0.015] hover:bg-white/[0.03]"}`}
      data-testid={`decision-row-${decision.id}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        data-testid={`decision-toggle-${decision.id}`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${actionColor[decision.action] || "text-white/40"}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{decision.companyName || "Unknown"}</span>
            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${actionColor[decision.action] || "text-white/40"} bg-white/5`}>
              {(decision.action || "").replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-white/30 font-mono">{decision.signalType || "signal"}</span>
            <span className="text-[11px] text-white/20">{formatAgo(decision.createdAt)}</span>
          </div>
        </div>

        <ConfidenceBar value={decision.confidence ?? 0} />

        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Priority</p>
              <p className="text-sm text-white font-mono">{decision.priority ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Signal ID</p>
              <p className="text-sm text-white/60 font-mono truncate">{decision.signalId?.slice(0, 12) || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Pipeline Push</p>
              <p className="text-sm">{decision.pushedPipeline ? <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" /> : <XCircle className="w-4 h-4 text-white/20 inline" />}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Outreach Queued</p>
              <p className="text-sm">{decision.outreachQueued ? <CheckCircle2 className="w-4 h-4 text-amber-400 inline" /> : <XCircle className="w-4 h-4 text-white/20 inline" />}</p>
            </div>
          </div>
          {decision.reasoning && (
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono mb-1">Reasoning</p>
              <p className="text-xs text-white/50 leading-relaxed">{decision.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: any }) {
  const isWin = ["won", "meeting_booked", "replied"].includes(outcome.outcome);
  const isLoss = ["lost", "bounced"].includes(outcome.outcome);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${isWin ? "border-emerald-500/20 bg-emerald-500/5" : isLoss ? "border-red-500/20 bg-red-500/5" : "border-white/5 bg-white/[0.02]"}`}
      data-testid={`outcome-row-${outcome.id}`}
    >
      {isWin ? (
        <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : isLoss ? (
        <ArrowDownRight className="w-4 h-4 text-red-400 shrink-0" />
      ) : (
        <Activity className="w-4 h-4 text-white/30 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <span className="text-sm text-white truncate block">{outcome.companyName || "Unknown"}</span>
        <span className="text-[11px] text-white/30">{formatAgo(outcome.createdAt)}</span>
      </div>

      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${isWin ? "text-emerald-400 bg-emerald-500/10" : isLoss ? "text-red-400 bg-red-500/10" : "text-white/40 bg-white/5"}`}>
        {outcome.outcome}
      </span>

      {outcome.dealValue != null && outcome.dealValue > 0 && (
        <span className="text-xs font-mono text-[#C9A84C]">{formatCurrency(outcome.dealValue)}</span>
      )}
    </div>
  );
}

function PipelineRow({ item }: { item: any }) {
  const stageColor: Record<string, string> = {
    new: "text-blue-400 bg-blue-500/10",
    qualified: "text-amber-400 bg-amber-500/10",
    quoted: "text-purple-400 bg-purple-500/10",
    won: "text-emerald-400 bg-emerald-500/10",
    lost: "text-red-400 bg-red-500/10",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-white/5 bg-white/[0.015]" data-testid={`pipeline-row-${item.id}`}>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-white truncate block">{item.companyName || "Unknown"}</span>
        <span className="text-[11px] text-white/30">{item.sourceType || "signal"} · {formatAgo(item.createdAt)}</span>
      </div>
      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${stageColor[item.stage] || "text-white/40 bg-white/5"}`}>
        {item.stage || "unknown"}
      </span>
      {item.estimatedValue != null && item.estimatedValue > 0 && (
        <span className="text-xs font-mono text-[#C9A84C]">{formatCurrency(item.estimatedValue)}</span>
      )}
    </div>
  );
}

export default function AdminNexoraMonitor() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/admin/nexora/monitor"],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]" data-testid="monitor-loading">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-[#C9A84C] animate-pulse" />
          <p className="text-white/40 text-sm">Connecting to Nexora...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[70vh]" data-testid="monitor-error">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-white/40 text-sm">Failed to connect to monitor feed</p>
        </div>
      </div>
    );
  }

  const { state, decisions, outcomes, pipeline, outreach, stats } = data ?? {};

  return (
    <div className="space-y-6 pb-12" data-testid="nexora-monitor-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Nexora AI Monitor
          </h1>
          <p className="text-white/40 text-sm mt-1">Real-time intelligence observation feed</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${state?.loopRunning ? "bg-emerald-400 animate-pulse" : state?.loopEnabled ? "bg-amber-400" : "bg-white/20"}`} />
          <span className="text-xs text-white/40 font-mono uppercase">
            {state?.loopRunning ? "Running" : state?.loopEnabled ? "Idle" : "Stopped"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="monitor-state-cards">
        <StateCard
          label="Mode"
          value={state?.mode === "safe" ? "SAFE" : "LIVE"}
          icon={Shield}
          color={state?.mode === "safe" ? "text-amber-400" : "text-emerald-400"}
        />
        <StateCard
          label="Last Run"
          value={formatAgo(state?.lastRunAt)}
          icon={Clock}
          color="text-white/60"
        />
        <StateCard
          label="Win Rate"
          value={`${stats?.winRate ?? 0}%`}
          icon={Target}
          color={stats?.winRate >= 60 ? "text-emerald-400" : stats?.winRate >= 40 ? "text-amber-400" : "text-red-400"}
        />
        <StateCard
          label="Pipeline"
          value={formatCurrency(pipeline?.totalValue ?? 0)}
          icon={TrendingUp}
          color="text-[#C9A84C]"
        />
        <StateCard
          label="Outreach"
          value={`${outreach?.sent ?? 0} sent`}
          icon={Mail}
          color="text-blue-400"
          sub={`${outreach?.drafts ?? 0} drafts`}
        />
        <StateCard
          label="Threshold"
          value={state?.currentThreshold ? `v${state.currentThreshold.version}` : "—"}
          icon={Zap}
          color="text-purple-400"
          sub={state?.currentThreshold ? `SP: ${state.currentThreshold.strongPipeline}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#C9A84C]" />
              Decision Feed
            </h2>
            <span className="text-[11px] text-white/20 font-mono">{decisions?.length ?? 0} decisions</span>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar" data-testid="decision-feed">
            {decisions?.length > 0 ? (
              decisions.map((d: any, i: number) => <DecisionRow key={d.id} decision={d} index={i} />)
            ) : (
              <div className="text-center py-12 text-white/20 text-sm">No decisions yet</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Outcomes
            </h2>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar" data-testid="outcome-feed">
              {outcomes?.length > 0 ? (
                outcomes.map((o: any) => <OutcomeRow key={o.id} outcome={o} />)
              ) : (
                <div className="text-center py-8 text-white/20 text-sm">No outcomes recorded</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
                Pipeline
              </h2>
              {pipeline?.byStage && (
                <div className="flex items-center gap-1.5">
                  {Object.entries(pipeline.byStage as Record<string, number>).map(([stage, count]) => (
                    <span key={stage} className="text-[10px] font-mono text-white/30">
                      {stage}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar" data-testid="pipeline-feed">
              {pipeline?.items?.length > 0 ? (
                pipeline.items.map((p: any) => <PipelineRow key={p.id} item={p} />)
              ) : (
                <div className="text-center py-8 text-white/20 text-sm">Pipeline empty</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StateCard({ label, value, icon: Icon, color, sub }: {
  label: string;
  value: string;
  icon: any;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5" data-testid={`state-card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] uppercase text-white/30 font-mono tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/20 font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

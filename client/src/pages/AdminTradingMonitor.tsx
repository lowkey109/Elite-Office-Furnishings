import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, BarChart3, TrendingUp, TrendingDown, Clock,
  ChevronDown, ChevronRight, Shield, Zap, AlertTriangle,
  Target, Gauge, LineChart, Crosshair, DollarSign,
  ArrowUpRight, ArrowDownRight, Layers,
} from "lucide-react";

function formatAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatUsd(val: number): string {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2" data-testid="trading-confidence-bar">
      <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-white/60">{pct}%</span>
    </div>
  );
}

function PnlMiniChart({ series }: { series: { date: string; value: number }[] }) {
  if (!series || series.length < 2) return <div className="text-white/20 text-xs py-4 text-center">Insufficient data</div>;

  const maxVal = Math.max(...series.map(s => s.value));
  const minVal = Math.min(...series.map(s => s.value));
  const range = maxVal - minVal || 1;
  const h = 80;
  const w = 100;

  const points = series.map((s, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((s.value - minVal) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  const lastVal = series[series.length - 1].value;
  const isPositive = lastVal >= 0;

  return (
    <div className="w-full" data-testid="pnl-chart">
      <svg viewBox={`-2 -5 ${w + 4} ${h + 10}`} className="w-full h-20" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={isPositive ? "#10b981" : "#ef4444"}
          strokeWidth="1.5"
          points={points}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-white/20 font-mono mt-1">
        <span>{formatUsd(minVal)}</span>
        <span className={isPositive ? "text-emerald-400" : "text-red-400"}>{formatUsd(lastVal)}</span>
        <span>{formatUsd(maxVal)}</span>
      </div>
    </div>
  );
}

function TradingDecisionRow({ decision, index }: { decision: any; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const dirColor = decision.direction === "long" ? "text-emerald-400" : "text-red-400";
  const dirBg = decision.direction === "long" ? "bg-emerald-500/10" : "bg-red-500/10";
  const statusColor: Record<string, string> = {
    executed: "text-emerald-400 bg-emerald-500/10",
    pending: "text-amber-400 bg-amber-500/10",
    skipped: "text-white/30 bg-white/5",
  };

  return (
    <div
      className={`border border-white/5 rounded-lg transition-all duration-300 ${index === 0 ? "ring-1 ring-[#C9A84C]/30 bg-white/[0.03]" : "bg-white/[0.015] hover:bg-white/[0.03]"}`}
      data-testid={`trading-decision-row-${decision.id}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        data-testid={`trading-decision-toggle-${decision.id}`}
      >
        <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${dirBg}`}>
          {decision.direction === "long" ? (
            <ArrowUpRight className={`w-3.5 h-3.5 ${dirColor}`} />
          ) : (
            <ArrowDownRight className={`w-3.5 h-3.5 ${dirColor}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{decision.market}</span>
            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${dirColor} ${dirBg}`}>
              {decision.direction}
            </span>
            <span className="text-[10px] font-mono text-white/30 truncate">{(decision.strategy || "").replace(/_/g, " ")}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-white/30 font-mono">{decision.regime}</span>
            {decision.volumeRatio != null && <span className="text-[11px] text-white/20 font-mono">vol: {decision.volumeRatio}x</span>}
            <span className="text-[10px] text-white/20 font-mono">{decision.reasonCode?.replace(/_/g, " ")}</span>
            <span className="text-[11px] text-white/20">{formatAgo(decision.timestamp)}</span>
          </div>
        </div>

        <ConfidenceBar value={decision.confidence ?? 0} />

        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${statusColor[decision.status] || "text-white/30 bg-white/5"}`}>
          {decision.status}
        </span>

        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-4 animate-in fade-in duration-200">
          <div className="text-xs text-white/50 leading-relaxed italic">{decision.thesis}</div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Expected Move</p>
              <p className="text-sm text-white font-mono">{decision.expectedMove != null ? `${decision.expectedMove}%` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Expected Cost</p>
              <p className="text-sm text-white/60 font-mono">{decision.expectedCost != null ? `$${decision.expectedCost}` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Invalidation</p>
              <p className="text-sm text-white/60 font-mono truncate">{decision.invalidationRule || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Risk Bucket</p>
              <p className={`text-sm font-mono ${decision.riskBucket === "high" ? "text-red-400" : decision.riskBucket === "medium" ? "text-amber-400" : "text-emerald-400"}`}>
                {(decision.riskBucket || "—").toUpperCase()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Data Quality</p>
              <p className="text-sm text-white font-mono">{decision.dataQualityScore != null ? `${Math.round(decision.dataQualityScore * 100)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Slippage Est.</p>
              <p className="text-sm text-white/60 font-mono">{decision.slippageEstimate != null ? `${decision.slippageEstimate}%` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Volume Ratio</p>
              <p className="text-sm text-white/60 font-mono">{decision.volumeRatio ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Model</p>
              <p className="text-sm text-white/60 font-mono">{decision.modelVersion || "—"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Created</p>
              <p className="text-sm text-white/40 font-mono">{decision.createdAt ? new Date(decision.createdAt).toLocaleString() : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 font-mono">Updated</p>
              <p className="text-sm text-white/40 font-mono">{decision.updatedAt ? new Date(decision.updatedAt).toLocaleString() : "—"}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase text-white/30 font-mono mb-1">Full Payload</p>
            <pre className="text-[11px] text-white/40 bg-white/[0.02] border border-white/5 rounded-lg p-3 overflow-x-auto max-h-48 custom-scrollbar font-mono">
              {JSON.stringify(decision.fullPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PositionRow({ position }: { position: any }) {
  const isProfit = position.unrealizedPnl >= 0;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${isProfit ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}
      data-testid={`position-row-${position.id}`}
    >
      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${position.side === "long" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
        {position.side === "long" ? (
          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
        ) : (
          <ArrowDownRight className="w-3 h-3 text-red-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{position.symbol}</span>
          <span className={`text-[10px] font-mono uppercase ${position.side === "long" ? "text-emerald-400" : "text-red-400"}`}>
            {position.side}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-white/30 font-mono">
          <span>Entry: ${position.entryPrice?.toLocaleString()}</span>
          <span>Now: ${position.currentPrice?.toLocaleString()}</span>
          <span>Stop: ${position.stopPrice?.toLocaleString()}</span>
        </div>
      </div>

      <div className="text-right">
        <p className={`text-sm font-mono font-semibold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
          {isProfit ? "+" : ""}{formatUsd(position.unrealizedPnl)}
        </p>
        <div className="flex items-center gap-2 justify-end mt-0.5">
          <span className="text-[10px] text-white/20 font-mono">{position.duration}</span>
          <span className="text-[10px] font-mono uppercase text-emerald-400/60">{position.status}</span>
        </div>
      </div>
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: any }) {
  const isWin = outcome.outcome === "win";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${isWin ? "border-emerald-500/15 bg-emerald-500/[0.03]" : "border-red-500/15 bg-red-500/[0.03]"}`}
      data-testid={`trading-outcome-row-${outcome.id}`}
    >
      {isWin ? (
        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      ) : (
        <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">{outcome.symbol}</span>
          <span className="text-[10px] text-white/30 font-mono">{(outcome.strategy || "").replace(/_/g, " ")}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/20 font-mono mt-0.5">
          <span>${outcome.entryPrice?.toLocaleString()} → ${outcome.exitPrice?.toLocaleString()}</span>
          <span>{outcome.duration}</span>
        </div>
      </div>

      <div className="text-right">
        <p className={`text-xs font-mono font-semibold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
          {outcome.realizedPnl >= 0 ? "+" : ""}{formatUsd(outcome.realizedPnl)}
        </p>
        <div className="flex items-center gap-2 justify-end mt-0.5">
          <span className={`text-[10px] font-mono uppercase ${isWin ? "text-emerald-400" : "text-red-400"}`}>{outcome.outcome}</span>
          <span className="text-[10px] text-white/20 font-mono">slip: {outcome.slippage}%</span>
        </div>
        <p className="text-[10px] text-white/15 font-mono">{formatAgo(outcome.timestamp)}</p>
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
    <div className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5" data-testid={`trading-state-card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] uppercase text-white/30 font-mono tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/20 font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminTradingMonitor() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/admin/trading/monitor"],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]" data-testid="trading-monitor-loading">
        <div className="flex flex-col items-center gap-3">
          <BarChart3 className="w-8 h-8 text-[#C9A84C] animate-pulse" />
          <p className="text-white/40 text-sm">Connecting to Trading Monitor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[70vh]" data-testid="trading-monitor-error">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-white/40 text-sm">Failed to connect to trading monitor feed</p>
        </div>
      </div>
    );
  }

  const { state, decisions, positions, recent_outcomes, performance } = data ?? {};

  return (
    <div className="space-y-6 pb-12" data-testid="trading-monitor-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }} data-testid="trading-monitor-heading">
            Trading AI Monitor
          </h1>
          <p className="text-white/40 text-sm mt-1">Paper trading · Real market data · Read-only observation</p>
        </div>
        <div className="flex items-center gap-2" data-testid="trading-mode-badge">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-amber-400 font-mono uppercase">PAPER MODE</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3" data-testid="trading-state-cards">
        <StateCard label="Mode" value="PAPER" icon={Shield} color="text-amber-400" />
        <StateCard label="Regime" value={(state?.currentRegime || "—").toUpperCase()} icon={Layers} color="text-blue-400" />
        <StateCard label="Last Decision" value={formatAgo(state?.lastDecisionTime)} icon={Clock} color="text-white/60" />
        <StateCard label="Total Trades" value={String(state?.totalTrades ?? 0)} icon={BarChart3} color="text-[#C9A84C]" />
        <StateCard
          label="Win Rate"
          value={`${state?.winRate ?? 0}%`}
          icon={Target}
          color={(state?.winRate ?? 0) >= 60 ? "text-emerald-400" : (state?.winRate ?? 0) >= 40 ? "text-amber-400" : "text-red-400"}
        />
        <StateCard
          label="Drawdown"
          value={`${state?.currentDrawdown ?? 0}%`}
          icon={TrendingDown}
          color={(state?.currentDrawdown ?? 0) > 10 ? "text-red-400" : (state?.currentDrawdown ?? 0) > 5 ? "text-amber-400" : "text-emerald-400"}
        />
        <StateCard label="Open Positions" value={String(state?.openPositionsCount ?? 0)} icon={Crosshair} color="text-purple-400" />
        <StateCard label="Best Strategy" value={state?.bestStrategy || "—"} icon={Zap} color="text-[#C9A84C]" />
        <StateCard
          label="Data Quality"
          value={state?.dataQualityScore ? `${Math.round(state.dataQualityScore * 100)}%` : "—"}
          icon={Gauge}
          color={(state?.dataQualityScore ?? 0) >= 0.9 ? "text-emerald-400" : "text-amber-400"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#C9A84C]" />
              Decision Feed
            </h2>
            <span className="text-[11px] text-white/20 font-mono">{decisions?.length ?? 0} decisions</span>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar" data-testid="trading-decision-feed">
            {decisions?.length > 0 ? (
              decisions.map((d: any, i: number) => <TradingDecisionRow key={d.id} decision={d} index={i} />)
            ) : (
              <div className="text-center py-12 text-white/20 text-sm">No trading decisions yet</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-purple-400" />
              Open Positions
            </h2>
            <div className="space-y-2" data-testid="trading-positions-panel">
              {positions?.length > 0 ? (
                positions.map((p: any) => <PositionRow key={p.id} position={p} />)
              ) : (
                <div className="text-center py-8 text-white/20 text-sm">No open positions</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <LineChart className="w-4 h-4 text-emerald-400" />
              Performance
            </h2>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3" data-testid="trading-performance-panel">
              <PnlMiniChart series={performance?.pnlSeries || []} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase text-white/30 font-mono">Avg Win</p>
                  <p className="text-sm font-mono text-emerald-400">{formatUsd(performance?.avgWin ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/30 font-mono">Avg Loss</p>
                  <p className="text-sm font-mono text-red-400">{formatUsd(performance?.avgLoss ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/30 font-mono">Expectancy</p>
                  <p className={`text-sm font-mono ${(performance?.expectancy ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatUsd(performance?.expectancy ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/30 font-mono">Streaks</p>
                  <p className="text-sm font-mono text-white/60">
                    <span className="text-emerald-400">{performance?.consecutiveWins ?? 0}W</span>
                    {" / "}
                    <span className="text-red-400">{performance?.consecutiveLosses ?? 0}L</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#C9A84C]" />
            Recent Outcomes
          </h2>
          <span className="text-[11px] text-white/20 font-mono">{recent_outcomes?.length ?? 0} trades</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar" data-testid="trading-outcomes-panel">
          {recent_outcomes?.length > 0 ? (
            recent_outcomes.map((o: any) => <OutcomeRow key={o.id} outcome={o} />)
          ) : (
            <div className="text-center py-8 text-white/20 text-sm col-span-2">No completed trades yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

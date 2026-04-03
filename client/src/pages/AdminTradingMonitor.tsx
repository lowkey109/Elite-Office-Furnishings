import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, BarChart3, TrendingUp, TrendingDown, Clock,
  ChevronDown, ChevronRight, Shield, Zap, AlertTriangle,
  Target, Gauge, LineChart, Crosshair, DollarSign,
  ArrowUpRight, ArrowDownRight, Layers, Newspaper,
  Globe, BookOpen, ExternalLink, Brain, Settings2,
  CheckCircle2, XCircle, Lightbulb, RotateCcw,
  PieChart, Ban, Lock, Ruler, Timer, Radio, Plug,
  CheckCircle, Circle, Power,
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
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function formatVolume(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
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
        <polyline fill="none" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth="1.5" points={points} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-white/20 font-mono mt-1">
        <span>{formatUsd(minVal)}</span>
        <span className={isPositive ? "text-emerald-400" : "text-red-400"}>{formatUsd(lastVal)}</span>
        <span>{formatUsd(maxVal)}</span>
      </div>
    </div>
  );
}

interface TradingMonitorState { mode: string; currentRegime: string; lastDecisionTime: string; totalTrades: number; winRate: number; currentDrawdown: number; openPositionsCount: number; bestStrategy: string; dataQualityScore: number; }
interface TDec { id: string; timestamp: string; market: string; strategy: string; direction: "long"|"short"; confidence: number; thesis: string; regime: string; volumeRatio: number|null; reasonCode: string; status: string; expectedMove: number|null; expectedCost: number|null; invalidationRule: string; riskBucket: string; dataQualityScore: number; slippageEstimate: number|null; modelVersion: string; fullPayload: Record<string, any>; createdAt: string; updatedAt: string; decisionSource: string; executionStatus: string; confidenceThreshold: number; riskAmount: number|null; paperCapitalImpact: number|null; linkedPositionId: string|null; sourceMarketSnapshotId: string|null; sourceNewsIds: string[]; strategyVersion: string; decisionGeneratedAt: string; }
interface OPos { id: string; symbol: string; side: "long"|"short"; entryPrice: number; currentPrice: number; unrealizedPnl: number; stopPrice: number; duration: string; status: string; linkedDecisionId: string; paperCapitalAllocated: number; entryTimestamp: string; targetPrice: number|null; }
interface TOut { id: string; symbol: string; strategy: string; direction: "long"|"short"; entryPrice: number; exitPrice: number; realizedPnl: number; duration: string; slippage: number; outcome: "win"|"loss"; timestamp: string; linkedDecisionId: string; linkedPositionId: string; exitReason: string; paperCapitalReturned: number; fees: number; }
interface TPerf { avgWin: number; avgLoss: number; expectancy: number; consecutiveWins: number; consecutiveLosses: number; sharpeRatio: number; profitFactor: number; maxDrawdown: number; totalPnl: number; pnlSeries: { date: string; value: number }[]; }
interface NItem { id: string; timestamp: string; headline: string; source: string; sentiment: "bullish"|"bearish"|"neutral"; relevance: number; markets: string[]; summary: string; impact: "high"|"medium"|"low"; sourceUrl: string|null; linkedDecisionIds: string[]; }
interface MCtx { symbol: string; price: number; change24h: number; changePct24h: number; volume24h: number; high24h: number; low24h: number; regime: string; dominantTrend: string; volatilityLevel: string; keyLevels: { support: number[]; resistance: number[] }; technicals: { rsi14: number; macd: { value: number; signal: number; histogram: number }; ema20: number; ema50: number; ema200: number; bbUpper: number; bbLower: number; bbWidth: number; atr14: number; adx: number; obv: string; vwap: number; stochRsi: number; williamsR: number; cci: number; mfi: number; }; fundingRate: number|null; openInterest: number|null; fearGreedIndex: number|null; snapshotId: string; lastUpdated: string; dataSource: string; isStale: boolean; }
interface SProf { name: string; description: string; edge: string; idealRegime: string; winRate: number; avgRR: number; avgHoldTime: string; riskPerTrade: string; entryRules: string[]; exitRules: string[]; invalidationRules: string[]; strengths: string[]; weaknesses: string[]; version: string; isActive: boolean; powersDecisions: boolean; ruleSource: string; lastUsedAt: string|null; }
interface FeedSt { loopRunning: boolean; lastFastCycle: string|null; lastDetailedCycle: string|null; cycleErrors: number; liveSymbols: string[]; unavailableSymbols: string[]; }
interface NewsSt { available: boolean; source: string; lastFetched: string|null; error: string|null; }
interface TradingMonitorResponse { state: TradingMonitorState; decisions: TDec[]; positions: OPos[]; recent_outcomes: TOut[]; performance: TPerf; news: NItem[]; marketContext: MCtx[]; strategies: SProf[]; dataMode: "simulation"|"paper"|"live"; lastRefreshed: string; feedStatus?: FeedSt; newsStatus?: NewsSt; }

function TradingDecisionRow({ decision, index, isExpanded, onToggle }: { decision: TDec; index: number; isExpanded: boolean; onToggle: () => void }) {
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
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left" data-testid={`trading-decision-toggle-${decision.id}`}>
        <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${dirBg}`}>
          {decision.direction === "long" ? <ArrowUpRight className={`w-3.5 h-3.5 ${dirColor}`} /> : <ArrowDownRight className={`w-3.5 h-3.5 ${dirColor}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{decision.market}</span>
            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${dirColor} ${dirBg}`}>{decision.direction}</span>
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
        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${statusColor[decision.status] || "text-white/30 bg-white/5"}`}>{decision.status}</span>
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-4 animate-in fade-in duration-200">
          <div className="text-xs text-white/50 leading-relaxed italic">{decision.thesis}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Expected Move</p><p className="text-sm text-white font-mono">{decision.expectedMove != null ? `${decision.expectedMove}%` : "—"}</p></div>
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Expected Cost</p><p className="text-sm text-white/60 font-mono">{decision.expectedCost != null ? `$${decision.expectedCost}` : "—"}</p></div>
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Invalidation</p><p className="text-sm text-white/60 font-mono truncate">{decision.invalidationRule || "—"}</p></div>
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Risk Bucket</p><p className={`text-sm font-mono ${decision.riskBucket === "high" ? "text-red-400" : decision.riskBucket === "medium" ? "text-amber-400" : "text-emerald-400"}`}>{(decision.riskBucket || "—").toUpperCase()}</p></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Data Quality</p><p className="text-sm text-white font-mono">{decision.dataQualityScore != null ? `${Math.round(decision.dataQualityScore * 100)}%` : "—"}</p></div>
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Slippage Est.</p><p className="text-sm text-white/60 font-mono">{decision.slippageEstimate != null ? `${decision.slippageEstimate}%` : "—"}</p></div>
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Volume Ratio</p><p className="text-sm text-white/60 font-mono">{decision.volumeRatio ?? "—"}</p></div>
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Model</p><p className="text-sm text-white/60 font-mono">{decision.modelVersion || "—"}</p></div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase text-white/30 font-mono tracking-wider">Provenance</p>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><p className="text-[9px] uppercase text-white/20 font-mono">Decision Source</p><p className="text-[11px] text-white/50 font-mono">{decision.decisionSource || "—"}</p></div>
              <div><p className="text-[9px] uppercase text-white/20 font-mono">Strategy Version</p><p className="text-[11px] text-white/50 font-mono">{decision.strategyVersion || "—"}</p></div>
              <div><p className="text-[9px] uppercase text-white/20 font-mono">Execution Status</p><p className={`text-[11px] font-mono ${decision.executionStatus === "filled" ? "text-emerald-400" : decision.executionStatus === "entered" ? "text-blue-400" : decision.executionStatus === "rejected" ? "text-red-400" : "text-amber-400"}`}>{decision.executionStatus || "—"}</p></div>
              <div><p className="text-[9px] uppercase text-white/20 font-mono">Generated At</p><p className="text-[11px] text-white/50 font-mono">{decision.decisionGeneratedAt ? new Date(decision.decisionGeneratedAt).toLocaleString() : "—"}</p></div>
              <div><p className="text-[9px] uppercase text-white/20 font-mono">Market Snapshot</p><p className="text-[11px] text-white/40 font-mono truncate">{decision.sourceMarketSnapshotId || "none"}</p></div>
              <div><p className="text-[9px] uppercase text-white/20 font-mono">News Sources</p><p className="text-[11px] text-white/40 font-mono">{decision.sourceNewsIds?.length > 0 ? `${decision.sourceNewsIds.length} linked` : "none"}</p></div>
              <div><p className="text-[9px] uppercase text-white/20 font-mono">Position ID</p><p className="text-[11px] text-white/40 font-mono truncate">{decision.linkedPositionId || "none"}</p></div>
              <div><p className="text-[9px] uppercase text-white/20 font-mono">Confidence Threshold</p><p className="text-[11px] text-white/50 font-mono">{decision.confidenceThreshold}%</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Created</p><p className="text-sm text-white/40 font-mono">{decision.createdAt ? new Date(decision.createdAt).toLocaleString() : "—"}</p></div>
            <div><p className="text-[10px] uppercase text-white/30 font-mono">Updated</p><p className="text-sm text-white/40 font-mono">{decision.updatedAt ? new Date(decision.updatedAt).toLocaleString() : "—"}</p></div>
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/30 font-mono mb-1">Full Payload</p>
            <pre className="text-[11px] text-white/40 bg-white/[0.02] border border-white/5 rounded-lg p-3 overflow-x-auto max-h-48 custom-scrollbar font-mono">{JSON.stringify(decision.fullPayload, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PositionRow({ position }: { position: OPos }) {
  const isProfit = position.unrealizedPnl >= 0;
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${isProfit ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`} data-testid={`position-row-${position.id}`}>
      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${position.side === "long" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
        {position.side === "long" ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{position.symbol}</span>
          <span className={`text-[10px] font-mono uppercase ${position.side === "long" ? "text-emerald-400" : "text-red-400"}`}>{position.side}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-white/30 font-mono">
          <span>Entry: ${position.entryPrice?.toLocaleString()}</span>
          <span>Now: ${position.currentPrice?.toLocaleString()}</span>
          <span>Stop: ${position.stopPrice?.toLocaleString()}</span>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-mono font-semibold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>{isProfit ? "+" : ""}{formatUsd(position.unrealizedPnl)}</p>
        <div className="flex items-center gap-2 justify-end mt-0.5">
          <span className="text-[10px] text-white/20 font-mono">{position.duration}</span>
          <span className="text-[10px] font-mono uppercase text-emerald-400/60">{position.status}</span>
        </div>
      </div>
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: TOut }) {
  const isWin = outcome.outcome === "win";
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${isWin ? "border-emerald-500/15 bg-emerald-500/[0.03]" : "border-red-500/15 bg-red-500/[0.03]"}`} data-testid={`trading-outcome-row-${outcome.id}`}>
      {isWin ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">{outcome.symbol}</span>
          <span className={`text-[10px] font-mono uppercase ${outcome.direction === "long" ? "text-emerald-400/50" : "text-red-400/50"}`}>{outcome.direction}</span>
          <span className="text-[10px] text-white/30 font-mono">{(outcome.strategy || "").replace(/_/g, " ")}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/20 font-mono mt-0.5">
          <span>${outcome.entryPrice?.toLocaleString()} → ${outcome.exitPrice?.toLocaleString()}</span>
          <span>{outcome.duration}</span>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-xs font-mono font-semibold ${isWin ? "text-emerald-400" : "text-red-400"}`}>{outcome.realizedPnl >= 0 ? "+" : ""}{formatUsd(outcome.realizedPnl)}</p>
        <div className="flex items-center gap-2 justify-end mt-0.5">
          <span className={`text-[10px] font-mono uppercase ${isWin ? "text-emerald-400" : "text-red-400"}`}>{outcome.outcome}</span>
          <span className="text-[10px] text-white/20 font-mono">slip: {outcome.slippage}%</span>
        </div>
        <p className="text-[10px] text-white/15 font-mono">{formatAgo(outcome.timestamp)}</p>
      </div>
    </div>
  );
}

function NewsRow({ item }: { item: NItem }) {
  const sentimentColor = { bullish: "text-emerald-400 bg-emerald-500/10", bearish: "text-red-400 bg-red-500/10", neutral: "text-white/40 bg-white/5" };
  const impactColor = { high: "text-red-400", medium: "text-amber-400", low: "text-white/30" };
  return (
    <div className="border border-white/5 rounded-lg bg-white/[0.015] p-3 space-y-2" data-testid={`news-row-${item.id}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium leading-snug">{item.headline}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-white/30 font-mono">{item.source}</span>
            <span className="text-[10px] text-white/20">{formatAgo(item.timestamp)}</span>
            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${sentimentColor[item.sentiment as keyof typeof sentimentColor] || sentimentColor.neutral}`}>{item.sentiment}</span>
            <span className={`text-[10px] font-mono ${impactColor[item.impact as keyof typeof impactColor] || "text-white/30"}`}>{item.impact} impact</span>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-white/40 leading-relaxed">{item.summary}</p>
      <div className="flex items-center gap-1.5">
        {item.markets?.map((m: string) => (
          <span key={m} className="text-[9px] font-mono text-[#C9A84C]/60 bg-[#C9A84C]/5 px-1.5 py-0.5 rounded">{m}</span>
        ))}
      </div>
    </div>
  );
}

function MarketContextCard({ ctx }: { ctx: MCtx }) {
  const isUp = ctx.changePct24h >= 0;
  const isUnavailable = ctx.dataSource === "unavailable" || ctx.regime === "unavailable";
  const isStale = ctx.isStale && !isUnavailable;

  if (isUnavailable) {
    return (
      <div className="bg-white/[0.01] border border-white/5 rounded-lg p-3 space-y-2 opacity-40" data-testid={`market-ctx-${ctx.symbol}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white/50">{ctx.symbol}</span>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded text-white/30 bg-white/5">UNAVAILABLE</span>
        </div>
        <div className="text-xs text-white/20 py-4 text-center">No live feed available</div>
      </div>
    );
  }

  const regimeColor = ctx.regime === "trending" ? "text-emerald-400 bg-emerald-500/10"
    : ctx.regime === "volatile" ? "text-amber-400 bg-amber-500/10"
    : ctx.regime === "stale" ? "text-red-400 bg-red-500/10"
    : "text-blue-400 bg-blue-500/10";

  return (
    <div className={`bg-white/[0.02] border rounded-lg p-3 space-y-2 ${isStale ? "border-red-500/30" : "border-white/5"}`} data-testid={`market-ctx-${ctx.symbol}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{ctx.symbol}</span>
          {isStale && <span className="text-[9px] font-mono text-red-400 px-1 py-0.5 rounded bg-red-500/10">STALE</span>}
        </div>
        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${regimeColor}`}>{ctx.regime}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-mono text-white">${ctx.price?.toLocaleString()}</span>
        <span className={`text-xs font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}>{isUp ? "+" : ""}{ctx.changePct24h?.toFixed(2)}%</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div><span className="text-white/25">Vol</span> <span className="text-white/50">{formatVolume(ctx.volume24h)}</span></div>
        <div><span className="text-white/25">H24</span> <span className="text-white/50">{ctx.high24h ? `$${ctx.high24h.toLocaleString()}` : "—"}</span></div>
        <div><span className="text-white/25">L24</span> <span className="text-white/50">{ctx.low24h ? `$${ctx.low24h.toLocaleString()}` : "—"}</span></div>
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono text-white/20">
        <span>{ctx.dataSource}</span>
        <span>{formatAgo(ctx.lastUpdated)}</span>
      </div>
    </div>
  );
}

function StateCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string; sub?: string }) {
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
  const expandedRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);

  const toggleExpanded = useCallback((id: string) => {
    if (expandedRef.current.has(id)) {
      expandedRef.current.delete(id);
    } else {
      expandedRef.current.add(id);
    }
    forceUpdate(n => n + 1);
  }, []);

  const { data, isLoading, error, dataUpdatedAt, isRefetchError } = useQuery<TradingMonitorResponse>({
    queryKey: ["/api/admin/trading/monitor"],
    refetchInterval: 5000,
    retry: 2,
    retryDelay: 2000,
    refetchOnWindowFocus: false,
  });

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-[70vh]" data-testid="trading-monitor-loading">
        <div className="flex flex-col items-center gap-3">
          <BarChart3 className="w-8 h-8 text-[#C9A84C] animate-pulse" />
          <p className="text-white/40 text-sm">Connecting to Trading Monitor...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-[70vh]" data-testid="trading-monitor-error">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-white/40 text-sm">Failed to connect to trading monitor feed</p>
        </div>
      </div>
    );
  }

  const feedDelayed = isRefetchError && !!data;
  const state = data?.state;
  const decisions = data?.decisions ?? [];
  const positions = data?.positions ?? [];
  const recent_outcomes = data?.recent_outcomes ?? [];
  const performance = data?.performance;
  const news = data?.news ?? [];
  const marketContext = data?.marketContext ?? [];
  const strategies = data?.strategies ?? [];
  const dataMode = data?.dataMode ?? "paper";
  const feedStatus = data?.feedStatus;
  const newsStatus = data?.newsStatus;

  return (
    <div className="space-y-6 pb-12" data-testid="trading-monitor-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }} data-testid="trading-monitor-heading">Trading AI Monitor</h1>
          <p className="text-white/40 text-sm mt-1">Paper trading engine · DB-backed lifecycle · Read-only observation</p>
        </div>
        <div className="flex items-center gap-3" data-testid="trading-mode-badge">
          {feedDelayed && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-red-500/40 bg-red-500/10" data-testid="feed-delayed-badge">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-red-400 font-mono uppercase">FEED DELAYED</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/10" data-testid="data-mode-label">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-400 font-mono uppercase font-semibold tracking-wider">{dataMode === "paper" ? "PAPER ENGINE" : dataMode === "simulation" ? "SIMULATION" : "LIVE"}</span>
          </div>
          {feedStatus?.loopRunning && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10" data-testid="feed-live-badge">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-mono uppercase">FEEDS LIVE</span>
            </div>
          )}
          {state?.currentRegime === "awaiting_feeds" && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-blue-500/30 bg-blue-500/10" data-testid="awaiting-feeds-badge">
              <span className="text-[10px] text-blue-400 font-mono uppercase">AWAITING FEEDS</span>
            </div>
          )}
          {feedStatus && feedStatus.unavailableSymbols.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/10 bg-white/5" data-testid="unavailable-symbols-badge">
              <span className="text-[10px] text-white/40 font-mono">{feedStatus.unavailableSymbols.join(", ")} unavailable</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3" data-testid="trading-state-cards">
        <StateCard label="Mode" value="PAPER" icon={Shield} color="text-amber-400" />
        <StateCard label="Regime" value={(state?.currentRegime || "—").toUpperCase()} icon={Layers} color="text-blue-400" />
        <StateCard label="Last Decision" value={formatAgo(state?.lastDecisionTime)} icon={Clock} color="text-white/60" />
        <StateCard label="Total Trades" value={String(state?.totalTrades ?? 0)} icon={BarChart3} color="text-[#C9A84C]" />
        <StateCard label="Win Rate" value={`${state?.winRate ?? 0}%`} icon={Target} color={(state?.winRate ?? 0) >= 60 ? "text-emerald-400" : (state?.winRate ?? 0) >= 40 ? "text-amber-400" : "text-red-400"} />
        <StateCard label="Drawdown" value={`${state?.currentDrawdown ?? 0}%`} icon={TrendingDown} color={(state?.currentDrawdown ?? 0) > 10 ? "text-red-400" : (state?.currentDrawdown ?? 0) > 5 ? "text-amber-400" : "text-emerald-400"} />
        <StateCard label="Open Positions" value={String(state?.openPositionsCount ?? 0)} icon={Crosshair} color="text-purple-400" />
        <StateCard label="Best Strategy" value={state?.bestStrategy || "—"} icon={Zap} color="text-[#C9A84C]" />
        <StateCard label="Data Quality" value={state?.dataQualityScore ? `${state.dataQualityScore}%` : "—"} icon={Gauge} color={(state?.dataQualityScore ?? 0) >= 75 ? "text-emerald-400" : (state?.dataQualityScore ?? 0) >= 50 ? "text-amber-400" : "text-red-400"} />
      </div>

      {marketContext?.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            Market Context
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="trading-market-context">
            {marketContext.map((ctx) => <MarketContextCard key={ctx.symbol} ctx={ctx} />)}
          </div>
        </div>
      )}

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
              decisions.map((d, i) => (
                <TradingDecisionRow
                  key={d.id}
                  decision={d}
                  index={i}
                  isExpanded={expandedRef.current.has(d.id)}
                  onToggle={() => toggleExpanded(d.id)}
                />
              ))
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
              {positions.length > 0 ? positions.map((p) => <PositionRow key={p.id} position={p} />) : <div className="text-center py-8 text-white/20 text-sm">No open positions</div>}
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
                <div><p className="text-[10px] uppercase text-white/30 font-mono">Total PnL</p><p className={`text-sm font-mono font-semibold ${(performance?.totalPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatUsd(performance?.totalPnl ?? 0)}</p></div>
                <div><p className="text-[10px] uppercase text-white/30 font-mono">Sharpe Ratio</p><p className="text-sm font-mono text-white/60">{performance?.sharpeRatio ?? "—"}</p></div>
                <div><p className="text-[10px] uppercase text-white/30 font-mono">Avg Win</p><p className="text-sm font-mono text-emerald-400">{formatUsd(performance?.avgWin ?? 0)}</p></div>
                <div><p className="text-[10px] uppercase text-white/30 font-mono">Avg Loss</p><p className="text-sm font-mono text-red-400">{formatUsd(performance?.avgLoss ?? 0)}</p></div>
                <div><p className="text-[10px] uppercase text-white/30 font-mono">Expectancy</p><p className={`text-sm font-mono ${(performance?.expectancy ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatUsd(performance?.expectancy ?? 0)}</p></div>
                <div><p className="text-[10px] uppercase text-white/30 font-mono">Profit Factor</p><p className="text-sm font-mono text-white/60">{performance?.profitFactor ?? "—"}</p></div>
                <div><p className="text-[10px] uppercase text-white/30 font-mono">Max Drawdown</p><p className={`text-sm font-mono ${(performance?.maxDrawdown ?? 0) > 5 ? "text-red-400" : "text-emerald-400"}`}>{performance?.maxDrawdown ?? 0}%</p></div>
                <div><p className="text-[10px] uppercase text-white/30 font-mono">Streaks</p><p className="text-sm font-mono text-white/60"><span className="text-emerald-400">{performance?.consecutiveWins ?? 0}W</span>{" / "}<span className="text-red-400">{performance?.consecutiveLosses ?? 0}L</span></p></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#C9A84C]" />
              Recent Outcomes
            </h2>
            <span className="text-[11px] text-white/20 font-mono">{recent_outcomes?.length ?? 0} trades</span>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar" data-testid="trading-outcomes-panel">
            {recent_outcomes.length > 0 ? recent_outcomes.map((o) => <OutcomeRow key={o.id} outcome={o} />) : <div className="text-center py-8 text-white/20 text-sm">No completed trades yet</div>}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-blue-400" />
              Market News & Intelligence
            </h2>
            <span className="text-[11px] text-white/20 font-mono">{news?.length ?? 0} items</span>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar" data-testid="trading-news-feed">
            {news.length > 0 ? news.map((n) => <NewsRow key={n.id} item={n} />) : (
              <div className="text-center py-8 space-y-2" data-testid="news-empty-state">
                <p className="text-white/20 text-sm">No real news feed connected</p>
                {newsStatus?.error && <p className="text-[10px] text-white/15 font-mono max-w-xs mx-auto">{newsStatus.error}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {strategies?.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#C9A84C]" />
            Strategy Knowledge Base
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="trading-strategy-profiles">
            {strategies.map((s) => (
              <div key={s.name} className={`bg-white/[0.02] border rounded-lg p-4 space-y-2 ${s.isActive ? "border-white/5" : "border-white/5 opacity-50"}`} data-testid={`strategy-profile-${s.name}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{s.name.replace(/_/g, " ")}</span>
                    {s.powersDecisions && <span className="text-[8px] font-mono text-emerald-400 px-1 py-0.5 rounded bg-emerald-500/10">ACTIVE</span>}
                    {!s.isActive && <span className="text-[8px] font-mono text-white/30 px-1 py-0.5 rounded bg-white/5">INACTIVE</span>}
                  </div>
                  <span className="text-[10px] font-mono text-[#C9A84C]/60">{s.idealRegime}</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">{s.description}</p>
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                  <div><span className="text-white/25">WR</span> <span className="text-emerald-400">{s.winRate}%</span></div>
                  <div><span className="text-white/25">R:R</span> <span className="text-white/50">{s.avgRR}</span></div>
                  <div><span className="text-white/25">Hold</span> <span className="text-white/50">{s.avgHoldTime}</span></div>
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-white/20">
                  <span>v{s.version}</span>
                  <span>{s.powersDecisions ? "Powers decisions" : "Not connected"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <LearningPanel />
      <AdaptationPanel />
      <PortfolioPanel />
      <StressTestPanel />
      <ExecutionPanel />
      <LiveBridgePanel />
    </div>
  );
}

function LearningPanel() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/trading/learning"],
    refetchInterval: 30000,
    retry: 1,
  });

  const analysis = data?.analysis;
  const edgeInsights = data?.edgeInsights;
  const strategyHealth = data?.strategyHealth;
  const decisionQuality = data?.decisionQuality;
  const recommendations = data?.recommendations;
  const hasSufficientData = analysis?.sufficientData === true;

  return (
    <div className="space-y-4" data-testid="learning-panel">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-[#C9A84C]" />
        <h2 className="text-lg font-semibold text-white">Learning Engine</h2>
        {!hasSufficientData && !isLoading && <span className="text-[10px] font-mono text-amber-400/70 px-2 py-0.5 rounded bg-amber-500/10">INSUFFICIENT DATA</span>}
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-white/20 text-sm">Loading learning data...</div>
      ) : !hasSufficientData ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-6 text-center space-y-2" data-testid="learning-insufficient-data">
          <Brain className="w-8 h-8 text-white/10 mx-auto" />
          <p className="text-white/30 text-sm">Insufficient trade data for learning</p>
          <p className="text-[11px] text-white/15 font-mono">{analysis?.totalOutcomes ?? 0} outcomes recorded — minimum 20 required</p>
        </div>
      ) : (
        <div className="space-y-4">
          {strategyHealth?.strategies?.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#C9A84C]" />
                Strategy Leaderboard
              </h3>
              <div className="space-y-2" data-testid="strategy-leaderboard">
                {strategyHealth.strategies.map((s: any) => (
                  <div key={s.strategyName} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2" data-testid={`strategy-health-${s.strategyName}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/80 font-mono">{s.strategyName.replace(/_/g, " ")}</span>
                      {s.isHighPerforming && <span className="text-[8px] font-mono text-emerald-400 px-1 py-0.5 rounded bg-emerald-500/10">HIGH PERF</span>}
                      {s.isDegrading && <span className="text-[8px] font-mono text-red-400 px-1 py-0.5 rounded bg-red-500/10">DEGRADING</span>}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono">
                      <span className="text-white/30">WR <span className={s.winRate >= 55 ? "text-emerald-400" : s.winRate < 45 ? "text-red-400" : "text-white/50"}>{s.winRate.toFixed(1)}%</span></span>
                      <span className="text-white/30">Exp <span className={s.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}>${s.expectancy.toFixed(2)}</span></span>
                      <span className="text-white/30">PF <span className="text-white/50">{s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)}</span></span>
                      <span className="text-white/30">DD <span className="text-white/50">{s.drawdown.toFixed(1)}%</span></span>
                      <span className="text-white/20">{s.tradeCount} trades</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {edgeInsights?.insights?.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-[#C9A84C]" />
                Edge Insights
              </h3>
              <div className="space-y-2" data-testid="edge-insights">
                {edgeInsights.insights.map((e: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 bg-white/[0.01] border border-white/5 rounded-lg px-3 py-2">
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                      e.insightType === "top_setup" ? "text-emerald-400 bg-emerald-500/10" :
                      e.insightType === "weak_setup" ? "text-red-400 bg-red-500/10" :
                      e.insightType === "degradation" ? "text-amber-400 bg-amber-500/10" :
                      "text-blue-400 bg-blue-500/10"
                    }`}>{e.insightType.replace(/_/g, " ").toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/50">{e.description}</p>
                      <p className="text-[9px] text-white/20 font-mono mt-0.5">{e.confidence.toFixed(0)}% confidence · {e.tradeCount} trades</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {decisionQuality?.sufficientData && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#C9A84C]" />
                Decision Quality
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center" data-testid="decision-quality-summary">
                <div className="bg-white/[0.02] rounded-lg p-2">
                  <p className="text-[10px] text-white/20 font-mono uppercase">Avg Score</p>
                  <p className="text-lg font-bold text-white/80">{decisionQuality.avgQualityScore.toFixed(0)}</p>
                </div>
                <div className="bg-white/[0.02] rounded-lg p-2">
                  <p className="text-[10px] text-white/20 font-mono uppercase">Reviewed</p>
                  <p className="text-lg font-bold text-white/80">{decisionQuality.totalReviewed}</p>
                </div>
                {Object.entries(decisionQuality.distribution || {}).slice(0, 2).map(([label, count]: any) => (
                  <div key={label} className="bg-white/[0.02] rounded-lg p-2">
                    <p className="text-[9px] text-white/20 font-mono uppercase truncate">{label.replace(/_/g, " ")}</p>
                    <p className="text-lg font-bold text-white/60">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recommendations?.recommendations?.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-[#C9A84C]" />
                Recommendations
              </h3>
              <div className="space-y-2" data-testid="learning-recommendations">
                {recommendations.recommendations.map((r: any, i: number) => (
                  <div key={i} className="bg-white/[0.01] border border-white/5 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-[#C9A84C]/60 uppercase">{r.recommendationType.replace(/_/g, " ")}</span>
                      <span className="text-[9px] font-mono text-white/20">{r.confidence.toFixed(0)}% confidence</span>
                    </div>
                    <p className="text-[11px] text-white/50">{r.description}</p>
                    <p className="text-[10px] text-white/30 italic">{r.suggestedChange}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdaptationPanel() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/trading/adaptation"],
    refetchInterval: 30000,
    retry: 1,
  });

  const currentConfig = data?.currentConfig;
  const pendingProposals = data?.pendingProposals ?? [];
  const recentChanges = data?.recentChanges ?? [];
  const rollbackHistory = data?.rollbackHistory ?? [];
  const guardrailFailures = data?.guardrailFailures ?? [];

  return (
    <div className="space-y-4" data-testid="adaptation-panel">
      <div className="flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-[#C9A84C]" />
        <h2 className="text-lg font-semibold text-white">Adaptive Execution</h2>
        {currentConfig && <span className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded bg-white/5">{currentConfig.versionName}</span>}
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-white/20 text-sm">Loading adaptation data...</div>
      ) : (
        <div className="space-y-4">
          {currentConfig && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#C9A84C]" />
                Active Configuration
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="active-config">
                {Object.entries(currentConfig.config || {}).slice(0, 8).map(([key, val]: any) => (
                  <div key={key} className="bg-white/[0.02] rounded-lg p-2">
                    <p className="text-[9px] text-white/20 font-mono uppercase truncate">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                    <p className="text-[11px] text-white/50 font-mono truncate">{typeof val === "object" ? JSON.stringify(val).slice(0, 30) : String(val)}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 text-[9px] font-mono text-white/20">
                <span>Version: {currentConfig.versionName}</span>
                <span>Status: {currentConfig.approvalStatus}</span>
                {currentConfig.activatedAt && <span>Active since: {new Date(currentConfig.activatedAt).toLocaleDateString()}</span>}
              </div>
            </div>
          )}

          {pendingProposals.length > 0 ? (
            <div className="bg-white/[0.02] border border-amber-500/20 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-400/80 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                Pending Proposals ({pendingProposals.length})
              </h3>
              <div className="space-y-2" data-testid="pending-proposals">
                {pendingProposals.map((p: any) => (
                  <div key={p.id} className="bg-white/[0.01] border border-white/5 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-amber-400/60 uppercase">{p.proposalType.replace(/_/g, " ")}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${p.guardrailStatus === "passed" ? "text-emerald-400 bg-emerald-500/10" : p.guardrailStatus === "failed" ? "text-red-400 bg-red-500/10" : "text-amber-400 bg-amber-500/10"}`}>{p.guardrailStatus}</span>
                        <span className="text-[9px] font-mono text-white/20">{p.confidence.toFixed(0)}%</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/40 font-mono">{p.proposal?.parameterKey}: {JSON.stringify(p.proposal?.currentValue)} → {JSON.stringify(p.proposal?.proposedValue)}</p>
                    <p className="text-[10px] text-white/25">{p.proposal?.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-6 text-center" data-testid="no-proposals">
              <p className="text-white/20 text-sm">No pending adaptation proposals</p>
              <p className="text-[10px] text-white/10 font-mono mt-1">Proposals are generated from learning recommendations when sufficient evidence exists</p>
            </div>
          )}

          {guardrailFailures.length > 0 && (
            <div className="bg-white/[0.02] border border-red-500/10 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-red-400/70 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Guardrail Rejections ({guardrailFailures.length})
              </h3>
              <div className="space-y-1" data-testid="guardrail-failures">
                {guardrailFailures.map((f: any) => (
                  <div key={f.id} className="text-[10px] text-white/30 font-mono bg-white/[0.01] rounded px-2 py-1">
                    <span className="text-red-400/60">{f.proposalType}</span>: {f.guardrailNotes}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentChanges.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Recent Changes
              </h3>
              <div className="space-y-2" data-testid="recent-changes">
                {recentChanges.map((c: any, i: number) => (
                  <div key={i} className="bg-white/[0.01] border border-white/5 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-white/40">{c.versionName}</span>
                      <span className="text-[9px] text-white/20">{c.activatedAt ? new Date(c.activatedAt).toLocaleDateString() : ""}</span>
                    </div>
                    <p className="text-[11px] text-white/30 mt-0.5">{c.changeSummary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rollbackHistory.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-white/40" />
                Rollback History
              </h3>
              <div className="space-y-1" data-testid="rollback-history">
                {rollbackHistory.map((r: any) => (
                  <div key={r.id} className="text-[10px] text-white/30 font-mono bg-white/[0.01] rounded px-2 py-1">
                    {r.fromConfigVersionId.slice(0, 8)} → {r.toConfigVersionId.slice(0, 8)}: {r.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PortfolioPanel() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/trading/portfolio"],
    refetchInterval: 15000,
    retry: 1,
  });

  const ps = data?.portfolioState;
  const limits = data?.limits;
  const strategyAllocation = data?.strategyAllocation || {};
  const clusters = data?.clusters || [];
  const blockedAllocations = data?.blockedAllocations || [];
  const recentAllocations = data?.recentAllocations || [];

  const throttleColor = (t: string) => {
    if (t === "critical") return "text-red-400 bg-red-500/10";
    if (t === "elevated") return "text-orange-400 bg-orange-500/10";
    if (t === "cautious") return "text-amber-400 bg-amber-500/10";
    return "text-emerald-400 bg-emerald-500/10";
  };

  return (
    <div className="space-y-4" data-testid="portfolio-panel">
      <div className="flex items-center gap-2">
        <PieChart className="w-5 h-5 text-[#C9A84C]" />
        <h2 className="text-lg font-semibold text-white">Portfolio & Risk</h2>
        {ps && <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${throttleColor(ps.riskThrottleState)}`}>{ps.riskThrottleState.toUpperCase()}</span>}
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-white/20 text-sm">Loading portfolio data...</div>
      ) : !ps ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-6 text-center space-y-2" data-testid="portfolio-no-data">
          <PieChart className="w-8 h-8 text-white/10 mx-auto" />
          <p className="text-white/30 text-sm">Portfolio state unavailable</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="portfolio-metrics">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Total Equity</p>
              <p className="text-lg font-mono text-white/90 mt-1" data-testid="portfolio-equity">{formatUsd(ps.totalEquity)}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Buying Power</p>
              <p className="text-lg font-mono text-white/90 mt-1">{formatUsd(ps.availableBuyingPower)}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Gross Exposure</p>
              <p className="text-lg font-mono text-white/90 mt-1" data-testid="portfolio-gross">{formatUsd(ps.grossExposure)}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Net Exposure</p>
              <p className={`text-lg font-mono mt-1 ${ps.netExposure >= 0 ? "text-emerald-400" : "text-red-400"}`}>{ps.netExposure >= 0 ? "+" : ""}{formatUsd(ps.netExposure)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Realized PnL</p>
              <p className={`text-sm font-mono mt-1 ${ps.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="portfolio-realized-pnl">{ps.realizedPnl >= 0 ? "+" : ""}{formatUsd(ps.realizedPnl)}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Unrealized PnL</p>
              <p className={`text-sm font-mono mt-1 ${ps.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{ps.unrealizedPnl >= 0 ? "+" : ""}{formatUsd(ps.unrealizedPnl)}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Open Positions</p>
              <p className="text-sm font-mono text-white/90 mt-1" data-testid="portfolio-open-count">{ps.openPositionsCount} / {limits?.maxOpenPositions || 8}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Max Drawdown</p>
              <p className={`text-sm font-mono mt-1 ${ps.maxDrawdown > 10 ? "text-red-400" : ps.maxDrawdown > 5 ? "text-amber-400" : "text-white/70"}`}>{ps.maxDrawdown.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#C9A84C]" />
                Exposure by Asset
              </h3>
              {Object.keys(ps.exposureBySymbol).length === 0 ? (
                <p className="text-[11px] text-white/20 font-mono">No open exposure</p>
              ) : (
                <div className="space-y-2" data-testid="portfolio-exposure-by-asset">
                  {Object.entries(ps.exposureBySymbol as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([sym, exp]) => (
                    <div key={sym} className="flex items-center justify-between">
                      <span className="text-xs font-mono text-white/60">{sym}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#C9A84C]/60 rounded-full" style={{ width: `${Math.min(100, (exp / (limits?.maxExposurePerAsset || 25000)) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-white/40 w-14 text-right">{formatUsd(exp)}</span>
                        <span className="text-[9px] text-white/20">{ps.concentrationByAsset?.[sym] || 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#C9A84C]" />
                Cluster Exposure
              </h3>
              {clusters.map((c: any) => {
                const clusterExp = ps.exposureByCluster?.[c.name] || 0;
                const maxCluster = limits?.maxCorrelatedClusterExposure || 40000;
                return (
                  <div key={c.name} className="space-y-1" data-testid={`cluster-${c.name}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-white/60 capitalize">{c.name}</span>
                      <span className="text-[10px] font-mono text-white/40">{formatUsd(clusterExp)} / {formatUsd(maxCluster)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${clusterExp > maxCluster * 0.8 ? "bg-red-500/60" : "bg-[#C9A84C]/50"}`} style={{ width: `${Math.min(100, (clusterExp / maxCluster) * 100)}%` }} />
                    </div>
                    <p className="text-[9px] text-white/20 font-mono">{c.symbols.join(", ")} — correlation weight: {c.correlationWeight}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {Object.keys(strategyAllocation).length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#C9A84C]" />
                Strategy Allocation
              </h3>
              <div className="space-y-2" data-testid="strategy-allocation">
                {Object.entries(strategyAllocation as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([strat, pct]) => (
                  <div key={strat} className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/60">{strat.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#C9A84C]/50 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-white/40 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {blockedAllocations.length > 0 && (
            <div className="bg-white/[0.02] border border-red-500/10 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-red-400/70 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" />
                Blocked Trades ({blockedAllocations.length})
              </h3>
              <div className="space-y-1" data-testid="portfolio-blocked">
                {blockedAllocations.slice(0, 10).map((b: any) => (
                  <div key={b.id} className="text-[10px] text-white/30 font-mono bg-white/[0.01] rounded px-2 py-1 flex items-center justify-between">
                    <span><span className="text-red-400/60">{b.symbol}</span> · {b.strategy}</span>
                    <span className="text-white/20 truncate max-w-[200px]">{b.blockReason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentAllocations.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Recent Allocation Decisions
              </h3>
              <div className="space-y-1" data-testid="portfolio-recent-allocations">
                {recentAllocations.slice(0, 10).map((a: any) => (
                  <div key={a.id} className="text-[10px] text-white/30 font-mono bg-white/[0.01] rounded px-2 py-1">
                    <div className="flex items-center justify-between">
                      <span>
                        <span className={a.wasBlocked ? "text-red-400/60" : "text-emerald-400/60"}>{a.wasBlocked ? "BLOCKED" : "APPROVED"}</span>
                        {" "}{a.symbol} · {a.strategy}
                      </span>
                      <span className="text-white/20">
                        {a.wasBlocked ? "" : `${formatUsd(a.requestedSize)} → ${formatUsd(a.approvedSize)}`}
                      </span>
                    </div>
                    {a.blockReason && <p className="text-[9px] text-white/15 mt-0.5">{a.blockReason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-white/40" />
              Exposure Limits
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="portfolio-limits">
              {limits && Object.entries(limits as Record<string, number>).map(([key, val]) => (
                <div key={key} className="text-[10px] font-mono">
                  <span className="text-white/25">{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
                  <span className="text-white/50 ml-1">{typeof val === "number" ? formatUsd(val) : String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StressTestPanel() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/trading/stress"],
    refetchInterval: 30000,
    retry: 1,
  });

  const resilience = data?.resilience;
  const scenarioResults = data?.scenarioResults || [];
  const worstCase = data?.worstCase;
  const topRiskFlags = data?.topRiskFlags || [];
  const strategySensitivities = data?.strategySensitivities || [];
  const alerts = data?.alerts || [];
  const hasPositions = (data?.portfolioState?.openPositionsCount || 0) > 0;

  const fragilityColor = (label: string) => {
    if (label === "high") return "text-red-400 bg-red-500/10";
    if (label === "medium") return "text-amber-400 bg-amber-500/10";
    return "text-emerald-400 bg-emerald-500/10";
  };

  const severityColor = (s: string) => {
    if (s === "critical") return "text-red-400";
    if (s === "high") return "text-orange-400";
    if (s === "medium") return "text-amber-400";
    return "text-white/40";
  };

  return (
    <div className="space-y-4" data-testid="stress-panel">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-[#C9A84C]" />
        <h2 className="text-lg font-semibold text-white">Stress Testing & Resilience</h2>
        {resilience && <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${fragilityColor(resilience.fragilityLabel)}`}>{resilience.fragilityLabel.toUpperCase()} FRAGILITY</span>}
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-white/20 text-sm">Running stress tests...</div>
      ) : !hasPositions ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-6 text-center space-y-2" data-testid="stress-no-positions">
          <Shield className="w-8 h-8 text-white/10 mx-auto" />
          <p className="text-white/30 text-sm">No open positions to stress test</p>
          <p className="text-[11px] text-white/15 font-mono">Stress scenarios will be evaluated against live portfolio exposure</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="stress-metrics">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Resilience Score</p>
              <p className={`text-lg font-mono mt-1 ${(resilience?.overallScore || 0) >= 70 ? "text-emerald-400" : (resilience?.overallScore || 0) >= 40 ? "text-amber-400" : "text-red-400"}`} data-testid="resilience-score">{resilience?.overallScore || 0}/100</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Worst Case Impact</p>
              <p className="text-lg font-mono text-red-400 mt-1" data-testid="worst-case-impact">{worstCase ? formatUsd(worstCase.projectedPnlImpact) : "$0"}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Worst Scenario</p>
              <p className="text-sm font-mono text-white/70 mt-1 truncate" data-testid="worst-scenario">{worstCase?.scenarioName || "—"}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Worst Drawdown</p>
              <p className={`text-lg font-mono mt-1 ${(worstCase?.projectedDrawdown || 0) > 10 ? "text-red-400" : "text-amber-400"}`}>{worstCase?.projectedDrawdown?.toFixed(1) || "0"}%</p>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="bg-white/[0.02] border border-red-500/10 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-red-400/70 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Risk Alerts ({alerts.length})
              </h3>
              <div className="space-y-1" data-testid="stress-alerts">
                {alerts.map((a: any, i: number) => (
                  <div key={i} className="text-[10px] font-mono bg-white/[0.01] rounded px-2 py-1 flex items-center gap-2">
                    <span className={`${severityColor(a.severity)} uppercase text-[8px]`}>{a.severity}</span>
                    <span className="text-white/40">{a.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#C9A84C]" />
              Scenario Impact Table
            </h3>
            <div className="space-y-1" data-testid="scenario-impacts">
              {scenarioResults.sort((a: any, b: any) => a.projectedPnlImpact - b.projectedPnlImpact).slice(0, 10).map((s: any) => (
                <div key={s.scenarioName} className="flex items-center justify-between text-[10px] font-mono bg-white/[0.01] rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/20 uppercase w-16">{s.scenarioGroup.replace(/_/g, " ")}</span>
                    <span className="text-white/50">{s.scenarioName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`${s.projectedPnlImpact < 0 ? "text-red-400" : "text-emerald-400"}`}>{s.projectedPnlImpact >= 0 ? "+" : ""}{formatUsd(s.projectedPnlImpact)}</span>
                    <span className="text-white/20 w-12 text-right">{s.projectedDrawdown.toFixed(1)}% DD</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {strategySensitivities.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#C9A84C]" />
                Strategy Stress Sensitivity
              </h3>
              <div className="space-y-2" data-testid="strategy-sensitivity">
                {strategySensitivities.map((s: any) => (
                  <div key={s.strategy} className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-white/60">{s.strategy.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ${s.label === "fragile" ? "text-red-400 bg-red-500/10" : s.label === "moderate" ? "text-amber-400 bg-amber-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>{s.label}</span>
                      <span className="text-white/30">worst: {formatUsd(s.worstImpact)}</span>
                      <span className="text-white/20">{s.worstScenario}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topRiskFlags.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-white/70">Risk Flags</h3>
              <div className="flex flex-wrap gap-1" data-testid="risk-flags">
                {topRiskFlags.map((f: string, i: number) => (
                  <span key={i} className="text-[9px] font-mono text-amber-400/60 bg-amber-500/5 px-1.5 py-0.5 rounded">{f.replace(/_/g, " ")}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExecutionPanel() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/trading/execution"],
    refetchInterval: 30000,
    retry: 1,
  });

  const stats = data?.overallStats;
  const bySymbol = data?.bySymbol || {};
  const byStrategy = data?.byStrategy || {};
  const qualityDist = data?.qualityDistribution || {};
  const worstExecutions = data?.worstExecutions || [];
  const tvap = data?.theoreticalVsActualPnl;
  const profiles = data?.profiles || {};
  const hasTrades = (stats?.totalTrades || 0) > 0;

  const labelColor = (label: string) => {
    if (label === "excellent") return "text-emerald-400 bg-emerald-500/10";
    if (label === "good") return "text-green-400 bg-green-500/10";
    if (label === "acceptable") return "text-white/50 bg-white/5";
    if (label === "poor") return "text-amber-400 bg-amber-500/10";
    return "text-red-400 bg-red-500/10";
  };

  return (
    <div className="space-y-4" data-testid="execution-panel">
      <div className="flex items-center gap-2">
        <Ruler className="w-5 h-5 text-[#C9A84C]" />
        <h2 className="text-lg font-semibold text-white">Execution Quality</h2>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-white/20 text-sm">Loading execution data...</div>
      ) : !hasTrades ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-6 text-center space-y-2" data-testid="execution-no-data">
          <Ruler className="w-8 h-8 text-white/10 mx-auto" />
          <p className="text-white/30 text-sm">No execution data yet</p>
          <p className="text-[11px] text-white/15 font-mono">Execution quality is measured when trades close</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="execution-metrics">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Avg Slippage</p>
              <p className="text-lg font-mono text-white/90 mt-1">${stats?.avgSlippage?.toFixed(2) || "0"}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Worst Slippage</p>
              <p className="text-lg font-mono text-amber-400 mt-1">${stats?.worstSlippage?.toFixed(2) || "0"}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Poor Execution %</p>
              <p className={`text-lg font-mono mt-1 ${(stats?.poorExecutionPct || 0) > 20 ? "text-red-400" : "text-white/90"}`}>{stats?.poorExecutionPct || 0}%</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Execution Drag</p>
              <p className="text-lg font-mono text-red-400 mt-1">-${Math.abs(stats?.executionDrag || 0).toFixed(2)}</p>
            </div>
          </div>

          {tvap && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#C9A84C]" />
                Theoretical vs Actual PnL
              </h3>
              <div className="grid grid-cols-3 gap-3" data-testid="execution-pnl-comparison">
                <div className="text-center">
                  <p className="text-[10px] text-white/30">Theoretical</p>
                  <p className={`text-sm font-mono ${tvap.theoretical >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatUsd(tvap.theoretical)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-white/30">Actual</p>
                  <p className={`text-sm font-mono ${tvap.actual >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatUsd(tvap.actual)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-white/30">Drag</p>
                  <p className="text-sm font-mono text-red-400">{formatUsd(tvap.drag)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#C9A84C]" />
                Slippage by Asset
              </h3>
              <div className="space-y-2" data-testid="execution-by-symbol">
                {Object.entries(bySymbol as Record<string, any>).map(([sym, d]) => (
                  <div key={sym} className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-white/60">{sym}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">avg ${d.avgSlippage.toFixed(2)}</span>
                      <span className="text-white/20">{d.trades} trades</span>
                      <span className="text-[8px] text-white/30">score {d.avgScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#C9A84C]" />
                Quality Distribution
              </h3>
              <div className="space-y-2" data-testid="execution-quality-dist">
                {Object.entries(qualityDist as Record<string, number>).filter(([, v]) => v > 0).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between text-[10px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded ${labelColor(label)}`}>{label}</span>
                    <span className="text-white/40">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {worstExecutions.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Worst Executions
              </h3>
              <div className="space-y-1" data-testid="worst-executions">
                {worstExecutions.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between text-[10px] font-mono bg-white/[0.01] rounded px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white/60">{e.symbol}</span>
                      <span className="text-white/30">{e.strategy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">slip: ${e.totalSlippage?.toFixed(2)}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ${labelColor(e.label)}`}>{e.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-white/40" />
              Execution Profiles (Baseline Assumptions)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="execution-profiles">
              {Object.entries(profiles as Record<string, any>).map(([sym, p]) => (
                <div key={sym} className="text-[10px] font-mono">
                  <span className="text-white/60 font-bold">{sym}</span>
                  <div className="text-white/25 mt-0.5">spread: {(p.avgSpread * 100).toFixed(2)}%</div>
                  <div className="text-white/25">slip: {(p.avgSlippage * 100).toFixed(2)}%</div>
                  <div className="text-white/25">vol: {p.volatilityMultiplier}x</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveBridgePanel() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/trading/live-bridge"],
    refetchInterval: 30000,
    retry: 1,
  });

  const config = data?.config;
  const readiness = data?.readiness;
  const reconciliation = data?.reconciliation;
  const attemptLogs = data?.attemptLogs || [];
  const liveOrdersData = data?.liveOrders || [];
  const livePositionsData = data?.livePositions || [];

  const modeLabel = (mode: string) => {
    if (mode === "paper_only") return { text: "Paper Only", color: "text-white/40 bg-white/5" };
    if (mode === "dry_run") return { text: "Dry Run", color: "text-amber-400 bg-amber-500/10" };
    if (mode === "tiny_live") return { text: "Tiny Live", color: "text-emerald-400 bg-emerald-500/10" };
    return { text: mode, color: "text-white/40 bg-white/5" };
  };

  const statusColor = (status: string) => {
    if (status === "ready" || status === "healthy") return "text-emerald-400";
    if (status === "not_ready" || status === "stale") return "text-amber-400";
    return "text-white/40";
  };

  const ml = config ? modeLabel(config.executionMode) : null;

  return (
    <div className="space-y-4" data-testid="live-bridge-panel">
      <div className="flex items-center gap-2">
        <Radio className="w-5 h-5 text-[#C9A84C]" />
        <h2 className="text-lg font-semibold text-white">Live Execution Bridge</h2>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-white/20 text-sm">Loading bridge status...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="bridge-config">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Execution Mode</p>
              <span className={`inline-block mt-1 text-xs font-mono px-2 py-0.5 rounded ${ml?.color}`}>{ml?.text}</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Live Enabled</p>
              <div className="flex items-center gap-1.5 mt-1">
                {config?.liveEnabled ? (
                  <><Power className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs font-mono text-emerald-400">Yes</span></>
                ) : (
                  <><Power className="w-3.5 h-3.5 text-white/20" /><span className="text-xs font-mono text-white/30">No</span></>
                )}
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Account Mode</p>
              <p className="text-xs font-mono text-white/60 mt-1">{config?.accountMode || "—"}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Venue</p>
              <p className="text-xs font-mono text-white/60 mt-1">{config?.approvedVenue || "None"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="bridge-limits">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Max Risk/Trade</p>
              <p className="text-sm font-mono text-white/70 mt-1">${config?.maxLiveRiskPerTrade || 0}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Max Daily Risk</p>
              <p className="text-sm font-mono text-white/70 mt-1">${config?.maxDailyLiveRisk || 0}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Max Open Positions</p>
              <p className="text-sm font-mono text-white/70 mt-1">{config?.maxLiveOpenPositions || 0}</p>
            </div>
          </div>

          {readiness && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#C9A84C]" />
                Readiness Checks
                <span className={`ml-auto text-xs font-mono ${statusColor(readiness.status)}`}>{readiness.status === "ready" ? "READY" : "NOT READY"}</span>
              </h3>
              <div className="space-y-1.5" data-testid="readiness-checks">
                {readiness.checks?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      {c.passed ? (
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400" />
                      )}
                      <span className="text-white/60">{c.name}</span>
                    </div>
                    <span className="text-white/30">{c.reason}</span>
                  </div>
                ))}
              </div>
              {readiness.reasons?.length > 0 && (
                <div className="text-[9px] text-red-400/60 font-mono mt-1">
                  Blockers: {readiness.reasons.join(" · ")}
                </div>
              )}
            </div>
          )}

          {reconciliation && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-white/40" />
                Reconciliation
                <span className={`ml-auto text-xs font-mono ${statusColor(reconciliation.status)}`}>{reconciliation.status}</span>
              </h3>
              <div className="text-[10px] font-mono text-white/30">
                Orders checked: {reconciliation.ordersChecked} · Last sync: {formatAgo(reconciliation.lastSyncAt)}
              </div>
              {reconciliation.mismatches?.length > 0 && (
                <div className="space-y-0.5 mt-1">
                  {reconciliation.mismatches.map((m: string, i: number) => (
                    <div key={i} className="text-[9px] text-amber-400/60 font-mono">{m}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {livePositionsData.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#C9A84C]" />
                Live Positions ({livePositionsData.length})
              </h3>
              <div className="space-y-1" data-testid="live-positions">
                {livePositionsData.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-[10px] font-mono bg-white/[0.01] rounded px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white/60">{p.symbol}</span>
                      <span className={p.side === "long" ? "text-emerald-400" : "text-red-400"}>{p.side}</span>
                      <span className="text-white/30">{p.venue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">{p.quantity} @ ${p.entryPrice?.toFixed(2)}</span>
                      <span className={p.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}>{formatUsd(p.unrealizedPnl)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {liveOrdersData.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-white/40" />
                Recent Live Orders ({liveOrdersData.length})
              </h3>
              <div className="space-y-1" data-testid="live-orders">
                {liveOrdersData.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-[10px] font-mono bg-white/[0.01] rounded px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white/60">{o.symbol}</span>
                      <span className={o.side === "buy" ? "text-emerald-400" : "text-red-400"}>{o.side}</span>
                      <span className="text-white/30">{o.venue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">{o.quantity} @ ${o.requestedPrice?.toFixed(2)}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ${o.status.includes("filled") ? "text-emerald-400 bg-emerald-500/10" : o.status === "pending" ? "text-amber-400 bg-amber-500/10" : "text-white/30 bg-white/5"}`}>{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {attemptLogs.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                <Plug className="w-3.5 h-3.5 text-white/40" />
                Recent Gateway Attempts ({attemptLogs.length})
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto" data-testid="gateway-attempts">
                {attemptLogs.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-[10px] font-mono bg-white/[0.01] rounded px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${a.wasBlocked ? "bg-red-400" : "bg-emerald-400"}`} />
                      <span className="text-white/60">{a.symbol}</span>
                      <span className="text-white/30">{a.mode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/20 max-w-[200px] truncate">{a.requestedAction}</span>
                      {a.wasBlocked && <span className="text-[8px] text-red-400/60">{a.blockReason}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {liveOrdersData.length === 0 && livePositionsData.length === 0 && attemptLogs.length === 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-6 text-center space-y-2" data-testid="bridge-no-activity">
              <Radio className="w-8 h-8 text-white/10 mx-auto" />
              <p className="text-white/30 text-sm">No live execution activity</p>
              <p className="text-[11px] text-white/15 font-mono">Bridge is in {config?.executionMode || "paper_only"} mode — no orders sent to venues</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

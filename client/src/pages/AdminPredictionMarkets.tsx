import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Activity, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, Zap, BarChart3, Target, Globe,
  Clock, ArrowUpRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  uptime?: number;
  timestamp?: string;
  version?: string;
}

interface Source {
  name: string;
  status: "active" | "inactive" | "error" | string;
  marketsScanned?: number;
  lastScan?: string | null;
  error?: string | null;
}

interface SourcesResponse {
  sources: Source[];
  totalMarketsScanned?: number;
  lastUpdated?: string | null;
}

interface Opportunity {
  id?: string;
  market: string;
  opportunity: string;
  edge: number | string;
  status: "open" | "closed" | "pending" | string;
  source?: string;
  detectedAt?: string | null;
}

interface OpportunitiesResponse {
  opportunities: Opportunity[];
  count?: number;
  bestEdge?: number | string | null;
  lastUpdated?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SCANNER_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://prediction-market-scanner.railway.internal:8080"
    : "https://prediction-market-scanner.up.railway.app:8080";

function formatEdge(edge: number | string | null | undefined): string {
  if (edge == null) return "—";
  const n = typeof edge === "string" ? parseFloat(edge) : edge;
  if (isNaN(n)) return String(edge);
  return `${(n * 100).toFixed(1)}%`;
}

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

async function fetchScanner<T>(path: string): Promise<T> {
  const res = await fetch(`${SCANNER_BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className="bg-white/[0.02] border border-white/5 rounded-lg px-4 py-3"
      data-testid={`pm-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] uppercase text-white/30 font-mono tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-semibold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/20 font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

function SourceRow({ source }: { source: Source }) {
  const isActive = source.status === "active";
  const isError = source.status === "error";

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-white/5 bg-white/[0.015]"
      data-testid={`pm-source-${source.name}`}
    >
      <div className="shrink-0">
        {isActive ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : isError ? (
          <XCircle className="w-4 h-4 text-red-400" />
        ) : (
          <div className="w-4 h-4 rounded-full border border-white/20" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{source.name}</p>
        {source.error && (
          <p className="text-[11px] text-red-400/70 font-mono truncate">{source.error}</p>
        )}
        {!source.error && source.lastScan && (
          <p className="text-[11px] text-white/30 font-mono">{formatAgo(source.lastScan)}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {source.marketsScanned != null && (
          <span className="text-xs font-mono text-white/40">
            {source.marketsScanned.toLocaleString()} markets
          </span>
        )}
        <span
          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
            isActive
              ? "text-emerald-400 bg-emerald-500/10"
              : isError
              ? "text-red-400 bg-red-500/10"
              : "text-white/30 bg-white/5"
          }`}
        >
          {source.status}
        </span>
      </div>
    </div>
  );
}

function OpportunityRow({ opp, index }: { opp: Opportunity; index: number }) {
  const edgeNum =
    typeof opp.edge === "string" ? parseFloat(opp.edge) : (opp.edge ?? 0);
  const edgeColor =
    edgeNum >= 0.1
      ? "text-emerald-400"
      : edgeNum >= 0.05
      ? "text-amber-400"
      : "text-white/50";

  const statusColor: Record<string, string> = {
    open: "text-emerald-400 bg-emerald-500/10",
    pending: "text-amber-400 bg-amber-500/10",
    closed: "text-white/30 bg-white/5",
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
        index === 0
          ? "border-[#C9A84C]/20 bg-[#C9A84C]/[0.03] ring-1 ring-[#C9A84C]/10"
          : "border-white/5 bg-white/[0.015] hover:bg-white/[0.025]"
      }`}
      data-testid={`pm-opportunity-${opp.id ?? index}`}
    >
      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-[#C9A84C]/10">
        <ArrowUpRight className="w-3 h-3 text-[#C9A84C]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{opp.market}</p>
        <p className="text-[11px] text-white/40 truncate">{opp.opportunity}</p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-[10px] uppercase text-white/25 font-mono">Edge</p>
          <p className={`text-sm font-mono font-semibold ${edgeColor}`}>
            {formatEdge(opp.edge)}
          </p>
        </div>

        <span
          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
            statusColor[opp.status] ?? "text-white/30 bg-white/5"
          }`}
        >
          {opp.status}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPredictionMarkets() {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const healthQuery = useQuery<HealthResponse>({
    queryKey: ["pm-health"],
    queryFn: () => fetchScanner<HealthResponse>("/api/health"),
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: 3000,
  });

  const sourcesQuery = useQuery<SourcesResponse>({
    queryKey: ["pm-sources"],
    queryFn: () => fetchScanner<SourcesResponse>("/api/debug/sources"),
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: 3000,
  });

  const oppsQuery = useQuery<OpportunitiesResponse>({
    queryKey: ["pm-opportunities"],
    queryFn: () =>
      fetchScanner<OpportunitiesResponse>("/api/prediction-markets/opportunities"),
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: 3000,
  });

  function handleRefresh() {
    setLastRefresh(new Date());
    healthQuery.refetch();
    sourcesQuery.refetch();
    oppsQuery.refetch();
  }

  const isLoading =
    healthQuery.isLoading && sourcesQuery.isLoading && oppsQuery.isLoading;
  const hasError =
    healthQuery.isError && sourcesQuery.isError && oppsQuery.isError;

  const health = healthQuery.data;
  const sources = sourcesQuery.data?.sources ?? [];
  const totalMarketsScanned = sourcesQuery.data?.totalMarketsScanned;
  const opportunities = oppsQuery.data?.opportunities ?? [];
  const bestEdge = oppsQuery.data?.bestEdge;
  const oppsCount = oppsQuery.data?.count ?? opportunities.length;

  const healthOk = health?.status === "ok";
  const healthDegraded = health?.status === "degraded";

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-[70vh]"
        data-testid="pm-loading"
      >
        <div className="flex flex-col items-center gap-3">
          <TrendingUp className="w-8 h-8 text-[#C9A84C] animate-pulse" />
          <p className="text-white/40 text-sm">
            Connecting to Prediction Market Scanner…
          </p>
        </div>
      </div>
    );
  }

  // ── Full error state ───────────────────────────────────────────────────────
  if (hasError) {
    return (
      <div
        className="flex items-center justify-center h-[70vh]"
        data-testid="pm-error"
      >
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <div>
            <p className="text-white/70 text-sm font-medium">
              Cannot reach Prediction Market Scanner
            </p>
            <p className="text-white/30 text-xs mt-1">
              The scanner service may be starting up or unreachable. It runs at{" "}
              <span className="font-mono text-white/40">
                prediction-market-scanner.railway.internal
              </span>
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12" data-testid="pm-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
            data-testid="pm-heading"
          >
            Prediction Markets
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Live scanner · Arbitrage opportunities · Edge detection
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Health badge */}
          {health && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                healthOk
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : healthDegraded
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-red-500/40 bg-red-500/10"
              }`}
              data-testid="pm-health-badge"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  healthOk
                    ? "bg-emerald-400"
                    : healthDegraded
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`}
              />
              <span
                className={`text-xs font-mono uppercase font-semibold tracking-wider ${
                  healthOk
                    ? "text-emerald-400"
                    : healthDegraded
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {health.status}
              </span>
            </div>
          )}

          {healthQuery.isError && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/40 bg-red-500/10"
              data-testid="pm-health-error"
            >
              <XCircle className="w-3 h-3 text-red-400" />
              <span className="text-xs font-mono uppercase text-red-400">
                Offline
              </span>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={
              healthQuery.isFetching ||
              sourcesQuery.isFetching ||
              oppsQuery.isFetching
            }
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/80 transition-colors disabled:opacity-40"
            data-testid="pm-refresh-btn"
          >
            <RefreshCw
              className={`w-3 h-3 ${
                healthQuery.isFetching ||
                sourcesQuery.isFetching ||
                oppsQuery.isFetching
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </button>

          <span className="text-[10px] text-white/20 font-mono">
            {formatAgo(lastRefresh.toISOString())}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        data-testid="pm-stat-cards"
      >
        <StatCard
          label="Service Health"
          value={health ? health.status.toUpperCase() : "—"}
          icon={Activity}
          color={
            healthOk
              ? "text-emerald-400"
              : healthDegraded
              ? "text-amber-400"
              : "text-red-400"
          }
          sub={health?.version ? `v${health.version}` : undefined}
        />
        <StatCard
          label="Markets Scanned"
          value={
            totalMarketsScanned != null
              ? totalMarketsScanned.toLocaleString()
              : sources.length > 0
              ? sources
                  .reduce((acc, s) => acc + (s.marketsScanned ?? 0), 0)
                  .toLocaleString()
              : "—"
          }
          icon={Globe}
          color="text-blue-400"
          sub={`${sources.length} source${sources.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Opportunities"
          value={oppsCount > 0 ? String(oppsCount) : "0"}
          icon={Target}
          color="text-[#C9A84C]"
          sub={
            oppsQuery.dataUpdatedAt
              ? `Updated ${formatAgo(new Date(oppsQuery.dataUpdatedAt).toISOString())}`
              : undefined
          }
        />
        <StatCard
          label="Best Edge"
          value={bestEdge != null ? formatEdge(bestEdge) : opportunities.length > 0
            ? formatEdge(
                Math.max(
                  ...opportunities.map((o) =>
                    typeof o.edge === "string" ? parseFloat(o.edge) : (o.edge ?? 0)
                  )
                )
              )
            : "—"}
          icon={Zap}
          color="text-purple-400"
        />
      </div>

      {/* Sources + Opportunities grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sources panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Sources
            </h2>
            <span className="text-[11px] text-white/20 font-mono">
              {sources.length} configured
            </span>
          </div>

          {sourcesQuery.isError ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400/70 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Failed to load sources
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-10 text-white/20 text-sm">
              No sources configured
            </div>
          ) : (
            <div className="space-y-2" data-testid="pm-sources-list">
              {sources.map((source) => (
                <SourceRow key={source.name} source={source} />
              ))}
            </div>
          )}

          {/* Source summary */}
          {sources.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-mono font-semibold text-emerald-400">
                  {sources.filter((s) => s.status === "active").length}
                </p>
                <p className="text-[10px] uppercase text-white/25 font-mono">Active</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-mono font-semibold text-red-400">
                  {sources.filter((s) => s.status === "error").length}
                </p>
                <p className="text-[10px] uppercase text-white/25 font-mono">Errors</p>
              </div>
            </div>
          )}
        </div>

        {/* Opportunities panel */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
              Opportunities
            </h2>
            <span className="text-[11px] text-white/20 font-mono">
              {oppsCount} found
            </span>
          </div>

          {oppsQuery.isError ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400/70 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Failed to load opportunities
            </div>
          ) : opportunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="w-8 h-8 text-white/10 mb-3" />
              <p className="text-white/30 text-sm">No opportunities detected</p>
              <p className="text-white/15 text-xs mt-1">
                The scanner is running — check back shortly
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 pb-1">
                <span className="text-[10px] uppercase text-white/20 font-mono tracking-wider">
                  Market / Opportunity
                </span>
                <span className="text-[10px] uppercase text-white/20 font-mono tracking-wider">
                  Edge
                </span>
                <span className="text-[10px] uppercase text-white/20 font-mono tracking-wider">
                  Status
                </span>
              </div>

              <div
                className="space-y-2 max-h-[600px] overflow-y-auto pr-1"
                style={{ scrollbarWidth: "thin" }}
                data-testid="pm-opportunities-list"
              >
                {opportunities.map((opp, i) => (
                  <OpportunityRow
                    key={opp.id ?? `${opp.market}-${i}`}
                    opp={opp}
                    index={i}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

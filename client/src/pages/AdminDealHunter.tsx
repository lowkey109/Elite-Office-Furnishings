import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, RefreshCw, Zap, Building2, TrendingUp, Target, LayoutDashboard,
  ChevronRight, Eye, Radio, GitMerge, X, MapPin, Users, DollarSign,
  Clock, AlertTriangle, CheckCircle2, Loader2, ExternalLink, Crosshair,
  Filter, ArrowUpDown, FileText, MessageSquare,
} from "lucide-react";

interface DealHunterSignal {
  id: string;
  companyName: string;
  companyDomain: string | null;
  city: string;
  state: string | null;
  country: string | null;
  industry: string;
  employeeEstimate: number | null;
  growthRateEstimate: number | null;
  signalType: string;
  signalSubtype: string | null;
  signalSource: string;
  sourceUrl: string | null;
  rawPayloadSummary: string | null;
  signalStrengthScore: number;
  signalConfidence: number;
  reasoningSummary: string | null;
  estimatedWorkspaceSqm: number | null;
  estimatedProjectValue: number | null;
  relocationProbability: number | null;
  officeChangeProbability: number | null;
  probabilityTier: string;
  projectType: string | null;
  estimatedTimeline: string | null;
  recommendedAction: string | null;
  recommendedOutreachAngle: string | null;
  recommendedContactRolesJson: string | null;
  outreachDraft: string | null;
  isReviewed: boolean;
  pushedToPipeline: boolean;
  pushedToRadar: boolean;
  isDuplicate: boolean;
  status: string;
  createdAt: string;
}

interface Stats {
  total: number;
  newCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  pushedCount: number;
  dismissedCount: number;
  totalPipelineValue: number;
}

function tierColor(tier: string) {
  if (tier === "high") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (tier === "medium") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
}

function tierDot(tier: string) {
  if (tier === "high") return "bg-green-400";
  if (tier === "medium") return "bg-yellow-400";
  return "bg-zinc-500";
}

function signalTypeLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function fmtValue(v: number | null) {
  if (!v) return "—";
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
}

export default function AdminDealHunter() {
  const [authed] = useState(() =>
    sessionStorage.getItem("tcd_admin_auth") === "true" ||
    localStorage.getItem("tcd_admin_auth") === "true"
  );
  const [selectedSignal, setSelectedSignal] = useState<DealHunterSignal | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "value" | "recency" | "confidence">("score");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/admin/deal-hunter/stats"], enabled: authed });

  const { data: signals = [], isLoading: signalsLoading } = useQuery<DealHunterSignal[]>({
    queryKey: ["/api/admin/deal-hunter/signals", cityFilter, industryFilter, tierFilter, typeFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (cityFilter) params.set("city", cityFilter);
      if (industryFilter) params.set("industry", industryFilter);
      if (tierFilter) params.set("probabilityTier", tierFilter);
      if (typeFilter) params.set("signalType", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      return fetch(`/api/admin/deal-hunter/signals?${params}`).then(r => r.json());
    },
    enabled: authed,
  });

  const runScanMutation = useMutation({
    mutationFn: (count: number) => apiRequest("POST", "/api/admin/deal-hunter/run", { count }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/signals"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/stats"] });
      toast({ title: `Deal Hunter complete — ${data.created} signals discovered, ${data.deduplicated} deduplicated` });
    },
    onError: (e: any) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const pushPipelineMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/deal-hunter/signals/${id}/push-to-pipeline`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/signals"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/stats"] });
      setSelectedSignal(null);
      toast({ title: "Pushed to pipeline" });
    },
    onError: (e: any) => toast({ title: "Push failed", description: e.message, variant: "destructive" }),
  });

  const pushRadarMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/deal-hunter/signals/${id}/push-to-radar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/signals"] });
      setSelectedSignal(null);
      toast({ title: "Pushed to Office Move Radar" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/deal-hunter/signals/${id}/review`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/signals"] });
      toast({ title: "Marked as reviewed" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/deal-hunter/signals/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/signals"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/stats"] });
      setSelectedSignal(null);
      toast({ title: "Signal dismissed" });
    },
  });

  const dupeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/deal-hunter/signals/${id}/mark-duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/signals"] });
      setSelectedSignal(null);
      toast({ title: "Marked as duplicate" });
    },
  });

  // Sort and filter signals
  const filtered = signals
    .filter(s => !search || s.companyName.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase()) || s.industry.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "score") return b.signalStrengthScore - a.signalStrengthScore;
      if (sortBy === "value") return (b.estimatedProjectValue ?? 0) - (a.estimatedProjectValue ?? 0);
      if (sortBy === "confidence") return b.signalConfidence - a.signalConfidence;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const kpiTiles = [
    { label: "Total Signals", value: stats?.total ?? 0, icon: Target, color: "text-blue-400", sub: `${stats?.newCount ?? 0} unreviewed` },
    { label: "High Probability", value: stats?.highCount ?? 0, icon: TrendingUp, color: "text-green-400", sub: "Priority opportunities" },
    { label: "Medium Probability", value: stats?.mediumCount ?? 0, icon: Zap, color: "text-yellow-400", sub: "Nurture pipeline" },
    { label: "Pushed to Pipeline", value: stats?.pushedCount ?? 0, icon: CheckCircle2, color: "text-violet-400", sub: `${stats?.dismissedCount ?? 0} dismissed` },
    { label: "Total Pipeline Value", value: fmtValue(stats?.totalPipelineValue ?? null), icon: DollarSign, color: "text-[hsl(43,78%,52%)]", sub: "From discovered signals", raw: true },
  ];

  const allCities = [...new Set(signals.map(s => s.city))].sort();
  const allIndustries = [...new Set(signals.map(s => s.industry))].sort();
  const allTypes = [...new Set(signals.map(s => s.signalType))].sort();

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)] text-white">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard"><div className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm cursor-pointer"><LayoutDashboard className="w-4 h-4" /> Dashboard</div></Link>
            <ChevronRight className="w-3 h-3 text-zinc-700" />
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <span className="text-white font-semibold text-sm">AI Deal Hunter</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/signals"] }); qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/stats"] }); }}
              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => runScanMutation.mutate(10)} disabled={runScanMutation.isPending}
              className="flex items-center gap-2 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] disabled:opacity-50 text-black px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              data-testid="button-run-deal-hunter">
              {runScanMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Hunting...</> : <><Crosshair className="w-4 h-4" /> Run Deal Hunter</>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {kpiTiles.map(tile => (
            <div key={tile.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4" data-testid={`kpi-${tile.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-500 text-xs font-medium">{tile.label}</span>
                <tile.icon className={`w-4 h-4 ${tile.color}`} />
              </div>
              <p className={`text-2xl font-bold ${tile.color}`}>{tile.raw ? tile.value : tile.value}</p>
              <p className="text-zinc-600 text-xs mt-1">{tile.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters + Search + Sort */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, city, industry…"
                className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-zinc-600" data-testid="input-search" />
            </div>

            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none" data-testid="select-city">
              <option value="">All Cities</option>
              {allCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none" data-testid="select-industry">
              <option value="">All Industries</option>
              {allIndustries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>

            <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none" data-testid="select-tier">
              <option value="">All Tiers</option>
              <option value="high">High Probability</option>
              <option value="medium">Medium Probability</option>
              <option value="low">Low Probability</option>
            </select>

            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none" data-testid="select-type">
              <option value="">All Signal Types</option>
              {allTypes.map(t => <option key={t} value={t}>{signalTypeLabel(t)}</option>)}
            </select>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none" data-testid="select-status">
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="pushed">Pushed</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {(["score", "value", "recency", "confidence"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortBy === s ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`}>
                  {s === "score" ? "Score" : s === "value" ? "Value" : s === "recency" ? "Recent" : "Confidence"}
                </button>
              ))}
            </div>

            {(cityFilter || industryFilter || tierFilter || typeFilter || statusFilter || search) && (
              <button onClick={() => { setCityFilter(""); setIndustryFilter(""); setTierFilter(""); setTypeFilter(""); setStatusFilter(""); setSearch(""); }}
                className="flex items-center gap-1 text-zinc-500 hover:text-white text-xs">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <p className="text-zinc-600 text-xs mt-3">{filtered.length} signal{filtered.length !== 1 ? "s" : ""} shown</p>
        </div>

        {/* Signal Feed */}
        {signalsLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Crosshair className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-lg font-medium">No signals found</p>
            <p className="text-zinc-700 text-sm mt-1">Run the Deal Hunter to discover opportunities</p>
            <button onClick={() => runScanMutation.mutate(10)} disabled={runScanMutation.isPending}
              className="mt-6 flex items-center gap-2 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black px-6 py-3 rounded-xl text-sm font-semibold mx-auto">
              <Crosshair className="w-4 h-4" /> Run Deal Hunter
            </button>
          </div>
        ) : (
          <div className="space-y-3" data-testid="signal-feed">
            {filtered.map(signal => (
              <div key={signal.id}
                className={`bg-[hsl(220,18%,10%)] border rounded-2xl p-5 cursor-pointer hover:border-[rgba(201,168,76,0.25)] transition-all ${selectedSignal?.id === signal.id ? "border-[rgba(201,168,76,0.4)]" : "border-[rgba(255,255,255,0.06)]"}`}
                onClick={() => setSelectedSignal(selectedSignal?.id === signal.id ? null : signal)}
                data-testid={`signal-row-${signal.id}`}>
                <div className="flex items-start gap-4">
                  {/* Score ring */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-white leading-none">{signal.signalStrengthScore}</span>
                    <span className="text-zinc-600 text-[10px]">score</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-bold text-base">{signal.companyName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tierColor(signal.probabilityTier)}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${tierDot(signal.probabilityTier)}`} />
                        {signal.probabilityTier} probability
                      </span>
                      {signal.pushedToPipeline && <span className="text-xs px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-full">In Pipeline</span>}
                      {signal.pushedToRadar && <span className="text-xs px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full">In Radar</span>}
                      {signal.isReviewed && !signal.pushedToPipeline && <span className="text-xs px-2 py-0.5 bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 rounded-full">Reviewed</span>}
                      {signal.status === "dismissed" && <span className="text-xs px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">Dismissed</span>}
                    </div>

                    <div className="flex items-center gap-4 text-zinc-500 text-xs mb-2 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{signal.city}{signal.state ? `, ${signal.state}` : ""}</span>
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{signal.industry}</span>
                      {signal.employeeEstimate && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{signal.employeeEstimate.toLocaleString()} staff</span>}
                      {signal.estimatedProjectValue && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmtValue(signal.estimatedProjectValue)}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{signal.estimatedTimeline ?? "—"}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-lg">{signalTypeLabel(signal.signalType)}</span>
                      <span className="text-xs text-zinc-600">via {signal.signalSource}</span>
                    </div>

                    {signal.rawPayloadSummary && (
                      <p className="text-zinc-400 text-xs line-clamp-2">{signal.rawPayloadSummary}</p>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex-shrink-0 flex flex-col gap-2 items-end">
                    {!signal.pushedToPipeline && signal.status !== "dismissed" && (
                      <button onClick={e => { e.stopPropagation(); pushPipelineMutation.mutate(signal.id); }}
                        disabled={pushPipelineMutation.isPending}
                        className="text-xs px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg font-medium"
                        data-testid={`button-push-pipeline-${signal.id}`}>
                        → Pipeline
                      </button>
                    )}
                    {!signal.pushedToRadar && signal.status !== "dismissed" && (
                      <button onClick={e => { e.stopPropagation(); pushRadarMutation.mutate(signal.id); }}
                        disabled={pushRadarMutation.isPending}
                        className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium">
                        → Radar
                      </button>
                    )}
                    {!signal.isReviewed && (
                      <button onClick={e => { e.stopPropagation(); reviewMutation.mutate(signal.id); }}
                        className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg">
                        Mark Reviewed
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {selectedSignal?.id === signal.id && (
                  <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.06)] grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">Signal Intelligence</p>
                        <div className="space-y-1.5">
                          {signal.reasoningSummary?.split(" | ").map((r, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="text-green-400 mt-0.5">+</span>
                              <span className="text-zinc-300">{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">Opportunity Summary</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            { label: "Project Type", value: signal.projectType?.replace(/_/g, " ") ?? "—" },
                            { label: "Office Size", value: signal.estimatedWorkspaceSqm ? `${signal.estimatedWorkspaceSqm} sqm` : "—" },
                            { label: "Timeline", value: signal.estimatedTimeline ?? "—" },
                            { label: "Est. Value", value: fmtValue(signal.estimatedProjectValue) },
                            { label: "Relocation Prob.", value: signal.relocationProbability ? `${signal.relocationProbability}%` : "—" },
                            { label: "Change Prob.", value: signal.officeChangeProbability ? `${signal.officeChangeProbability}%` : "—" },
                            { label: "Confidence", value: `${signal.signalConfidence}%` },
                            { label: "Growth Rate", value: signal.growthRateEstimate ? `+${signal.growthRateEstimate}%` : "—" },
                          ].map(item => (
                            <div key={item.label} className="bg-zinc-900 rounded-xl p-2.5">
                              <p className="text-zinc-600 text-[10px] mb-0.5">{item.label}</p>
                              <p className="text-white font-medium">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {signal.recommendedContactRolesJson && (() => {
                        try {
                          const roles: string[] = JSON.parse(signal.recommendedContactRolesJson);
                          return (
                            <div>
                              <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">Recommended Contact Roles</p>
                              <div className="flex flex-wrap gap-2">
                                {roles.map(r => (
                                  <span key={r} className="text-xs px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg">{r}</span>
                                ))}
                              </div>
                            </div>
                          );
                        } catch { return null; }
                      })()}
                    </div>

                    <div className="space-y-4">
                      {signal.recommendedAction && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">Recommended Action</p>
                          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                            <p className="text-zinc-200 text-xs leading-relaxed">{signal.recommendedAction}</p>
                          </div>
                        </div>
                      )}

                      {signal.recommendedOutreachAngle && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">Outreach Angle</p>
                          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                            <p className="text-zinc-200 text-xs leading-relaxed">{signal.recommendedOutreachAngle}</p>
                          </div>
                        </div>
                      )}

                      {signal.outreachDraft && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">Outreach Draft</p>
                          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 max-h-40 overflow-y-auto">
                            <pre className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">{signal.outreachDraft}</pre>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="space-y-2 pt-2">
                        {!signal.pushedToPipeline && signal.status !== "dismissed" && (
                          <button onClick={() => pushPipelineMutation.mutate(signal.id)} disabled={pushPipelineMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium"
                            data-testid={`button-push-pipeline-detail-${signal.id}`}>
                            {pushPipelineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                            Push to Pipeline
                          </button>
                        )}
                        {!signal.pushedToRadar && signal.status !== "dismissed" && (
                          <button onClick={() => pushRadarMutation.mutate(signal.id)} disabled={pushRadarMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium">
                            <Radio className="w-4 h-4" /> Push to Office Move Radar
                          </button>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          {signal.pushedToPipeline && (
                            <Link href="/admin/leads">
                              <button className="w-full flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2 text-xs font-medium">
                                <Eye className="w-3.5 h-3.5" /> View Lead
                              </button>
                            </Link>
                          )}
                          {signal.pushedToRadar && (
                            <Link href="/admin/office-move-radar">
                              <button className="w-full flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2 text-xs font-medium">
                                <Radio className="w-3.5 h-3.5" /> View Radar
                              </button>
                            </Link>
                          )}
                          {signal.status !== "dismissed" && (
                            <button onClick={() => dismissMutation.mutate(signal.id)}
                              className="flex items-center justify-center gap-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl py-2 text-xs font-medium">
                              <X className="w-3.5 h-3.5" /> Dismiss
                            </button>
                          )}
                          <button onClick={() => dupeMutation.mutate(signal.id)}
                            className="flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl py-2 text-xs font-medium">
                            <GitMerge className="w-3.5 h-3.5" /> Duplicate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

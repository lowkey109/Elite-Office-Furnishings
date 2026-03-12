import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Building2, ArrowLeft, Zap, TrendingUp, MapPin, BarChart3,
  DollarSign, Filter, RefreshCw, Target, ChevronRight, Send,
  Globe, AlertCircle, Clock, CheckCircle, Eye, Trash2,
  Radar, Activity, X, Sparkles, ArrowRight, Users, Network,
  Briefcase,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";
const ADMIN_PASS = "Jaymin12!/";
const AUTH_KEY = "tcd_admin_auth";

type RelocationSignal = {
  id: string; companyName: string; industry?: string; city: string; state?: string;
  signalType: string; signalSource?: string; signalDetail?: string;
  jobPostingsCount?: number; estimatedHeadcount?: number; headcountGrowthPct?: number;
  leaseExpiryDate?: string; officeSizeSqm?: number; relocationProbability: number;
  probabilityTier: string; estimatedProjectValue?: number; estimatedTimeline?: string;
  recommendedAction?: string; pushedToPipeline: boolean; status: string; createdAt: string;
};
type MarketIntelligence = {
  totalSignals: number; highProbabilityCount: number; mediumProbabilityCount: number;
  totalPipelineValue: number; avgRelocationTimeline: string;
  cityBreakdown: Array<{ city: string; count: number; avgProbability: number; totalValue: number }>;
  industryBreakdown: Array<{ industry: string; count: number; avgProbability: number; totalValue: number }>;
  signalTypeBreakdown: Array<{ signalType: string; count: number }>;
  topOpportunities: RelocationSignal[];
};

const TIER_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-zinc-600/20 text-zinc-400 border-zinc-600/40",
};
const SIGNAL_COLORS: Record<string, string> = {
  hiring_surge: "bg-purple-500/20 text-purple-300",
  job_growth: "bg-blue-500/20 text-blue-300",
  headcount_growth: "bg-cyan-500/20 text-cyan-300",
  expansion_news: "bg-emerald-500/20 text-emerald-300",
  press_announcement: "bg-pink-500/20 text-pink-300",
  lease_expiry: "bg-amber-500/20 text-amber-300",
  linkedin_growth: "bg-violet-500/20 text-violet-300",
  new_office: "bg-red-500/20 text-red-300",
  planning_permit: "bg-orange-500/20 text-orange-300",
  commercial_listing: "bg-teal-500/20 text-teal-300",
};

function formatCurrency(v?: number) {
  if (!v) return "—";
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

function ProbabilityBar({ value, tier }: { value: number; tier: string }) {
  const color = tier === "high" ? "bg-red-500" : tier === "medium" ? "bg-amber-500" : "bg-zinc-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} /></div>
      <span className="text-xs text-zinc-400 w-8 text-right">{value}%</span>
    </div>
  );
}

export default function AdminRelocationIntelligence() {
  const [authed, setAuthed] = useState(() => {
    const s = sessionStorage.getItem(AUTH_KEY);
    return s === `${ADMIN_EMAIL}:${ADMIN_PASS}` || s === "true";
  });
  const [pw, setPw] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [selectedSignal, setSelectedSignal] = useState<RelocationSignal | null>(null);
  const [view, setView] = useState<"signals" | "intelligence">("signals");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: signals = [], isLoading } = useQuery<RelocationSignal[]>({
    queryKey: ["/api/admin/relocation-signals", tierFilter, cityFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (tierFilter !== "all") params.set("tier", tierFilter);
      if (cityFilter !== "all") params.set("city", cityFilter);
      return fetch(`/api/admin/relocation-signals?${params}`).then(r => r.json());
    },
    enabled: authed,
  });

  const { data: intel, isLoading: intelLoading } = useQuery<MarketIntelligence>({
    queryKey: ["/api/admin/relocation-signals/market-intelligence"],
    enabled: authed && view === "intelligence",
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/relocation-signals/generate", { count: 15 }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/relocation-signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/relocation-signals/market-intelligence"] });
      toast({ title: `Generated ${data.generated} relocation signals` });
    },
  });

  const pushMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/relocation-signals/${id}/push-to-pipeline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/relocation-signals"] });
      setSelectedSignal(null);
      toast({ title: "Pushed to prospect pipeline" });
    },
  });

  const routeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/relocation-signals/${id}/route-to-partners`),
    onSuccess: (data: any) => {
      toast({ title: `Routed to ${data.routed} partners` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/relocation-signals/${id}`, { status: "dismissed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/relocation-signals"] });
      setSelectedSignal(null);
    },
  });

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center"><Radar className="w-5 h-5 text-red-400" /></div>
            <div><div className="text-white font-semibold">Relocation Intelligence</div><div className="text-zinc-500 text-sm">Admin access required</div></div>
          </div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Admin password" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm mb-3 outline-none" onKeyDown={e => { if (e.key === "Enter" && pw === ADMIN_PASS) { sessionStorage.setItem(AUTH_KEY, `${ADMIN_EMAIL}:${pw}`); setAuthed(true); } }} />
          <button onClick={() => { if (pw === ADMIN_PASS) { sessionStorage.setItem(AUTH_KEY, `${ADMIN_EMAIL}:${pw}`); setAuthed(true); } }} className="w-full bg-red-700 hover:bg-red-600 text-white rounded-xl py-3 text-sm font-medium">Access Relocation Intelligence</button>
        </div>
      </div>
    );
  }

  const activeSigs = signals.filter(s => s.status === "active");
  const cities = [...new Set(signals.map(s => s.city))].sort();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/command-centre" className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center"><Radar className="w-5 h-5 text-red-400" /></div>
              <div><div className="text-white font-semibold text-lg">Office Relocation Intelligence</div><div className="text-zinc-500 text-xs">Real-time market signals and relocation probability scoring</div></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors" data-testid="button-generate-signals">
              {generateMutation.isPending ? <><Sparkles className="w-4 h-4 animate-spin" /> Scanning...</> : <><Zap className="w-4 h-4" /> Generate Signals</>}
            </button>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/relocation-signals"] })} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>
        {/* Tab Bar */}
        <div className="max-w-screen-2xl mx-auto px-6 pb-0 flex items-center gap-1">
          {[{ id: "signals", label: "Signal Feed", icon: Activity }, { id: "intelligence", label: "Market Intelligence", icon: BarChart3 }].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as any)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${view === tab.id ? "border-red-500 text-white" : "border-transparent text-zinc-500 hover:text-white"}`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {view === "signals" && (
          <div className="space-y-6">
            {/* Quick Stats */}
            {signals.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Active Signals", value: activeSigs.length, icon: Activity, color: "red" },
                  { label: "High Probability", value: signals.filter(s => s.probabilityTier === "high").length, icon: AlertCircle, color: "amber" },
                  { label: "In Pipeline", value: signals.filter(s => s.pushedToPipeline).length, icon: CheckCircle, color: "emerald" },
                  { label: "Total Pipeline Value", value: formatCurrency(signals.reduce((s, r) => s + (r.estimatedProjectValue ?? 0), 0)), icon: DollarSign, color: "blue" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4`}>
                    <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center mb-3`}><Icon className={`w-4 h-4 text-${color}-400`} /></div>
                    <div className="text-xl font-bold text-white">{value}</div>
                    <div className="text-zinc-500 text-xs mt-1">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none" data-testid="select-tier-filter">
                <option value="all">All Tiers</option>
                <option value="high">High Probability</option>
                <option value="medium">Medium Probability</option>
                <option value="low">Low Probability</option>
              </select>
              {cities.length > 0 && (
                <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                  <option value="all">All Cities</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-28 animate-pulse" />)}</div>
            ) : activeSigs.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-16 text-center">
                <Radar className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <div className="text-zinc-300 font-medium text-lg mb-2">No signals detected</div>
                <p className="text-zinc-500 text-sm mb-6">Click "Generate Signals" to scan the Australian market for companies likely to relocate or expand.</p>
                <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="bg-red-700 hover:bg-red-600 text-white rounded-xl px-6 py-3 text-sm font-medium" data-testid="button-generate-empty">
                  {generateMutation.isPending ? "Scanning..." : "Generate First Signals"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeSigs.map(signal => (
                  <div key={signal.id} onClick={() => setSelectedSignal(signal)} className={`bg-zinc-900 border rounded-2xl p-5 cursor-pointer hover:border-zinc-600 transition-all ${selectedSignal?.id === signal.id ? "border-red-500/40" : signal.probabilityTier === "high" ? "border-red-500/20" : signal.probabilityTier === "medium" ? "border-amber-500/15" : "border-zinc-800"}`} data-testid={`card-signal-${signal.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold truncate">{signal.companyName}</div>
                        <div className="flex items-center gap-1.5 text-zinc-400 text-xs mt-0.5"><MapPin className="w-3 h-3" />{signal.city}{signal.state ? `, ${signal.state}` : ""}{signal.industry ? ` · ${signal.industry}` : ""}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${TIER_COLORS[signal.probabilityTier] ?? ""}`}>{signal.probabilityTier}</span>
                    </div>
                    <div className="mb-3"><ProbabilityBar value={signal.relocationProbability} tier={signal.probabilityTier} /></div>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded-lg ${SIGNAL_COLORS[signal.signalType] ?? "bg-zinc-700 text-zinc-300"}`}>{signal.signalType.replace(/_/g, " ")}</span>
                      {signal.estimatedTimeline && <span className="flex items-center gap-1 text-zinc-500 text-xs"><Clock className="w-3 h-3" />{signal.estimatedTimeline}</span>}
                      {signal.estimatedProjectValue && <span className="text-emerald-400 text-xs font-medium">{formatCurrency(signal.estimatedProjectValue)}</span>}
                    </div>
                    {signal.signalDetail && <p className="text-zinc-500 text-xs line-clamp-2">{signal.signalDetail}</p>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                      <div className="flex gap-1.5">
                        {!signal.pushedToPipeline && (
                          <button onClick={e => { e.stopPropagation(); pushMutation.mutate(signal.id); }} className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors" data-testid={`button-push-${signal.id}`}><ArrowRight className="w-3 h-3" /> Push to Pipeline</button>
                        )}
                        {signal.pushedToPipeline && <span className="flex items-center gap-1 text-emerald-500 text-xs"><CheckCircle className="w-3 h-3" /> In Pipeline</span>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); routeMutation.mutate(signal.id); }} className="flex items-center gap-1 bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 rounded-lg px-2 py-1.5 text-xs transition-colors"><Network className="w-3 h-3" /> Route</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "intelligence" && (
          <div className="space-y-6">
            {intelLoading ? (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-32 animate-pulse" />)}</div>
            ) : intel ? (
              <>
                {/* KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Active Signals", value: intel.totalSignals, icon: Activity, color: "red" },
                    { label: "High Probability", value: intel.highProbabilityCount, icon: AlertCircle, color: "amber" },
                    { label: "Total Pipeline Value", value: formatCurrency(intel.totalPipelineValue), icon: DollarSign, color: "emerald" },
                    { label: "Avg Timeline", value: intel.avgRelocationTimeline, icon: Clock, color: "blue" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                      <div className={`w-9 h-9 rounded-xl bg-${color}-500/10 flex items-center justify-center mb-3`}><Icon className={`w-5 h-5 text-${color}-400`} /></div>
                      <div className="text-2xl font-bold text-white">{value}</div>
                      <div className="text-zinc-500 text-sm mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* City Breakdown */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4"><MapPin className="w-4 h-4 text-red-400" /><span className="text-white font-medium">By City</span></div>
                    <div className="space-y-3">
                      {intel.cityBreakdown.slice(0, 8).map(({ city, count, avgProbability, totalValue }) => (
                        <div key={city}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-zinc-300 text-sm">{city}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-500 text-xs">{count} signal{count !== 1 ? "s" : ""}</span>
                              <span className="text-emerald-400 text-xs">{formatCurrency(totalValue)}</span>
                            </div>
                          </div>
                          <ProbabilityBar value={avgProbability} tier={avgProbability >= 65 ? "high" : avgProbability >= 35 ? "medium" : "low"} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Industry Breakdown */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4"><Briefcase className="w-4 h-4 text-blue-400" /><span className="text-white font-medium">By Industry</span></div>
                    <div className="space-y-3">
                      {intel.industryBreakdown.slice(0, 8).map(({ industry, count, avgProbability, totalValue }) => (
                        <div key={industry}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-zinc-300 text-sm">{industry}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-500 text-xs">{count} signal{count !== 1 ? "s" : ""}</span>
                              <span className="text-emerald-400 text-xs">{formatCurrency(totalValue)}</span>
                            </div>
                          </div>
                          <ProbabilityBar value={avgProbability} tier={avgProbability >= 65 ? "high" : avgProbability >= 35 ? "medium" : "low"} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Signal Types */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-violet-400" /><span className="text-white font-medium">Signal Types</span></div>
                    <div className="space-y-2">
                      {intel.signalTypeBreakdown.map(({ signalType, count }) => (
                        <div key={signalType} className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded-lg ${SIGNAL_COLORS[signalType] ?? "bg-zinc-700 text-zinc-300"}`}>{signalType.replace(/_/g, " ")}</span>
                          <span className="text-zinc-400 text-sm font-medium">{count}</span>
                        </div>
                      ))}
                    </div>

                    {/* Top Opportunities */}
                    {intel.topOpportunities.length > 0 && (
                      <div className="mt-5 pt-5 border-t border-zinc-800">
                        <div className="text-zinc-400 text-xs mb-3">Top Priority Signals</div>
                        <div className="space-y-2">
                          {intel.topOpportunities.slice(0, 5).map(sig => (
                            <div key={sig.id} className="flex items-center justify-between">
                              <div>
                                <div className="text-white text-xs font-medium">{sig.companyName}</div>
                                <div className="text-zinc-500 text-xs">{sig.city}</div>
                              </div>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${TIER_COLORS[sig.probabilityTier]}`}>{sig.relocationProbability}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-zinc-400">Generate signals first to see market intelligence</div>
            )}
          </div>
        )}
      </div>

      {/* Signal Detail Drawer */}
      {selectedSignal && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-zinc-950 border-l border-zinc-800 z-50 overflow-y-auto">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950">
            <span className="text-white font-medium">{selectedSignal.companyName}</span>
            <button onClick={() => setSelectedSignal(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm px-3 py-1 rounded-full border ${TIER_COLORS[selectedSignal.probabilityTier]}`}>{selectedSignal.probabilityTier} probability</span>
              <span className={`text-sm px-2 py-0.5 rounded-lg ${SIGNAL_COLORS[selectedSignal.signalType] ?? "bg-zinc-700 text-zinc-300"}`}>{selectedSignal.signalType.replace(/_/g, " ")}</span>
            </div>
            <div><ProbabilityBar value={selectedSignal.relocationProbability} tier={selectedSignal.probabilityTier} /></div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Location", value: `${selectedSignal.city}${selectedSignal.state ? `, ${selectedSignal.state}` : ""}` },
                { label: "Industry", value: selectedSignal.industry ?? "—" },
                { label: "Est. Headcount", value: selectedSignal.estimatedHeadcount ? `${selectedSignal.estimatedHeadcount.toLocaleString()} staff` : "—" },
                { label: "Office Size", value: selectedSignal.officeSizeSqm ? `${selectedSignal.officeSizeSqm} sqm` : "—" },
                { label: "Project Value", value: formatCurrency(selectedSignal.estimatedProjectValue) },
                { label: "Timeline", value: selectedSignal.estimatedTimeline ?? "—" },
                { label: "Signal Source", value: selectedSignal.signalSource ?? "—" },
                { label: "Job Postings", value: selectedSignal.jobPostingsCount ? String(selectedSignal.jobPostingsCount) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                  <div className="text-zinc-500 text-xs">{label}</div>
                  <div className="text-white text-sm mt-0.5">{value}</div>
                </div>
              ))}
            </div>
            {selectedSignal.signalDetail && (
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="text-zinc-500 text-xs mb-2">Signal Detail</div>
                <p className="text-zinc-300 text-sm leading-relaxed">{selectedSignal.signalDetail}</p>
              </div>
            )}
            {selectedSignal.recommendedAction && (
              <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20">
                <div className="text-blue-400 text-xs mb-2 font-medium">Recommended Action</div>
                <p className="text-zinc-300 text-sm leading-relaxed">{selectedSignal.recommendedAction}</p>
              </div>
            )}
            <div className="space-y-2 pt-2">
              {!selectedSignal.pushedToPipeline && (
                <button onClick={() => pushMutation.mutate(selectedSignal.id)} disabled={pushMutation.isPending} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-medium" data-testid={`button-push-detail-${selectedSignal.id}`}>
                  <ArrowRight className="w-4 h-4" /> {pushMutation.isPending ? "Pushing..." : "Push to Prospect Pipeline"}
                </button>
              )}
              {selectedSignal.pushedToPipeline && <div className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 rounded-xl py-3 text-sm"><CheckCircle className="w-4 h-4" /> Already in Pipeline</div>}
              <button onClick={() => routeMutation.mutate(selectedSignal.id)} disabled={routeMutation.isPending} className="w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-xl py-3 text-sm font-medium">
                <Network className="w-4 h-4" /> {routeMutation.isPending ? "Routing..." : "Route to Partner Network"}
              </button>
              <button onClick={() => deleteMutation.mutate(selectedSignal.id)} className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 rounded-xl py-3 text-sm">
                Dismiss Signal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
